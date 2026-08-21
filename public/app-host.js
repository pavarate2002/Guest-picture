const socket = io();
const $ = (id) => document.getElementById(id);
const login = $('login');
const panel = $('panel');
let isHost = false;

// ---------------- Login ----------------
function tryLogin() {
  socket.emit('host:login', $('code').value, (res) => {
    if (res && res.ok) {
      isHost = true;
      login.classList.add('hidden');
      panel.classList.remove('hidden');
      refreshSlides();
    } else {
      $('loginErr').textContent = 'รหัสไม่ถูกต้อง ลองใหม่อีกครั้ง';
    }
  });
}
$('loginBtn').addEventListener('click', tryLogin);
$('code').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });

// ---------------- Controls ----------------
$('btnCountdown').addEventListener('click', () => socket.emit('host:countdownStart'));
$('btnStart').addEventListener('click', () => socket.emit('host:start'));
$('btnNext').addEventListener('click', () => socket.emit('host:next'));
$('btnAnswer').addEventListener('click', () => socket.emit('host:showAnswer'));

$('btnResetMath').addEventListener('click', () => {
  if (confirm('รีเกม + รีคะแนน (เก็บรูป/โจทย์/เฉลย และทีมไว้) ?')) socket.emit('host:resetMath');
});
$('btnResetAll').addEventListener('click', () => {
  if (confirm('ลบทั้งหมด (รูป + โจทย์ + เฉลย + ทีม + คะแนน) ?')) {
    socket.emit('host:resetAll');
    setTimeout(refreshSlides, 200);
  }
});

$('btnCfg').addEventListener('click', () => {
  socket.emit('host:setConfig', {
    countdownFrom: parseInt($('cfgCountdown').value, 10),
    blurDuration: parseInt($('cfgBlur').value, 10),
  });
  $('btnCfg').textContent = '✅ บันทึกแล้ว';
  setTimeout(() => ($('btnCfg').textContent = '💾 บันทึกตั้งค่า'), 1200);
});

// ---------------- Teams ----------------
$('btnAddTeam').addEventListener('click', () => {
  const nm = $('teamName').value.trim();
  if (!nm) return;
  socket.emit('host:addTeam', nm);
  $('teamName').value = '';
});
$('teamName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnAddTeam').click(); });

function renderTeams(teams) {
  const wrap = $('teams');
  wrap.innerHTML = '';
  (teams || []).forEach((t) => {
    const d = document.createElement('div');
    d.className = 'teamrow';
    d.innerHTML = `
      <span class="nm"></span>
      <button class="btn ghost sm minus">−1</button>
      <span class="sc"></span>
      <button class="btn green sm plus">+1</button>
      <button class="btn ghost sm plus5">+5</button>
      <button class="btn ghost sm del">✕</button>`;
    d.querySelector('.nm').textContent = t.name;
    d.querySelector('.sc').textContent = t.score;
    d.querySelector('.plus').onclick = () => socket.emit('host:score', { id: t.id, delta: 1 });
    d.querySelector('.plus5').onclick = () => socket.emit('host:score', { id: t.id, delta: 5 });
    d.querySelector('.minus').onclick = () => socket.emit('host:score', { id: t.id, delta: -1 });
    d.querySelector('.del').onclick = () => { if (confirm('ลบทีม ' + t.name + ' ?')) socket.emit('host:removeTeam', t.id); };
    wrap.appendChild(d);
  });
}

// ---------------- Upload ----------------
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
$('btnUpload').addEventListener('click', async () => {
  const files = Array.from($('files').files || []);
  if (files.length === 0) { $('uploadStatus').textContent = 'ยังไม่ได้เลือกรูป'; return; }
  const q = $('defaultQ').value;
  $('uploadStatus').textContent = `กำลังอัปโหลด ${files.length} รูป…`;
  const slides = [];
  for (const f of files) slides.push({ image: await fileToDataURL(f), question: q, answer: '' });
  socket.emit('host:addSlides', slides);
  $('files').value = '';
  $('uploadStatus').textContent = `✅ เพิ่มแล้ว ${files.length} รูป`;
  setTimeout(refreshSlides, 250);
});

// ---------------- Slides list ----------------
function refreshSlides() {
  if (!isHost) return;
  socket.emit('host:listSlides', null, (slides) => renderSlides(slides || []));
}
function renderSlides(slides) {
  $('slideCount').textContent = slides.length;
  const wrap = $('slides');
  wrap.innerHTML = '';
  slides.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'thumb';
    div.innerHTML = `
      <span class="tag">#${i + 1}</span>
      <button class="del" title="ลบรูปนี้">✕</button>
      <img alt="">
      <div class="meta">
        <input class="q" placeholder="โจทย์…">
        <input class="a" placeholder="เฉลย… (เช่น Corolla Cross)">
      </div>`;
    div.querySelector('img').src = s.image;
    const qi = div.querySelector('.q'); qi.value = s.question || '';
    const ai = div.querySelector('.a'); ai.value = s.answer || '';
    qi.addEventListener('change', () => socket.emit('host:updateSlide', { id: s.id, question: qi.value }));
    ai.addEventListener('change', () => socket.emit('host:updateSlide', { id: s.id, answer: ai.value }));
    div.querySelector('.del').addEventListener('click', () => {
      socket.emit('host:removeSlide', s.id);
      setTimeout(refreshSlides, 150);
    });
    wrap.appendChild(div);
  });
}

// ---------------- State sync ----------------
let cfgInit = false;
socket.on('state', (s) => {
  $('phasePill').textContent = s.paused ? 'paused' : s.phase;
  $('statPill').textContent = `${s.revealedCount} / ${s.total}`;
  $('uploadCount').textContent = `ในเกมตอนนี้: ${s.total} รูป`;
  $('btnCountdown').disabled = s.total === 0;
  $('btnStart').disabled = s.total === 0;
  $('btnNext').disabled = s.total === 0 || s.phase === 'countdown';
  $('btnAnswer').disabled = s.currentIndex < 0;
  renderTeams(s.teams);
  if (!cfgInit) {
    $('cfgCountdown').value = s.countdownFrom;
    $('cfgBlur').value = s.blurDuration;
    cfgInit = true;
  }
});
