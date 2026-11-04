"""Opt-in DCL exercises confined to ephemeral users and this run's schemas."""
import re
import secrets
import time

ACCOUNT = r"['`]?([A-Za-z][A-Za-z0-9_]{0,30})['`]?(?:\s*@\s*['`]?(localhost|127\.0\.0\.1)['`]?)?"
PRIVILEGES = re.compile(r'(?:ALL(?: PRIVILEGES)?|(?:SELECT|INSERT|UPDATE|DELETE)(?:\s*\([A-Za-z0-9_`, ]+\))?)(?:\s*,\s*(?:SELECT|INSERT|UPDATE|DELETE)(?:\s*\([A-Za-z0-9_`, ]+\))?)*', re.I)


def execute_dcl(session, sql, started):
    """Return None for ordinary SQL; accept only fully parsed, private DCL."""
    sql = (sql or "").strip().rstrip(";").strip()
    if not re.match(r'^(?:CREATE USER|DROP USER|ALTER USER|GRANT\b|REVOKE\b|SHOW GRANTS\b)', sql, re.I):
        return None
    if not session.allow_dcl:
        return session._failure('DCL is only enabled for explicit authorization exercises.', started, stmt=sql)
    connection = None
    try:
        create = re.fullmatch(r'CREATE\s+USER\s+(?:IF NOT EXISTS\s+)?' + ACCOUNT + r"\s+IDENTIFIED BY\s+'[^'\\]{1,100}'", sql, re.I)
        show = re.fullmatch(r'SHOW\s+GRANTS\s+FOR\s+' + ACCOUNT, sql, re.I)
        change = re.fullmatch(r'(GRANT|REVOKE)\s+(.+?)\s+ON\s+(?:([A-Za-z0-9_`]+)\s*\.\s*)?([A-Za-z0-9_`]+|\*)\s+(?:TO|FROM)\s+' + ACCOUNT, sql, re.I)
        drop = re.fullmatch(r'DROP\s+USER\s+(?:IF EXISTS\s+)?' + ACCOUNT, sql, re.I)
        if not any((create, show, change, drop)):
            raise ValueError('Use CREATE USER, SHOW GRANTS, schema-scoped GRANT/REVOKE or DROP USER. Global grants, grant options and arbitrary hosts are prohibited.')
        alias = (create or show or drop).group(1) if not change else change.group(5)
        alias = alias.lower()
        if alias in {'root', 'mysql', 'admin', 'administrator', 'sys', 'information_schema'} or alias == getattr(session, 'db_user', '').lower():
            raise ValueError('Only new exercise user aliases are allowed; existing administrator accounts are protected.')
        connection = session._open_admin_connection()
        with connection.cursor() as cur:
            if create:
                if alias in session.exercise_users or len(session.exercise_users) >= 4:
                    raise ValueError('Exercise users must be unique; maximum four per run.')
                actual = 'labd_' + session.session_token + '_' + str(len(session.exercise_users))
                password = secrets.token_urlsafe(24)
                cur.execute('CREATE USER %s@%s IDENTIFIED BY %s', (actual, 'localhost', password))
                session.exercise_users[alias] = (actual, password)
            else:
                if alias not in session.exercise_users:
                    raise ValueError('Create this exercise user in the current run first.')
                actual, _ = session.exercise_users[alias]
                if change:
                    verb, privileges, logical, table = change.group(1, 2, 3, 4)
                    if not PRIVILEGES.fullmatch(privileges.strip()):
                        raise ValueError('Only SELECT/INSERT/UPDATE/DELETE or schema-level ALL PRIVILEGES may be granted.')
                    if logical:
                        physical = session.schema_map.get(session._find_logical_schema(logical.strip('`')))
                    else:
                        physical = session.schema_map.get(session.active_schema)
                    if not physical:
                        raise ValueError('Grants are confined to the current run schemas.')
                    table = table.strip('`')
                    target = '*' if table == '*' else '`' + table + '`'
                    cur.execute(f'{verb} {privileges} ON `{physical}`.{target} ' + ('TO' if verb.upper() == 'GRANT' else 'FROM') + ' %s@%s', (actual, 'localhost'))
                elif show:
                    cur.execute('SHOW GRANTS FOR %s@%s', (actual, 'localhost'))
                    grants = [str(row[0]).replace(actual, alias) for row in cur.fetchall()]
                    for logical, physical in session.schema_map.items():
                        grants = [g.replace(physical, logical) for g in grants]
                    return session._ok(kind='SELECT', table='Grants', columns=['Grants'], rows=[{'Grants':g} for g in grants], rowcount=len(grants), message=f'{len(grants)} actual MySQL grants returned', started=started, stmt=sql)
                elif drop:
                    cur.execute('DROP USER %s@%s', (actual, 'localhost'))
                    del session.exercise_users[alias]
        return session._ok(kind='DCL', table='Privileges', columns=[], rows=[], rowcount=0, message='Applied to isolated MySQL exercise account; no global privileges changed.', started=started, stmt=sql)
    except Exception as error:
        return session._failure(str(error), started, stmt=sql)
    finally:
        if connection:
            connection.close()
