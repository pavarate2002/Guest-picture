// Transformation Night - Guest Picture
// Real-time Host/User game with Socket.io
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 }); // 100MB for image payloads

const HOST_CODE = 'pqc';
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// ---- Game state (in-memory) ----
function freshState() {
  return {
    slides: [],        // [{ img, q1, q2, q3 }]
    index: 0,          // current slide index
    revealed: false,   // is the image shown to users
    countdown: {
      running: false,
      startAt: 0,      // server timestamp (ms) when countdown started
      duration: 5,     // seconds
      paused: false,
      pausedRemaining: 0
    }
  };
}
let state = freshState();

// Build the payload sent to clients (users don't need to know slide count)
function publicState(forHost) {
  const cur = state.slides[state.index] || null;
  return {
    total: state.slides.length,
    index: state.index,
    revealed: state.revealed,
    countdown: state.countdown,
    current: cur ? {
      img: state.revealed || forHost ? cur.img : null, // hide image from user until revealed
      q1: cur.q1, q2: cur.q2, q3: cur.q3
    } : null,
    // host-only full list
    slides: forHost ? state.slides.map(s => ({ q1: s.q1, q2: s.q2, q3: s.q3, hasImg: !!s.img })) : undefined
  };
}

function broadcast() {
  io.to('hosts').emit('state', publicState(true));
  io.to('users').emit('state', publicState(false));
}

io.on('connection', (socket) => {
  socket.isHost = false;

  socket.on('join:user', () => {
    socket.join('users');
    socket.emit('state', publicState(false));
  });

  socket.on('host:login', (code, cb) => {
    if (code === HOST_CODE) {
      socket.isHost = true;
      socket.join('hosts');
      socket.emit('state', publicState(true));
      cb && cb({ ok: true });
    } else {
      cb && cb({ ok: false, msg: 'รหัสไม่ถูกต้อง' });
    }
  });

  const guard = (fn) => (...args) => { if (socket.isHost) fn(...args); };

  // ---- Slide management ----
  socket.on('host:addSlide', guard((slide) => {
    state.slides.push({
      img: slide.img || '',
      q1: slide.q1 || '',
      q2: slide.q2 || '',
      q3: slide.q3 || ''
    });
    broadcast();
  }));

  socket.on('host:updateSlide', guard(({ i, slide }) => {
    if (state.slides[i]) {
      state.slides[i] = { ...state.slides[i], ...slide };
      broadcast();
    }
  }));

  socket.on('host:deleteSlide', guard((i) => {
    if (state.slides[i]) {
      state.slides.splice(i, 1);
      if (state.index >= state.slides.length) state.index = Math.max(0, state.slides.length - 1);
      state.revealed = false;
      stopCountdown();
      broadcast();
    }
  }));

  socket.on('host:goto', guard((i) => {
    if (i >= 0 && i < state.slides.length) {
      state.index = i;
      state.revealed = false;
      stopCountdown();
      broadcast();
    }
  }));

  socket.on('host:next', guard(() => {
    if (state.index < state.slides.length - 1) {
      state.index++;
      state.revealed = false;
      stopCountdown();
      broadcast();
    }
  }));

  socket.on('host:prev', guard(() => {
    if (state.index > 0) {
      state.index--;
      state.revealed = false;
      stopCountdown();
      broadcast();
    }
  }));

  // ---- Countdown / reveal ----
  // Countdown is driven by a server timestamp; clients compute remaining locally
  // to avoid per-second network delay.
  socket.on('host:countdownStart', guard((duration) => {
    state.countdown = {
      running: true,
      startAt: Date.now(),
      duration: duration || 5,
      paused: false,
      pausedRemaining: 0
    };
    state.revealed = false; // image hidden during the count; revealed on Start
    broadcast();
  }));

  socket.on('host:start', guard(() => {
    // reveal the image immediately
    state.revealed = true;
    stopCountdown();
    broadcast();
  }));

  socket.on('host:pause', guard(() => {
    const c = state.countdown;
    if (c.running && !c.paused) {
      const elapsed = (Date.now() - c.startAt) / 1000;
      c.pausedRemaining = Math.max(0, c.duration - elapsed);
      c.paused = true;
    } else if (c.running && c.paused) {
      // resume
      c.startAt = Date.now() - (c.duration - c.pausedRemaining) * 1000;
      c.paused = false;
    }
    broadcast();
  }));

  function stopCountdown() {
    state.countdown = { running: false, startAt: 0, duration: state.countdown.duration || 5, paused: false, pausedRemaining: 0 };
  }

  // ---- Reset variants ----
  // Reset Match: keep slides + questions, restart progress (index 0, hide image)
  socket.on('host:resetMatch', guard(() => {
    state.index = 0;
    state.revealed = false;
    stopCountdown();
    broadcast();
  }));

  // Restart Game (NEW): everything stays, just start a fresh round from the beginning
  socket.on('host:restartGame', guard(() => {
    state.index = 0;
    state.revealed = false;
    stopCountdown();
    io.to('users').emit('flash', 'เริ่มเกมใหม่!');
    broadcast();
  }));

  // Reset All: wipe everything
  socket.on('host:resetAll', guard(() => {
    state = freshState();
    broadcast();
  }));
});

server.listen(PORT, () => console.log('Guest Picture running on port ' + PORT));
