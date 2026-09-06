(function() {
  'use strict';

  const editor = document.getElementById('script-editor');
  const output = document.getElementById('output-console');
  const lineNumbers = document.getElementById('line-numbers');
  const funcList = document.getElementById('function-list');
  const envCount = document.getElementById('env-count');

  const btnExec = document.getElementById('btn-execute');
  const btnClear = document.getElementById('btn-clear');
  const btnClearOutput = document.getElementById('btn-clear-output');
  const btnSave = document.getElementById('btn-save');
  const btnLoad = document.getElementById('btn-load');
  const themeSelect = document.getElementById('theme-select');

  let capturedFunctions = [];

  function updateLineNumbers() {
    const lines = editor.value.split('\n').length;
    lineNumbers.textContent = Array.from({length: lines}, (_, i) => i+1).join('\n');
  }
  editor.addEventListener('input', updateLineNumbers);
  editor.addEventListener('scroll', () => lineNumbers.scrollTop = editor.scrollTop);
  updateLineNumbers();

  function log(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = 'log-' + type;
    const ts = new Date().toLocaleTimeString();
    if (typeof message === 'string' && message.includes('\n')) {
      entry.style.whiteSpace = 'pre-wrap';
      entry.style.wordBreak = 'break-all';
    }
    entry.textContent = `[${ts}] ${message}`;
    output.appendChild(entry);
    output.scrollTop = output.scrollHeight;
  }

  async function fetchWithRetry(url, retries = 2) {
    for (let i = 0; i <= retries; i++) {
      try {
        const resp = await fetch(url, {
          headers: { 'User-Agent': 'Roblox/WinInet', 'Accept': 'text/plain' }
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = await resp.text();
        if (text.length < 5) throw new Error('Konten terlalu pendek');
        return text;
      } catch (e) {
        log(`⚠️ Percobaan ${i+1} gagal: ${e.message}`, 'warn');
        if (i === retries) {
          log(`❌ Gagal total dari ${url}`, 'error');
          return null;
        }
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  function extractUrls(code) {
    const urlRegex = /https?:\/\/[^\s"')]+/g;
    return code.match(urlRegex) || [];
  }

  function trapEnvironment(code) {
    const funcRegex = /function\s+(\w+)\s*\(/g;
    const localFuncRegex = /local\s+(\w+)\s*=\s*function/g;
    const globalAssign = /(\w+)\s*=\s*function/g;
    const found = [];
    let m;
    while ((m = funcRegex.exec(code)) !== null) found.push(m[1]);
    while ((m = localFuncRegex.exec(code)) !== null) found.push(m[1]);
    while ((m = globalAssign.exec(code)) !== null) found.push(m[1]);
    if (code.includes('loadstring') || code.includes('HttpGet')) found.push('_trap_loader');
    if (code.includes('game:GetService')) found.push('_service_hook');
    if (code.includes('getgenv') || code.includes('_G')) found.push('_env_hook');

    const unique = [...new Set(found)];
    capturedFunctions = unique;
    envCount.textContent = unique.length;

    funcList.innerHTML = '';
    unique.forEach(fn => {
      const chip = document.createElement('span');
      chip.className = 'func-chip';
      chip.textContent = fn;
      funcList.appendChild(chip);
    });

    log(`🧩 Trap: ${unique.length} function/environment captured.`, 'trap');
    return unique;
  }

  async function executeScript(code) {
    if (!code.trim()) {
      log('⚠️ Script kosong.', 'warn');
      return;
    }

    log('▶️ Menjalankan script...', 'info');
    log(`📜 Panjang: ${code.length} chars`, 'info');

    trapEnvironment(code);

    const urls = extractUrls(code);
    if (urls.length === 0) {
      log('ℹ️ Tidak ada URL ditemukan. Script mungkin lokal.', 'info');
    } else {
      log(`🔗 Ditemukan ${urls.length} URL`, 'info');
      for (const url of urls) {
        log(`🌐 Fetching: ${url}`, 'trap');
        const content = await fetchWithRetry(url);
        if (content !== null) {
          log(`📥 Berhasil fetch (${content.length} chars)`, 'success');
          log(`📄 RAW CONTENT:\n${content}`, 'trap');
        } else {
          log(`⚠️ Gagal fetch ${url}`, 'warn');
        }
      }
    }

    // Simulasi eksekusi tanpa error
    log('✅ Eksekusi selesai (simulasi).', 'success');
  }

  // ── Event Listeners ──
  btnExec.addEventListener('click', () => executeScript(editor.value));

  btnClear.addEventListener('click', () => {
    editor.value = '';
    updateLineNumbers();
    log('🗑️ Editor dibersihkan.', 'info');
  });

  btnClearOutput.addEventListener('click', () => {
    output.innerHTML = '';
    log('🧹 Output dibersihkan.', 'info');
  });

  btnSave.addEventListener('click', () => {
    localStorage.setItem('robux_loader_script', editor.value);
    log('💾 Script disimpan.', 'success');
  });

  btnLoad.addEventListener('click', () => {
    const saved = localStorage.getItem('robux_loader_script');
    if (saved) {
      editor.value = saved;
      updateLineNumbers();
      log('📂 Script dimuat.', 'success');
    } else {
      log('⚠️ Tidak ada simpanan.', 'warn');
    }
  });

  themeSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    const app = document.getElementById('app');
    const body = document.body;
    const editorPanel = document.querySelector('.editor-panel');
    if (val === 'dark') {
      body.style.background = '#1a1a1a';
      app.style.background = '#2d2d2d';
      app.style.borderColor = '#fee440';
      app.style.boxShadow = '12px 12px 0 #fee440';
      editor.style.background = '#1e1e1e';
      editor.style.color = '#d4d4d4';
      if (editorPanel) editorPanel.style.borderColor = '#fee440';
    } else if (val === 'neon') {
      body.style.background = '#0d0d2b';
      app.style.background = '#1a1a3a';
      app.style.borderColor = '#ff00ff';
      app.style.boxShadow = '12px 12px 0 #00ffff';
      editor.style.background = '#0d0d1a';
      editor.style.color = '#00ffcc';
      if (editorPanel) editorPanel.style.borderColor = '#ff00ff';
    } else {
      body.style.background = '#f5f0e8';
      app.style.background = '#ffffff';
      app.style.borderColor = '#1a1a1a';
      app.style.boxShadow = '12px 12px 0 #1a1a1a';
      editor.style.background = '#fcfcf8';
      editor.style.color = '#1a1a1a';
      if (editorPanel) editorPanel.style.borderColor = '#1a1a1a';
    }
    log(`🎨 Tema: ${val}`, 'info');
  });

  editor.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      btnExec.click();
    }
  });

  // ── Init ──
  log('🚀 Robux Loader siap.', 'success');
  log('💡 Ctrl+Enter untuk execute. URL akan di-fetch otomatis.', 'info');
  setTimeout(() => trapEnvironment(editor.value), 300);
})();
