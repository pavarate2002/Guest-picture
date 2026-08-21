// Guest Picture - simple version (ทุกไฟล์อยู่ root ไม่ต้องมีโฟลเดอร์ public)
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 });

// เสิร์ฟไฟล์ static จากโฟลเดอร์เดียวกับ server.js
app.use(express.static(__dirname));

// route ตรงๆ กันเหนียว (เผื่อ static ไม่จับ /)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/host', (req, res) => res.sendFile(path.join(__dirname, 'host.html')));
app.get('/user', (req, res) => res.sendFile(path.join(__dirname, 'user.html')));

const HOST_CODE = 'pqc';

// state ง่ายๆ
let images = [];
let question = 'รถคันนี้คือรุ่นอะไร?';
let current = null;   // index รูปที่โชว์อยู่ (null = ยังไม่โชว์)
let counting = false;

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

  socket.on('login', (code, cb) => cb(code === HOST_CODE));

  socket.on('addImages', (arr) => {
    if (Array.isArray(arr)) arr.forEach((d) => d && images.push(d));
    sendState();
  });

  socket.on('setQuestion', (q) => { question = q || ''; sendState(); });

  socket.on('clearImages', () => { images = []; current = null; sendState(); });

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

  socket.on('reveal', () => { current = randomIndex(); sendState(); });
  socket.on('next', () => { current = randomIndex(); sendState(); });
  socket.on('hide', () => { current = null; sendState(); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('running on ' + PORT));
