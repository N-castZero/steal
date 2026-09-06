(function() {
  'use strict';

  // ── DOM references ──
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

  // ── State ──
  let capturedFunctions = [];
  let executionHistory = [];

  // ── Line Numbers ──
  function updateLineNumbers() {
    const lines = editor.value.split('\n').length;
    let html = '';
    for (let i = 1; i <= lines; i++) html += i + '\n';
    lineNumbers.textContent = html;
  }
  editor.addEventListener('input', updateLineNumbers);
  editor.addEventListener('scroll', () => {
    lineNumbers.scrollTop = editor.scrollTop;
  });
  updateLineNumbers();

  // ── Console Logger ──
  function log(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = 'log-' + type;
    const timestamp = new Date().toLocaleTimeString();
    entry.textContent = `[${timestamp}] ${message}`;
    output.appendChild(entry);
    output.scrollTop = output.scrollHeight;
    executionHistory.push({ message, type, timestamp });
  }

  // ── Fetch with retry dan header ──
  async function fetchScriptWithRetry(url, retries = 2) {
    for (let i = 0; i <= retries; i++) {
      try {
        const resp = await fetch(url, {
          headers: {
            'User-Agent': 'Roblox/WinInet',
            'Accept': 'text/plain'
          }
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = await resp.text();
        if (text.length < 10) throw new Error('Script terlalu pendek, mungkin terpotong.');
        return text;
      } catch (e) {
        log(`⚠️ Fetch attempt ${i+1} gagal: ${e.message}`, 'warn');
        if (i === retries) {
          log(`❌ Gagal memuat dari ${url} setelah ${retries+1} percobaan.`, 'error');
          return null;
        }
        // Tunggu sebentar sebelum retry
        await new Promise(r => setTimeout(r, 500));
      }
    }
    return null;
  }

  // ── Trap Environment ──
  function trapEnvironment(code) {
    const funcRegex = /function\s+(\w+)\s*\(/g;
    const localFuncRegex = /local\s+(\w+)\s*=\s*function/g;
    const globalAssign = /(\w+)\s*=\s*function/g;
    const found = [];

    let match;
    while ((match = funcRegex.exec(code)) !== null) found.push(match[1]);
    while ((match = localFuncRegex.exec(code)) !== null) found.push(match[1]);
    while ((match = globalAssign.exec(code)) !== null) found.push(match[1]);

    if (code.includes('loadstring') || code.includes('HttpGet')) {
      found.push('_trap_loader');
    }
    if (code.includes('game:GetService')) {
      found.push('_service_hook');
    }
    if (code.includes('getgenv') || code.includes('_G')) {
      found.push('_env_hook');
    }

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

    log(`🧩 Trap: ${unique.length} function/environment signatures captured.`, 'trap');
    return unique;
  }

  // ── Eksekusi Script dengan sandbox dan wrapper ──
  async function executeScript(code) {
    if (!code || !code.trim()) {
      log('⚠️ Script kosong, tidak ada yang dijalankan.', 'warn');
      return;
    }

    log('▶️ Executing script...', 'info');
    log(`📜 Script length: ${code.length} chars`, 'info');

    // Trap environment
    trapEnvironment(code);

    // Deteksi loadstring dan ekstrak URL
    if (code.includes('loadstring') && code.includes('HttpGet')) {
      log('⚠️ Detected loadstring(HttpGet) — trap script terdeteksi!', 'warn');
      const urls = code.match(/https?:\/\/[^\s"')]+/g) || [];
      for (const url of urls) {
        log(`🔗 Trap URL: ${url}`, 'trap');
        // Coba fetch script dari URL tersebut
        const fetched = await fetchScriptWithRetry(url);
        if (fetched) {
          log(`📥 Berhasil fetch dari ${url} (${fetched.length} chars)`, 'success');
          // Tambahkan ke sandbox sebagai variabel
          sandbox._fetchedScripts = sandbox._fetchedScripts || {};
          sandbox._fetchedScripts[url] = fetched;
        } else {
          log(`⚠️ Gagal fetch dari ${url}, lanjutkan dengan simulasi.`, 'warn');
        }
      }
    }

    // Siapkan sandbox lengkap
    const sandbox = {
      print: (...args) => log('📢 ' + args.join(' '), 'success'),
      warn: (...args) => log('⚠️ ' + args.join(' '), 'warn'),
      error: (...args) => log('❌ ' + args.join(' '), 'error'),
      game: {
        GetService: (s) => {
          log(`🎮 game:GetService("${s}") dipanggil`, 'info');
          return { Name: s };
        },
        HttpGet: (url) => {
          log(`🌐 game:HttpGet("${url}") — trap environment captured`, 'trap');
          return '-- [trap] content from ' + url;
        },
        PlaceId: 0,
        GameId: 0,
        Players: {
          LocalPlayer: { UserId: 12345 }
        }
      },
      getgenv: () => ({}),
      _G: { ServerURL: 'https://zeroinhub.com' },
      syn: { request: () => ({ Status: 200, Body: '{}' }) },
      request: () => ({ Status: 200, Body: '{}' }),
      http_request: () => ({ Status: 200, Body: '{}' }),
      http: { request: () => ({ Status: 200, Body: '{}' }) },
      gethui: () => ({ Parent: null }),
      Instance: {
        new: (cls) => ({
          Name: cls,
          Parent: null,
          Size: {},
          Position: {},
          BackgroundColor3: {},
          BorderSizePixel: 0,
          BorderColor3: {},
          Text: '',
          TextColor3: {},
          Font: {},
          TextSize: 0,
          BackgroundTransparency: 1,
          TextWrapped: false,
          TextEditable: false,
          ClearTextOnFocus: false,
          Parent: null
        })
      },
      Color3: { fromRGB: () => ({}) },
      Enum: { Font: { GothamBold: {}, Gotham: {}, Code: {} } },
      UDim2: { new: () => ({}) },
      loadstring: (src) => {
        log(`📦 loadstring() dipanggil — environment terpapar!`, 'trap');
        return function() { log('⚡ loadstring result executed', 'success'); };
      }
    };

    // Bungkus script agar tidak error parsing
    const wrappedCode = `
      (function() {
        ${code}
      })()
    `;

    try {
      const fn = new Function('sandbox', `
        with (sandbox) {
          ${wrappedCode}
        }
      `);
      fn(sandbox);

      log('✅ Eksekusi selesai (simulasi).', 'success');
    } catch (err) {
      log(`❌ Error: ${err.message}`, 'error');
      log('💡 Tips: Script mungkin terpotong atau mengandung sintaks yang tidak valid. Coba perbaiki manual di editor.', 'warn');
    }
  }

  // ── Event: Execute ──
  btnExec.addEventListener('click', () => {
    const code = editor.value;
    executeScript(code);
  });

  // ── Clear Editor ──
  btnClear.addEventListener('click', () => {
    editor.value = '';
    updateLineNumbers();
    log('🗑️ Editor dibersihkan.', 'info');
  });

  // ── Clear Output ──
  btnClearOutput.addEventListener('click', () => {
    output.innerHTML = '';
    executionHistory = [];
    log('🧹 Output dibersihkan.', 'info');
  });

  // ── Save Script (localStorage) ──
  btnSave.addEventListener('click', () => {
    try {
      localStorage.setItem('robux_loader_script', editor.value);
      log('💾 Script disimpan ke local storage.', 'success');
    } catch (e) {
      log('❌ Gagal menyimpan: ' + e.message, 'error');
    }
  });

  // ── Load Script (localStorage) ──
  btnLoad.addEventListener('click', () => {
    try {
      const saved = localStorage.getItem('robux_loader_script');
      if (saved) {
        editor.value = saved;
        updateLineNumbers();
        log('📂 Script dimuat dari local storage.', 'success');
      } else {
        log('⚠️ Tidak ada script tersimpan.', 'warn');
      }
    } catch (e) {
      log('❌ Gagal memuat: ' + e.message, 'error');
    }
  });

  // ── Theme Switcher ──
  themeSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    const app = document.getElementById('app');
    const body = document.body;
    if (val === 'dark') {
      body.style.background = '#1a1a1a';
      app.style.background = '#2d2d2d';
      app.style.borderColor = '#fee440';
      app.style.boxShadow = '12px 12px 0 #fee440';
      editor.style.background = '#1e1e1e';
      editor.style.color = '#d4d4d4';
      document.querySelector('.editor-panel').style.borderColor = '#fee440';
    } else if (val === 'neon') {
      body.style.background = '#0d0d2b';
      app.style.background = '#1a1a3a';
      app.style.borderColor = '#ff00ff';
      app.style.boxShadow = '12px 12px 0 #00ffff';
      editor.style.background = '#0d0d1a';
      editor.style.color = '#00ffcc';
      document.querySelector('.editor-panel').style.borderColor = '#ff00ff';
    } else {
      body.style.background = '#f5f0e8';
      app.style.background = '#ffffff';
      app.style.borderColor = '#1a1a1a';
      app.style.boxShadow = '12px 12px 0 #1a1a1a';
      editor.style.background = '#fcfcf8';
      editor.style.color = '#1a1a1a';
      document.querySelector('.editor-panel').style.borderColor = '#1a1a1a';
    }
    log(`🎨 Tema diubah ke: ${val}`, 'info');
  });

  // ── Shortcut: Ctrl+Enter Execute ──
  editor.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      btnExec.click();
    }
  });

  // ── Init Log ──
  log('🚀 Robux Loader siap. Neo-brutalism + long shadow aktif.', 'success');
  log('💡 Ctrl+Enter untuk execute. Trap environment berjalan real-time.', 'info');

  // Auto-trap untuk script awal
  setTimeout(() => {
    trapEnvironment(editor.value);
  }, 300);

})();
