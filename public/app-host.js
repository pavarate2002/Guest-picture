const socket = io();

const $ = (id) => document.getElementById(id);
const login = $('login');
const panel = $('panel');

let isHost = false;

// ---------------- Login ----------------
function tryLogin() {
  const code = $('code').value;
  socket.emit('host:login', code, (res) => {
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

$('btnResetMath').addEventListener('click', () => {
  if (confirm('รีเกมใหม่ (เก็บรูป/โจทย์ไว้) ?')) socket.emit('host:resetMath');
});
$('btnResetAll').addEventListener('click', () => {
  if (confirm('ลบทั้งหมด (รูป + โจทย์ + ความคืบหน้า) ?')) {
    socket.emit('host:resetAll');
    setTimeout(refreshSlides, 200);
  }
});

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
  for (const f of files) {
    const dataURL = await fileToDataURL(f);
    slides.push({ image: dataURL, question: q });
  }
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
  slides.forEach((s) => {
    const div = document.createElement('div');
    div.className = 'thumb';
    div.innerHTML = `
      <button class="del" title="ลบรูปนี้">✕</button>
      <img src="${s.image}" alt="">
      <input class="q" style="border:none;border-radius:0;background:transparent"
             value="${(s.question || '').replace(/"/g, '&quot;')}" />
    `;
    div.querySelector('.del').addEventListener('click', () => {
      socket.emit('host:removeSlide', s.id);
      setTimeout(refreshSlides, 150);
    });
    const qInput = div.querySelector('.q');
    qInput.addEventListener('change', () => {
      socket.emit('host:updateQuestion', { id: s.id, question: qInput.value });
    });
    wrap.appendChild(div);
  });
}

// ---------------- State sync ----------------
socket.on('state', (s) => {
  $('phasePill').textContent = s.paused ? 'paused' : s.phase;
  $('statPill').textContent = `${s.revealedCount} / ${s.total}`;
  $('uploadCount').textContent = `ในเกมตอนนี้: ${s.total} รูป`;

  // enable/disable controls sensibly
  $('btnCountdown').disabled = s.total === 0;
  $('btnStart').disabled = s.total === 0;
  $('btnNext').disabled = s.total === 0 || s.phase === 'countdown';
});
