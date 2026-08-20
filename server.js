/**
 * Guess the Picture — Game Server
 * Pure Node.js (no external dependencies) — works on Render.com, Railway, Glitch,
 * or run locally with: node server.js
 *
 * Roles:
 *  - Host : open /host  -> upload a picture + type a question/prompt, then "Send to Game"
 *  - User : open /      -> the shared screen. Shows the question + a covered picture grid.
 *           Controls here: Start (auto-reveal random tiles on a timer), Pause/Resume,
 *           Reveal All, Reset, and an adjustable interval. Tiles can also be clicked manually.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const GRID_SIZE = 16; // 4 x 4

// ---------- In-memory game state ----------
let game = {
  question: '',
  imageData: null, // base64 data URL
  hasGame: false,
};

let progress = {
  revealed: [],     // array of revealed tile indices
  order: [],        // remaining shuffled indices left to auto-reveal
  running: false,
  paused: false,
  intervalSec: 4,
};

let revealTimer = null;
let sseClients = new Set();

function shuffledIndices(n) {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    res.write(payload);
  }
}

function progressSnapshot() {
  return {
    revealed: progress.revealed,
    total: GRID_SIZE,
    running: progress.running,
    paused: progress.paused,
    intervalSec: progress.intervalSec,
  };
}

function broadcastProgress() {
  broadcast('progress', progressSnapshot());
}

function stopTimer() {
  if (revealTimer) {
    clearInterval(revealTimer);
    revealTimer = null;
  }
}

function tick() {
  if (progress.order.length === 0) {
    finishAutoReveal();
    return;
  }
  const idx = progress.order.shift();
  if (!progress.revealed.includes(idx)) {
    progress.revealed.push(idx);
  }
  broadcastProgress();
  if (progress.order.length === 0) {
    finishAutoReveal();
  }
}

function finishAutoReveal() {
  stopTimer();
  progress.running = false;
  progress.paused = false;
  broadcastProgress();
}

function setGame(imageData, question) {
  game = { imageData, question: (question || '').toString().slice(0, 300), hasGame: true };
  stopTimer();
  progress = {
    revealed: [],
    order: shuffledIndices(GRID_SIZE),
    running: false,
    paused: false,
    intervalSec: progress.intervalSec || 4,
  };
  broadcast('game', { question: game.question, imageData: game.imageData, total: GRID_SIZE });
  broadcastProgress();
}

function startAutoReveal(intervalSec) {
  if (!game.hasGame) return;
  if (progress.running && !progress.paused) return;
  if (typeof intervalSec === 'number' && intervalSec > 0) {
    progress.intervalSec = intervalSec;
  }
  if (progress.order.length === 0 && progress.revealed.length < GRID_SIZE) {
    // rebuild order from tiles not yet revealed (safety net)
    const remaining = [];
    for (let i = 0; i < GRID_SIZE; i++) if (!progress.revealed.includes(i)) remaining.push(i);
    progress.order = remaining.sort(() => Math.random() - 0.5);
  }
  progress.running = true;
  progress.paused = false;
  stopTimer();
  revealTimer = setInterval(tick, progress.intervalSec * 1000);
  broadcastProgress();
}

function pauseAutoReveal() {
  if (!progress.running || progress.paused) return;
  stopTimer();
  progress.paused = true;
  broadcastProgress();
}

function resumeAutoReveal() {
  if (!progress.running || !progress.paused) return;
  progress.paused = false;
  stopTimer();
  revealTimer = setInterval(tick, progress.intervalSec * 1000);
  broadcastProgress();
}

function revealAllTiles() {
  stopTimer();
  progress.revealed = Array.from({ length: GRID_SIZE }, (_, i) => i);
  progress.order = [];
  progress.running = false;
  progress.paused = false;
  broadcastProgress();
}

function resetReveal() {
  stopTimer();
  progress.revealed = [];
  progress.order = shuffledIndices(GRID_SIZE);
  progress.running = false;
  progress.paused = false;
  broadcastProgress();
}

function manualReveal(index) {
  if (typeof index !== 'number' || index < 0 || index >= GRID_SIZE) return;
  if (progress.revealed.includes(index)) return;
  progress.revealed.push(index);
  progress.order = progress.order.filter((i) => i !== index);
  broadcastProgress();
  if (progress.revealed.length === GRID_SIZE) {
    finishAutoReveal();
  }
}

// ---------- Static file serving ----------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function serveStatic(req, res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ---- SSE stream ----
  if (pathname === '/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('\n');
    sseClients.add(res);
    if (game.hasGame) {
      res.write(`event: game\ndata: ${JSON.stringify({ question: game.question, imageData: game.imageData, total: GRID_SIZE })}\n\n`);
    }
    res.write(`event: progress\ndata: ${JSON.stringify(progressSnapshot())}\n\n`);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // ---- Host API ----
  if (pathname === '/api/host/set-game' && req.method === 'POST') {
    const body = await readBody(req);
    setGame(body.imageData, body.question);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // ---- User (shared screen) API ----
  if (pathname === '/api/user/start' && req.method === 'POST') {
    const body = await readBody(req);
    startAutoReveal(body.intervalSec);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (pathname === '/api/user/pause' && req.method === 'POST') {
    pauseAutoReveal();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (pathname === '/api/user/resume' && req.method === 'POST') {
    resumeAutoReveal();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (pathname === '/api/user/reveal-all' && req.method === 'POST') {
    revealAllTiles();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (pathname === '/api/user/reset' && req.method === 'POST') {
    resetReveal();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (pathname === '/api/user/reveal-tile' && req.method === 'POST') {
    const body = await readBody(req);
    manualReveal(body.index);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // ---- Static pages ----
  if (pathname === '/' || pathname === '/user.html' || pathname === '/index.html') {
    serveStatic(req, res, path.join(PUBLIC_DIR, 'user.html'));
    return;
  }
  if (pathname === '/host' || pathname === '/host.html') {
    serveStatic(req, res, path.join(PUBLIC_DIR, 'host.html'));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Guess the Picture server running on http://localhost:${PORT}`);
  console.log(`  User page (share this): http://localhost:${PORT}/`);
  console.log(`  Host page             : http://localhost:${PORT}/host`);
});
