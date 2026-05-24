// ==========================================
// SteamGifts AutoJoin - Content Script
// ==========================================

(function () {
  'use strict';

  // ---- CONFIG ----
  const CONFIG = {
    delayBetweenEntries: 250,    // ms between cada entrada (¡muy rápido!)
    delayBetweenPages: 1000,     // ms entre navegación de páginas
    maxPages: 10,                // max pages to scan incrementado
    minPointsReserve: 0,         // minimum points to keep in reserve
    logEnabled: true,
  };

  // ---- STATE ----
  let isRunning = false;
  let shouldStop = false;
  let stats = { entered: 0, skipped: 0, errors: 0, total: 0 };
  let currentSessionPoints = 0;

  // ---- LOGGING ----
  function log(msg, type = 'info') {
    if (!CONFIG.logEnabled) return;
    const prefix = '[SG AutoJoin]';
    const styles = {
      info: 'color: #4fc3f7; font-weight: bold;',
      success: 'color: #66bb6a; font-weight: bold;',
      warn: 'color: #ffa726; font-weight: bold;',
      error: 'color: #ef5350; font-weight: bold;',
    };
    console.log(`%c${prefix} ${msg}`, styles[type] || styles.info);
    updatePanelLog(msg, type);
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ---- PANEL UI ----
  function createPanel() {
    if (document.getElementById('sg-autojoin-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'sg-autojoin-panel';
    panel.innerHTML = `
      <div id="sg-panel-header">
        <span class="sg-title">🎮 SG AutoJoin</span>
        <button id="sg-close-btn" title="Minimizar">−</button>
      </div>
      <div id="sg-panel-body">
        <div id="sg-status">
          <div class="sg-stat-row">
            <span>Estado:</span>
            <span id="sg-state" class="sg-badge sg-idle">Listo</span>
          </div>
          <div class="sg-stat-row">
            <span>Puntos:</span>
            <span id="sg-points">--</span>
          </div>
          <div class="sg-stat-row">
            <span>Nivel:</span>
            <span id="sg-level">--</span>
          </div>
        </div>
        <div id="sg-stats-grid">
          <div class="sg-stat-box">
            <span id="sg-entered-count">0</span>
            <label>Ingresadas</label>
          </div>
          <div class="sg-stat-box">
            <span id="sg-skipped-count">0</span>
            <label>Omitidas</label>
          </div>
          <div class="sg-stat-box">
            <span id="sg-errors-count">0</span>
            <label>Errores</label>
          </div>
          <div class="sg-stat-box">
            <span id="sg-total-count">0</span>
            <label>Total</label>
          </div>
        </div>
        <div id="sg-progress-bar">
          <div id="sg-progress-fill"></div>
        </div>
        <div id="sg-log-container">
          <div id="sg-log"></div>
        </div>
        <div id="sg-actions">
          <button id="sg-start-btn" class="sg-btn sg-btn-primary">
            ▶ AutoJoin
          </button>
          <button id="sg-stop-btn" class="sg-btn sg-btn-danger" disabled>
            ■ Detener
          </button>
          <button id="sg-page-btn" class="sg-btn sg-btn-secondary">
            ▶ AutoJoin (Multi-Página)
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // Event listeners
    document.getElementById('sg-start-btn').addEventListener('click', () => startAutoJoin(false));
    document.getElementById('sg-stop-btn').addEventListener('click', stopAutoJoin);
    document.getElementById('sg-page-btn').addEventListener('click', () => startAutoJoin(true));
    document.getElementById('sg-close-btn').addEventListener('click', togglePanel);

    // Make panel draggable
    makeDraggable(panel, document.getElementById('sg-panel-header'));

    // Load initial info
    loadUserInfo();
    log('Extensión cargada. ¡Listo para AutoJoin!');
  }

  function makeDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      if (e.target.id === 'sg-close-btn') return;
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      element.style.top = (element.offsetTop - pos2) + "px";
      element.style.left = (element.offsetLeft - pos1) + "px";
      element.style.right = 'auto';
      element.style.bottom = 'auto';
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  function togglePanel() {
    const body = document.getElementById('sg-panel-body');
    const panel = document.getElementById('sg-autojoin-panel');
    const btn = document.getElementById('sg-close-btn');
    if (body.style.display === 'none') {
      body.style.display = 'block';
      btn.textContent = '−';
      panel.style.height = 'auto';
    } else {
      body.style.display = 'none';
      btn.textContent = '+';
      panel.style.height = 'auto';
    }
  }

  function updatePanelLog(msg, type) {
    const logEl = document.getElementById('sg-log');
    if (!logEl) return;
    const entry = document.createElement('div');
    entry.className = `sg-log-entry sg-log-${type}`;
    const time = new Date().toLocaleTimeString();
    entry.textContent = `[${time}] ${msg}`;
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;

    // Keep only last 50 entries
    while (logEl.children.length > 50) {
      logEl.removeChild(logEl.firstChild);
    }
  }

  function updateStats() {
    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    setText('sg-entered-count', stats.entered);
    setText('sg-skipped-count', stats.skipped);
    setText('sg-errors-count', stats.errors);
    setText('sg-total-count', stats.total);
  }

  function setProgress(current, total) {
    const fill = document.getElementById('sg-progress-fill');
    if (fill && total > 0) {
      fill.style.width = `${(current / total) * 100}%`;
    }
  }

  function setState(state) {
    const el = document.getElementById('sg-state');
    if (!el) return;
    el.className = 'sg-badge';
    switch (state) {
      case 'idle':
        el.textContent = 'Listo';
        el.classList.add('sg-idle');
        break;
      case 'running':
        el.textContent = 'Ejecutando...';
        el.classList.add('sg-running');
        break;
      case 'done':
        el.textContent = 'Completado ✓';
        el.classList.add('sg-done');
        break;
      case 'error':
        el.textContent = 'Error';
        el.classList.add('sg-error');
        break;
      case 'stopped':
        el.textContent = 'Detenido';
        el.classList.add('sg-error');
        break;
    }
  }

  function loadUserInfo() {
    try {
      // Try to get points from the header
      const pointsEl = document.querySelector('.nav__points');
      if (pointsEl) {
        document.getElementById('sg-points').textContent = pointsEl.textContent.trim() + ' P';
      }

      // Try to get level
      const levelEl = document.querySelector('.nav__avatarcontribution');
      if (levelEl) {
        const levelMatch = levelEl.textContent.match(/Level (\d+)/i);
        if (levelMatch) {
          document.getElementById('sg-level').textContent = levelMatch[1];
        }
      }
    } catch (e) {
      log('No se pudo cargar info del usuario', 'warn');
    }
  }

  // ---- CORE AUTO-JOIN LOGIC ----

  function getCurrentPoints() {
    const pointsEl = document.querySelector('.nav__points');
    if (pointsEl) {
      // Remover comas si existen (ej. 3,000 -> 3000)
      return parseInt(pointsEl.textContent.replace(/,/g, '').trim()) || 0;
    }
    return 0;
  }

  function updateDomPoints(newPoints) {
    const pointsEl = document.querySelector('.nav__points');
    if (pointsEl) pointsEl.textContent = newPoints;
    const panelPoints = document.getElementById('sg-points');
    if (panelPoints) panelPoints.textContent = newPoints + ' P';
  }

  function getGiveawaysOnPage() {
    // Find all giveaway rows
    const giveaways = document.querySelectorAll('.giveaway__row-inner-wrap');
    const results = [];

    giveaways.forEach(ga => {
      // Skip already entered giveaways (they have is-faded class)
      if (ga.classList.contains('is-faded')) {
        return;
      }

      // Get giveaway link/code
      const linkEl = ga.querySelector('.giveaway__heading__name');
      if (!linkEl) return;

      const href = linkEl.getAttribute('href');
      if (!href) return;

      // Extract giveaway code from URL like /giveaway/XXXXX/game-name
      const codeMatch = href.match(/\/giveaway\/([a-zA-Z0-9]{5})/);
      if (!codeMatch) return;

      const code = codeMatch[1];
      const name = linkEl.textContent.trim();

      // Get points cost
      const pointsEl = ga.querySelector('.giveaway__heading__thin');
      let points = 0;
      if (pointsEl) {
        const pointsMatch = pointsEl.textContent.match(/\((\d+)P\)/);
        if (pointsMatch) {
          points = parseInt(pointsMatch[1]) || 0;
        }
      }

      // Find the enter button/form
      const enterForm = ga.querySelector('form[action*="/giveaway/"]');
      const enterBtn = ga.querySelector('.giveaway__hide input[type="submit"], input[value="Enter Giveaway"]');

      results.push({
        element: ga,
        code,
        name,
        points,
        enterForm,
        enterBtn,
      });
    });

    return results;
  }

  async function enterGiveaway(ga) {
    try {
      // Usar la variable de sesión para no tener que depender de que el DOM se actualice
      if (currentSessionPoints < ga.points) {
        log(`Omitiendo "${ga.name}": ${ga.points}P (Tienes ${currentSessionPoints}P)`, 'warn');
        stats.skipped++;
        updateStats();
        // Si no nos alcanza para este, como están ordenados por precio, 
        // probablemente no nos alcance para los siguientes. 
        // Retornamos 'no_points' para manejar esto rápidamente.
        return 'no_points';
      }

      if (currentSessionPoints - ga.points < CONFIG.minPointsReserve) {
        log(`Reserva de puntos (${CONFIG.minPointsReserve}P) alcanzada.`, 'warn');
        return 'reserve';
      }

      log(`Intentando: "${ga.name}" (${ga.points}P)...`, 'info');

      let success = false;

      // Intentar método AJAX (el más rápido y silencioso)
      const xsrfToken = getXsrfToken();
      if (xsrfToken) {
        const response = await fetch('/ajax.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `xsrf_token=${xsrfToken}&do=entry_insert&code=${ga.code}`,
          credentials: 'same-origin',
        });

        const data = await response.json();
        if (data.type === 'success') {
          success = true;
        } else if (data.msg && data.msg.includes('Not enough points')) {
          return 'no_points';
        } else {
          log(`AJAX Falló: ${data.msg || 'Error desconocido'}`, 'error');
        }
      }

      // Fallback 1: Si AJAX falló pero tenemos botón
      if (!success && ga.enterBtn) {
        ga.enterBtn.click();
        success = true;
      }

      // Fallback 2: Form submission (menos ideal, recarga la página a veces)
      if (!success && ga.enterForm) {
        const action = ga.enterForm.getAttribute('action');
        const formData = new FormData(ga.enterForm);
        const response = await fetch(action || window.location.href, {
          method: 'POST',
          body: formData,
          credentials: 'same-origin',
        });
        if (response.ok) success = true;
      }

      if (success) {
        stats.entered++;
        stats.total++;
        currentSessionPoints -= ga.points;
        updateDomPoints(currentSessionPoints);
        updateStats();
        
        // Añadir clase visual para saber que ya entramos
        ga.element.classList.add('is-faded');
        ga.element.style.opacity = '0.5';
        
        log(`✓ Entraste a "${ga.name}" (Quedan: ${currentSessionPoints}P)`, 'success');
        return true;
      }

      log(`No se pudo encontrar forma de entrar a "${ga.name}"`, 'error');
      stats.errors++;
      updateStats();
      return false;

    } catch (error) {
      log(`Error en "${ga.name}": ${error.message}`, 'error');
      stats.errors++;
      stats.total++;
      updateStats();
      return false;
    }
  }

  function getXsrfToken() {
    // Try to find XSRF token from any form on the page
    const xsrfInput = document.querySelector('input[name="xsrf_token"]');
    return xsrfInput ? xsrfInput.value : null;
  }

  async function startAutoJoin(multiPage = false) {
    if (isRunning) return;
    isRunning = true;
    shouldStop = false;
    stats = { entered: 0, skipped: 0, errors: 0, total: 0 };
    currentSessionPoints = getCurrentPoints(); // Inicializar puntos al inicio
    
    updateStats();
    setState('running');

    const startBtn = document.getElementById('sg-start-btn');
    const stopBtn = document.getElementById('sg-stop-btn');
    const pageBtn = document.getElementById('sg-page-btn');
    startBtn.disabled = true;
    stopBtn.disabled = false;
    pageBtn.disabled = true;

    try {
      if (multiPage) {
        await runMultiPage();
      } else {
        await runSinglePage();
      }
    } catch (error) {
      log(`Error fatal: ${error.message}`, 'error');
      setState('error');
    }

    isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    pageBtn.disabled = false;

    if (!shouldStop) {
      setState('done');
      log(`¡Completado! Ingresadas: ${stats.entered} | Omitidas: ${stats.skipped} | Errores: ${stats.errors}`, 'success');
    }
  }

  async function processGiveawaysList(giveaways) {
    // Filtramos las que de plano no podemos pagar antes de intentar (para acelerar)
    const affordableGiveaways = [];
    for (const ga of giveaways) {
      if (currentSessionPoints >= ga.points) {
        affordableGiveaways.push(ga);
      } else {
        log(`Omitiendo rápido: "${ga.name}" (${ga.points}P > ${currentSessionPoints}P)`, 'warn');
        stats.skipped++;
        stats.total++;
      }
    }

    // Ordenar las asequibles por puntos (de menor a mayor costo)
    affordableGiveaways.sort((a, b) => a.points - b.points);
    updateStats();

    log(`Intentando entrar a ${affordableGiveaways.length} giveaways asequibles...`, 'info');

    for (let i = 0; i < affordableGiveaways.length; i++) {
      if (shouldStop) break;

      setProgress(i + 1, affordableGiveaways.length);
      const result = await enterGiveaway(affordableGiveaways[i]);

      if (result === 'reserve' || result === 'no_points') {
        log('No alcanzan los puntos para más. Terminando lote.', 'warn');
        break; 
      }

      // Delay súper rápido
      if (i < affordableGiveaways.length - 1 && !shouldStop) {
        await delay(CONFIG.delayBetweenEntries);
      }
    }
    
    setProgress(100, 100);
  }

  async function runSinglePage() {
    log('Escaneando giveaways en la página actual...', 'info');
    const giveaways = getGiveawaysOnPage();
    log(`Encontradas ${giveaways.length} giveaways no ingresadas`, 'info');
    
    await processGiveawaysList(giveaways);
  }

  async function runMultiPage() {
    const pagesToScan = CONFIG.maxPages;

    for (let page = 1; page <= pagesToScan; page++) {
      if (shouldStop) break;

      log(`📄 Procesando página ${page} de ${pagesToScan}...`, 'info');

      if (page > 1) {
        const currentUrl = new URL(window.location.href);
        const searchQuery = currentUrl.searchParams.get('q');
        const baseUrl = currentUrl.pathname;
        
        let targetUrl;
        if (baseUrl.includes('/giveaways')) {
          targetUrl = `${baseUrl}/search?page=${page}`;
        } else {
          targetUrl = `/giveaways/search?page=${page}`;
        }
        
        if (searchQuery) {
          targetUrl += `&q=${encodeURIComponent(searchQuery)}`;
        }

        window.location.href = targetUrl;
        // La navegación reinicia el script.
        // Lo ideal para una extensión sería guardar el estado de "corriendo"
        // en chrome.storage y retomarlo al cargar. 
        // Para este script de contenido inyectado puro, multi-page navegará y se detendrá.
        // Pero detendremos explícitamente y lo avisaremos.
        log('Navegando a la siguiente página... Dale AutoJoin nuevamente.', 'warn');
        break;
      }

      const giveaways = getGiveawaysOnPage();
      await processGiveawaysList(giveaways);
    }
  }

  function stopAutoJoin() {
    shouldStop = true;
    isRunning = false;
    setState('stopped');
    log('AutoJoin detenido por el usuario.', 'warn');

    const startBtn = document.getElementById('sg-start-btn');
    const stopBtn = document.getElementById('sg-stop-btn');
    const pageBtn = document.getElementById('sg-page-btn');
    if (startBtn) startBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
    if (pageBtn) pageBtn.disabled = false;
  }

  // ---- INIT ----
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createPanel);
  } else {
    createPanel();
  }
})();
