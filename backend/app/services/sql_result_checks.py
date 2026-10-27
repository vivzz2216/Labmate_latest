"""Independent checks over stored input tables, never model-written row counts."""
import re
from collections import Counter


def join_expected(statement, tables, mode=None):
    sql = statement.replace('`', '')
    sql = re.split(r'\bUNION\b', sql, maxsplit=1, flags=re.I)[0]
    pattern = (r'^SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+(?:AS\s+)?(?!INNER\b|LEFT\b|RIGHT\b)(\w+))?\s+'
               r'(INNER|LEFT|RIGHT)(?:\s+OUTER)?\s+JOIN\s+(\w+)(?:\s+(?:AS\s+)?(?!ON\b)(\w+))?\s+'
               r'ON\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)')
    m = re.match(pattern, sql.strip(), re.I | re.S)
    if not m:
        return None
    projection, left, la, kind, right, ra, a1, k1, a2, k2 = m.groups()
    left, right, la, ra = left.lower(), right.lower(), (la or left).lower(), (ra or right).lower()
    available = {k.lower(): v for k, v in tables.items()}
    if left not in available or right not in available:
        return None
    lt, rt = available[left], available[right]
    # Snapshots contain at most 100 rows. Never certify a potentially truncated sample.
    if len(lt.get('rows', [])) >= 100 or len(rt.get('rows', [])) >= 100:
        return None
    aliases = {left: 'l', la: 'l', right: 'r', ra: 'r'}
    expressions = []
    for expr in projection.split(','):
        field = re.fullmatch(r'\s*(\w+)\.(\w+)(?:\s+(?:AS\s+)?\w+)?\s*', expr, re.I)
        if not field or field.group(1).lower() not in aliases:
            return None
        expressions.append((aliases[field.group(1).lower()], field.group(2).lower()))
    if a1.lower() not in aliases or a2.lower() not in aliases or aliases[a1.lower()] == aliases[a2.lower()]:
        return None
    lk, rk = (k1, k2) if aliases[a1.lower()] == 'l' else (k2, k1)
    def normalized(rows):return [{k.lower():v for k,v in row.items()} for row in rows]
    ls, rs = normalized(lt['rows']), normalized(rt['rows'])
    pairs, seen_right = [], set()
    kind = mode or kind.upper()
    for l in ls:
        matched = False
        for index, r in enumerate(rs):
            if l.get(lk.lower()) is not None and l.get(lk.lower()) == r.get(rk.lower()):
                pairs.append((l, r));matched = True;seen_right.add(index)
        if not matched and kind in {'LEFT', 'FULL'}:pairs.append((l, {}))
    if kind in {'RIGHT', 'FULL'}:
        pairs.extend(({}, r) for index, r in enumerate(rs) if index not in seen_right)
    return [tuple((l if side == 'l' else r).get(column) for side,column in expressions) for l,r in pairs]


def independent_checks(statements):
    checks = []
    for step in statements:
        sql, rows = step.get('statement', ''), step.get('rows', [])
        snap = step.get('schemas_snapshot') or {}
        db = snap.get(step.get('active_schema', 'lab')) or next(iter(snap.values()), {})
        tables = db.get('tables', {})
        if step.get('success') and step.get('columns') and re.search(r'\bJOIN\b', sql, re.I):
            full = bool(re.search(r'\bUNION\s+ALL\b', sql, re.I))
            expected = join_expected(sql, tables, 'FULL' if full else None)
            if expected is not None:
                actual = [tuple(row.get(column) for column in step['columns']) for row in rows]
                ok = Counter(actual) == Counter(expected)
                detail = f'{len(actual)} observed rows; {len(expected)} independently derived rows. Complete projected rows compared, including NULLs and duplicates.'
                if not ok and full:detail += ' Correct the FULL OUTER emulation: Customers LEFT JOIN Orders UNION ALL Customers RIGHT JOIN Orders WHERE Customers.CustomerID IS NULL. Do not repeat unmatched Customers in the second branch; include unmatched Orders.'
                checks.append({'name': f"Query {step['index']} join values and multiplicities", 'passed': ok, 'detail':detail})
        if re.search(r'\bHAVING\s+COUNT\([^)]*\)\s*>\s*5\b', sql, re.I):
            checks.append({'name':'HAVING demonstration dataset', 'passed':bool(rows),
                           'detail':'A group satisfies COUNT > 5.' if rows else 'SQL executed, but no group passes HAVING COUNT > 5. Seed at least six customers in one country and rerun.'})
        table_lookup = {k.lower():v for k,v in tables.items()}
        if re.search(r'\bFROM\s+`?WorkCenterStats`?\b', sql, re.I) and rows:
            centers = table_lookup.get('workcenters', {}).get('rows', [])
            expected = sum(next((v for k,v in row.items() if k.lower() == 'capacity'), 0) or 0 for row in centers)
            totals = [v for row in rows for k,v in row.items() if k.lower() == 'totalcapacity']
            checks.append({'name':'Trigger accumulated capacity', 'passed':totals == [expected],
                           'detail':f'Sum of saved WorkCenters capacities is {expected}; observed totalCapacity values {totals}.'})
    return checks
