const socket = io();

const el = {
  stage: document.getElementById('stage'),
  idle: document.getElementById('idle'),
  idleStat: document.getElementById('idleStat'),
  countdown: document.getElementById('countdown'),
  countNum: document.getElementById('countNum'),
  reveal: document.getElementById('reveal'),
  img: document.getElementById('stageImg'),
  q: document.getElementById('stageQ'),
  progress: document.getElementById('progress'),
  pauseBtn: document.getElementById('pauseBtn'),
};

function show(view) {
  el.idle.classList.toggle('hidden', view !== 'idle');
  el.countdown.classList.toggle('hidden', view !== 'countdown');
  el.reveal.classList.toggle('hidden', view !== 'reveal');
}

socket.on('state', (s) => {
  // paused visual
  el.stage.classList.toggle('paused', !!s.paused);

  // pause button only active during countdown
  el.pauseBtn.disabled = s.phase !== 'countdown';
  el.pauseBtn.textContent = s.paused ? '▶ Resume' : '⏸ Pause';
  el.pauseBtn.classList.toggle('green', s.paused);
  el.pauseBtn.classList.toggle('amber', !s.paused);

  if (s.phase === 'countdown') {
    show('countdown');
    el.countNum.textContent = s.countdown;
  } else if (s.phase === 'revealed' && s.current) {
    show('reveal');
    el.img.src = s.current.image;
    el.q.textContent = s.current.question || '';
    el.progress.textContent = `${s.revealedCount} / ${s.total}`;
  } else {
    show('idle');
    el.idleStat.textContent = s.total
      ? `พร้อมแล้ว ${s.total} รูป`
      : 'ยังไม่มีรูป — ให้ Host อัปโหลดก่อน';
  }
});

// Pause / resume from the user screen
el.pauseBtn.addEventListener('click', () => socket.emit('togglePause'));
