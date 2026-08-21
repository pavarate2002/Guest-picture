/**
 * Guest Picture v3 - Guess the Car Model
 * Transformation Night TOYOTA
 *
 * Server-authoritative game: countdown, reveal-timer and pause stay in sync
 * on every screen (fixes pause delay / second-counting lag).
 *
 * New in v3:
 *   - Blur-reveal: image starts blurred, clears over the reveal timer -> tension!
 *   - Answer field per slide + "Show Answer" broadcast.
 *   - Adjustable countdown length & reveal (blur) duration.
 *   - Scoreboard: host can +/- points for teams, shown on the user screen.
 *   - Sound cues (client-side Web Audio, no assets needed).
 */

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 });

const HOST_CODE = process.env.HOST_CODE || 'pqc';

app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
let state = {
  slides: [],           // [{ id, image, question, answer }]
  queue: [],            // shuffled indexes not shown yet
  currentIndex: -1,
  phase: 'idle',        // idle | countdown | revealing | revealed
  countdown: 5,
  countdownFrom: 5,     // configurable
  blurDuration: 8,      // seconds for blur to clear
  blurLeft: 8,          // seconds remaining in blur reveal
  paused: false,
  showAnswer: false,
  revealedCount: 0,
  teams: [],            // [{ id, name, score }]
};

let timer = null;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function rebuildQueue() { state.queue = shuffle(state.slides.map((_, i) => i)); }

function publicState() {
  return {
    total: state.slides.length,
    currentIndex: state.currentIndex,
    phase: state.phase,
    countdown: state.countdown,
    countdownFrom: state.countdownFrom,
    blurDuration: state.blurDuration,
    blurLeft: state.blurLeft,
    paused: state.paused,
    showAnswer: state.showAnswer,
    revealedCount: state.revealedCount,
    remaining: state.queue.length,
    teams: state.teams,
    // current slide WITHOUT answer unless showAnswer=true (so answer can't leak early)
    current: state.currentIndex >= 0 ? {
      id: state.slides[state.currentIndex].id,
      image: state.slides[state.currentIndex].image,
      question: state.slides[state.currentIndex].question,
      answer: state.showAnswer ? state.slides[state.currentIndex].answer : null,
    } : null,
  };
}

function broadcast() { io.emit('state', publicState()); }
function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

function pickNextIndex() {
  if (state.queue.length === 0) rebuildQueue();
  if (state.queue.length === 0) return -1;
  return state.queue.shift();
}

// Reveal picks a random slide, starts blurred, then clears over blurDuration
function reveal() {
  stopTimer();
  const idx = pickNextIndex();
  if (idx === -1) { state.phase = 'idle'; broadcast(); return; }
  state.currentIndex = idx;
  state.phase = 'revealing';
  state.showAnswer = false;
  state.paused = false;
  state.blurLeft = state.blurDuration;
  state.revealedCount += 1;
  broadcast();

  if (state.blurDuration <= 0) { state.phase = 'revealed'; broadcast(); return; }
  timer = setInterval(() => {
    if (state.paused) return;
    state.blurLeft -= 1;
    if (state.blurLeft <= 0) {
      stopTimer();
      state.phase = 'revealed';
      broadcast();
    } else {
      broadcast();
    }
  }, 1000);
}

function startCountdown() {
  if (state.slides.length === 0) return;
  stopTimer();
  state.phase = 'countdown';
  state.countdown = state.countdownFrom;
  state.paused = false;
  broadcast();
  timer = setInterval(() => {
    if (state.paused) return;
    state.countdown -= 1;
    if (state.countdown <= 0) reveal();
    else broadcast();
  }, 1000);
}

function resetMath() {
  stopTimer();
  state.currentIndex = -1;
  state.phase = 'idle';
  state.countdown = state.countdownFrom;
  state.blurLeft = state.blurDuration;
  state.paused = false;
  state.showAnswer = false;
  state.revealedCount = 0;
  state.teams.forEach((t) => (t.score = 0));   // reset scores, keep teams
  rebuildQueue();
  broadcast();
}

function resetAll() {
  stopTimer();
  const cf = state.countdownFrom, bd = state.blurDuration;
  state = {
    slides: [], queue: [], currentIndex: -1, phase: 'idle',
    countdown: cf, countdownFrom: cf, blurDuration: bd, blurLeft: bd,
    paused: false, showAnswer: false, revealedCount: 0, teams: [],
  };
  broadcast();
}

// ---------------------------------------------------------------------------
io.on('connection', (socket) => {
  socket.emit('state', publicState());

  socket.on('host:login', (code, cb) => {
    const ok = String(code).trim() === HOST_CODE;
    if (ok) socket.data.isHost = true;
    if (typeof cb === 'function') cb({ ok });
  });
  const requireHost = (fn) => (...a) => { if (socket.data.isHost) fn(...a); };

  // slides
  socket.on('host:addSlides', requireHost((slides) => {
    if (!Array.isArray(slides)) return;
    slides.forEach((s) => {
      if (s && s.image) state.slides.push({
        id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        image: s.image, question: s.question || '', answer: s.answer || '',
      });
    });
    rebuildQueue(); broadcast();
  }));
  socket.on('host:updateSlide', requireHost(({ id, question, answer }) => {
    const s = state.slides.find((x) => x.id === id);
    if (s) {
      if (question !== undefined) s.question = question;
      if (answer !== undefined) s.answer = answer;
      broadcast();
    }
  }));
  socket.on('host:removeSlide', requireHost((id) => {
    state.slides = state.slides.filter((x) => x.id !== id);
    if (state.currentIndex >= state.slides.length) state.currentIndex = -1;
    rebuildQueue(); broadcast();
  }));
  socket.on('host:listSlides', requireHost((_, cb) => {
    if (typeof cb === 'function') cb(state.slides);
  }));

  // settings
  socket.on('host:setConfig', requireHost(({ countdownFrom, blurDuration }) => {
    if (Number.isFinite(countdownFrom)) state.countdownFrom = Math.max(0, Math.min(10, countdownFrom | 0));
    if (Number.isFinite(blurDuration)) state.blurDuration = Math.max(0, Math.min(30, blurDuration | 0));
    broadcast();
  }));

  // controls
  socket.on('host:countdownStart', requireHost(() => startCountdown()));
  socket.on('host:start', requireHost(() => reveal()));
  socket.on('host:next', requireHost(() => { if (state.phase !== 'countdown') reveal(); }));
  socket.on('host:showAnswer', requireHost(() => {
    if (state.currentIndex < 0) return;
    state.showAnswer = true;
    if (state.phase === 'revealing') { stopTimer(); state.phase = 'revealed'; state.blurLeft = 0; }
    broadcast();
  }));
  socket.on('host:clearImage', requireHost(() => {
    stopTimer(); state.phase = 'revealing'; state.blurLeft = 0; state.phase = 'revealed'; broadcast();
  }));
  socket.on('host:resetMath', requireHost(() => resetMath()));
  socket.on('host:resetAll', requireHost(() => resetAll()));

  // teams / scoreboard
  socket.on('host:addTeam', requireHost((name) => {
    const nm = String(name || '').trim();
    if (!nm) return;
    state.teams.push({ id: Date.now() + '_' + Math.random().toString(36).slice(2, 6), name: nm, score: 0 });
    broadcast();
  }));
  socket.on('host:removeTeam', requireHost((id) => {
    state.teams = state.teams.filter((t) => t.id !== id); broadcast();
  }));
  socket.on('host:score', requireHost(({ id, delta }) => {
    const t = state.teams.find((x) => x.id === id);
    if (t) { t.score += (delta | 0); broadcast(); }
  }));

  // pause available Host + User
  socket.on('togglePause', () => {
    if (state.phase !== 'countdown' && state.phase !== 'revealing') return;
    state.paused = !state.paused; broadcast();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Guest Picture v3 running on :${PORT}`));
