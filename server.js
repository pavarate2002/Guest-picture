// ============================================================
//  Transformation Night · GUEST PICTURE  (v4.7)
//  SINGLE FILE — no /public folder, no .html files.
//    User page  = /            (TWO-COLUMN layout: left=title+questions, right=big image)
//    Host page  = /host
//    Version    = /version   -> {"version":"v4.5"}
//
//  HOST buttons:
//   1) Pause / หยุดเวลา  (on Host window)
//   2) Reset ลบข้อมูลทั้งหมด
//   3) Reset เริ่มเกมใหม่ (รูป+โจทย์ยังอยู่ครบ)
//   4) เพิ่มโจทย์: 1 ข้อ = 1 รูป + 3 คำถาม (ไทย/อังกฤษ/ญี่ปุ่น) บังคับครบ
// ============================================================
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const APP_VERSION = 'v4.7';
const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 });

const HOST_CODE = 'pqc';
const PORT = process.env.PORT || 3000;
const TILE_COUNT = 16;
const TILE_INTERVAL = 5000;

function freshState() { return { slides: [], index: 0, phase: 'idle', reveal: null }; }
let state = freshState();
let tileTimer = null;

function clearTileTimer() { if (tileTimer) { clearInterval(tileTimer); tileTimer = null; } }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function openTilesArray() {
  const arr = new Array(TILE_COUNT).fill(false);
  if (state.phase === 'full') return arr.fill(true);
  if (state.phase === 'tiles' && state.reveal) { for (let i = 0; i < state.reveal.revealedCount; i++) arr[state.reveal.order[i]] = true; }
  return arr;
}
function publicState(forHost) {
  const cur = state.slides[state.index] || null;
  const showImg = (state.phase !== 'idle') || forHost;
  return {
    version: APP_VERSION, total: state.slides.length, index: state.index, phase: state.phase,
    tilesOpen: openTilesArray(), revealedCount: state.reveal ? state.reveal.revealedCount : 0,
    tileCount: TILE_COUNT, revealPaused: state.reveal ? state.reveal.paused : false,
    nextAt: state.reveal ? state.reveal.nextAt : 0,
    pausedRemaining: state.reveal ? state.reveal.pausedRemaining : 0,
    intervalSec: TILE_INTERVAL / 1000,
    current: cur ? { img: showImg ? cur.img : null, q1: cur.q1, q2: cur.q2, q3: cur.q3 } : null,
    slides: forHost ? state.slides.map(s => ({ q1: s.q1, q2: s.q2, q3: s.q3, hasImg: !!s.img })) : undefined
  };
}
function broadcast() { io.to('hosts').emit('state', publicState(true)); io.to('users').emit('state', publicState(false)); }
function startTiles() {
  clearTileTimer(); state.phase = 'tiles';
  state.reveal = { order: shuffle([...Array(TILE_COUNT).keys()]), revealedCount: 0, paused: false, nextAt: Date.now() + TILE_INTERVAL, pausedRemaining: 0 };
  broadcast();
  tileTimer = setInterval(() => {
    const r = state.reveal;
    if (!r || state.phase !== 'tiles') { clearTileTimer(); return; }
    if (r.paused) return;
    if (Date.now() >= r.nextAt) {
      if (r.revealedCount < TILE_COUNT) { r.revealedCount++; r.nextAt = Date.now() + TILE_INTERVAL; broadcast(); }
      if (r.revealedCount >= TILE_COUNT) clearTileTimer();
    }
  }, 200);
}
function stopReveal() { clearTileTimer(); state.reveal = null; }

io.on('connection', (socket) => {
  socket.isHost = false;
  socket.on('join:user', () => { socket.join('users'); socket.emit('state', publicState(false)); });
  socket.on('host:login', (code, cb) => {
    if (code === HOST_CODE) { socket.isHost = true; socket.join('hosts'); socket.emit('state', publicState(true)); cb && cb({ ok: true }); }
    else { cb && cb({ ok: false, msg: 'รหัสไม่ถูกต้อง' }); }
  });
  const guard = (fn) => (...a) => { if (socket.isHost) fn(...a); };

  socket.on('host:addSlide', guard((s) => { state.slides.push({ img: s.img || '', q1: s.q1 || '', q2: s.q2 || '', q3: s.q3 || '' }); broadcast(); }));
  socket.on('host:deleteSlide', guard((i) => {
    if (state.slides[i]) { state.slides.splice(i, 1); if (state.index >= state.slides.length) state.index = Math.max(0, state.slides.length - 1); state.phase = 'idle'; stopReveal(); broadcast(); }
  }));
  socket.on('host:goto', guard((i) => { if (i >= 0 && i < state.slides.length) { state.index = i; state.phase = 'idle'; stopReveal(); broadcast(); } }));
  socket.on('host:next', guard(() => { if (state.index < state.slides.length - 1) { state.index++; state.phase = 'idle'; stopReveal(); broadcast(); } }));
  socket.on('host:prev', guard(() => { if (state.index > 0) { state.index--; state.phase = 'idle'; stopReveal(); broadcast(); } }));
  socket.on('host:countdownStart', guard(() => { startTiles(); }));
  socket.on('host:start', guard(() => { state.phase = 'full'; clearTileTimer(); broadcast(); }));
  socket.on('host:pause', guard(() => {
    const r = state.reveal; if (state.phase !== 'tiles' || !r) return;
    if (!r.paused) { r.pausedRemaining = Math.max(0, r.nextAt - Date.now()); r.paused = true; }
    else { r.nextAt = Date.now() + (r.pausedRemaining || TILE_INTERVAL); r.paused = false; }
    broadcast();
  }));
  socket.on('host:restartGame', guard(() => { state.index = 0; state.phase = 'idle'; stopReveal(); io.to('users').emit('flash', 'เริ่มเกมใหม่!'); broadcast(); }));
  socket.on('host:resetAll', guard(() => { stopReveal(); state = freshState(); broadcast(); }));
});

// ---------- Shared CSS: flags drawn with CSS (render on Windows) ----------
const FLAG_CSS = `
  .flag { display:inline-block; position:relative; overflow:hidden; flex:0 0 auto;
    border-radius:4px; box-shadow:0 0 0 1px rgba(255,255,255,.25); background:#fff; }
  .flag-th { background:linear-gradient(#A51931 0 16.66%, #fff 16.66% 33.33%, #2D2A4A 33.33% 66.66%, #fff 66.66% 83.33%, #A51931 83.33% 100%); }
  .flag-jp { background:#fff; }
  .flag-jp::after { content:''; position:absolute; inset:0; margin:auto; width:52%; aspect-ratio:1; border-radius:50%; background:#BC002D; }
  .flag-us { background:repeating-linear-gradient(#B22234 0 7.69%, #fff 7.69% 15.38%); }
  .flag-us::before { content:''; position:absolute; top:0; left:0; width:42%; height:53.8%; background:#3C3B6E; }
`;

// ---------- USER PAGE (TWO-COLUMN) ----------
const USER_HTML = `<!DOCTYPE html>
<html lang="th"><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<title>Guest Picture</title>
<script src="/socket.io/socket.io.js"></script>
<style>
  :root { --neon:#00e5ff; --neon2:#ff2bd6; --neon3:#7d5bff; }
  * { box-sizing:border-box; margin:0; padding:0; }
  html,body { height:100%; overflow:hidden; }
  body { font-family:'Segoe UI',Tahoma,sans-serif; background:#04040c; color:#fff;
    height:100vh; height:100dvh; display:flex; gap:12px; padding:12px;
    background-image:radial-gradient(circle at 15% 0%, rgba(125,91,255,.15), transparent 40%),
                     radial-gradient(circle at 85% 100%, rgba(255,43,214,.12), transparent 40%); }
  .vertag { position:fixed; bottom:6px; right:10px; z-index:60; font-size:10px; color:#2f3560; letter-spacing:1px; }

  /* LEFT column */
  .left { flex:0 0 32%; max-width:460px; display:flex; flex-direction:column; gap:12px; min-height:0; }
  .panel { border-radius:16px; border:1px solid #1c2350; background:rgba(12,16,38,.75); box-shadow:0 0 24px rgba(125,91,255,.12); }
  .title-panel { position:relative; padding:16px 14px 14px; text-align:center; }
  .host-link { position:fixed; bottom:8px; left:8px; z-index:70; font-size:11px; color:#7f8cff; text-decoration:none; border:1px solid #2a2f55; padding:4px 10px; border-radius:20px; background:rgba(10,12,30,.7); }
  .host-link:hover { color:var(--neon); border-color:var(--neon); }
  .led-title { display:inline-block; font-weight:900; letter-spacing:5px; font-size:clamp(24px, 3vw, 40px);
    background:linear-gradient(90deg,#00e5ff,#7d5bff,#ff2bd6,#00e5ff); background-size:300% 100%;
    -webkit-background-clip:text; background-clip:text; color:transparent;
    animation:hue 6s linear infinite, flicker 4s infinite; text-shadow:0 0 18px rgba(0,229,255,.35); }
  .led-title .dot { color:#ff2bd6; -webkit-text-fill-color:#ff2bd6; animation:blink 1.1s steps(1) infinite; }
  @keyframes hue { to { background-position:300% 0; } }
  @keyframes blink { 50% { opacity:.15; } }
  @keyframes flicker { 0%,19%,21%,23%,80%,100%{opacity:1} 20%,22%{opacity:.7} }
  .subtitle { margin-top:3px; font-size:clamp(9px,1vw,12px); letter-spacing:4px; color:#5a63a0; text-transform:uppercase; }
  .question { flex:1; min-height:0; display:flex; flex-direction:column; justify-content:flex-start; gap:18px; padding:22px 20px; }
  .q-line { display:flex; align-items:center; gap:16px; font-size:clamp(16px,1.8vw,26px); min-height:1.5em; }
  .q-line .flag { width:clamp(40px,3.4vw,58px); height:clamp(27px,2.3vw,38px); }
  .q-line .txt { color:#e8ecff; word-break:break-word; }
  .q-line.empty .txt { color:#3a4170; }
  /* countdown timer under questions */
  .timer { margin-top:auto; display:none; align-items:center; justify-content:center; padding-top:14px; }
  .timer.show { display:flex; }
  .timer-num { font-weight:900; line-height:1; font-size:clamp(70px,10vw,150px);
    color:#fff; text-shadow:0 0 30px var(--neon), 0 0 60px var(--neon2);
    background:linear-gradient(90deg,#00e5ff,#7d5bff,#ff2bd6); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
    animation:tpop .5s ease-out; }
  @keyframes tpop { 0%{transform:scale(.5);opacity:.3} 55%{transform:scale(1.12);opacity:1} 100%{transform:scale(1)} }

  /* RIGHT column */
  .right { flex:1; min-height:0; }
  .image-wrap { position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center;
    border-radius:18px; overflow:hidden; background:radial-gradient(circle at 50% 40%, #0c1030, #04040c 72%);
    border:1px solid #1c2350; box-shadow:0 0 40px rgba(0,229,255,.15) inset, 0 0 30px rgba(125,91,255,.15); }
  .image-wrap img { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; }
  .placeholder { font-size:clamp(80px,18vw,260px); font-weight:800; color:#20264f; text-shadow:0 0 30px rgba(0,229,255,.2); z-index:1; }
  .tiles { position:absolute; inset:0; display:grid; z-index:5; grid-template-columns:repeat(4,1fr); grid-template-rows:repeat(4,1fr); gap:0; padding:0; pointer-events:none; }
  .tiles.hidden { display:none; }
  .tile { position:relative; overflow:hidden; background:linear-gradient(135deg,#141a45,#0a0e26);
    box-shadow:0 0 12px rgba(0,229,255,.18) inset;
    transition:transform .55s cubic-bezier(.2,.8,.2,1), opacity .55s ease; transform-style:preserve-3d; }
  .tile::before { content:''; position:absolute; inset:0; background:repeating-linear-gradient(45deg, rgba(0,229,255,.08) 0 8px, transparent 8px 16px); animation:scan 3s linear infinite; }
  .tile::after { content:''; position:absolute; inset:0; margin:auto; width:38%; height:38%; border-radius:50%; background:radial-gradient(circle, rgba(0,229,255,.55), transparent 70%); filter:blur(2px); animation:pulse 2.4s ease-in-out infinite; }
  @keyframes scan { to { background-position:32px 0; } }
  @keyframes pulse { 0%,100%{opacity:.35;transform:scale(.85)} 50%{opacity:.9;transform:scale(1.1)} }
  .tile.open { transform:rotateY(90deg) scale(.4); opacity:0; }

  .flash { position:fixed; inset:0; display:none; align-items:center; justify-content:center; z-index:80; background:rgba(3,4,12,.7); }
  .flash.show { display:flex; }
  .flash span { font-size:clamp(30px,8vw,90px); font-weight:900; color:var(--neon); text-shadow:0 0 40px var(--neon2); }

  @media(max-width:760px){
    body { flex-direction:column; }
    .left { flex:0 0 auto; max-width:none; }
    .right { flex:1; }
    .question { gap:10px; padding:14px 16px; }
  }
  ${FLAG_CSS}
</style></head>
<body>
  <div class="vertag">${APP_VERSION}</div>
  <a class="host-link" href="/host">🔒 Host</a>
  <div class="left">
    <div class="panel title-panel">
      <div class="led-title">GUEST<span class="dot">·</span>PICTURE</div>
      <div class="subtitle">Transformation Night</div>
    </div>
    <div class="panel question">
      <div class="q-line empty" id="line1"><span class="flag flag-th"></span><span class="txt" id="t1"></span></div>
      <div class="q-line empty" id="line2"><span class="flag flag-us"></span><span class="txt" id="t2"></span></div>
      <div class="q-line empty" id="line3"><span class="flag flag-jp"></span><span class="txt" id="t3"></span></div>
      <div class="timer" id="timer"><div class="timer-num" id="timerNum">5</div></div>
    </div>
  </div>
  <div class="right">
    <div class="image-wrap">
      <div id="placeholder" class="placeholder">?</div>
      <img id="pic" style="display:none"/>
      <div id="tiles" class="tiles hidden"></div>
    </div>
  </div>
  <div class="flash" id="flash"><span id="flashText"></span></div>
<script>
  var socket = io();
  socket.on('connect', function(){ socket.emit('join:user'); });
  var pic=document.getElementById('pic'), placeholder=document.getElementById('placeholder'), tilesEl=document.getElementById('tiles');
  var timerEl=document.getElementById('timer'), timerNum=document.getElementById('timerNum');
  var TILE_N=16, tileNodes=[];
  for (var i=0;i<TILE_N;i++){ var d=document.createElement('div'); d.className='tile'; tilesEl.appendChild(d); tileNodes.push(d); }
  function setLine(lineId, txtId, text){ var line=document.getElementById(lineId), txt=document.getElementById(txtId); txt.textContent=text||''; if(text) line.classList.remove('empty'); else line.classList.add('empty'); }

  var cur = null, cdTimer = null;
  function stopCd(){ if(cdTimer){ clearInterval(cdTimer); cdTimer=null; } }
  function updateTimer(){
    if(!cur || cur.phase!=='tiles' || (cur.revealedCount>=cur.tileCount)){ timerEl.classList.remove('show'); stopCd(); return; }
    timerEl.classList.add('show');
    var remaining;
    if(cur.revealPaused){ remaining = (cur.pausedRemaining||0)/1000; }
    else { remaining = (cur.nextAt - Date.now())/1000; }
    if(remaining < 0) remaining = 0;
    var shown = Math.max(1, Math.min(cur.intervalSec||5, Math.ceil(remaining)));
    if(timerNum.textContent !== String(shown)){
      timerNum.textContent = shown;
      timerNum.style.animation='none'; void timerNum.offsetWidth; timerNum.style.animation='tpop .5s ease-out';
    }
  }
  function render(s){
    cur = s;
    if (s.current && s.current.img){ pic.src=s.current.img; pic.style.display='block'; placeholder.style.display='none'; }
    else { pic.style.display='none'; placeholder.style.display='block'; }
    var showTiles = !!(s.current && s.current.img) && s.phase !== 'full';
    tilesEl.classList.toggle('hidden', !showTiles);
    var open=s.tilesOpen||[]; for (var i=0;i<TILE_N;i++){ tileNodes[i].classList.toggle('open', !!open[i]); }
    if (s.current){ setLine('line1','t1',s.current.q1); setLine('line2','t2',s.current.q2); setLine('line3','t3',s.current.q3); }
    else { setLine('line1','t1',''); setLine('line2','t2',''); setLine('line3','t3',''); }
    // countdown timer
    stopCd();
    if(s.phase==='tiles' && s.revealedCount < s.tileCount){
      updateTimer();
      if(!s.revealPaused) cdTimer = setInterval(updateTimer, 120);
    } else { timerEl.classList.remove('show'); }
  }
  socket.on('state', render);
  socket.on('flash', function(msg){ var f=document.getElementById('flash'); document.getElementById('flashText').textContent=msg; f.classList.remove('show'); void f.offsetWidth; f.classList.add('show'); setTimeout(function(){ f.classList.remove('show'); }, 1700); });
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
  body { font-family:'Segoe UI',Tahoma,sans-serif; background:#04040c; color:#e8ecff; padding:16px; }
  .vertag { position:fixed; top:6px; left:8px; font-size:10px; color:#2f3560; }
  .login { max-width:340px; margin:16vh auto; text-align:center; background:#0b1030; border:1px solid #1c2350; border-radius:16px; padding:28px; }
  input { width:100%; padding:10px 12px; border-radius:10px; border:1px solid #2a2f55; background:#0a0e26; color:#fff; font-size:15px; margin-bottom:10px; font-family:inherit; }
  input:focus { outline:none; border-color:var(--neon); }
  .err { color:var(--bad); font-size:13px; min-height:18px; }
  .app { display:none; grid-template-columns:1fr 1fr; gap:16px; max-width:1100px; margin:0 auto; }
  @media(max-width:820px){ .app { grid-template-columns:1fr; } }
  .card { background:#0b1030; border:1px solid #1c2350; border-radius:16px; padding:16px; }
  .card h3 { font-size:15px; margin-bottom:12px; color:var(--neon); }
  button { cursor:pointer; border:none; border-radius:10px; padding:10px 14px; font-size:14px; font-weight:600; color:#04040c; transition:.15s; font-family:inherit; }
  button:hover { transform:translateY(-1px); }
  .btn-add { background:var(--neon); width:100%; }
  .btn-nav { background:#2a2f55; color:#fff; }
  .btn-count { background:var(--warn); }
  .btn-start { background:var(--ok); }
  .btn-pause { background:#7f8cff; width:100%; }
  .btn-restart { background:#00c2b8; width:100%; }
  .btn-rall { background:var(--bad); width:100%; }
  .btn-del { background:var(--bad); padding:5px 9px; font-size:12px; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .controls { display:flex; flex-direction:column; gap:10px; }
  .sep { height:1px; background:#1c2350; margin:6px 0; }
  .status { font-size:13px; color:#8b93c9; margin-bottom:10px; line-height:1.6; }
  .status b { color:#fff; }
  .qrow { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
  .qrow .flag { width:32px; height:22px; }
  .qrow input { margin-bottom:0; }
  .filebtn { display:block; padding:10px; text-align:center; border:1px dashed #2a2f55; border-radius:10px; color:#8b93c9; cursor:pointer; margin-bottom:12px; }
  .thumb { max-width:100%; max-height:120px; border-radius:8px; margin-bottom:10px; display:none; }
  .hint { font-size:11px; color:#5a63a0; margin-top:4px; }
  .req { color:var(--bad); }
  .slide-item { display:flex; align-items:center; gap:8px; padding:8px; border:1px solid #1c2350; border-radius:10px; margin-bottom:6px; }
  .slide-item.active { border-color:var(--neon); background:rgba(0,229,255,.06); }
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
  <div class="vertag">${APP_VERSION}</div>
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
        <h3>เพิ่มโจทย์ · 1 ข้อ = 1 รูป + 3 คำถาม (ครบทุกแถว)</h3>
        <label class="filebtn" for="imgFile" id="fileLabel">📷 เลือกรูปภาพ <span class="req">*จำเป็น</span></label>
        <input type="file" id="imgFile" accept="image/*" style="display:none"/>
        <img id="thumb" class="thumb"/>
        <div class="qrow"><span class="flag flag-th"></span><input id="q1" placeholder="คำถามภาษาไทย *"/></div>
        <div class="qrow"><span class="flag flag-us"></span><input id="q2" placeholder="Question (English) *"/></div>
        <div class="qrow"><span class="flag flag-jp"></span><input id="q3" placeholder="質問 (日本語) *"/></div>
        <button class="btn-add" onclick="addSlide()">➕ เพิ่มลงเกม</button>
        <div class="hint">ต้องใส่ <b>รูป 1 รูป + คำถามครบทั้ง 3 แถว</b> ถึงจะเพิ่มได้ · เก็บไว้ล่วงหน้าได้</div>
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
            <button class="btn-count" onclick="socket.emit('host:countdownStart')">⏱ Countdown (เปิดแผ่นทุก 5 วิ)</button>
            <button class="btn-start" onclick="socket.emit('host:start')">▶ Start (เปิดรูปทั้งหมด)</button>
          </div>
          <button class="btn-pause" onclick="socket.emit('host:pause')">⏸ หยุดเวลา / Pause (กดซ้ำ = ไปต่อ)</button>
          <div class="sep"></div>
          <button class="btn-restart" onclick="socket.emit('host:restartGame')">🔄 Reset เริ่มเกมใหม่ (รูป+โจทย์ยังอยู่ครบ)</button>
          <button class="btn-rall" onclick="confirmResetAll()">🗑 Reset ลบข้อมูลทั้งหมด</button>
        </div>
      </div>
      <p style="text-align:center;margin-top:12px"><a href="/" style="color:#7f8cff;font-size:13px">เปิดหน้า User (จอโชว์) →</a></p>
    </div>
  </div>
<script>
  var socket = io();
  var pendingImg = '';
  function login(){
    var code=document.getElementById('code').value.trim();
    socket.emit('host:login', code, function(res){
      if(res && res.ok){ document.getElementById('login').style.display='none'; document.getElementById('app').style.display='grid'; }
      else { document.getElementById('loginErr').textContent=(res && res.msg) || 'เข้าสู่ระบบไม่สำเร็จ'; }
    });
  }
  document.getElementById('code').addEventListener('keydown', function(e){ if(e.key==='Enter') login(); });

  document.getElementById('imgFile').addEventListener('change', function(e){
    var file=e.target.files[0]; if(!file) return;
    var reader=new FileReader();
    reader.onload=function(ev){
      var img=new Image();
      img.onload=function(){
        var max=1400,w=img.width,h=img.height;
        if(w>max||h>max){ var r=Math.min(max/w,max/h); w*=r; h*=r; }
        var cv=document.createElement('canvas'); cv.width=w; cv.height=h;
        cv.getContext('2d').drawImage(img,0,0,w,h);
        pendingImg=cv.toDataURL('image/jpeg',0.85);
        document.getElementById('fileLabel').innerHTML='✅ '+file.name;
        var th=document.getElementById('thumb'); th.src=pendingImg; th.style.display='block';
      };
      img.src=ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  function addSlide(){
    var q1=document.getElementById('q1').value.trim();
    var q2=document.getElementById('q2').value.trim();
    var q3=document.getElementById('q3').value.trim();
    if(!pendingImg){ alert('⚠️ ต้องใส่รูป 1 รูปต่อ 1 ข้อ'); return; }
    if(!q1 || !q2 || !q3){ alert('⚠️ ต้องกรอกคำถามให้ครบทั้ง 3 แถว (ไทย/อังกฤษ/ญี่ปุ่น)'); return; }
    socket.emit('host:addSlide', { img:pendingImg, q1:q1, q2:q2, q3:q3 });
    pendingImg=''; document.getElementById('imgFile').value='';
    document.getElementById('fileLabel').innerHTML='📷 เลือกรูปภาพ <span class="req">*จำเป็น</span>';
    var th=document.getElementById('thumb'); th.src=''; th.style.display='none';
    document.getElementById('q1').value=''; document.getElementById('q2').value=''; document.getElementById('q3').value='';
  }
  function confirmResetAll(){ if(confirm('ลบรูปและคำถามทั้งหมด? ย้อนกลับไม่ได้')) socket.emit('host:resetAll'); }
  function esc(t){ return (t||'').replace(/[&<>"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]; }); }
  function flagLine(cls, text){ return '<div class="pv-line"><span class="flag '+cls+'"></span>'+esc(text||'-')+'</div>'; }

  socket.on('state', function(s){
    var phaseTxt = s.phase==='full' ? 'เปิดรูปทั้งหมด' : (s.phase==='tiles' ? ('กำลังเปิดแผ่น '+s.revealedCount+'/'+s.tileCount+(s.revealPaused?' (พัก)':'')) : 'ปิดอยู่');
    document.getElementById('status').innerHTML = 'โจทย์: <b>' + (s.total ? (s.index+1)+' / '+s.total : '—') + '</b> · สถานะ: <b>' + phaseTxt + '</b>';
    var pv=document.getElementById('preview');
    if (s.current){
      var imgHtml = s.current.img ? '<img src="'+s.current.img+'"/>' : '<div class="ph">?</div>';
      pv.innerHTML = imgHtml + flagLine('flag-th',s.current.q1) + flagLine('flag-us',s.current.q2) + flagLine('flag-jp',s.current.q3);
    } else { pv.innerHTML='<div class="ph">?</div>'; }
    var list=document.getElementById('slideList');
    if(!s.slides || !s.slides.length){ list.innerHTML='<div style="color:#5a63a0;font-size:13px">ยังไม่มีโจทย์</div>'; return; }
    list.innerHTML = s.slides.map(function(sl,i){
      return '<div class="slide-item '+(i===s.index?'active':'')+'">'+
        '<div class="meta"><div>#'+(i+1)+' '+(sl.hasImg?'🖼':'—')+'</div><div>'+esc(sl.q1||'-')+'</div></div>'+
        '<button class="go" onclick="socket.emit(\\'host:goto\\','+i+')">ไป</button>'+
        '<button class="btn-del" onclick="socket.emit(\\'host:deleteSlide\\','+i+')">ลบ</button>'+
      '</div>';
    }).join('');
  });
</script>
</body></html>`;

app.get('/', (req, res) => res.type('html').send(USER_HTML));
app.get('/host', (req, res) => res.type('html').send(HOST_HTML));
app.get('/version', (req, res) => res.json({ version: APP_VERSION }));

server.listen(PORT, () => console.log('Guest Picture ' + APP_VERSION + ' running on port ' + PORT));
