/**
 * Guest Picture - Guess the Car Model
 * Transformation Night TOYOTA
 *
 * Server-authoritative game so the countdown/pause is in sync on every screen
 * (fixes the "pause delay" and "second counting lag" problems).
 *
 * Roles:
 *   - HOST  : enters code "pqc". Uploads image+question pairs, controls the game.
 *   - USER  : the team screen shared to the audience (no name needed).
 *
 * Buttons:
 *   - Countdown Start : counts 5..1 then reveals a RANDOM picture.
 *   - Start           : reveals a random picture immediately (host press = users can act).
 *   - Pause / Resume  : freezes / continues the countdown (available on Host & User).
 *   - Next            : go to the next random picture.
 *   - Reset Math      : restart the game (score/progress) but KEEP images & questions.
 *   - Reset All       : delete everything (images, questions and progress).
 */

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 }); // 100MB for image uploads

const HOST_CODE = process.env.HOST_CODE || 'pqc';
const COUNTDOWN_FROM = 5;

app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Game state (in-memory - perfect for a single live event)
// ---------------------------------------------------------------------------
let state = {
  slides: [],          // [{ id, image(dataURL), question }]
  queue: [],           // shuffled indexes not shown yet (true random, no repeat)
  currentIndex: -1,    // index of the slide currently revealed
  phase: 'idle',       // 'idle' | 'countdown' | 'revealed'
  countdown: COUNTDOWN_FROM,
  paused: false,
  revealedCount: 0,
};

let timer = null;

// Fisher-Yates shuffle -> genuinely random order
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rebuildQueue() {
  const idx = state.slides.map((_, i) => i);
  state.queue = shuffle(idx);
}

// Public snapshot sent to clients (slides list without heavy images for control panel)
function publicState() {
  return {
    total: state.slides.length,
    currentIndex: state.currentIndex,
    phase: state.phase,
    countdown: state.countdown,
    paused: state.paused,
    revealedCount: state.revealedCount,
    remaining: state.queue.length,
    current: state.currentIndex >= 0 ? state.slides[state.currentIndex] : null,
  };
}

function broadcast() {
  io.emit('state', publicState());
}

function stopTimer() {
  if (timer) { clearInterval(timer); timer = null; }
}

function pickNextIndex() {
  if (state.queue.length === 0) rebuildQueue();          // reshuffle when exhausted
  if (state.queue.length === 0) return -1;               // no slides at all
  return state.queue.shift();
}

function reveal() {
  stopTimer();
  const idx = pickNextIndex();
  if (idx === -1) { state.phase = 'idle'; broadcast(); return; }
  state.currentIndex = idx;
  state.phase = 'revealed';
  state.paused = false;
  state.revealedCount += 1;
  broadcast();
}

function startCountdown() {
  if (state.slides.length === 0) return;
  stopTimer();
  state.phase = 'countdown';
  state.countdown = COUNTDOWN_FROM;
  state.paused = false;
  broadcast();
  timer = setInterval(() => {
    if (state.paused) return;                 // pause = freeze tick (server-side = accurate)
    state.countdown -= 1;
    if (state.countdown <= 0) {
      reveal();                               // 0 -> reveal random picture
    } else {
      broadcast();
    }
  }, 1000);
}

function resetMath() {
  stopTimer();
  state.currentIndex = -1;
  state.phase = 'idle';
  state.countdown = COUNTDOWN_FROM;
  state.paused = false;
  state.revealedCount = 0;
  rebuildQueue();                             // keep slides, fresh shuffle
  broadcast();
}

function resetAll() {
  stopTimer();
  state = {
    slides: [], queue: [], currentIndex: -1, phase: 'idle',
    countdown: COUNTDOWN_FROM, paused: false, revealedCount: 0,
  };
  broadcast();
}

// ---------------------------------------------------------------------------
// Socket handlers
// ---------------------------------------------------------------------------
io.on('connection', (socket) => {
  socket.emit('state', publicState());

  // ---- Host authentication ----
  socket.on('host:login', (code, cb) => {
    const ok = String(code).trim() === HOST_CODE;
    if (ok) socket.data.isHost = true;
    if (typeof cb === 'function') cb({ ok });
  });

  const requireHost = (fn) => (...args) => {
    if (!socket.data.isHost) return;
    fn(...args);
  };

  // ---- Slide management ----
  socket.on('host:addSlides', requireHost((slides) => {
    // slides: [{ image(dataURL), question }]
    if (!Array.isArray(slides)) return;
    slides.forEach((s) => {
      if (s && s.image) {
        state.slides.push({
          id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
          image: s.image,
          question: s.question || '',
        });
      }
    });
    rebuildQueue();
    broadcast();
  }));

  socket.on('host:updateQuestion', requireHost(({ id, question }) => {
    const s = state.slides.find((x) => x.id === id);
    if (s) { s.question = question || ''; broadcast(); }
  }));

  socket.on('host:removeSlide', requireHost((id) => {
    state.slides = state.slides.filter((x) => x.id !== id);
    if (state.currentIndex >= state.slides.length) state.currentIndex = -1;
    rebuildQueue();
    broadcast();
  }));

  socket.on('host:listSlides', requireHost((_, cb) => {
    if (typeof cb === 'function') cb(state.slides);
  }));

  // ---- Game controls (Host + User can pause/resume) ----
  socket.on('host:countdownStart', requireHost(() => startCountdown()));
  socket.on('host:start', requireHost(() => reveal()));      // immediate reveal
  socket.on('host:next', requireHost(() => {
    if (state.phase === 'countdown') return;
    reveal();
  }));
  socket.on('host:resetMath', requireHost(() => resetMath()));
  socket.on('host:resetAll', requireHost(() => resetAll()));

  // Pause / resume allowed from Host OR User screen (better timing control)
  socket.on('pause', () => {
    if (state.phase !== 'countdown') return;
    state.paused = true;
    broadcast();
  });
  socket.on('resume', () => {
    if (state.phase !== 'countdown') return;
    state.paused = false;
    broadcast();
  });
  socket.on('togglePause', () => {
    if (state.phase !== 'countdown') return;
    state.paused = !state.paused;
    broadcast();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Guest Picture running on :${PORT}`));
