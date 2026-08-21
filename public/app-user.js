const socket = io();

const el = {
  stage: document.getElementById('stage'),
  idle: document.getElementById('idle'),
  idleStat: document.getElementById('idleStat'),
  countdown: document.getElementById('countdown'),
  countNum: document.getElementById('countNum'),
  reveal: document.getElementById('reveal'),
  img: document.getElementById('stageImg'),
  revealFill: document.getElementById('revealFill'),
  q: document.getElementById('stageQ'),
  answer: document.getElementById('answer'),
  progress: document.getElementById('progress'),
  pauseBtn: document.getElementById('pauseBtn'),
  scorebar: document.getElementById('scorebar'),
  soundBtn: document.getElementById('soundBtn'),
  fsBtn: document.getElementById('fsBtn'),
};

let last = { phase: null, countdown: null, currentId: null, showAnswer: false };

function show(view) {
  el.idle.classList.toggle('hidden', view !== 'idle');
  el.countdown.classList.toggle('hidden', view !== 'countdown');
  el.reveal.classList.toggle('hidden', view !== 'reveal');
}

function renderScores(teams) {
  if (!teams || teams.length === 0) { el.scorebar.innerHTML = ''; return; }
  el.scorebar.innerHTML = teams
    .map((t) => `<div class="scorechip">${escapeHtml(t.name)}<b>${t.score}</b></div>`)
    .join('');
}
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

socket.on('state', (s) => {
  el.stage.classList.toggle('paused', !!s.paused);
  el.pauseBtn.disabled = !(s.phase === 'countdown' || s.phase === 'revealing');
  el.pauseBtn.textContent = s.paused ? '▶ Resume' : '⏸ Pause';
  el.pauseBtn.classList.toggle('green', s.paused);
  el.pauseBtn.classList.toggle('amber', !s.paused);

  renderScores(s.teams);

  if (s.phase === 'countdown') {
    show('countdown');
    el.countNum.textContent = s.countdown;
    // animate re-pop each second
    if (last.countdown !== s.countdown) {
      el.countNum.style.animation = 'none'; void el.countNum.offsetWidth; el.countNum.style.animation = '';
      if (!s.paused) (s.countdown <= 0 ? Sound.go() : Sound.tick());
    }
  } else if ((s.phase === 'revealing' || s.phase === 'revealed') && s.current) {
    show('reveal');
    if (last.currentId !== s.current.id) {
      el.img.src = s.current.image;
      el.answer.classList.remove('show');
      el.answer.textContent = '';
    }
    el.q.textContent = s.current.question || '';
    el.progress.textContent = `${s.revealedCount} / ${s.total}`;

    // blur reveal effect: blur proportional to blurLeft/blurDuration
    if (s.phase === 'revealing' && s.blurDuration > 0) {
      const frac = Math.max(0, s.blurLeft / s.blurDuration);
      el.img.style.filter = `blur(${(frac * 22).toFixed(1)}px)`;
      el.revealFill.style.width = `${((1 - frac) * 100).toFixed(0)}%`;
    } else {
      el.img.style.filter = 'blur(0px)';
      el.revealFill.style.width = '100%';
      if (last.phase === 'revealing') { Sound.reveal(); confettiBurst(); }
    }

    // answer
    if (s.showAnswer && s.current.answer) {
      if (!last.showAnswer) { Sound.answer(); confettiBurst(); }
      el.answer.textContent = '✅ ' + s.current.answer;
      el.answer.classList.add('show');
    } else {
      el.answer.classList.remove('show');
    }
  } else {
    show('idle');
    el.idleStat.textContent = s.total ? `พร้อมแล้ว ${s.total} รูป` : 'ยังไม่มีรูป — ให้ Host อัปโหลดก่อน';
    el.img.style.filter = 'blur(0px)';
  }

  last = { phase: s.phase, countdown: s.countdown, currentId: s.current ? s.current.id : null, showAnswer: s.showAnswer };
});

el.pauseBtn.addEventListener('click', () => socket.emit('togglePause'));

// sound toggle
el.soundBtn.addEventListener('click', () => {
  const on = !Sound.isEnabled();
  Sound.setEnabled(on);
  el.soundBtn.textContent = on ? '🔊' : '🔇';
  if (on) Sound.tick();
});

// fullscreen
el.fsBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
});

// simple confetti
function confettiBurst() {
  const colors = ['#e10a1a', '#ff3b46', '#f59e0b', '#22c55e', '#3b82f6', '#ffffff'];
  for (let i = 0; i < 60; i++) {
    const d = document.createElement('div');
    d.className = 'confetti';
    d.style.left = Math.random() * 100 + 'vw';
    d.style.background = colors[(Math.random() * colors.length) | 0];
    const dur = 1.6 + Math.random() * 1.4;
    d.style.transition = `transform ${dur}s ease-in, opacity ${dur}s`;
    document.body.appendChild(d);
    requestAnimationFrame(() => {
      d.style.transform = `translateY(105vh) rotate(${(Math.random() * 720 - 360) | 0}deg)`;
      d.style.opacity = '0';
    });
    setTimeout(() => d.remove(), dur * 1000 + 100);
  }
}
