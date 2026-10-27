// Google Colaboratory Pro Dark Mode - Interactive Runtime & Notebook Engine

document.addEventListener('DOMContentLoaded', () => {
  let executionCounter = 0;
  let isConnected = false;
  let cellIdCounter = 1;

  // Persistent Python Session State (populated from real runtime bridge when available)
  const pySession = {
    vars: {},
    types: {},
    history: []
  };

  // DOM Elements
  const cellsContainer = document.getElementById('cells-container');
  const connectBtn = document.getElementById('btn-connect');
  const connectCaretBtn = document.getElementById('btn-connect-caret');
  const connectLabel = document.getElementById('connect-label');
  const connectedMeters = document.getElementById('connected-meters');
  const runtimePopover = document.getElementById('runtime-popover');
  const footerRuntimeStatus = document.getElementById('footer-runtime-status');
  const saveStatusText = document.getElementById('save-status-text');

  // =========================================================
  // 1. RUNTIME CONNECTION ENGINE
  // =========================================================
  function hasRealColabBridge() {
    return typeof window.pyColabBridge === 'function';
  }

  function setConnectedUi(connected, statusLabel) {
    isConnected = Boolean(connected);
    if (isConnected) {
      if (connectLabel) connectLabel.style.display = 'none';
      if (connectedMeters) connectedMeters.style.display = 'flex';
      if (footerRuntimeStatus) footerRuntimeStatus.textContent = statusLabel || 'Python 3 • Connected';
    } else {
      if (connectLabel) {
        connectLabel.style.display = 'inline';
        connectLabel.textContent = statusLabel || 'Connect';
      }
      if (connectedMeters) connectedMeters.style.display = 'none';
      if (footerRuntimeStatus) footerRuntimeStatus.textContent = statusLabel || '';
    }
  }

  function connectRuntime(callback) {
    if (!hasRealColabBridge()) {
      setConnectedUi(false, 'Runtime not connected');
      if (callback) callback(false);
      return;
    }
    if (isConnected) {
      if (callback) callback(true);
      return;
    }
    setConnectedUi(true, 'Python 3 • Connected');
    if (callback) callback(true);
  }

  function disconnectRuntime() {
    executionCounter = 0;
    pySession.vars = {};
    pySession.types = {};
    setConnectedUi(false, 'Connect');
    if (runtimePopover) runtimePopover.classList.remove('open');
  }

  if (connectBtn) {
    connectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isConnected) {
        connectRuntime();
      } else if (runtimePopover) {
        runtimePopover.classList.toggle('open');
      }
    });
  }

  if (connectCaretBtn && runtimePopover) {
    connectCaretBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      runtimePopover.classList.toggle('open');
    });
    runtimePopover.addEventListener('click', (e) => e.stopPropagation());
  }

  const btnDisconnectRt = document.getElementById('btn-disconnect-rt');
  if (btnDisconnectRt) {
    btnDisconnectRt.addEventListener('click', () => disconnectRuntime());
  }

  // =========================================================
  // 2. HTML & MARKDOWN SANITIZATION + FORMATTING HELPERS
  // =========================================================
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }

  function formatPyValue(val, isRepr) {
    if (val === null || val === undefined) return isRepr ? '' : 'None';
    if (typeof val === 'boolean') return val ? 'True' : 'False';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'string') return isRepr ? `'${val}'` : val;
    if (Array.isArray(val)) {
      return `[${val.map(v => formatPyValue(v, true)).join(', ')}]`;
    }
    if (typeof val === 'object') {
      const entries = Object.entries(val).map(([k, v]) => `'${k}': ${formatPyValue(v, true)}`);
      return `{${entries.join(', ')}}`;
    }
    return String(val);
  }

  const ALLOWED_HTML_TAGS = new Set([
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'P', 'BR', 'HR', 'DIV', 'SPAN',
    'STRONG', 'B', 'EM', 'I', 'U', 'CODE', 'PRE', 'BLOCKQUOTE',
    'UL', 'OL', 'LI',
    'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'CAPTION', 'COLGROUP', 'COL',
    'A', 'SUB', 'SUP'
  ]);

  const ALLOWED_HTML_ATTRS = new Set([
    'class', 'colspan', 'rowspan', 'scope', 'align', 'title', 'href', 'border'
  ]);

  function isSafeHref(url) {
    const cleaned = String(url || '').replace(/[\u0000-\u0020]+/g, '').toLowerCase();
    if (!cleaned) return false;
    if (cleaned.startsWith('#') || cleaned.startsWith('/') || cleaned.startsWith('./') || cleaned.startsWith('../')) {
      return true;
    }
    return cleaned.startsWith('http://') || cleaned.startsWith('https://') || cleaned.startsWith('mailto:');
  }

  function sanitizeHtmlFragment(dirtyHtml) {
    if (!dirtyHtml) return '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(dirtyHtml), 'text/html');

    function cleanNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return document.createTextNode(node.textContent || '');
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return null;
      }
      const tag = node.tagName.toUpperCase();
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'IFRAME' || tag === 'OBJECT' || tag === 'EMBED' || tag === 'SVG' || tag === 'MATH' || tag === 'FORM' || tag === 'INPUT' || tag === 'BUTTON' || tag === 'TEXTAREA' || tag === 'LINK' || tag === 'META' || tag === 'BASE') {
        return null;
      }

      if (!ALLOWED_HTML_TAGS.has(tag)) {
        const frag = document.createDocumentFragment();
        Array.from(node.childNodes).forEach(child => {
          const cleanedChild = cleanNode(child);
          if (cleanedChild) frag.appendChild(cleanedChild);
        });
        return frag;
      }

      const el = document.createElement(tag.toLowerCase());
      Array.from(node.attributes).forEach(attr => {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on') || !ALLOWED_HTML_ATTRS.has(name)) {
          return;
        }
        if (name === 'href') {
          if (isSafeHref(attr.value)) {
            el.setAttribute('href', attr.value.trim());
            el.setAttribute('rel', 'noopener noreferrer');
          }
          return;
        }
        el.setAttribute(name, attr.value);
      });

      Array.from(node.childNodes).forEach(child => {
        const cleanedChild = cleanNode(child);
        if (cleanedChild) el.appendChild(cleanedChild);
      });
      return el;
    }

    const container = document.createElement('div');
    Array.from(doc.body.childNodes).forEach(child => {
      const cleaned = cleanNode(child);
      if (cleaned) container.appendChild(cleaned);
    });
    return container.innerHTML;
  }

  function renderSafeMarkdownOrHtml(input) {
    const raw = String(input || '');
    if (!raw.trim()) return '';
    // If input does not contain HTML tags, convert basic Markdown headings/paragraphs/lists safely
    if (!/<[a-zA-Z!/]/.test(raw)) {
      const lines = raw.split('\n');
      const htmlParts = [];
      for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        if (t.startsWith('### ')) {
          htmlParts.push(`<h3>${escapeHtml(t.slice(4))}</h3>`);
        } else if (t.startsWith('## ')) {
          htmlParts.push(`<h2>${escapeHtml(t.slice(3))}</h2>`);
        } else if (t.startsWith('# ')) {
          htmlParts.push(`<h1>${escapeHtml(t.slice(2))}</h1>`);
        } else {
          htmlParts.push(`<p>${escapeHtml(line)}</p>`);
        }
      }
      return htmlParts.join('');
    }
    return sanitizeHtmlFragment(raw);
  }

  function isSafePlotSrc(src) {
    if (typeof src !== 'string') return false;
    const trimmed = src.trim();
    if (trimmed.startsWith('data:image/png;base64,') || trimmed.startsWith('data:image/jpeg;base64,') || trimmed.startsWith('data:image/webp;base64,')) {
      return true;
    }
    return /^[A-Za-z0-9+/=\s]+$/.test(trimmed) && trimmed.length > 16;
  }

  // =========================================================
  // 3. CELL INTERACTION, EXECUTION & DYNAMIC CREATION
  // =========================================================
  function autoResizeTextarea(ta) {
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.max(20, ta.scrollHeight) + 'px';
  }

  function highlightPython(code) {
    if (!code) return '';
    return code.split('\n').map(line => {
      if (line.trim().startsWith('#')) {
        return `<span class="tok-com">${escapeHtml(line)}</span>`;
      }
      // Tokenize strings, keywords, classes, builtins, modules, numbers
      const tokenRegex = /(f?"[^"]*"|f?'[^']*'|#.*$|\b(?:import|from|as|for|in|if|elif|else|while|return|with|try|except|finally|yield|lambda|pass|break|continue)\b|\b(?:def|class|True|False|None|and|or|not|is)\b|\b(?:LabelEncoder|StandardScaler|MinMaxScaler|GaussianNB|MultinomialNB|SVC|LinearSVC|KNeighborsClassifier|LinearRegression|LogisticRegression|DecisionTreeClassifier|RandomForestClassifier|KMeans|PCA|DataFrame|Series|Tensor)\b|\b(?:print|range|len|sum|min|max|abs|round|randn|cos|sin|tan|linspace|arange|array|tensor|zeros|ones|read_csv|fillna|drop|mean|fit|predict|fit_transform|transform|train_test_split|accuracy_score|r2_score|mean_squared_error|confusion_matrix|classification_report|head|tail|describe|info|groupby|plot|scatter|bar|hist|xlabel|ylabel|title|legend|show|figure|subplots)\b|\b(?:torch|numpy|np|pandas|pd|math|plt|matplotlib|pyplot|sklearn|seaborn|sns|scipy|metrics|preprocessing|model_selection|naive_bayes|svm|neighbors|linear_model|tree|ensemble|cluster)\b|\b\d+(?:\.\d+)?\b)/g;
      let result = '';
      let lastIdx = 0;
      let match;
      while ((match = tokenRegex.exec(line)) !== null) {
        if (match.index > lastIdx) {
          result += escapeHtml(line.slice(lastIdx, match.index));
        }
        const tok = match[0];
        if (tok.startsWith('#')) {
          result += `<span class="tok-com">${escapeHtml(tok)}</span>`;
        } else if (tok.startsWith('"') || tok.startsWith("'") || tok.startsWith('f"') || tok.startsWith("f'")) {
          result += `<span class="tok-str">${escapeHtml(tok)}</span>`;
        } else if (/^(import|from|as|for|in|if|elif|else|while|return|with|try|except|finally|yield|lambda|pass|break|continue)$/.test(tok)) {
          result += `<span class="tok-kw">${tok}</span>`;
        } else if (/^(def|class|True|False|None|and|or|not|is)$/.test(tok)) {
          result += `<span class="tok-def">${tok}</span>`;
        } else if (/^(LabelEncoder|StandardScaler|MinMaxScaler|GaussianNB|MultinomialNB|SVC|LinearSVC|KNeighborsClassifier|LinearRegression|LogisticRegression|DecisionTreeClassifier|RandomForestClassifier|KMeans|PCA|DataFrame|Series|Tensor)$/.test(tok)) {
          result += `<span class="tok-cls">${tok}</span>`;
        } else if (/^(print|range|len|sum|min|max|abs|round|randn|cos|sin|tan|linspace|arange|array|tensor|zeros|ones|read_csv|fillna|drop|mean|fit|predict|fit_transform|transform|train_test_split|accuracy_score|r2_score|mean_squared_error|confusion_matrix|classification_report|head|tail|describe|info|groupby|plot|scatter|bar|hist|xlabel|ylabel|title|legend|show|figure|subplots)$/.test(tok)) {
          result += `<span class="tok-fn">${tok}</span>`;
        } else if (/^(torch|numpy|np|pandas|pd|math|plt|matplotlib|pyplot|sklearn|seaborn|sns|scipy|metrics|preprocessing|model_selection|naive_bayes|svm|neighbors|linear_model|tree|ensemble|cluster)$/.test(tok)) {
          result += `<span class="tok-mod">${tok}</span>`;
        } else if (/^\d/.test(tok)) {
          result += `<span class="tok-num">${tok}</span>`;
        } else {
          result += escapeHtml(tok);
        }
        lastIdx = tokenRegex.lastIndex;
      }
      if (lastIdx < line.length) {
        result += escapeHtml(line.slice(lastIdx));
      }
      return result;
    }).join('\n');
  }

  function renderCellOutput(cell, result, execNum, execTime = '0s') {
    const playBtn = cell.querySelector('.cell-play-btn');
    const bracketInd = cell.querySelector('.cell-bracket-indicator');
    const checkInd = cell.querySelector('.cell-status-check');
    const timeInd = cell.querySelector('.cell-exec-time');
    const outputWrapper = cell.querySelector('.cell-output-wrapper');
    const outputContent = cell.querySelector('.cell-output-content');

    if (playBtn) {
      playBtn.classList.remove('running');
      playBtn.innerHTML = `
        <svg class="play-icon" viewBox="0 0 24 24" width="12" height="12">
          <path d="M8 5v14l11-7z" fill="#1e1f20"/>
        </svg>
      `;
    }

    const hasError = Boolean(result && result.error);
    cell.classList.toggle('cell-error', hasError);
    cell.dataset.status = hasError ? 'error' : 'ok';

    if (hasError) {
      if (bracketInd) bracketInd.textContent = execNum !== undefined && execNum !== null ? `[${execNum}]` : '[!]';
      if (checkInd) {
        checkInd.style.display = 'inline';
        checkInd.textContent = '✕';
        checkInd.classList.add('error');
      }
      if (timeInd) {
        timeInd.style.display = 'inline';
        timeInd.textContent = execTime || '0s';
      }
    } else if (execNum !== undefined && execNum !== null) {
      if (bracketInd) bracketInd.textContent = `[${execNum}]`;
      if (checkInd) {
        checkInd.style.display = 'inline';
        checkInd.textContent = '✓';
        checkInd.classList.remove('error');
      }
      if (timeInd) {
        timeInd.style.display = 'inline';
        timeInd.textContent = execTime || '0s';
      }
    }

    const plots = Array.isArray(result && result.plots) ? result.plots.filter(isSafePlotSrc) : [];
    const safeHtml = result && result.html ? sanitizeHtmlFragment(result.html) : '';
    const hasOutput = Boolean(
      result && (result.stdout || result.repr || safeHtml || result.error || plots.length > 0)
    );

    if (outputWrapper && outputContent) {
      if (hasOutput) {
        outputWrapper.style.display = 'flex';
        outputContent.innerHTML = '';

        if (result.stdout) {
          const outDiv = document.createElement('div');
          outDiv.textContent = result.stdout;
          outputContent.appendChild(outDiv);
        }
        if (safeHtml) {
          const htmlDiv = document.createElement('div');
          htmlDiv.innerHTML = safeHtml;
          outputContent.appendChild(htmlDiv);
        } else if (result.repr) {
          const reprDiv = document.createElement('div');
          reprDiv.className = 'output-repr';
          reprDiv.textContent = result.repr;
          outputContent.appendChild(reprDiv);
        }
        if (plots.length > 0) {
          const plotContainer = document.createElement('div');
          plotContainer.className = 'colab-plot-container';
          plots.forEach(src => {
            const img = document.createElement('img');
            img.className = 'colab-plot-img';
            const cleanSrc = src.trim();
            img.src = cleanSrc.startsWith('data:image') ? cleanSrc : `data:image/png;base64,${cleanSrc}`;
            img.alt = 'Matplotlib plot output';
            plotContainer.appendChild(img);
          });
          outputContent.appendChild(plotContainer);
        }
        if (result.error) {
          const errDiv = document.createElement('div');
          errDiv.className = 'output-error';
          errDiv.textContent = result.error;
          outputContent.appendChild(errDiv);
        }
      } else {
        outputWrapper.style.display = 'none';
        outputContent.innerHTML = '';
      }
    }
  }

  function syncPlaceholder(cell) {
    const ta = cell.querySelector('.cell-code-textarea');
    const ph = cell.querySelector('.cell-placeholder');
    const hl = cell.querySelector('.cell-code-highlight');
    if (ta && ph) {
      ph.style.display = ta.value.length > 0 ? 'none' : 'block';
    }
    if (ta && hl) {
      hl.innerHTML = highlightPython(ta.value) + (ta.value.endsWith('\n') ? ' ' : '');
    }
  }

  function focusCell(cell) {
    document.querySelectorAll('.colab-cell').forEach(c => c.classList.remove('focused'));
    cell.classList.add('focused');
  }

  function getCodeCellIndex(cell) {
    const codeCells = Array.from(document.querySelectorAll('.colab-cell.code-cell'));
    const idx = codeCells.indexOf(cell);
    return idx >= 0 ? idx : 0;
  }

  async function executeCell(cell, onDone) {
    const ta = cell.querySelector('.cell-code-textarea');
    const playBtn = cell.querySelector('.cell-play-btn');

    if (!ta) return null;
    const code = ta.value;
    const cellIndex = getCodeCellIndex(cell);

    if (playBtn) {
      playBtn.classList.add('running');
      playBtn.innerHTML = '';
    }

    if (!hasRealColabBridge()) {
      setConnectedUi(false, 'Runtime not connected');
      const disconnectedResult = {
        type: 'code',
        code,
        stdout: '',
        repr: null,
        html: null,
        plots: [],
        error: 'Runtime not connected',
        execCount: null,
        execTime: '0s'
      };
      renderCellOutput(cell, disconnectedResult, null, '0s');
      if (onDone) onDone(disconnectedResult);
      return disconnectedResult;
    }

    setConnectedUi(true, 'Python 3 • Connected');
    try {
      const bridgeRes = await window.pyColabBridge({ cellIndex, code });
      const normalized = Object.assign(
        {
          type: 'code',
          code,
          stdout: '',
          repr: null,
          html: null,
          plots: [],
          error: null,
          execTime: '0s'
        },
        bridgeRes || {}
      );
      const execNum = normalized.execCount !== undefined && normalized.execCount !== null
        ? normalized.execCount
        : (++executionCounter);
      normalized.execCount = execNum;

      if (normalized.variables && typeof normalized.variables === 'object') {
        pySession.vars = Object.assign({}, normalized.variables);
      }
      if (normalized.variableTypes && typeof normalized.variableTypes === 'object') {
        pySession.types = Object.assign({}, normalized.variableTypes);
      }

      renderCellOutput(cell, normalized, execNum, normalized.execTime || '0s');
      updateVariablesView();
      if (onDone) onDone(normalized);
      return normalized;
    } catch (err) {
      const errMessage = err && err.message ? err.message : String(err || 'Runtime execution failed');
      const failedResult = {
        type: 'code',
        code,
        stdout: '',
        repr: null,
        html: null,
        plots: [],
        error: errMessage,
        execCount: null,
        execTime: '0s'
      };
      renderCellOutput(cell, failedResult, null, '0s');
      if (onDone) onDone(failedResult);
      return failedResult;
    }
  }

  function bindCellEvents(cell) {
    const ta = cell.querySelector('.cell-code-textarea');
    const playBtn = cell.querySelector('.cell-play-btn');
    const clearOutBtn = cell.querySelector('.output-action-btn');
    const genLink = cell.querySelector('.placeholder-link');

    cell.addEventListener('mousedown', () => focusCell(cell));

    if (ta) {
      ta.addEventListener('focus', () => focusCell(cell));
      ta.addEventListener('input', () => {
        syncPlaceholder(cell);
        autoResizeTextarea(ta);
      });
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.shiftKey)) {
          e.preventDefault();
          executeCell(cell, () => {
            if (e.shiftKey) {
              const nextCell = cell.nextElementSibling;
              if (nextCell && nextCell.classList.contains('colab-cell')) {
                focusCell(nextCell);
                const nextTa = nextCell.querySelector('.cell-code-textarea');
                if (nextTa) nextTa.focus();
              } else {
                const created = createCodeCell('');
                const createdTa = created.querySelector('.cell-code-textarea');
                if (createdTa) createdTa.focus();
              }
            }
          });
        } else if (e.key === 'Tab') {
          e.preventDefault();
          const start = ta.selectionStart;
          const end = ta.selectionEnd;
          ta.value = ta.value.substring(0, start) + '  ' + ta.value.substring(end);
          ta.selectionStart = ta.selectionEnd = start + 2;
          syncPlaceholder(cell);
        }
      });
    }

    if (playBtn) {
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        executeCell(cell);
      });
    }

    if (clearOutBtn) {
      clearOutBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const outputWrapper = cell.querySelector('.cell-output-wrapper');
        const outputContent = cell.querySelector('.cell-output-content');
        cell.classList.remove('cell-error');
        delete cell.dataset.status;
        if (outputWrapper) outputWrapper.style.display = 'none';
        if (outputContent) outputContent.innerHTML = '';
      });
    }

    if (genLink) {
      genLink.style.pointerEvents = 'auto';
      genLink.style.cursor = 'pointer';
      genLink.addEventListener('click', (e) => {
        e.stopPropagation();
        if (ta) {
          ta.focus();
        }
      });
    }

    // Floating toolbar buttons
    cell.querySelectorAll('.cft-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = btn.dataset.cellAction;
        if (act === 'delete') {
          if (document.querySelectorAll('.colab-cell').length > 1) {
            cell.remove();
          } else if (ta) {
            ta.value = '';
            syncPlaceholder(cell);
            autoResizeTextarea(ta);
            cell.classList.remove('cell-error');
            const ow = cell.querySelector('.cell-output-wrapper');
            if (ow) ow.style.display = 'none';
          }
        } else if (act === 'move-up' && cell.previousElementSibling) {
          cellsContainer.insertBefore(cell, cell.previousElementSibling);
        } else if (act === 'move-down' && cell.nextElementSibling) {
          cellsContainer.insertBefore(cell.nextElementSibling, cell);
        } else if (act === 'ai-edit' && ta) {
          executeCell(cell);
        }
      });
    });
  }

  function createCodeCell(initialCode = '', executeImmediately = false) {
    cellIdCounter++;
    const cell = document.createElement('div');
    cell.className = 'colab-cell code-cell';
    cell.dataset.cellId = `cell-${cellIdCounter}`;
    cell.innerHTML = `
      <div class="cell-left-gutter">
        <span class="cell-status-check" style="display: none;">✓</span>
        <span class="cell-exec-time" style="display: none;">0s</span>
        <span class="cell-bracket-indicator">[ ]</span>
      </div>
      <div class="cell-box">
        <div class="cell-floating-toolbar">
          <button class="cft-btn" data-cell-action="move-up" title="Move cell up">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/></svg>
          </button>
          <button class="cft-btn" data-cell-action="move-down" title="Move cell down">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z"/></svg>
          </button>
          <button class="cft-btn" data-cell-action="ai-edit" title="Explain or transform code with Gemini">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7.5 5.6L10 7 8.6 4.5 10 2 7.5 3.4 5 2l1.4 2.5L5 7zm12 9.8L17 14l1.4 2.5L17 19l2.5-1.4L22 19l-1.4-2.5L22 14zM22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5zm-7.63 5.29a.996.996 0 0 0-1.41 0L1.29 18.96a.996.996 0 0 0 0 1.41l2.34 2.34c.39.39 1.02.39 1.41 0L16.7 11.05a.996.996 0 0 0 0-1.41l-2.33-2.35zm-1.03 5.49l-2.12-2.12 2.44-2.44 2.12 2.12-2.44 2.44z"/></svg>
          </button>
          <button class="cft-btn" data-cell-action="delete" title="Delete cell">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/></svg>
          </button>
          <button class="cft-btn" data-cell-action="more" title="More cell actions">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
          </button>
        </div>
        <div class="cell-editor-row">
          <button class="cell-play-btn" title="Run cell (Ctrl+Enter)">
            <svg class="play-icon" viewBox="0 0 24 24" width="12" height="12">
              <path d="M8 5v14l11-7z" fill="#1e1f20"/>
            </svg>
          </button>
          <div class="cell-code-wrap">
            <div class="cell-placeholder">Start coding or <span class="placeholder-link">generate</span> with AI.</div>
            <pre class="cell-code-highlight" aria-hidden="true"></pre>
            <textarea class="cell-code-textarea" rows="1" spellcheck="false" aria-label="Code editor"></textarea>
          </div>
        </div>
        <div class="cell-output-wrapper" style="display: none;">
          <div class="cell-output-gutter">
            <button class="output-action-btn" title="Clear output">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
          <div class="cell-output-content"></div>
        </div>
      </div>
    `;
    cellsContainer.appendChild(cell);
    bindCellEvents(cell);
    focusCell(cell);

    const ta = cell.querySelector('.cell-code-textarea');
    if (ta && initialCode) {
      ta.value = initialCode;
      syncPlaceholder(cell);
      autoResizeTextarea(ta);
    }
    if (executeImmediately) {
      executeCell(cell);
    }
    return cell;
  }

  function createTextCell(initialMarkdown = '### Section Title\nDouble-click (or enter) to edit') {
    cellIdCounter++;
    const cell = document.createElement('div');
    cell.className = 'colab-cell text-cell';
    cell.dataset.cellId = `cell-${cellIdCounter}`;
    cell.innerHTML = `
      <div class="cell-left-gutter"></div>
      <div class="cell-box">
        <div class="cell-floating-toolbar">
          <button class="cft-btn" data-cell-action="delete" title="Delete cell">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/></svg>
          </button>
        </div>
        <div class="text-cell-editor text-cell-rendered" contenteditable="true" spellcheck="false">${renderSafeMarkdownOrHtml(initialMarkdown)}</div>
      </div>
    `;
    cellsContainer.appendChild(cell);
    bindCellEvents(cell);
    focusCell(cell);
    return cell;
  }

  // Bind initial cell
  const firstCell = document.querySelector('.colab-cell');
  if (firstCell) {
    bindCellEvents(firstCell);
  }

  // Toolbar Buttons (+ Code, + Text, Run all)
  const btnAddCode = document.getElementById('btn-add-code');
  const btnAddText = document.getElementById('btn-add-text');
  const btnRunAll = document.getElementById('btn-run-all');

  if (btnAddCode) {
    btnAddCode.addEventListener('click', () => {
      const c = createCodeCell('');
      const ta = c.querySelector('.cell-code-textarea');
      if (ta) ta.focus();
    });
  }

  if (btnAddText) {
    btnAddText.addEventListener('click', () => createTextCell());
  }

  async function runAllCells() {
    const codeCells = Array.from(document.querySelectorAll('.colab-cell.code-cell'));
    const results = [];
    for (const c of codeCells) {
      const r = await executeCell(c);
      results.push(r);
    }
    return results;
  }

  if (btnRunAll) {
    btnRunAll.addEventListener('click', () => {
      runAllCells();
    });
  }

  // =========================================================
  // 4. MENUBAR, SIDE DRAWER & BOTTOM DRAWER
  // =========================================================
  const menuItems = document.querySelectorAll('.colab-menubar .menu-item');
  menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = item.classList.contains('open');
      menuItems.forEach(m => m.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
    });
  });

  document.querySelectorAll('.menu-option').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      menuItems.forEach(m => m.classList.remove('open'));
      const act = opt.dataset.action;
      if (act === 'add-code') createCodeCell('');
      else if (act === 'add-text') createTextCell();
      else if (act === 'run-all') runAllCells();
      else if (act === 'run-focused') {
        const focused = document.querySelector('.colab-cell.focused');
        if (focused) executeCell(focused);
      } else if (act === 'clear-outputs') {
        document.querySelectorAll('.colab-cell').forEach(c => {
          c.classList.remove('cell-error');
          delete c.dataset.status;
        });
        document.querySelectorAll('.cell-output-wrapper').forEach(w => { w.style.display = 'none'; });
        document.querySelectorAll('.cell-bracket-indicator').forEach(b => { b.textContent = '[ ]'; });
        document.querySelectorAll('.cell-status-check, .cell-exec-time').forEach(el => {
          el.style.display = 'none';
          el.classList.remove('error');
        });
      } else if (act === 'restart-runtime') {
        executionCounter = 0;
        pySession.vars = {};
        pySession.types = {};
        updateVariablesView();
      } else if (act === 'disconnect-runtime') {
        disconnectRuntime();
      } else if (act === 'save-notebook') {
        if (saveStatusText) {
          saveStatusText.textContent = 'All changes saved';
          setTimeout(() => { saveStatusText.textContent = ''; }, 2500);
        }
      } else if (act === 'print-notebook') {
        window.print();
      }
    });
  });

  // Global Ctrl+P shortcut handler to ensure clean full-page print
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && !e.shiftKey) {
      document.body.classList.add('colab-expand-full');
    }
  });

  document.addEventListener('click', () => {
    menuItems.forEach(m => m.classList.remove('open'));
    if (runtimePopover) runtimePopover.classList.remove('open');
  });

  // Star Button
  const starBtn = document.getElementById('btn-star');
  if (starBtn) {
    starBtn.addEventListener('click', () => starBtn.classList.toggle('starred'));
  }

  // Left Icon Rail & Side Drawer
  const sideDrawer = document.getElementById('side-drawer');
  const sideDrawerTitle = document.getElementById('side-drawer-title');
  const sideDrawerBody = document.getElementById('side-drawer-body');
  const btnCloseDrawer = document.getElementById('btn-close-drawer');
  const railBtns = document.querySelectorAll('.rail-icon-btn');

  function updateVariablesView() {
    const varNames = Object.keys(pySession.vars);
    const html = varNames.length === 0
      ? `<div style="color:#8e918f; padding: 8px 0;">${isConnected ? 'No variables defined yet. Run a cell to inspect variables.' : 'Runtime not connected.'}</div>`
      : `<table style="width:100%; border-collapse:collapse; font-family:'Roboto Mono',monospace; font-size:11.5px;">
          <thead><tr style="border-bottom:1px solid #444746; color:#c4c7c5; text-align:left;">
            <th style="padding:6px 4px;">Name</th><th style="padding:6px 4px;">Type</th><th style="padding:6px 4px;">Value</th>
          </tr></thead>
          <tbody>
            ${varNames.map(k => `<tr style="border-bottom:1px solid #333537;">
              <td style="padding:6px 4px; color:#a8c7fa;">${escapeHtml(k)}</td>
              <td style="padding:6px 4px; color:#8e918f;">${escapeHtml(pySession.types[k] || 'object')}</td>
              <td style="padding:6px 4px; color:#e3e3e3;">${escapeHtml(formatPyValue(pySession.vars[k], true))}</td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    if (sideDrawer && sideDrawer.dataset.activePanel === 'variables' && sideDrawerBody) {
      sideDrawerBody.innerHTML = html;
    }
    const bottomDrawer = document.getElementById('bottom-drawer');
    const bottomBody = document.getElementById('bottom-drawer-body');
    if (bottomDrawer && bottomDrawer.dataset.mode === 'variables' && bottomBody) {
      bottomBody.innerHTML = html;
    }
  }

  railBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.dataset.panel;
      const isAlreadyActive = btn.classList.contains('active') && sideDrawer.classList.contains('open');
      railBtns.forEach(b => b.classList.remove('active'));

      if (isAlreadyActive) {
        sideDrawer.classList.remove('open');
        return;
      }

      btn.classList.add('active');
      sideDrawer.classList.add('open');
      sideDrawer.dataset.activePanel = panel;

      if (panel === 'toc') {
        sideDrawerTitle.textContent = 'Table of contents';
        sideDrawerBody.innerHTML = `<div style="color:#8e918f;">No section headers yet. Click <strong>+ Text</strong> to add Markdown sections.</div>`;
      } else if (panel === 'variables') {
        sideDrawerTitle.textContent = 'Variables';
        updateVariablesView();
      } else if (panel === 'files') {
        sideDrawerTitle.textContent = 'Files';
        renderFilesDrawer();
      } else if (panel === 'snippets') {
        sideDrawerTitle.textContent = 'Code snippets';
        sideDrawerBody.innerHTML = `<div style="color:#8e918f;">No code snippets configured.</div>`;
      } else {
        sideDrawerTitle.textContent = btn.getAttribute('title');
        sideDrawerBody.innerHTML = `<div style="color:#8e918f;">${escapeHtml(btn.getAttribute('title'))} inspector ready.</div>`;
      }
    });
  });

  if (btnCloseDrawer) {
    btnCloseDrawer.addEventListener('click', () => {
      sideDrawer.classList.remove('open');
      railBtns.forEach(b => b.classList.remove('active'));
    });
  }

  // Bottom Drawer (Variables & Terminal)
  const bottomDrawer = document.getElementById('bottom-drawer');
  const bottomDrawerTitle = document.getElementById('bottom-drawer-title');
  const bottomDrawerBody = document.getElementById('bottom-drawer-body');
  const btnCloseBottom = document.getElementById('btn-close-bottom-drawer');
  const btnFooterVars = document.getElementById('btn-footer-vars');
  const btnFooterTerm = document.getElementById('btn-footer-terminal');

  if (btnFooterVars && bottomDrawer) {
    btnFooterVars.addEventListener('click', () => {
      bottomDrawer.style.display = 'flex';
      bottomDrawer.dataset.mode = 'variables';
      bottomDrawerTitle.textContent = 'Variables';
      updateVariablesView();
    });
  }

  if (btnFooterTerm && bottomDrawer) {
    btnFooterTerm.addEventListener('click', () => {
      bottomDrawer.style.display = 'flex';
      bottomDrawer.dataset.mode = 'terminal';
      bottomDrawerTitle.textContent = 'Terminal';
      bottomDrawerBody.innerHTML = isConnected
        ? `<div style="color:#81c995;">Connected to local Python runtime</div>`
        : `<div style="color:#f28b82;">Runtime not connected</div>`;
    });
  }

  if (btnCloseBottom && bottomDrawer) {
    btnCloseBottom.addEventListener('click', () => {
      bottomDrawer.style.display = 'none';
    });
  }

  // Gemini Sparkle FAB button
  const btnGeminiFab = document.getElementById('btn-gemini-fab');
  if (btnGeminiFab) {
    btnGeminiFab.addEventListener('click', () => {
      const focused = document.querySelector('.colab-cell.focused') || document.querySelector('.colab-cell');
      if (focused && focused.classList.contains('code-cell')) {
        executeCell(focused);
      }
    });
  }

  // =========================================================
  // 5. PASTE DATASET & UPLOAD CODE + STUDENT PROFILE API
  // =========================================================
  const uploadedDatasets = {};

  const GOOGLE_AVATAR_PALETTE = [
    '#7b1fa2', '#00897b', '#c2185b', '#1976d2', '#388e3c', '#e64a19', '#512da8', '#0288d1'
  ];

  function hashString(str) {
    let h = 0;
    for (let i = 0; i < (str || '').length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  function renderFilesDrawer() {
    if (!sideDrawerBody) return;
    const dsFiles = Object.keys(uploadedDatasets);
    sideDrawerBody.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:10px;">
        <div style="display:flex; gap:6px;">
          <button id="btn-paste-dataset" style="flex:1; background:#303134; color:#e3e3e3; border:1px solid #5f6368; border-radius:4px; padding:5px 8px; font-size:11.5px; cursor:pointer;">+ Paste Dataset (.csv)</button>
          <button id="btn-paste-code" style="flex:1; background:#004a77; color:#c2e7ff; border:none; border-radius:4px; padding:5px 8px; font-size:11.5px; cursor:pointer;">+ Paste Teacher Code</button>
        </div>
        <div id="dataset-paste-box" style="display:none; flex-direction:column; gap:6px; background:#282a2c; padding:8px; border-radius:6px; border:1px solid #444746;">
          <input id="ds-filename-input" type="text" value="" placeholder="Dataset filename (.csv)" style="background:#1e1f20; color:#e3e3e3; border:1px solid #5f6368; padding:4px 6px; font-size:11.5px; border-radius:4px;">
          <textarea id="ds-csv-textarea" rows="4" placeholder="Paste teacher CSV content here..." style="background:#1e1f20; color:#e3e3e3; border:1px solid #5f6368; padding:4px 6px; font-size:11px; font-family:'Roboto Mono',monospace; border-radius:4px;"></textarea>
          <button id="btn-save-dataset" style="background:#81c995; color:#131314; font-weight:600; border:none; border-radius:4px; padding:4px 8px; font-size:11.5px; cursor:pointer;">Save Dataset to Runtime</button>
        </div>
        <div style="font-family:'Roboto Mono',monospace; font-size:12px; line-height:1.9;">
          ${dsFiles.length > 0
            ? dsFiles.map(f => `<div style="padding-left:6px; color:#81c995;">📄 ${escapeHtml(f)}</div>`).join('')
            : `<div style="color:#8e918f;">No datasets uploaded in this session.</div>`}
        </div>
      </div>
    `;
    const btnPasteDs = document.getElementById('btn-paste-dataset');
    const pasteBox = document.getElementById('dataset-paste-box');
    const btnSaveDs = document.getElementById('btn-save-dataset');
    const btnPasteCode = document.getElementById('btn-paste-code');

    if (btnPasteDs && pasteBox) {
      btnPasteDs.addEventListener('click', () => {
        pasteBox.style.display = pasteBox.style.display === 'none' ? 'flex' : 'none';
      });
    }
    if (btnSaveDs) {
      btnSaveDs.addEventListener('click', () => {
        const fname = (document.getElementById('ds-filename-input')?.value || '').trim();
        const csvContent = document.getElementById('ds-csv-textarea')?.value || '';
        if (fname) {
          uploadedDatasets[fname] = csvContent || true;
          renderFilesDrawer();
        }
      });
    }
    if (btnPasteCode) {
      btnPasteCode.addEventListener('click', () => {
        const focused = document.querySelector('.colab-cell.code-cell.focused') || document.querySelector('.colab-cell.code-cell');
        if (focused) {
          const ta = focused.querySelector('.cell-code-textarea');
          if (ta) ta.focus();
        }
      });
    }
  }

  const notebookApi = {
    uploadedDatasets,
    reset() {
      cellsContainer.innerHTML = '';
      executionCounter = 0;
      cellIdCounter = 0;
      pySession.vars = {};
      pySession.types = {};
      Object.keys(uploadedDatasets).forEach(k => delete uploadedDatasets[k]);
      setConnectedUi(hasRealColabBridge(), hasRealColabBridge() ? 'Python 3 • Connected' : 'Connect');
    },
    setTitle(title) {
      const titleInput = document.getElementById('notebook-title-input');
      if (titleInput && title) {
        titleInput.value = title;
        const charWidth = Math.max(162, Math.min(420, title.length * 8.6 + 22));
        titleInput.style.width = `${Math.round(charWidth)}px`;
        document.title = `${title} - Colab`;
      }
    },
    setStudentProfile(profile = {}) {
      const rawName = (profile.studentName || profile.username || 'Student').trim();
      const cleanFirst = rawName.split(/\s+/)[0].replace(/[^A-Za-z0-9_]/g, '') || 'Student';
      const initial = (cleanFirst[0] || 'S').toUpperCase();
      const subject = (profile.subject || 'DSLab').replace(/[^A-Za-z0-9_]/g, '');
      const expNo = profile.expNo !== undefined && profile.expNo !== null ? String(profile.expNo) : '6';

      // 1. Update top-right Google Account Avatar initial, tooltip, and color
      const avatarRing = document.querySelector('.google-avatar-ring');
      const avatarInner = document.querySelector('.avatar-inner');
      const h = hashString(rawName + expNo);
      if (avatarInner) {
        avatarInner.textContent = initial;
        avatarInner.style.backgroundColor = GOOGLE_AVATAR_PALETTE[h % GOOGLE_AVATAR_PALETTE.length];
      }
      if (avatarRing) {
        avatarRing.setAttribute('title', `Google Account: ${rawName}`);
      }

      // 2. Update Notebook Headline (e.g., DSLab_Rahul_Exp6.ipynb)
      const naturalTitle = profile.notebookTitle || `${subject}_${cleanFirst}_Exp${expNo}.ipynb`;
      this.setTitle(naturalTitle);

      // 3. Subtle natural variation in RAM / Disk resource meters per student
      const ramPct = 21 + (h % 14);
      const diskPct = 26 + ((h >> 3) % 10);
      const ramFill = document.getElementById('ram-fill');
      const diskFill = document.getElementById('disk-fill');
      if (ramFill) ramFill.style.width = `${ramPct}%`;
      if (diskFill) diskFill.style.width = `${diskPct}%`;
    },
    uploadDataset(filename, csvContent) {
      if (filename) {
        uploadedDatasets[filename] = csvContent || true;
      }
    },
    setExpandFull(expand = true) {
      if (expand) {
        document.body.classList.add('colab-expand-full');
      } else {
        document.body.classList.remove('colab-expand-full');
      }
    },
    setCellCode(index, code) {
      const cells = document.querySelectorAll('.colab-cell.code-cell');
      const target = cells[index] || createCodeCell('');
      const ta = target.querySelector('.cell-code-textarea');
      if (ta) {
        ta.value = code;
        syncPlaceholder(target);
        autoResizeTextarea(ta);
      }
      return target;
    },
    async runCell(index = 0) {
      const cells = document.querySelectorAll('.colab-cell.code-cell');
      if (cells[index]) {
        return await executeCell(cells[index]);
      }
      return null;
    },
    addAndRunCell(code) {
      return createCodeCell(code, true);
    },
    addExecutedCell(code, outputObj = {}, execNum = null, execTime = '0s') {
      setConnectedUi(true, 'Python 3 • Connected');

      const cell = createCodeCell(code, false);
      const num = execNum !== null ? execNum : (++executionCounter);
      renderCellOutput(cell, outputObj, num, execTime);
      return cell;
    },
    addMarkdownCell(htmlOrText) {
      const cell = createTextCell('');
      const ed = cell.querySelector('.text-cell-editor');
      if (ed) {
        ed.classList.add('text-cell-rendered');
        ed.innerHTML = renderSafeMarkdownOrHtml(htmlOrText);
      }
      return cell;
    },
    loadCells(cellsList = [], options = {}) {
      this.reset();
      document.body.classList.toggle('colab-light-body', options.theme === 'light');
      document.body.dataset.theme = options.theme === 'light' ? 'light' : 'dark';
      if (options.studentName || options.subject || options.expNo) {
        this.setStudentProfile({
          studentName: options.studentName,
          subject: options.subject,
          expNo: options.expNo,
          notebookTitle: options.title
        });
      } else if (options.title) {
        this.setTitle(options.title);
      }
      if (options.datasets && typeof options.datasets === 'object') {
        Object.entries(options.datasets).forEach(([k, v]) => this.uploadDataset(k, v));
      }
      if (options.expandFull !== undefined) this.setExpandFull(options.expandFull);
      let lastCell = null;
      cellsList.forEach((c, idx) => {
        if (c.type === 'markdown' || c.type === 'text') {
          lastCell = this.addMarkdownCell(c.html || c.content || c.code || '');
        } else {
          const execNum = c.execCount !== undefined ? c.execCount : (idx + 1);
          lastCell = this.addExecutedCell(
            c.code || '',
            {
              stdout: c.stdout || '',
              repr: c.repr || null,
              html: c.html || null,
              plots: c.plots || [],
              error: c.error || null
            },
            execNum,
            c.execTime || '0s'
          );
        }
      });
      if (options.runtime && typeof options.runtime === 'object') {
        const isConn = options.runtime.connected !== undefined ? Boolean(options.runtime.connected) : hasRealColabBridge();
        setConnectedUi(isConn, isConn ? 'Python 3 • Connected' : 'Runtime not connected');
      }
      if (options.unfocusCells && lastCell) {
        lastCell.classList.remove('focused');
      } else if (lastCell) {
        focusCell(lastCell);
      }
      return cellsList.length;
    },
    runAll: runAllCells,
    sanitizeHtml: sanitizeHtmlFragment
  };

  window.colabApp = notebookApi;
  window.ColabNotebook = notebookApi;
});
