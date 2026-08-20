/**
 * Guess the Picture - Host & Player Game Server
 * Pure Node.js (no external dependencies) so it runs anywhere, including
 * Render.com as a "Web Service" with zero npm installs required.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
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
};

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
        // Fully revealed - pause automatically until Host/User press Next
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

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, 'public', filePath);

  // Prevent path traversal
  if (!filePath.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

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
      state.tilesRevealed = 0;
      state.tickCounter = 0;
      state.timerRunning = true;
      return sendJSON(res, 200, { ok: true });
    });
  }

  if (pathname === '/api/host/stop' && req.method === 'POST') {
    return readJSONBody(req, (err, body) => {
      if (err || body.password !== HOST_PASSWORD) return sendJSON(res, 401, { ok: false, error: 'Unauthorized' });
      state.timerRunning = false;
      return sendJSON(res, 200, { ok: true });
    });
  }

  if (pathname === '/api/host/resume' && req.method === 'POST') {
    return readJSONBody(req, (err, body) => {
      if (err || body.password !== HOST_PASSWORD) return sendJSON(res, 401, { ok: false, error: 'Unauthorized' });
      if (state.gameStarted && !state.gameOver && state.tilesRevealed < state.totalTiles) {
        state.timerRunning = true;
      }
      return sendJSON(res, 200, { ok: true });
    });
  }

  if (pathname === '/api/host/reset' && req.method === 'POST') {
    return readJSONBody(req, (err, body) => {
      if (err || body.password !== HOST_PASSWORD) return sendJSON(res, 401, { ok: false, error: 'Unauthorized' });
      state.gameStarted = false;
      state.gameOver = false;
      state.currentIndex = 0;
      state.tilesRevealed = 0;
      state.tickCounter = 0;
      state.timerRunning = false;
      if (body.clearQuestions) state.questions = freshQuestions();
      return sendJSON(res, 200, { ok: true });
    });
  }

  // Next question - callable by BOTH Host and User (no password required)
  if (pathname === '/api/next' && req.method === 'POST') {
    if (!state.gameStarted || state.gameOver) {
      return sendJSON(res, 200, { ok: true }); // no-op
    }
    if (state.currentIndex < state.totalQuestions - 1) {
      state.currentIndex++;
      state.tilesRevealed = 0;
      state.tickCounter = 0;
      state.timerRunning = true;
    } else {
      state.gameOver = true;
      state.timerRunning = false;
    }
    return sendJSON(res, 200, { ok: true });
  }

  // ---------- STATIC FILES ----------
  if (req.method === 'GET') {
    return serveStatic(req, res, pathname);
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Guess the Picture server running on port ${PORT}`);
});
