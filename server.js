// ============================================================
//  Transformation Night · Guest Picture  (v3)
//  Single-file server: serves User page (/) and Host page (/host)
//  CSS flags (work on Windows), real-time via Socket.io
// ============================================================
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 }); // 100MB for images

const HOST_CODE = 'pqc';
const PORT = process.env.PORT || 3000;

// ---------- Game state ----------
function freshState() {
  return {
    slides: [],   // [{ img, q1, q2, q3 }]
    index: 0,
    revealed: false,
    countdown: { running: false, startAt: 0, duration: 5, paused: false, pausedRemaining: 0 }
  };
}
let state = freshState();

function publicState(forHost) {
  const cur = state.slides[state.index] || null;
  return {
    total: state.slides.length,
    index: state.index,
    revealed: state.revealed,
    countdown: state.countdown,
    current: cur ? {
      img: (state.revealed || forHost) ? cur.img : null,
      q1: cur.q1, q2: cur.q2, q3: cur.q3
    } : null,
    slides: forHost ? state.slides.map(s => ({ q1: s.q1, q2: s.q2, q3: s.q3, hasImg: !!s.img })) : undefined
  };
}
function broadcast() {
  io.to('hosts').emit('state', publicState(true));
  io.to('users').emit('state', publicState(false));
}
function stopCountdown() {
  state.countdown = { running: false, startAt: 0, duration: state.countdown.duration || 5, paused: false, pausedRemaining: 0 };
}

// ---------- Socket ----------
io.on('connection', (socket) => {
  socket.isHost = false;

  socket.on('join:user', () => { socket.join('users'); socket.emit('state', publicState(false)); });

  socket.on('host:login', (code, cb) => {
    if (code === HOST_CODE) {
      socket.isHost = true; socket.join('hosts');
      socket.emit('state', publicState(true));
      cb && cb({ ok: true });
    } else { cb && cb({ ok: false, msg: 'รหัสไม่ถูกต้อง' }); }
  });

  const guard = (fn) => (...a) => { if (socket.isHost) fn(...a); };

  socket.on('host:addSlide', guard((s) => {
    state.slides.push({ img: s.img || '', q1: s.q1 || '', q2: s.q2 || '', q3: s.q3 || '' });
    broadcast();
  }));
  socket.on('host:updateSlide', guard(({ i, slide }) => {
    if (state.slides[i]) { state.slides[i] = { ...state.slides[i], ...slide }; broadcast(); }
  }));
  socket.on('host:deleteSlide', guard((i) => {
    if (state.slides[i]) {
      state.slides.splice(i, 1);
      if (state.index >= state.slides.length) state.index = Math.max(0, state.slides.length - 1);
      state.revealed = false; stopCountdown(); broadcast();
    }
  }));
  socket.on('host:goto', guard((i) => {
    if (i >= 0 && i < state.slides.length) { state.index = i; state.revealed = false; stopCountdown(); broadcast(); }
  }));
  socket.on('host:next', guard(() => {
    if (state.index < state.slides.length - 1) { state.index++; state.revealed = false; stopCountdown(); broadcast(); }
  }));
  socket.on('host:prev', guard(() => {
    if (state.index > 0) { state.index--; state.revealed = false; stopCountdown(); broadcast(); }
  }));

  // countdown / reveal
  socket.on('host:countdownStart', guard((dur) => {
    state.countdown = { running: true, startAt: Date.now(), duration: dur || 5, paused: false, pausedRemaining: 0 };
    state.revealed = false; broadcast();
  }));
  socket.on('host:start', guard(() => { state.revealed = true; stopCountdown(); broadcast(); }));
  socket.on('host:pause', guard(() => {
    const c = state.countdown;
    if (c.running && !c.paused) {
      const elapsed = (Date.now() - c.startAt) / 1000;
      c.pausedRemaining = Math.max(0, c.duration - elapsed); c.paused = true;
    } else if (c.running && c.paused) {
      c.startAt = Date.now() - (c.duration - c.pausedRemaining) * 1000; c.paused = false;
    }
    broadcast();
  }));

  // resets
  socket.on('host:restartGame', guard(() => {
    state.index = 0; state.revealed = false; stopCountdown();
    io.to('users').emit('flash', 'เริ่มเกมใหม่!'); broadcast();
  }));
  socket.on('host:resetMatch', guard(() => { state.index = 0; state.revealed = false; stopCountdown(); broadcast(); }));
  socket.on('host:resetAll', guard(() => { state = freshState(); broadcast(); }));
});

// ---------- Shared CSS (flags drawn with CSS so they render on Windows) ----------
const FLAG_CSS = `
  .flag { display:inline-block; position:relative; overflow:hidden; flex:0 0 auto;
    border-radius:4px; box-shadow:0 0 0 1px rgba(255,255,255,.25); background:#fff; }
  /* Thailand: red / white / blue(double) / white / red */
  .flag-th { background:linear-gradient(#A51931 0 16.66%, #fff 16.66% 33.33%, #2D2A4A 33.33% 66.66%, #fff 66.66% 83.33%, #A51931 83.33% 100%); }
  /* Japan: white with red disc */
  .flag-jp { background:#fff; }
  .flag-jp::after { content:''; position:absolute; inset:0; margin:auto; width:52%; aspect-ratio:1; border-radius:50%; background:#BC002D; }
  /* USA: 13 stripes + blue canton */
  .flag-us { background:repeating-linear-gradient(#B22234 0 7.69%, #fff 7.69% 15.38%); }
  .flag-us::before { content:''; position:absolute; top:0; left:0; width:42%; height:53.8%; background:#3C3B6E; }
`;

// ---------- USER PAGE ----------
const USER_HTML = `<!DOCTYPE html>
<html lang="th"><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<title>Guest Picture</title>
<script src="/socket.io/socket.io.js"></script>
<style>
  :root { --neon:#00e5ff; --neon2:#ff2bd6; }
  * { box-sizing:border-box; margin:0; padding:0; }
  html,body { height:100%; overflow:hidden; }
  body { font-family:'Segoe UI',Tahoma,sans-serif; background:#05060f; color:#fff;
    height:100vh; height:100dvh; display:flex; flex-direction:column; }
  .host-link { position:fixed; top:10px; right:12px; z-index:50; font-size:12px; color:#7f8cff;
    text-decoration:none; border:1px solid #2a2f55; padding:4px 10px; border-radius:20px;
    background:rgba(10,12,30,.6); }
  .host-link:hover { color:var(--neon); border-color:var(--neon); }
  .stage { flex:1; display:flex; flex-direction:column; padding:12px; gap:10px; min-height:0; }
  .image-wrap { position:relative; flex:1; min-height:0; display:flex; align-items:center; justify-content:center;
    border-radius:18px; overflow:hidden; background:radial-gradient(circle at 50% 30%, #101636, #05060f 70%);
    border:1px solid #1c2350; box-shadow:0 0 40px rgba(0,229,255,.15) inset; }
  .image-wrap img { max-width:100%; max-height:100%; object-fit:contain; border-radius:12px; }
  .placeholder { font-size:clamp(40px,12vw,140px); font-weight:800; letter-spacing:4px;
    color:#20264f; text-shadow:0 0 30px rgba(0,229,255,.2); }
  .countdown { position:absolute; inset:0; display:none; align-items:center; justify-content:center; z-index:20;
    background:rgba(3,4,12,.55); backdrop-filter:blur(2px); }
  .countdown.show { display:flex; }
  .countdown .num { font-size:clamp(120px,40vh,420px); font-weight:900; line-height:1; color:#fff;
    text-shadow:0 0 40px var(--neon),0 0 80px var(--neon2); animation:pop .9s ease-out; }
  @keyframes pop { 0%{transform:scale(.4);opacity:.2} 40%{transform:scale(1.15);opacity:1} 100%{transform:scale(1)} }
  .countdown .go { color:#39ff88; text-shadow:0 0 40px #39ff88,0 0 90px #39ff88; }
  .question { flex:0 0 auto; display:flex; flex-direction:column; gap:8px; padding:12px 16px;
    border-radius:14px; background:rgba(12,16,38,.75); border:1px solid #1c2350; }
  .q-line { display:flex; align-items:center; gap:14px; font-size:clamp(14px,2.2vw,22px); min-height:1.5em; }
  .q-line .flag { width:clamp(30px,4vw,42px); height:clamp(20px,2.7vw,28px); }
  .q-line .txt { color:#e8ecff; }
  .q-line.empty .txt { color:#3a4170; }
  .flash { position:fixed; inset:0; display:none; align-items:center; justify-content:center; z-index:80;
    background:rgba(3,4,12,.7); }
  .flash.show { display:flex; }
  .flash span { font-size:clamp(30px,8vw,90px); font-weight:900; color:var(--neon); text-shadow:0 0 40px var(--neon2); }
  ${FLAG_CSS}
</style></head>
<body>
  <a class="host-link" href="/host">Host</a>
  <div class="stage">
    <div class="image-wrap">
      <div id="placeholder" class="placeholder">?</div>
      <img id="pic" style="display:none"/>
      <div id="countdown" class="countdown"><div id="cd-num" class="num"></div></div>
    </div>
    <div class="question">
      <div class="q-line empty" id="line1"><span class="flag flag-th"></span><span class="txt" id="t1"></span></div>
      <div class="q-line empty" id="line2"><span class="flag flag-us"></span><span class="txt" id="t2"></span></div>
      <div class="q-line empty" id="line3"><span class="flag flag-jp"></span><span class="txt" id="t3"></span></div>
    </div>
  </div>
  <div class="flash" id="flash"><span id="flashText"></span></div>
<script>
  var socket = io();
  socket.on('connect', function(){ socket.emit('join:user'); });
  var pic = document.getElementById('pic');
  var placeholder = document.getElementById('placeholder');
  var cd = document.getElementById('countdown');
  var cdNum = document.getElementById('cd-num');
  var cdTimer = null;
  function setLine(lineId, txtId, text){
    var line = document.getElementById(lineId), txt = document.getElementById(txtId);
    txt.textContent = text || '';
    if (text) line.classList.remove('empty'); else line.classList.add('empty');
  }
  function render(s){
    if (s.current && s.current.img && s.revealed){
      pic.src = s.current.img; pic.style.display='block'; placeholder.style.display='none';
    } else { pic.style.display='none'; placeholder.style.display='block'; }
    if (s.current){ setLine('line1','t1',s.current.q1); setLine('line2','t2',s.current.q2); setLine('line3','t3',s.current.q3); }
    else { setLine('line1','t1',''); setLine('line2','t2',''); setLine('line3','t3',''); }
    handleCountdown(s.countdown);
  }
  function handleCountdown(c){
    if (cdTimer){ clearInterval(cdTimer); cdTimer=null; }
    if (!c || !c.running){ cd.classList.remove('show'); return; }
    cd.classList.add('show');
    function tick(){
      var remaining = c.paused ? c.pausedRemaining : (c.duration - (Date.now()-c.startAt)/1000);
      if (remaining <= 0.05){ cdNum.textContent='GO!'; cdNum.classList.add('go'); clearInterval(cdTimer); cdTimer=null; return; }
      cdNum.classList.remove('go');
      var shown = Math.ceil(remaining);
      if (cdNum.textContent !== String(shown)){
        cdNum.textContent = shown; cdNum.style.animation='none'; void cdNum.offsetWidth; cdNum.style.animation='pop .9s ease-out';
      }
    }
    tick();
    if (!c.paused) cdTimer = setInterval(tick, 100);
  }
  socket.on('state', render);
  socket.on('flash', function(msg){
    var f = document.getElementById('flash');
    document.getElementById('flashText').textContent = msg;
    f.classList.remove('show'); void f.offsetWidth; f.classList.add('show');
    setTimeout(function(){ f.classList.remove('show'); }, 1700);
  });
</script>
</body></html>`;

// ---------- HOST PAGE ----------
const HOST_HTML = `<!DOCTYPE html>
<html lang="th"><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Host · Guest Picture</title>
<script src="/socket.io/socket.io.js"></script>
<style>
  :root { --neon:#00e5ff; --neon2:#ff2bd6; --ok:#39ff88; --warn:#ffb020; --bad:#ff4d6d; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Segoe UI',Tahoma,sans-serif; background:#05060f; color:#e8ecff; padding:16px; }
  .login { max-width:340px; margin:16vh auto; text-align:center; background:#0b1030;
    border:1px solid #1c2350; border-radius:16px; padding:28px; }
  input, textarea { width:100%; padding:10px 12px; border-radius:10px; border:1px solid #2a2f55;
    background:#0a0e26; color:#fff; font-size:15px; margin-bottom:10px; font-family:inherit; }
  input:focus { outline:none; border-color:var(--neon); }
  .err { color:var(--bad); font-size:13px; min-height:18px; }
  .app { display:none; grid-template-columns:1fr 1fr; gap:16px; max-width:1100px; margin:0 auto; }
  @media(max-width:820px){ .app { grid-template-columns:1fr; } }
  .card { background:#0b1030; border:1px solid #1c2350; border-radius:16px; padding:16px; }
  .card h3 { font-size:15px; margin-bottom:12px; color:var(--neon); }
  button { cursor:pointer; border:none; border-radius:10px; padding:10px 14px; font-size:14px;
    font-weight:600; color:#05060f; transition:.15s; font-family:inherit; }
  button:hover { transform:translateY(-1px); }
  .btn-add { background:var(--neon); width:100%; }
  .btn-nav { background:#2a2f55; color:#fff; }
  .btn-count { background:var(--warn); }
  .btn-start { background:var(--ok); }
  .btn-pause { background:#7f8cff; width:100%; }
  .btn-restart { background:#00c2b8; width:100%; }
  .btn-rmatch { background:#5a63a0; color:#fff; }
  .btn-rall { background:var(--bad); }
  .btn-del { background:var(--bad); padding:5px 9px; font-size:12px; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .controls { display:flex; flex-direction:column; gap:10px; }
  .sep { height:1px; background:#1c2350; margin:6px 0; }
  .status { font-size:13px; color:#8b93c9; margin-bottom:10px; line-height:1.6; }
  .status b { color:#fff; }
  /* input rows with flags (Host) */
  .qrow { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
  .qrow .flag { width:32px; height:22px; }
  .qrow input { margin-bottom:0; }
  .filebtn { display:block; padding:10px; text-align:center; border:1px dashed #2a2f55;
    border-radius:10px; color:#8b93c9; cursor:pointer; margin-bottom:12px; }
  .hint { font-size:11px; color:#5a63a0; margin-top:4px; }
  .slide-item { display:flex; align-items:center; gap:8px; padding:8px; border:1px solid #1c2350;
    border-radius:10px; margin-bottom:6px; }
  .slide-item.active { border-color:var(--neon); background:rgba(0,229,255,.06); }
  .slide-item img { width:52px; height:40px; object-fit:cover; border-radius:6px; background:#05060f; }
  .slide-item .meta { flex:1; font-size:12px; color:#b7bde8; overflow:hidden; }
  .slide-item .meta div { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .slide-item .go { background:#2a2f55; color:#fff; padding:5px 9px; font-size:12px; }
  .preview { text-align:center; }
  .preview img { max-width:100%; max-height:200px; border-radius:10px; border:1px solid #1c2350; }
  .preview .ph { padding:40px; color:#3a4170; font-size:48px; }
  .pv-line { display:flex; align-items:center; gap:8px; font-size:12px; color:#b7bde8; margin-top:4px; text-align:left; }
  .pv-line .flag { width:24px; height:16px; }
  ${FLAG_CSS}
</style></head>
<body>
  <div class="login" id="login">
    <h2 style="margin-bottom:14px">Host Login</h2>
    <input type="password" id="code" placeholder="ใส่รหัส Host"/>
    <button class="btn-add" onclick="login()">เข้าสู่ระบบ</button>
    <div class="err" id="loginErr"></div>
    <p style="font-size:12px;margin-top:10px"><a href="/" style="color:#7f8cff">กลับหน้า User</a></p>
  </div>

  <div class="app" id="app">
    <div>
      <div class="card">
        <h3>เพิ่มโจทย์ (รูป + คำถาม 3 ภาษา)</h3>
        <label class="filebtn" for="imgFile" id="fileLabel">เลือกรูปภาพ</label>
        <input type="file" id="imgFile" accept="image/*" style="display:none"/>
        <div class="qrow"><span class="flag flag-th"></span><input id="q1" placeholder="คำถามภาษาไทย"/></div>
        <div class="qrow"><span class="flag flag-us"></span><input id="q2" placeholder="Question (English)"/></div>
        <div class="qrow"><span class="flag flag-jp"></span><input id="q3" placeholder="質問 (日本語)"/></div>
        <button class="btn-add" onclick="addSlide()">เพิ่มลงเกม</button>
        <div class="hint">รูปจะยังไม่โชว์ให้ผู้เล่นจนกว่าจะกด Start</div>
      </div>
      <div class="card" style="margin-top:16px">
        <h3>รายการโจทย์ทั้งหมด</h3>
        <div id="slideList"></div>
      </div>
    </div>

    <div>
      <div class="card">
        <h3>แผงควบคุมเกม</h3>
        <div class="status" id="status"></div>
        <div class="preview" id="preview"><div class="ph">?</div></div>
        <div class="sep"></div>
        <div class="controls">
          <div class="grid2">
            <button class="btn-nav" onclick="socket.emit('host:prev')">◀ ก่อนหน้า</button>
            <button class="btn-nav" onclick="socket.emit('host:next')">ถัดไป ▶</button>
          </div>
          <div class="grid2">
            <button class="btn-count" onclick="socket.emit('host:countdownStart',5)">Countdown Start (5)</button>
            <button class="btn-start" onclick="socket.emit('host:start')">▶ Start (เปิดรูป)</button>
          </div>
          <button class="btn-pause" onclick="socket.emit('host:pause')">⏸ Pause / หยุดเวลา (กดซ้ำ = ไปต่อ)</button>
          <div class="sep"></div>
          <button class="btn-restart" onclick="socket.emit('host:restartGame')">🔄 Restart Game (เริ่มใหม่ ทุกอย่างอยู่ครบ)</button>
          <div class="grid2">
            <button class="btn-rmatch" onclick="socket.emit('host:resetMatch')">↩ Reset Match</button>
            <button class="btn-rall" onclick="confirmResetAll()">🗑 Reset All (ลบหมด)</button>
          </div>
        </div>
      </div>
      <p style="text-align:center;margin-top:12px"><a href="/" style="color:#7f8cff;font-size:13px">เปิดหน้า User (จอโชว์) →</a></p>
    </div>
  </div>

<script>
  var socket = io();
  var pendingImg = '';
  function login(){
    var code = document.getElementById('code').value.trim();
    socket.emit('host:login', code, function(res){
      if (res && res.ok){ document.getElementById('login').style.display='none'; document.getElementById('app').style.display='grid'; }
      else { document.getElementById('loginErr').textContent = (res && res.msg) || 'เข้าสู่ระบบไม่สำเร็จ'; }
    });
  }
  document.getElementById('code').addEventListener('keydown', function(e){ if(e.key==='Enter') login(); });

  document.getElementById('imgFile').addEventListener('change', function(e){
    var file = e.target.files[0]; if(!file) return;
    var reader = new FileReader();
    reader.onload = function(ev){
      var img = new Image();
      img.onload = function(){
        var max=1400, w=img.width, h=img.height;
        if (w>max || h>max){ var r=Math.min(max/w,max/h); w*=r; h*=r; }
        var cv=document.createElement('canvas'); cv.width=w; cv.height=h;
        cv.getContext('2d').drawImage(img,0,0,w,h);
        pendingImg = cv.toDataURL('image/jpeg',0.85);
        document.getElementById('fileLabel').textContent = '✅ ' + file.name;
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  function addSlide(){
    var q1=document.getElementById('q1').value.trim();
    var q2=document.getElementById('q2').value.trim();
    var q3=document.getElementById('q3').value.trim();
    if(!pendingImg && !q1 && !q2 && !q3){ alert('ใส่รูปหรือคำถามอย่างน้อย 1 อย่าง'); return; }
    socket.emit('host:addSlide', { img:pendingImg, q1:q1, q2:q2, q3:q3 });
    pendingImg=''; document.getElementById('imgFile').value='';
    document.getElementById('fileLabel').textContent='เลือกรูปภาพ';
    document.getElementById('q1').value=''; document.getElementById('q2').value=''; document.getElementById('q3').value='';
  }
  function confirmResetAll(){ if(confirm('ลบรูปและคำถามทั้งหมด? ย้อนกลับไม่ได้')) socket.emit('host:resetAll'); }
  function esc(t){ return (t||'').replace(/[&<>"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]; }); }
  function flagLine(cls, text){ return '<div class="pv-line"><span class="flag '+cls+'"></span>'+esc(text||'-')+'</div>'; }

  socket.on('state', function(s){
    document.getElementById('status').innerHTML =
      'โจทย์: <b>' + (s.total ? (s.index+1)+' / '+s.total : '—') + '</b>' +
      ' · รูป: <b>' + (s.revealed ? 'เปิดแล้ว' : 'ปิดอยู่') + '</b>' +
      (s.countdown && s.countdown.running ? ' · ⏱ กำลังนับ' + (s.countdown.paused ? ' (พัก)' : '') : '');

    var pv = document.getElementById('preview');
    if (s.current){
      var imgHtml = s.current.img ? '<img src="'+s.current.img+'"/>' : '<div class="ph">?</div>';
      pv.innerHTML = imgHtml + flagLine('flag-th', s.current.q1) + flagLine('flag-us', s.current.q2) + flagLine('flag-jp', s.current.q3);
    } else { pv.innerHTML = '<div class="ph">?</div>'; }

    var list = document.getElementById('slideList');
    if (!s.slides || !s.slides.length){ list.innerHTML='<div style="color:#5a63a0;font-size:13px">ยังไม่มีโจทย์</div>'; return; }
    list.innerHTML = s.slides.map(function(sl,i){
      return '<div class="slide-item '+(i===s.index?'active':'')+'">'+
        '<div class="meta"><div>#'+(i+1)+' '+(sl.hasImg?'🖼':'—')+'</div>'+
        '<div>'+esc(sl.q1||'-')+'</div></div>'+
        '<button class="go" onclick="socket.emit(\\'host:goto\\','+i+')">ไป</button>'+
        '<button class="btn-del" onclick="socket.emit(\\'host:deleteSlide\\','+i+')">ลบ</button>'+
      '</div>';
    }).join('');
  });
</script>
</body></html>`;

// ---------- Routes ----------
app.get('/', (req, res) => res.type('html').send(USER_HTML));
app.get('/host', (req, res) => res.type('html').send(HOST_HTML));

server.listen(PORT, () => console.log('Guest Picture v3 running on port ' + PORT));
