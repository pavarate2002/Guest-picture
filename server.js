// Guest Picture - simple version (เหมือนเกมปุ่มกด)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 });

app.use(express.static('public'));

const HOST_CODE = 'pqc';

// state ง่ายๆ
let images = [];      // dataURL ของรูป
let question = 'รถคันนี้คือรุ่นอะไร?';
let current = null;   // index รูปที่โชว์อยู่ (null = ยังไม่โชว์)
let counting = false; // กำลังนับถอยหลังไหม

function sendState() {
  io.emit('state', {
    count: images.length,
    question,
    current,
    image: current !== null ? images[current] : null,
  });
}

function randomIndex() {
  if (images.length === 0) return null;
  return Math.floor(Math.random() * images.length);
}

io.on('connection', (socket) => {
  sendState();

  // host login
  socket.on('login', (code, cb) => cb(code === HOST_CODE));

  // host เพิ่มรูป
  socket.on('addImages', (arr) => {
    if (Array.isArray(arr)) arr.forEach((d) => d && images.push(d));
    sendState();
  });

  // host ตั้งโจทย์
  socket.on('setQuestion', (q) => { question = q || ''; sendState(); });

  // host ลบรูปทั้งหมด
  socket.on('clearImages', () => { images = []; current = null; sendState(); });

  // Countdown 5..1 แล้วเปิดรูปสุ่ม
  socket.on('countdown', () => {
    if (images.length === 0 || counting) return;
    counting = true;
    let n = 5;
    io.emit('countdown', n);
    const t = setInterval(() => {
      n--;
      if (n > 0) {
        io.emit('countdown', n);
      } else {
        clearInterval(t);
        counting = false;
        current = randomIndex();
        sendState();
      }
    }, 1000);
  });

  // เปิดรูปสุ่มทันที
  socket.on('reveal', () => { current = randomIndex(); sendState(); });

  // รูปถัดไป (สุ่ม)
  socket.on('next', () => { current = randomIndex(); sendState(); });

  // ซ่อนรูป (กลับหน้ารอ)
  socket.on('hide', () => { current = null; sendState(); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('running on ' + PORT));
