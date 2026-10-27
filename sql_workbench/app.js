// MySQL Workbench 8.0 - Relational SQL Engine & Interactive Workbench UI Controller

(function() {
  'use strict';

  // =========================================================================
  // 1. SQL STATEMENT SPLITTER & SCHEMA METADATA STORE
  // =========================================================================
  class SQLEngine {
    constructor() {
      this.reset();
    }

    reset() {
      this.schemas = {
        quickstartdb: {
          name: 'quickstartdb',
          tables: {}
        },
        sys: {
          name: 'sys',
          tables: {}
        }
      };
      this.activeSchema = 'quickstartdb';
    }

    // Resolve table case-insensitively
    getTable(rawName) {
      let schemaName = this.activeSchema;
      let tableName = rawName.trim().replace(/[`"']/g, '');

      if (tableName.includes('.')) {
        const parts = tableName.split('.');
        schemaName = parts[0].trim();
        tableName = parts[1].trim();
      }

      const schemaKey = Object.keys(this.schemas).find(
        k => k.toLowerCase() === schemaName.toLowerCase()
      );
      if (!schemaKey) {
        throw new Error(`Unknown database '${schemaName}'`);
      }
      const schema = this.schemas[schemaKey];

      const tableKey = Object.keys(schema.tables || {}).find(
        k => k.toLowerCase() === tableName.toLowerCase()
      );
      if (tableKey) {
        return {
          table: schema.tables[tableKey],
          schemaName: schemaKey,
          tableName: schema.tables[tableKey].name,
          isView: false
        };
      }
      const viewKey = Object.keys(schema.views || {}).find(
        k => k.toLowerCase() === tableName.toLowerCase()
      );
      if (viewKey) {
        return {
          table: schema.views[viewKey],
          schemaName: schemaKey,
          tableName: schema.views[viewKey].name,
          isView: true
        };
      }
      throw new Error(`Table '${schemaKey}.${tableName}' doesn't exist`);
    }

    // Split SQL script into individual statements preserving strings and comments
    splitStatements(sql) {
      const stmts = [];
      let current = '';
      let inStr = false;
      let strChar = '';
      let inLineComment = false;
      let inBlockComment = false;

      for (let i = 0; i < sql.length; i++) {
        const ch = sql[i];
        const next = sql[i + 1] || '';

        if (inLineComment) {
          if (ch === '\n') inLineComment = false;
          continue;
        }
        if (inBlockComment) {
          if (ch === '*' && next === '/') {
            inBlockComment = false;
            i++;
          }
          continue;
        }

        if (!inStr) {
          if (ch === '-' && next === '-') {
            inLineComment = true;
            i++;
            continue;
          }
          if (ch === '#') {
            inLineComment = true;
            continue;
          }
          if (ch === '/' && next === '*') {
            inBlockComment = true;
            i++;
            continue;
          }
          if (ch === "'" || ch === '"' || ch === '`') {
            inStr = true;
            strChar = ch;
            current += ch;
            continue;
          }
          if (ch === ';') {
            if (current.trim()) stmts.push(current.trim());
            current = '';
            continue;
          }
        } else {
          if (ch === strChar) {
            if (sql[i - 1] === '\\') {
              // escaped quote
            } else {
              inStr = false;
            }
          }
        }
        current += ch;
      }
      if (current.trim()) stmts.push(current.trim());
      return stmts;
    }

    // Direct JavaScript SQL simulation is disabled; real SQLite bridge is required.
    execute() {
      throw new Error('SQL runtime bridge (window.pySqliteBridge) is not connected.');
    }
  }

  // =========================================================================
  // 2. WORKBENCH APPLICATION CONTROLLER & UI BINDINGS
  // =========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    const engine = new SQLEngine();

    let actionCounter = 1;
    let resultSets = [];
    let activeResultIndex = -1;
    let editorStartLine = 1;
    let editorHighlightRange = null;

    // DOM Elements
    const sqlTextarea = document.getElementById('sql-textarea');
    const sqlHighlightLayer = document.getElementById('sql-highlight-layer');
    const codeGutter = document.getElementById('code-gutter');
    const schemaTreeEl = document.getElementById('schema-tree');
    const infoContentBox = document.getElementById('info-content-box');
    const resultGridThead = document.getElementById('result-grid-thead');
    const resultGridTbody = document.getElementById('result-grid-tbody');
    const rgSubTabs = document.getElementById('rg-sub-tabs');
    const actionOutputTbody = document.getElementById('action-output-tbody');

    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      const d = document.createElement('div');
      d.textContent = String(str);
      return d.innerHTML;
    }

    function getTimeString() {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      return `${hh}:${mm}:${ss}`;
    }

    // -----------------------------------------------------------------------
    // SYNTAX HIGHLIGHTING & GUTTER
    // -----------------------------------------------------------------------
    const SQL_KEYWORDS = new Set([
      'DROP', 'DATABASE', 'SCHEMA', 'IF', 'EXISTS', 'CREATE', 'USE', 'TABLE', 'SERIAL',
      'PRIMARY', 'KEY', 'VARCHAR', 'INTEGER', 'INT', 'TEXT', 'FLOAT', 'DOUBLE',
      'DECIMAL', 'BOOLEAN', 'DATE', 'DATETIME', 'TIMESTAMP', 'NOT', 'NULL',
      'AUTO_INCREMENT', 'DEFAULT', 'INSERT', 'INTO', 'VALUES', 'SELECT', 'FROM',
      'WHERE', 'AND', 'OR', 'ORDER', 'BY', 'ASC', 'DESC', 'LIMIT', 'UPDATE',
      'SET', 'DELETE', 'REPLACE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'ON', 'AS',
      'GROUP', 'HAVING', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'DISTINCT', 'SHOW',
      'DATABASES', 'SCHEMAS', 'TABLES', 'DESCRIBE', 'DESC', 'ALTER', 'ADD', 'COLUMN', 'LIKE',
      'OUTER', 'FULL', 'UNION', 'ALL', 'VIEW', 'FOREIGN', 'REFERENCES', 'CONSTRAINT',
      'UNIQUE', 'INDEX', 'CHECK', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'IS'
    ]);

    function highlightSqlLine(line) {
      const trimmed = line.trim();
      if (trimmed.startsWith('--') || trimmed.startsWith('#')) {
        return `<span class="sql-com">${escapeHtml(line)}</span>`;
      }
      const tokenRegex = /('[^']*'|"[^"]*"|--.*$|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b)/g;
      let out = '';
      let lastIdx = 0;
      let match;
      while ((match = tokenRegex.exec(line)) !== null) {
        if (match.index > lastIdx) {
          out += escapeHtml(line.slice(lastIdx, match.index));
        }
        const tok = match[0];
        if (tok.startsWith('--')) {
          out += `<span class="sql-com">${escapeHtml(tok)}</span>`;
        } else if (tok.startsWith("'") || tok.startsWith('"')) {
          out += `<span class="sql-str">${escapeHtml(tok)}</span>`;
        } else if (/^\d/.test(tok)) {
          out += `<span class="sql-num">${tok}</span>`;
        } else if (SQL_KEYWORDS.has(tok.toUpperCase())) {
          out += `<span class="sql-kw">${escapeHtml(tok)}</span>`;
        } else {
          out += `<span class="sql-ident">${escapeHtml(tok)}</span>`;
        }
        lastIdx = tokenRegex.lastIndex;
      }
      if (lastIdx < line.length) {
        out += escapeHtml(line.slice(lastIdx));
      }
      return out;
    }

    function syncEditorHighlightAndGutter() {
      if (!sqlTextarea || !sqlHighlightLayer || !codeGutter) return;
      const text = sqlTextarea.value;
      const lines = text.split('\n');

      sqlHighlightLayer.innerHTML = lines.map((line, idx) => {
        const lineNum = editorStartLine + idx;
        const isHighlighted = Array.isArray(editorHighlightRange) &&
          lineNum >= editorHighlightRange[0] &&
          lineNum <= editorHighlightRange[1];
        const html = highlightSqlLine(line);
        return isHighlighted ? `<span class="sql-active-stmt-line">${html || ' '}</span>` : html;
      }).join('\n') + (text.endsWith('\n') ? ' ' : '');

      let gutterHtml = '';
      lines.forEach((line, idx) => {
        const lineNum = editorStartLine + idx;
        const trimmed = line.trim();
        const isHighlighted = Array.isArray(editorHighlightRange) &&
          lineNum >= editorHighlightRange[0] &&
          lineNum <= editorHighlightRange[1];
        const hasStmtDot = trimmed.length > 0 && !trimmed.startsWith('--') && !trimmed.startsWith('#');
        gutterHtml += `<div class="gutter-item ${isHighlighted ? 'active-stmt-gutter' : ''}"><span class="line-num">${lineNum}</span><span class="exec-dot ${hasStmtDot ? 'active' : ''}"></span></div>`;
      });
      codeGutter.innerHTML = gutterHtml;

      sqlTextarea.style.height = 'auto';
      sqlTextarea.style.height = Math.max(180, lines.length * 17 + 16) + 'px';
    }

    if (sqlTextarea) {
      sqlTextarea.addEventListener('input', syncEditorHighlightAndGutter);
      sqlTextarea.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'Enter') {
          e.preventDefault();
          executeSqlScript(sqlTextarea.value, false);
        } else if (e.ctrlKey && e.key === 'Enter') {
          e.preventDefault();
          executeStatementUnderCursor();
        }
      });
    }

    // -----------------------------------------------------------------------
    // ACTION OUTPUT LOGGER
    // -----------------------------------------------------------------------
    function logAction(actionText, messageText, durationText, isSuccess = true) {
      if (!actionOutputTbody) return;
      const seq = actionCounter++;
      const timeStr = getTimeString();
      const iconFile = isSuccess ? 'status_ok.png' : 'status_error.png';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="status-cell">
          <img src="assets/icons/${iconFile}" width="13" height="13" alt="${isSuccess ? 'OK' : 'Error'}">
        </td>
        <td>${seq}</td>
        <td>${timeStr}</td>
        <td class="ao-action-text" title="${escapeHtml(actionText)}">${escapeHtml(actionText)}</td>
        <td title="${escapeHtml(messageText)}">${escapeHtml(messageText)}</td>
        <td>${escapeHtml(durationText)}</td>
      `;
      actionOutputTbody.appendChild(tr);

      const container = document.querySelector('.ao-table-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }

    // -----------------------------------------------------------------------
    // RESULT GRID & SUBTABS
    // -----------------------------------------------------------------------
    function renderResultSubTabs() {
      if (!rgSubTabs) return;
      rgSubTabs.innerHTML = '';
      resultSets.forEach((rs, idx) => {
        const btn = document.createElement('button');
        btn.className = `sub-tab ${idx === activeResultIndex ? 'active' : ''}`;
        btn.innerHTML = `${escapeHtml(rs.title)} <span class="tab-x" data-close-idx="${idx}">✕</span>`;
        btn.addEventListener('click', (e) => {
          if (e.target.dataset.closeIdx !== undefined) {
            e.stopPropagation();
            const cIdx = parseInt(e.target.dataset.closeIdx, 10);
            resultSets.splice(cIdx, 1);
            activeResultIndex = Math.min(activeResultIndex, resultSets.length - 1);
            renderResultSubTabs();
            renderActiveResultGrid();
            return;
          }
          activeResultIndex = idx;
          renderResultSubTabs();
          renderActiveResultGrid();
        });
        rgSubTabs.appendChild(btn);
      });
    }

    function renderActiveResultGrid() {
      if (!resultGridThead || !resultGridTbody) return;
      const rs = resultSets[activeResultIndex];
      if (!rs || !rs.columns || rs.columns.length === 0) {
        resultGridThead.innerHTML = '<tr><th class="col-num">#</th></tr>';
        resultGridTbody.innerHTML = '';
        return;
      }

      resultGridThead.innerHTML = `
        <tr>
          <th class="col-num">#</th>
          ${rs.columns.map(col => `<th class="col-field">${escapeHtml(col)}</th>`).join('')}
        </tr>
      `;

      resultGridTbody.innerHTML = '';
      rs.rows.forEach((row, rIdx) => {
        const isSelected = rIdx === 0;
        const tr = document.createElement('tr');
        tr.className = `rg-row ${isSelected ? 'selected-row' : ''}`;
        tr.innerHTML = `
          <td class="row-selector">${isSelected ? '▶' : ''}</td>
          ${rs.columns.map(col => {
            const val = row[col];
            const display = val === null || val === undefined ? 'NULL' : String(val);
            return `<td class="cell-data ${val === null ? 'null-val' : ''}" data-col="${escapeHtml(col)}" data-row="${rIdx}">${escapeHtml(display)}</td>`;
          }).join('')}
        `;
        tr.addEventListener('click', () => {
          resultGridTbody.querySelectorAll('.rg-row').forEach(r => {
            r.classList.remove('selected-row');
            const sel = r.querySelector('.row-selector');
            if (sel && sel.textContent === '▶') sel.textContent = '';
          });
          tr.classList.add('selected-row');
          const sel = tr.querySelector('.row-selector');
          if (sel) sel.textContent = '▶';
        });
        resultGridTbody.appendChild(tr);
      });

      // Trailing NULL insert row matching official MySQL Workbench 8.0
      const nullTr = document.createElement('tr');
      nullTr.className = 'rg-row null-row';
      nullTr.innerHTML = `
        <td class="row-selector">*</td>
        ${rs.columns.map(() => `<td class="null-val">NULL</td>`).join('')}
      `;
      resultGridTbody.appendChild(nullTr);
    }

    // -----------------------------------------------------------------------
    // SCHEMAS TREE & OBJECT INFO
    // -----------------------------------------------------------------------
    function renderSchemaTree() {
      if (!schemaTreeEl) return;
      const filterText = (document.getElementById('schema-filter-input')?.value || '').toLowerCase();
      schemaTreeEl.innerHTML = '';

      Object.keys(engine.schemas).forEach(schemaName => {
        const isExpanded = schemaName.toLowerCase() === engine.activeSchema.toLowerCase();
        const db = engine.schemas[schemaName];
        const tableNames = Object.keys(db.tables || {}).filter(t => t.toLowerCase().includes(filterText));
        const viewNames = Object.keys(db.views || {}).filter(v => v.toLowerCase().includes(filterText));
        const hasViews = viewNames.length > 0;

        const li = document.createElement('li');
        li.className = `schema-tree-node ${isExpanded ? 'expanded' : ''}`;
        li.dataset.name = schemaName;

        li.innerHTML = `
          <div class="tree-item-row" data-type="schema" data-schema="${escapeHtml(schemaName)}">
            <span class="tree-arrow">${isExpanded ? '▼' : '▶'}</span>
            <img src="assets/icons/db_schema.png" width="15" height="15" alt="">
            <span class="schema-title ${isExpanded ? 'bold-schema' : ''}">${escapeHtml(schemaName)}</span>
          </div>
          <ul class="schema-branch">
            <li class="schema-folder-node expanded">
              <div class="tree-item-row">
                <span class="tree-arrow">▼</span>
                <img src="assets/icons/db_table.png" width="14" height="14" alt="">
                <span class="folder-name">Tables</span>
              </div>
              <ul class="schema-leaf-list">
                ${tableNames.map((tKey, idx) => {
                  const tbl = db.tables[tKey];
                  return `
                    <li class="schema-leaf-node ${idx === 0 && isExpanded ? 'active-leaf' : ''}" data-table="${escapeHtml(tbl.name)}" data-schema="${escapeHtml(schemaName)}">
                      <div class="tree-item-row">
                        <img src="assets/icons/db_table.png" width="14" height="14" alt="">
                        <span class="leaf-name">${escapeHtml(tbl.name)}</span>
                        <div class="leaf-quick-actions">
                          <button class="leaf-act-btn" data-act="select" title="Select Rows - Limit 1000">▦</button>
                        </div>
                      </div>
                    </li>
                  `;
                }).join('')}
              </ul>
            </li>
            <li class="schema-folder-node ${hasViews ? 'expanded' : ''}">
              <div class="tree-item-row">
                <span class="tree-arrow">${hasViews ? '▼' : '▶'}</span>
                <img src="assets/icons/tb_add_view.png" width="14" height="14" alt="">
                <span class="folder-name">Views</span>
              </div>
              <ul class="schema-leaf-list">
                ${viewNames.map((vKey) => {
                  const vw = db.views[vKey];
                  return `
                    <li class="schema-leaf-node" data-table="${escapeHtml(vw.name)}" data-schema="${escapeHtml(schemaName)}">
                      <div class="tree-item-row">
                        <img src="assets/icons/tb_add_view.png" width="14" height="14" alt="">
                        <span class="leaf-name">${escapeHtml(vw.name)}</span>
                        <div class="leaf-quick-actions">
                          <button class="leaf-act-btn" data-act="select" title="Select Rows - Limit 1000">▦</button>
                        </div>
                      </div>
                    </li>
                  `;
                }).join('')}
              </ul>
            </li>
            <li class="schema-folder-node"><div class="tree-item-row"><span class="tree-arrow">▶</span><span class="folder-name">Stored Procedures</span></div></li>
            <li class="schema-folder-node"><div class="tree-item-row"><span class="tree-arrow">▶</span><span class="folder-name">Functions</span></div></li>
          </ul>
        `;

        const headerRow = li.querySelector('.tree-item-row[data-type="schema"]');
        headerRow.addEventListener('click', () => {
          li.classList.toggle('expanded');
          const arrow = headerRow.querySelector('.tree-arrow');
          if (arrow) arrow.textContent = li.classList.contains('expanded') ? '▼' : '▶';
        });

        li.querySelectorAll('.schema-leaf-node').forEach(leaf => {
          leaf.addEventListener('click', async (e) => {
            e.stopPropagation();
            const sName = leaf.dataset.schema;
            const tName = leaf.dataset.table;
            updateObjectInfo(sName, tName);

            if (e.target.closest('.leaf-act-btn')) {
              await executeSingleSql(`SELECT * FROM ${sName}.${tName}`);
              renderResultSubTabs();
              renderActiveResultGrid();
            }
          });
        });

        schemaTreeEl.appendChild(li);
      });

      // Update Object Info for first active table if available
      const activeDb = engine.schemas[engine.activeSchema];
      if (activeDb) {
        const firstTableKey = Object.keys(activeDb.tables)[0];
        if (firstTableKey) {
          updateObjectInfo(engine.activeSchema, activeDb.tables[firstTableKey].name);
        } else if (infoContentBox) {
          infoContentBox.innerHTML = '<div class="info-line" style="color:#666;">No object selected</div>';
        }
      }
    }

    function updateObjectInfo(schemaName, tableName) {
      if (!infoContentBox) return;
      try {
        const { table, isView } = engine.getTable(`${schemaName}.${tableName}`);
        infoContentBox.innerHTML = `
          <div class="info-line"><strong>${isView ? 'View' : 'Table'}:</strong> ${escapeHtml(schemaName)}.${escapeHtml(table.name)}</div>
          <div class="info-line"><strong>Rows:</strong> ${table.rows ? table.rows.length : 0}</div>
          <div class="info-line"><strong>Columns:</strong></div>
          ${table.columns.map(c => `<div class="info-line" style="padding-left:6px;">${escapeHtml(c.name)} <span style="color:#666;">${escapeHtml(c.type)}${c.isPk ? ' (PK)' : ''}</span></div>`).join('')}
        `;
      } catch (e) {
        // Ignored
      }
    }

    // -----------------------------------------------------------------------
    // EXECUTION DISPATCHERS
    // -----------------------------------------------------------------------
    async function executeSingleSql(stmtRaw) {
      const stmt = stmtRaw.trim().replace(/;$/, '');
      if (!stmt) return null;

      if (typeof window.pySqliteBridge !== 'function') {
        const errMsg = 'Error: SQL runtime bridge (window.pySqliteBridge) is not connected.';
        logAction(stmt, errMsg, '0.000 sec', false);
        return {
          success: false,
          error: errMsg,
          message: errMsg,
          duration: '0.000 sec',
          columns: [],
          rows: []
        };
      }

      try {
        const res = await window.pySqliteBridge(stmt);
        const isOk = Boolean(res && res.success !== false && !res.error);
        const displayQuery = isOk && res.type === 'SELECT' && !/LIMIT/i.test(stmt)
          ? `${stmt} LIMIT 0, 1000`
          : stmt;
        const msg = (res && (res.message || res.error)) || (isOk ? '0 row(s) affected' : 'Error executing SQL statement');

        logAction(displayQuery, msg, (res && res.duration) || '0.015 sec', isOk);

        if (isOk && res.type === 'SELECT' && Array.isArray(res.columns) && res.columns.length > 0) {
          const tName = res.tableName || 'Result';
          const tabCount = resultSets.filter(r => r.tableName === tName).length + 1;
          resultSets.push({
            title: `${tName} ${tabCount}`,
            tableName: tName,
            schemaName: res.schemaName || engine.activeSchema,
            columns: res.columns,
            rows: Array.isArray(res.rows) ? res.rows : []
          });
          activeResultIndex = resultSets.length - 1;
        }

        if (res && res.schemas) {
          engine.schemas = res.schemas;
        }
        if (res && res.activeSchema) {
          engine.activeSchema = res.activeSchema;
        }
        renderSchemaTree();
        return {
          ...res,
          success: isOk,
          error: isOk ? undefined : (res?.error || res?.message || msg),
          message: msg
        };
      } catch (err) {
        const errMsg = err && err.message ? err.message : String(err);
        logAction(stmt, `Error: ${errMsg}`, '0.000 sec', false);
        return { success: false, error: errMsg, message: `Error: ${errMsg}` };
      }
    }

    async function executeSqlScript(scriptText, clearPrevious = false) {
      if (clearPrevious) {
        resultSets = [];
        activeResultIndex = -1;
      }
      const stmts = engine.splitStatements(scriptText);
      const results = [];
      for (const stmt of stmts) {
        const r = await executeSingleSql(stmt);
        if (r) results.push(r);
      }

      renderResultSubTabs();
      renderActiveResultGrid();
      renderSchemaTree();
      return results;
    }

    async function executeStatementUnderCursor() {
      if (!sqlTextarea) return;
      const pos = sqlTextarea.selectionStart;
      const text = sqlTextarea.value;
      const before = text.slice(0, pos);
      const after = text.slice(pos);
      const startSemi = before.lastIndexOf(';');
      const endSemi = after.indexOf(';');
      const stmtSegment = (startSemi === -1 ? before : before.slice(startSemi + 1)) +
                          (endSemi === -1 ? after : after.slice(0, endSemi));
      const clean = stmtSegment
        .split('\n')
        .map(l => l.replace(/--.*$/, '').trim())
        .filter(Boolean)
        .join(' ')
        .trim();

      if (clean) {
        await executeSingleSql(clean);
        renderResultSubTabs();
        renderActiveResultGrid();
      }
    }

    // -----------------------------------------------------------------------
    // TOOLBAR & MENU HOOKS
    // -----------------------------------------------------------------------
    const btnExecAll = document.getElementById('btn-execute-all');
    const btnExecCurrent = document.getElementById('btn-execute-selection');
    const btnBeautify = document.getElementById('btn-beautify');
    const btnClearOutput = document.getElementById('ao-clear-btn');

    if (btnExecAll && sqlTextarea) {
      btnExecAll.addEventListener('click', () => executeSqlScript(sqlTextarea.value, false));
    }
    if (btnExecCurrent) {
      btnExecCurrent.addEventListener('click', () => executeStatementUnderCursor());
    }
    if (btnBeautify && sqlTextarea) {
      btnBeautify.addEventListener('click', () => {
        SQL_KEYWORDS.forEach(kw => {
          const reg = new RegExp(`\\b${kw}\\b`, 'gi');
          sqlTextarea.value = sqlTextarea.value.replace(reg, kw);
        });
        syncEditorHighlightAndGutter();
      });
    }
    if (btnClearOutput && actionOutputTbody) {
      btnClearOutput.addEventListener('click', () => {
        actionOutputTbody.innerHTML = '';
      });
    }

    // Panel toggles
    const toggleSidebarBtn = document.getElementById('toggle-sidebar');
    const toggleOutputBtn = document.getElementById('toggle-output');
    const toggleAdditionsBtn = document.getElementById('toggle-additions');
    const sidebarPanel = document.getElementById('sidebar-panel');
    const outputPanel = document.getElementById('output-panel');
    const additionsPanel = document.getElementById('additions-panel');

    function togglePanel(panelEl, btnEl) {
      if (!panelEl) return;
      const isHidden = panelEl.style.display === 'none';
      panelEl.style.display = isHidden ? 'flex' : 'none';
      if (btnEl) btnEl.classList.toggle('active', isHidden);
    }

    if (toggleSidebarBtn) toggleSidebarBtn.addEventListener('click', () => togglePanel(sidebarPanel, toggleSidebarBtn));
    if (toggleOutputBtn) toggleOutputBtn.addEventListener('click', () => togglePanel(outputPanel, toggleOutputBtn));
    if (toggleAdditionsBtn) toggleAdditionsBtn.addEventListener('click', () => togglePanel(additionsPanel, toggleAdditionsBtn));

    // Menubar dropdowns
    const menuItems = document.querySelectorAll('.wb-menubar .menu-item');
    menuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasActive = item.classList.contains('active');
        menuItems.forEach(m => m.classList.remove('active'));
        if (!wasActive) item.classList.add('active');
      });
    });
    document.addEventListener('click', () => menuItems.forEach(m => m.classList.remove('active')));

    // Schema search filter
    const schemaFilterInput = document.getElementById('schema-filter-input');
    if (schemaFilterInput) {
      schemaFilterInput.addEventListener('input', renderSchemaTree);
    }

    // Result Grid search filter
    const rgFilterInput = document.getElementById('rg-filter-input');
    if (rgFilterInput && resultGridTbody) {
      rgFilterInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        resultGridTbody.querySelectorAll('.rg-row:not(.null-row)').forEach(tr => {
          tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
      });
    }

    // -----------------------------------------------------------------------
    // INITIAL SYSTEM BOOT
    // -----------------------------------------------------------------------
    syncEditorHighlightAndGutter();
    renderSchemaTree();
    renderResultSubTabs();
    renderActiveResultGrid();

    // -----------------------------------------------------------------------
    // 3. GLOBAL AUTOMATION & TESTING API
    // -----------------------------------------------------------------------
    const WorkbenchAPI = {
      // Execute any SQL statement or multiline script
      async executeSQL(sql, clearPreviousResults = false) {
        if (sqlTextarea && sql !== undefined) {
          sqlTextarea.value = sql;
          syncEditorHighlightAndGutter();
        }
        const textToRun = sql !== undefined ? sql : (sqlTextarea ? sqlTextarea.value : '');
        const results = await executeSqlScript(textToRun, clearPreviousResults);
        return {
          success: results.every(r => r.success !== false),
          results,
          activeSchema: engine.activeSchema,
          currentResultSet: resultSets[activeResultIndex] || null,
          allResultSets: resultSets,
          actionCount: actionCounter - 1
        };
      },

      // Set editor text with syntax highlight and line numbers
      setEditorSQL(sql) {
        if (sqlTextarea) {
          sqlTextarea.value = sql;
          syncEditorHighlightAndGutter();
        }
      },

      getEditorSQL() {
        return sqlTextarea ? sqlTextarea.value : '';
      },

      // Returns the currently visible result grid table data
      getResultGridData() {
        const rs = resultSets[activeResultIndex];
        if (!rs) return { columns: [], rows: [] };
        return {
          title: rs.title,
          tableName: rs.tableName,
          columns: rs.columns,
          rows: rs.rows
        };
      },

      // Returns action log history
      getActionLog() {
        if (!actionOutputTbody) return [];
        const logs = [];
        actionOutputTbody.querySelectorAll('tr').forEach(tr => {
          const cells = tr.querySelectorAll('td');
          if (cells.length >= 6) {
            logs.push({
              status: cells[0].querySelector('img')?.alt || 'OK',
              num: parseInt(cells[1].textContent, 10),
              time: cells[2].textContent,
              action: cells[3].textContent,
              message: cells[4].textContent,
              duration: cells[5].textContent
            });
          }
        });
        return logs;
      },

      // Reset database and UI to initial state
      reset() {
        engine.reset();
        resultSets = [];
        activeResultIndex = -1;
        actionCounter = 1;
        editorStartLine = 1;
        editorHighlightRange = null;
        if (actionOutputTbody) actionOutputTbody.innerHTML = '';
        renderSchemaTree();
        renderResultSubTabs();
        renderActiveResultGrid();
      },

      // Deterministically render a Workbench state from a stored MySQL execution receipt
      renderFrame(frameConfig = {}) {
        const connNameEl = document.querySelector('.conn-name');
        if (connNameEl && frameConfig.connectionTitle) {
          connNameEl.textContent = frameConfig.connectionTitle;
        }
        const tabTitleEl = document.querySelector('.editor-tab.active .tab-title');
        if (tabTitleEl && frameConfig.tabTitle) {
          tabTitleEl.textContent = frameConfig.tabTitle;
        }
        const serverStatusItem = document.querySelector('.nav-item-clickable[data-info^="Server Status"]');
        if (serverStatusItem && frameConfig.serverVersion) {
          serverStatusItem.setAttribute('data-info', `Server Status: Running (MySQL ${frameConfig.serverVersion})`);
        }

        const codeSectionEl = document.getElementById('wb-code-section');
        const resultPaneEl = document.getElementById('result-pane');
        const outputPanelEl = document.getElementById('output-panel');
        if (codeSectionEl && resultPaneEl && outputPanelEl) {
          if (frameConfig.layoutMode === 'code') {
            codeSectionEl.style.height = '425px';
            codeSectionEl.style.flex = '0 0 425px';
            codeSectionEl.style.minHeight = '425px';
            resultPaneEl.style.height = '167px';
            resultPaneEl.style.flex = '0 0 167px';
            outputPanelEl.style.height = '155px';
            outputPanelEl.style.flex = '0 0 155px';
          } else if (frameConfig.layoutMode === 'result') {
            codeSectionEl.style.height = '200px';
            codeSectionEl.style.flex = '0 0 200px';
            codeSectionEl.style.minHeight = '200px';
            resultPaneEl.style.height = '392px';
            resultPaneEl.style.flex = '0 0 392px';
            outputPanelEl.style.height = '155px';
            outputPanelEl.style.flex = '0 0 155px';
          }
        }

        editorStartLine = Number(frameConfig.startLine) || 1;
        editorHighlightRange = Array.isArray(frameConfig.highlightRange) ? frameConfig.highlightRange : null;
        if (sqlTextarea && frameConfig.editorSql !== undefined) {
          sqlTextarea.value = frameConfig.editorSql;
          syncEditorHighlightAndGutter();
        }
        if (codeSectionEl) {
          codeSectionEl.scrollTop = 0;
        }

        if (frameConfig.schemas) {
          engine.schemas = frameConfig.schemas;
        }
        if (frameConfig.activeSchema) {
          engine.activeSchema = frameConfig.activeSchema;
        }
        renderSchemaTree();

        if (frameConfig.focusObject) {
          updateObjectInfo(engine.activeSchema, frameConfig.focusObject);
          document.querySelectorAll('.schema-leaf-node').forEach(leaf => {
            const matches = (leaf.dataset.table || '').toLowerCase() === String(frameConfig.focusObject).toLowerCase();
            leaf.classList.toggle('active-leaf', matches);
          });
        }

        if (Array.isArray(frameConfig.resultSets)) {
          resultSets = frameConfig.resultSets;
          activeResultIndex = typeof frameConfig.activeResultIndex === 'number'
            ? frameConfig.activeResultIndex
            : (resultSets.length - 1);
          renderResultSubTabs();
          renderActiveResultGrid();
        }

        if (Array.isArray(frameConfig.actionLogs) && actionOutputTbody) {
          actionOutputTbody.innerHTML = '';
          actionCounter = frameConfig.actionLogs.length + 1;
          frameConfig.actionLogs.forEach((entry, idx) => {
            const isOk = entry.success !== false;
            const iconFile = isOk ? 'status_ok.png' : 'status_error.png';
            const tr = document.createElement('tr');
            if (entry.isCurrent || idx === frameConfig.actionLogs.length - 1) {
              tr.className = 'ao-row-current';
            }
            tr.innerHTML = `
              <td class="status-cell">
                <img src="assets/icons/${iconFile}" width="13" height="13" alt="${isOk ? 'OK' : 'Error'}">
              </td>
              <td>${entry.seq || (idx + 1)}</td>
              <td>${escapeHtml(entry.time || getTimeString())}</td>
              <td class="ao-action-text" title="${escapeHtml(entry.action || '')}">${escapeHtml(entry.action || '')}</td>
              <td title="${escapeHtml(entry.message || '')}">${escapeHtml(entry.message || '')}</td>
              <td>${escapeHtml(entry.duration || '0.001 sec')}</td>
            `;
            actionOutputTbody.appendChild(tr);
          });
          const aoContainer = document.querySelector('.ao-table-container');
          if (aoContainer) {
            aoContainer.scrollTop = aoContainer.scrollHeight;
          }
        }
      },

      // Raw engine reference
      getEngine: () => engine,
      getResultSets: () => resultSets,
      getActiveSchema: () => engine.activeSchema
    };

    window.MySQLWorkbench = WorkbenchAPI;
    window.workbenchApp = WorkbenchAPI; // backwards-compatibility
  });
})();
