/**
 * Guess the Picture - Host & Player Game
 * SINGLE FILE VERSION - everything (server + all pages + styling) lives in
 * this one server.js file. No "public" folder, no separate .html/.css files.
 * Pure Node.js built-in modules only - nothing to npm install.
 *
 * Deploy on Render.com as a "Web Service" with:
 *   Start Command: node server.js
 * (This app needs a running server for real-time Host/Player sync, so it
 *  CANNOT be deployed as a "Static Site".)
 */
const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 3000;
const HOST_PASSWORD = 'pqc';
const TOTAL_QUESTIONS = 8;
const TOTAL_TILES = 16; // 4 x 4 grid
const SECONDS_PER_TILE = 5;
const MAX_BODY_BYTES = 8 * 1024 * 1024; // 8MB safety limit per request

function freshQuestions() {
  return Array.from({ length: TOTAL_QUESTIONS }, () => ({ image: null, questionText: '' }));
}

// Fisher-Yates shuffle - returns a new randomly-ordered array [0..n-1]
function shuffledIndices(n) {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---- In-memory game state (single shared game session) ----
const state = {
  totalQuestions: TOTAL_QUESTIONS,
  totalTiles: TOTAL_TILES,
  secondsPerTile: SECONDS_PER_TILE,
  questions: freshQuestions(),
  gameStarted: false,
  gameOver: false,
  currentIndex: 0,
  tilesRevealed: 0,
  timerRunning: false,
  tickCounter: 0,
  revealOrder: shuffledIndices(TOTAL_TILES), // random order in which tiles get revealed for the CURRENT question
};

function startNewQuestionReveal() {
  state.tilesRevealed = 0;
  state.tickCounter = 0;
  state.revealOrder = shuffledIndices(state.totalTiles);
}

// ---- Server-driven reveal timer (ticks every second) ----
setInterval(() => {
  if (state.gameStarted && state.timerRunning && !state.gameOver) {
    state.tickCounter++;
    if (state.tickCounter >= state.secondsPerTile) {
      state.tickCounter = 0;
      if (state.tilesRevealed < state.totalTiles) {
        state.tilesRevealed++;
      }
      if (state.tilesRevealed >= state.totalTiles) {
        state.timerRunning = false;
      }
    }
  }
}, 1000);

function publicState() {
  const q = state.questions[state.currentIndex] || { image: null, questionText: '' };
  return {
    totalQuestions: state.totalQuestions,
    totalTiles: state.totalTiles,
    secondsPerTile: state.secondsPerTile,
    gameStarted: state.gameStarted,
    gameOver: state.gameOver,
    currentIndex: state.currentIndex,
    tilesRevealed: state.tilesRevealed,
    timerRunning: state.timerRunning,
    secondsToNextTile: state.timerRunning ? (state.secondsPerTile - state.tickCounter) : null,
    revealOrder: state.revealOrder,
    currentQuestion: { image: q.image, questionText: q.questionText },
    questionsMeta: state.questions.map(item => ({
      hasImage: !!item.image,
      hasText: !!item.questionText,
    })),
  };
}

function sendJSON(res, statusCode, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendHTML(res, html) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function readJSONBody(req, callback) {
  let data = '';
  let tooBig = false;
  req.on('data', chunk => {
    data += chunk;
    if (data.length > MAX_BODY_BYTES) {
      tooBig = true;
      req.destroy();
    }
  });
  req.on('end', () => {
    if (tooBig) return callback(new Error('Payload too large'), null);
    if (!data) return callback(null, {});
    try {
      callback(null, JSON.parse(data));
    } catch (e) {
      callback(e, null);
    }
  });
}

/* =========================================================================
   SHARED STYLE (embedded once, reused across every page as a <style> block)
   ========================================================================= */
const STYLE_BLOCK = `
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Kanit:wght@400;600&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    font-family: 'Kanit', 'Segoe UI', sans-serif;
    background: radial-gradient(circle at 50% 0%, #14213d 0%, #05070f 65%, #000 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 30px 15px;
    overflow-x: hidden;
  }
  .card {
    position: relative;
    background: linear-gradient(160deg, rgba(10,15,30,0.95), rgba(5,8,18,0.98));
    border-radius: 22px;
    padding: 34px 30px 38px;
    width: 100%;
    max-width: 560px;
    text-align: center;
    border: 1px solid rgba(0, 229, 255, 0.35);
    box-shadow: 0 0 25px rgba(0,229,255,0.25), 0 0 60px rgba(255,0,200,0.12), inset 0 0 30px rgba(0,229,255,0.05);
  }
  .card.wide { max-width: 720px; }
  h1 {
    margin: 0 0 10px;
    font-family: 'Orbitron', sans-serif;
    font-weight: 900;
    font-size: 2.1em;
    letter-spacing: 2px;
    color: #fff;
    text-shadow: 0 0 6px #00e5ff, 0 0 14px #00e5ff, 0 0 26px #00b8ff, 0 0 46px #ff00c8;
    animation: flicker 3.5s infinite alternate;
  }
  h2 {
    font-family: 'Orbitron', sans-serif;
    color: #00e5ff;
    text-shadow: 0 0 8px rgba(0,229,255,0.7);
    letter-spacing: 1px;
    font-size: 1.1em;
  }
  @keyframes flicker {
    0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% {
      text-shadow: 0 0 6px #00e5ff, 0 0 14px #00e5ff, 0 0 26px #00b8ff, 0 0 46px #ff00c8;
    }
    20%, 24%, 55% { text-shadow: none; opacity: 0.55; }
  }
  .subtitle { color: rgba(255,255,255,0.55); margin-bottom: 22px; font-size: 0.95em; }
  .controls { display: flex; flex-wrap: wrap; gap: 14px; justify-content: center; margin-bottom: 26px; }
  .btn {
    border: none; padding: 11px 22px; border-radius: 50px;
    font-family: 'Kanit', sans-serif; font-size: 0.95em; font-weight: 600;
    cursor: pointer; color: #fff; letter-spacing: 0.5px;
    transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
    background: rgba(255,255,255,0.04); border: 1px solid transparent;
  }
  .btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.2); }
  .btn:active:not(:disabled) { transform: translateY(0); }
  .btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .btn-cyan { border-color: #00e5ff; box-shadow: 0 0 10px rgba(0,229,255,0.6), inset 0 0 8px rgba(0,229,255,0.15); color: #00e5ff; }
  .btn-pink { border-color: #ff2e93; box-shadow: 0 0 10px rgba(255,46,147,0.6), inset 0 0 8px rgba(255,46,147,0.15); color: #ff2e93; }
  .btn-green { border-color: #39ff14; box-shadow: 0 0 10px rgba(57,255,20,0.6), inset 0 0 8px rgba(57,255,20,0.15); color: #39ff14; }
  .btn-amber { border-color: #ffb400; box-shadow: 0 0 10px rgba(255,180,0,0.6), inset 0 0 8px rgba(255,180,0,0.15); color: #ffb400; }
  input[type="text"], input[type="password"], textarea {
    width: 100%; padding: 10px 14px; border-radius: 10px;
    border: 1px solid rgba(0,229,255,0.4); background: rgba(0,0,0,0.4);
    color: #fff; font-family: 'Kanit', sans-serif; font-size: 0.95em; outline: none;
  }
  input[type="text"]:focus, input[type="password"]:focus, textarea:focus {
    border-color: #00e5ff; box-shadow: 0 0 10px rgba(0,229,255,0.5);
  }
  input[type="file"] { display: none; }
  .board-wrapper {
    position: relative; width: 100%; max-width: 460px; aspect-ratio: 1 / 1;
    margin: 0 auto; border-radius: 16px; overflow: hidden; background: #05070f;
    border: 1px solid rgba(0,229,255,0.4);
    box-shadow: 0 0 20px rgba(0,229,255,0.35), 0 0 45px rgba(255,0,200,0.15), inset 0 0 25px rgba(0,0,0,0.6);
  }
  .placeholder {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    color: rgba(255,255,255,0.35); font-size: 1em; padding: 20px; text-align: center; z-index: 3;
    text-shadow: 0 0 8px rgba(0,229,255,0.3);
  }
  .sharp-layer { position: absolute; inset: 0; background-position: center; background-size: cover; background-repeat: no-repeat; z-index: 1; }
  .grid {
    position: absolute; inset: 0; display: grid;
    grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(4, 1fr);
    gap: 0; z-index: 2;
  }
  .tile {
    background: linear-gradient(160deg, #0d1b3d, #050a1c); color: #00e5ff;
    font-family: 'Orbitron', sans-serif; font-size: 1.3em; font-weight: 700;
    display: flex; align-items: center; justify-content: center; user-select: none;
    transition: opacity 0.5s ease;
    box-shadow: inset 0 0 0 1px rgba(0,229,255,0.35), inset 0 0 12px rgba(0,229,255,0.12);
    text-shadow: 0 0 8px rgba(0,229,255,0.8);
  }
  .tile.revealed { opacity: 0; pointer-events: none; }
  .status { margin-top: 18px; color: #00e5ff; font-family: 'Orbitron', sans-serif; font-size: 0.9em; letter-spacing: 1px; min-height: 1.3em; text-shadow: 0 0 8px rgba(0,229,255,0.6); }
  .badge {
    display: inline-block; padding: 6px 16px; border-radius: 50px; border: 1px solid rgba(0,229,255,0.5);
    color: #00e5ff; font-family: 'Orbitron', sans-serif; font-size: 0.85em; letter-spacing: 1px;
    margin-bottom: 16px; box-shadow: 0 0 10px rgba(0,229,255,0.35);
  }
  .question-text { color: #fff; font-size: 1.05em; margin: 6px 0 20px; min-height: 1.3em; text-shadow: 0 0 6px rgba(255,255,255,0.25); }
  .countdown { font-family: 'Orbitron', sans-serif; font-size: 2.4em; color: #ff2e93; text-shadow: 0 0 14px rgba(255,46,147,0.8); margin-top: 14px; }
  .role-buttons { display: flex; flex-direction: column; gap: 16px; margin-top: 10px; }
  .role-buttons .btn { padding: 18px; font-size: 1.1em; }
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 50; }
  .modal-box {
    background: linear-gradient(160deg, rgba(10,15,30,0.98), rgba(5,8,18,1));
    border: 1px solid rgba(0,229,255,0.5); box-shadow: 0 0 30px rgba(0,229,255,0.4);
    border-radius: 18px; padding: 28px; width: 90%; max-width: 360px; text-align: center;
  }
  .modal-box h3 { font-family: 'Orbitron', sans-serif; color: #fff; text-shadow: 0 0 8px rgba(0,229,255,0.6); margin-top: 0; }
  .error-text { color: #ff2e93; font-size: 0.85em; margin-top: 8px; min-height: 1.2em; }
  .slots { display: flex; flex-direction: column; gap: 14px; margin-bottom: 24px; max-height: 420px; overflow-y: auto; padding-right: 4px; }
  .slot { display: flex; gap: 12px; align-items: center; background: rgba(255,255,255,0.03); border: 1px solid rgba(0,229,255,0.25); border-radius: 14px; padding: 12px; text-align: left; }
  .slot-num { font-family: 'Orbitron', sans-serif; color: #00e5ff; font-weight: 700; width: 28px; flex-shrink: 0; text-align: center; }
  .slot-thumb {
    width: 56px; height: 56px; border-radius: 8px; background: #0d1b3d; background-size: cover; background-position: center;
    border: 1px solid rgba(0,229,255,0.3); flex-shrink: 0; display: flex; align-items: center; justify-content: center;
    color: rgba(255,255,255,0.25); font-size: 0.7em; cursor: pointer; overflow: hidden;
  }
  .slot-fields { flex: 1; display: flex; flex-direction: column; gap: 6px; }
  .slot-fields input { font-size: 0.85em; padding: 8px 10px; }
  .slot-status { font-size: 0.7em; color: rgba(255,255,255,0.4); }
  .host-controls { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin: 20px 0; }
  .status-panel { background: rgba(255,255,255,0.03); border: 1px solid rgba(0,229,255,0.25); border-radius: 14px; padding: 14px 18px; margin-bottom: 20px; font-size: 0.9em; color: rgba(255,255,255,0.75); text-align: left; line-height: 1.6; }
  .status-panel b { color: #00e5ff; }
  .top-link { display: block; text-align: right; color: rgba(255,255,255,0.4); font-size: 0.8em; margin-bottom: 10px; text-decoration: none; }
  .top-link:hover { color: #00e5ff; }
</style>
`;

/* =========================================================================
   PAGE: Landing page (role selection)
   ========================================================================= */
const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Guess the Picture 🖼️</title>
${STYLE_BLOCK}
</head>
<body>
  <div class="card">
    <h1>🖼️ GUESS THE PICTURE</h1>
    <p class="subtitle">Choose your role to join the game</p>
    <div class="role-buttons">
      <button class="btn btn-cyan" id="hostBtn">🔐 I'm the Host</button>
      <button class="btn btn-green" id="userBtn">🙋 Join as Player</button>
    </div>
  </div>

  <div class="modal-overlay" id="modalOverlay" style="display:none;">
    <div class="modal-box">
      <h3>Host Login</h3>
      <input type="password" id="passwordInput" placeholder="Enter host password">
      <div class="error-text" id="errorText"></div>
      <div class="controls" style="margin-top:18px;">
        <button class="btn btn-cyan" id="confirmBtn">Enter</button>
        <button class="btn btn-pink" id="cancelBtn">Cancel</button>
      </div>
    </div>
  </div>

<script>
  const hostBtn = document.getElementById('hostBtn');
  const userBtn = document.getElementById('userBtn');
  const modalOverlay = document.getElementById('modalOverlay');
  const passwordInput = document.getElementById('passwordInput');
  const errorText = document.getElementById('errorText');
  const confirmBtn = document.getElementById('confirmBtn');
  const cancelBtn = document.getElementById('cancelBtn');

  userBtn.addEventListener('click', () => { window.location.href = '/user'; });

  hostBtn.addEventListener('click', () => {
    modalOverlay.style.display = 'flex';
    errorText.textContent = '';
    passwordInput.value = '';
    passwordInput.focus();
  });

  cancelBtn.addEventListener('click', () => { modalOverlay.style.display = 'none'; });

  async function tryLogin() {
    const password = passwordInput.value;
    try {
      const res = await fetch('/api/host/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.ok) {
        sessionStorage.setItem('hostPassword', password);
        window.location.href = '/host';
      } else {
        errorText.textContent = 'Incorrect password. Please try again.';
      }
    } catch (e) {
      errorText.textContent = 'Connection error. Please try again.';
    }
  }

  confirmBtn.addEventListener('click', tryLogin);
  passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
</script>
</body>
</html>`;

/* =========================================================================
   PAGE: Host Dashboard
   ========================================================================= */
const HOST_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Host Dashboard - Guess the Picture</title>
${STYLE_BLOCK}
</head>
<body>
  <div class="card wide">
    <a href="/" class="top-link">← Back to role selection</a>
    <h1>🔐 HOST DASHBOARD</h1>
    <p class="subtitle">Upload 8 pictures &amp; questions, then control the game</p>

    <div class="status-panel" id="statusPanel">Loading status...</div>

    <div class="host-controls">
      <button class="btn btn-green" id="startBtn" disabled>▶ Start Game</button>
      <button class="btn btn-cyan" id="nextBtn" disabled>⏭ Next Question</button>
      <button class="btn btn-pink" id="resetBtn">🔄 Reset Game</button>
    </div>

    <h2 style="margin-bottom: 14px;">Question Slots (8)</h2>
    <div class="slots" id="slots"></div>
  </div>

<script>
  const password = sessionStorage.getItem('hostPassword');
  if (password !== 'pqc') { window.location.href = '/'; }

  const slotsEl = document.getElementById('slots');
  const statusPanel = document.getElementById('statusPanel');
  const startBtn = document.getElementById('startBtn');
  const nextBtn = document.getElementById('nextBtn');
  const resetBtn = document.getElementById('resetBtn');

  const TOTAL = 8;
  let localQuestions = Array.from({ length: TOTAL }, () => ({ image: null, questionText: '' }));
  let latestState = null; // always the freshest known server state
  let requestInFlight = false; // prevents overlapping start/next clicks
  let saveTimers = {};

  function buildSlots() {
    slotsEl.innerHTML = '';
    for (let i = 0; i < TOTAL; i++) {
      const q = localQuestions[i];
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.innerHTML = \`
        <div class="slot-num">#\${i + 1}</div>
        <div class="slot-thumb" id="thumb-\${i}" style="\${q.image ? \`background-image:url('\${q.image}')\` : ''}">\${q.image ? '' : '📤'}</div>
        <input type="file" accept="image/*" id="file-\${i}" style="display:none;">
        <div class="slot-fields">
          <input type="text" id="qtext-\${i}" placeholder="Question text (optional)" value="\${(q.questionText || '').replace(/"/g, '&quot;')}">
          <div class="slot-status" id="slotstatus-\${i}">\${q.image ? 'Image uploaded ✅' : 'No image yet'}</div>
        </div>
      \`;
      slotsEl.appendChild(slot);

      const thumb = slot.querySelector(\`#thumb-\${i}\`);
      const fileInput = slot.querySelector(\`#file-\${i}\`);
      const qtextInput = slot.querySelector(\`#qtext-\${i}\`);

      thumb.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          localQuestions[i].image = evt.target.result;
          thumb.style.backgroundImage = \`url('\${evt.target.result}')\`;
          thumb.textContent = '';
          saveQuestion(i);
        };
        reader.readAsDataURL(file);
      });

      qtextInput.addEventListener('input', (e) => {
        localQuestions[i].questionText = e.target.value;
        clearTimeout(saveTimers[i]);
        saveTimers[i] = setTimeout(() => saveQuestion(i), 600);
      });
    }
  }

  async function saveQuestion(index) {
    const statusEl = document.getElementById(\`slotstatus-\${index}\`);
    statusEl.textContent = 'Saving...';
    try {
      const res = await fetch('/api/host/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password, index,
          image: localQuestions[index].image,
          questionText: localQuestions[index].questionText,
        }),
      });
      const data = await res.json();
      statusEl.textContent = data.ok ? 'Saved ✅' : ('Error: ' + (data.error || 'unknown'));
    } catch (e) {
      statusEl.textContent = 'Save failed (connection error)';
    }
  }

  async function loadQuestions() {
    try {
      const res = await fetch('/api/host/questions?password=' + encodeURIComponent(password));
      const data = await res.json();
      if (data.ok) { localQuestions = data.questions; buildSlots(); }
    } catch (e) { /* ignore */ }
  }

  function renderStatus() {
    if (!latestState) return;
    const s = latestState;
    let statusHtml = '';
    if (!s.gameStarted) {
      statusHtml = '<b>Status:</b> Not started yet. Upload pictures then press Start.';
    } else if (s.gameOver) {
      statusHtml = '🎉 <b>Game Over!</b> All 8 questions finished.';
    } else {
      statusHtml = \`<b>Question:</b> \${s.currentIndex + 1} / \${s.totalQuestions} &nbsp;|&nbsp; \` +
        \`<b>Tiles revealed:</b> \${s.tilesRevealed} / \${s.totalTiles} &nbsp;|&nbsp; \` +
        \`<b>Timer:</b> \${s.timerRunning ? ('Running (next tile in ' + s.secondsToNextTile + 's)') : 'Stopped (paused)'}\`;
    }
    statusPanel.innerHTML = statusHtml;

    if (!requestInFlight) {
      startBtn.disabled = s.gameStarted;
      nextBtn.disabled = !s.gameStarted || s.gameOver;
    }
  }

  async function pollState() {
    try {
      const res = await fetch('/api/state');
      latestState = await res.json();
      renderStatus();
    } catch (e) { /* ignore */ }
  }

  startBtn.addEventListener('click', async () => {
    if (requestInFlight) return;
    requestInFlight = true;
    startBtn.disabled = true;
    await fetch('/api/host/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    await pollState();
    requestInFlight = false;
    renderStatus();
  });

  nextBtn.addEventListener('click', async () => {
    if (requestInFlight) return;
    requestInFlight = true;
    nextBtn.disabled = true;
    await fetch('/api/next', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    await pollState();
    requestInFlight = false;
    renderStatus();
  });

  resetBtn.addEventListener('click', async () => {
    if (!confirm('Reset the current game progress?')) return;
    const clearQuestions = confirm('Also clear all uploaded pictures & questions? OK = clear, Cancel = keep them.');
    await fetch('/api/host/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password, clearQuestions }) });
    if (clearQuestions) {
      localQuestions = Array.from({ length: TOTAL }, () => ({ image: null, questionText: '' }));
      buildSlots();
    }
    await pollState();
  });

  buildSlots();
  loadQuestions();
  pollState();
  setInterval(pollState, 1000);
</script>
</body>
</html>`;

/* =========================================================================
   PAGE: Player page
   (Pause/Resume control lives here instead of the Host dashboard.
    Uses an OPTIMISTIC UI update on click so the button/countdown reacts
    INSTANTLY, instead of waiting for a full network round-trip before
    showing any visual feedback - this removes the perceived "delay".)
   ========================================================================= */
const USER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Guess the Picture 🖼️</title>
${STYLE_BLOCK}
</head>
<body>
  <div class="card">
    <a href="/" class="top-link">← Leave game</a>
    <h1>🖼️ GUESS THE PICTURE</h1>

    <div id="waitingScreen">
      <p class="subtitle">Waiting for the host to start the game...</p>
    </div>

    <div id="gameScreen" style="display:none;">
      <div class="badge" id="questionBadge">Question 1 / 8</div>
      <div class="question-text" id="questionText"></div>
      <div class="board-wrapper" id="boardWrapper">
        <div class="sharp-layer" id="sharpLayer"></div>
        <div class="grid" id="grid"></div>
      </div>
      <div class="countdown" id="countdown"></div>
      <div class="status" id="status"></div>
      <div class="controls" style="margin-top: 20px;">
        <button class="btn btn-amber" id="stopResumeBtn">⏸ Stop Timer</button>
        <button class="btn btn-cyan" id="nextBtn">⏭ Next Question</button>
      </div>
    </div>

    <div id="gameOverScreen" style="display:none;">
      <p class="subtitle" style="font-size:1.1em; color:#39ff14;">🎉 Game Finished! Thanks for playing.</p>
    </div>
  </div>

<script>
  const TOTAL_TILES = 16;
  const waitingScreen = document.getElementById('waitingScreen');
  const gameScreen = document.getElementById('gameScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const questionBadge = document.getElementById('questionBadge');
  const questionText = document.getElementById('questionText');
  const sharpLayer = document.getElementById('sharpLayer');
  const grid = document.getElementById('grid');
  const countdownEl = document.getElementById('countdown');
  const statusEl = document.getElementById('status');
  const nextBtn = document.getElementById('nextBtn');
  const stopResumeBtn = document.getElementById('stopResumeBtn');

  let builtForIndex = -1;
  let latestState = null;
  // "pendingOverride" holds an optimistic guess of timerRunning right after a
  // click, so the UI shows the correct state INSTANTLY, before the server
  // has even responded. It gets cleared as soon as a poll confirms the truth
  // (or reverted if the request ultimately failed).
  let pendingOverride = null;
  let stopResumeInFlight = false;
  let nextInFlight = false;

  function buildGrid() {
    grid.innerHTML = '';
    for (let i = 0; i < TOTAL_TILES; i++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.index = i;
      tile.textContent = '?';
      grid.appendChild(tile);
    }
  }

  // tilesRevealedCount = how many tiles have been opened so far.
  // order = the server's random reveal order (array of tile positions),
  // e.g. order = [7, 2, 15, 0, ...] means tile #7 opens first, then #2, etc.
  // A tile is "revealed" if its own index appears within the first
  // tilesRevealedCount entries of that random order - NOT simply if its
  // index number is less than tilesRevealedCount (that would be sequential).
  function applyRevealed(tilesRevealedCount, order) {
    const revealedSet = new Set((order || []).slice(0, tilesRevealedCount));
    const tiles = grid.querySelectorAll('.tile');
    tiles.forEach((tile) => {
      const idx = Number(tile.dataset.index);
      if (revealedSet.has(idx)) tile.classList.add('revealed');
      else tile.classList.remove('revealed');
    });
  }

  function effectiveTimerRunning(s) {
    // Trust the optimistic override until the server confirms/refutes it.
    return pendingOverride !== null ? pendingOverride : s.timerRunning;
  }

  function renderStopResumeButton(s) {
    const running = effectiveTimerRunning(s);
    const disabled = !s.gameStarted || s.gameOver || s.tilesRevealed >= s.totalTiles;
    stopResumeBtn.disabled = disabled || stopResumeInFlight;
    if (!stopResumeInFlight) {
      stopResumeBtn.textContent = running ? '⏸ Stop Timer' : '▶ Resume Timer';
    }
  }

  async function pollState() {
    try {
      const res = await fetch('/api/state');
      const s = await res.json();
      latestState = s;

      // Once the server's real timerRunning matches what we optimistically
      // predicted, we can drop the override and just trust the server again.
      if (pendingOverride !== null && s.timerRunning === pendingOverride) {
        pendingOverride = null;
      }

      if (s.gameOver) {
        waitingScreen.style.display = 'none';
        gameScreen.style.display = 'none';
        gameOverScreen.style.display = 'block';
        return;
      }
      if (!s.gameStarted) {
        waitingScreen.style.display = 'block';
        gameScreen.style.display = 'none';
        gameOverScreen.style.display = 'none';
        return;
      }

      waitingScreen.style.display = 'none';
      gameOverScreen.style.display = 'none';
      gameScreen.style.display = 'block';

      if (builtForIndex !== s.currentIndex) {
        buildGrid();
        builtForIndex = s.currentIndex;
        pendingOverride = null; // new question - drop any stale override
      }

      questionBadge.textContent = \`Question \${s.currentIndex + 1} / \${s.totalQuestions}\`;
      questionText.textContent = s.currentQuestion.questionText || '';
      sharpLayer.style.backgroundImage = s.currentQuestion.image ? \`url('\${s.currentQuestion.image}')\` : 'none';

      applyRevealed(s.tilesRevealed, s.revealOrder);
      statusEl.textContent = \`Revealed \${s.tilesRevealed} / \${s.totalTiles} tiles\`;

      const running = effectiveTimerRunning(s);
      if (s.tilesRevealed >= s.totalTiles) {
        countdownEl.textContent = '✅ Fully revealed';
      } else if (running) {
        countdownEl.textContent = \`Next tile in: \${s.secondsToNextTile !== null ? s.secondsToNextTile : s.secondsPerTile}s\`;
      } else {
        countdownEl.textContent = '⏸ Paused';
      }

      renderStopResumeButton(s);
    } catch (e) { /* ignore transient errors */ }
  }

  stopResumeBtn.addEventListener('click', async () => {
    if (stopResumeInFlight || !latestState) return;
    const currentlyRunning = effectiveTimerRunning(latestState);
    const action = currentlyRunning ? 'stop' : 'resume';

    // 1) INSTANT optimistic UI update - no waiting on the network at all.
    pendingOverride = (action === 'resume');
    stopResumeInFlight = true;
    stopResumeBtn.textContent = action === 'stop' ? '⏸ Stop Timer' : '▶ Resume Timer';
    countdownEl.textContent = action === 'stop' ? '⏸ Paused' : countdownEl.textContent;
    renderStopResumeButton(latestState);

    // 2) Fire the request in the background; don't block the UI on it.
    try {
      const res = await fetch(\`/api/\${action}\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!res.ok) throw new Error('request failed');
    } catch (e) {
      // Revert the optimistic guess if the request actually failed.
      pendingOverride = (action === 'resume') ? false : true;
    }
    stopResumeInFlight = false;
    // 3) Quick background resync to confirm server truth (does not block UI).
    pollState();
  });

  nextBtn.addEventListener('click', async () => {
    if (nextInFlight) return;
    nextInFlight = true;
    nextBtn.disabled = true;
    pendingOverride = null;
    try {
      await fetch('/api/next', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    } catch (e) { /* ignore, poll will resync */ }
    await pollState();
    nextInFlight = false;
    nextBtn.disabled = false;
  });

  pollState();
  setInterval(pollState, 500);
</script>
</body>
</html>`;

/* =========================================================================
   SERVER / ROUTING
   ========================================================================= */
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // ---------- PAGE ROUTES ----------
  if (req.method === 'GET' && (pathname === '/' || pathname === '/index' || pathname === '/index.html')) {
    return sendHTML(res, INDEX_HTML);
  }
  if (req.method === 'GET' && (pathname === '/host' || pathname === '/host.html')) {
    return sendHTML(res, HOST_HTML);
  }
  if (req.method === 'GET' && (pathname === '/user' || pathname === '/user.html')) {
    return sendHTML(res, USER_HTML);
  }

  // ---------- API ROUTES ----------
  if (pathname === '/api/state' && req.method === 'GET') {
    return sendJSON(res, 200, publicState());
  }

  if (pathname === '/api/host/verify' && req.method === 'POST') {
    return readJSONBody(req, (err, body) => {
      if (err) return sendJSON(res, 400, { ok: false, error: 'Bad request' });
      const ok = body.password === HOST_PASSWORD;
      return sendJSON(res, 200, { ok });
    });
  }

  if (pathname === '/api/host/questions' && req.method === 'GET') {
    const password = parsed.query.password;
    if (password !== HOST_PASSWORD) return sendJSON(res, 401, { ok: false, error: 'Unauthorized' });
    return sendJSON(res, 200, { ok: true, questions: state.questions });
  }

  if (pathname === '/api/host/question' && req.method === 'POST') {
    return readJSONBody(req, (err, body) => {
      if (err) return sendJSON(res, 413, { ok: false, error: 'Payload too large or invalid' });
      if (body.password !== HOST_PASSWORD) return sendJSON(res, 401, { ok: false, error: 'Unauthorized' });
      const idx = Number(body.index);
      if (!Number.isInteger(idx) || idx < 0 || idx >= TOTAL_QUESTIONS) {
        return sendJSON(res, 400, { ok: false, error: 'Invalid question index' });
      }
      if (typeof body.image === 'string' && body.image.length > 0) {
        state.questions[idx].image = body.image;
      }
      if (typeof body.questionText === 'string') {
        state.questions[idx].questionText = body.questionText;
      }
      return sendJSON(res, 200, { ok: true });
    });
  }

  if (pathname === '/api/host/start' && req.method === 'POST') {
    return readJSONBody(req, (err, body) => {
      if (err || body.password !== HOST_PASSWORD) return sendJSON(res, 401, { ok: false, error: 'Unauthorized' });
      state.gameStarted = true;
      state.gameOver = false;
      state.currentIndex = 0;
      startNewQuestionReveal();
      state.timerRunning = true;
      return sendJSON(res, 200, { ok: true });
    });
  }

  if (pathname === '/api/host/reset' && req.method === 'POST') {
    return readJSONBody(req, (err, body) => {
      if (err || body.password !== HOST_PASSWORD) return sendJSON(res, 401, { ok: false, error: 'Unauthorized' });
      state.gameStarted = false;
      state.gameOver = false;
      state.currentIndex = 0;
      startNewQuestionReveal();
      state.timerRunning = false;
      if (body.clearQuestions) state.questions = freshQuestions();
      return sendJSON(res, 200, { ok: true });
    });
  }

  // Stop/Resume timer - called from the USER (player) page, no password required.
  if (pathname === '/api/stop' && req.method === 'POST') {
    state.timerRunning = false;
    return sendJSON(res, 200, { ok: true });
  }

  if (pathname === '/api/resume' && req.method === 'POST') {
    if (state.gameStarted && !state.gameOver && state.tilesRevealed < state.totalTiles) {
      state.timerRunning = true;
    }
    return sendJSON(res, 200, { ok: true });
  }

  // Next question - callable by BOTH Host and User (no password required)
  if (pathname === '/api/next' && req.method === 'POST') {
    if (!state.gameStarted || state.gameOver) {
      return sendJSON(res, 200, { ok: true }); // no-op
    }
    if (state.currentIndex < state.totalQuestions - 1) {
      state.currentIndex++;
      startNewQuestionReveal();
      state.timerRunning = true;
    } else {
      state.gameOver = true;
      state.timerRunning = false;
    }
    return sendJSON(res, 200, { ok: true });
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Guess the Picture server running on port ${PORT}`);
});
