# 🚗 Guest Picture — Guess the Car Model

เกมทายรูป (ทายรุ่นรถ) สำหรับงาน Transformation Night TOYOTA
Real-time sync ระหว่างจอ Host (คุมเกม) และจอ User (แชร์ให้ผู้เล่นดู)

## ✨ ฟีเจอร์
- Host ใส่รหัส (default: pqc) — อัปโหลดรูป + โจทย์ และคุมเกม
- User ไม่ต้องใส่ชื่อ กดเข้าได้เลย — Host เข้าได้จากหน้านี้ด้วย
- Countdown Start — นับ 5→1 แล้วเปิดภาพสุ่มจริง (Fisher–Yates ไม่ซ้ำจนครบ)
- Start — เปิดภาพสุ่มทันที / Next — ไปรูปสุ่มถัดไป
- Pause / Resume — อยู่ที่หน้า User นับเวลาโดย server = ไม่ดีเลย์
- Reset Math — รีเกม แต่เก็บรูป/โจทย์ / Reset All — ลบทั้งหมด

## รันในเครื่อง
    npm install
    npm start
    # เปิด http://localhost:3000

## Deploy บน Render
1. Push โค้ดขึ้น GitHub (pavarate2002/Guest-picture)
2. Render → New → Web Service → เลือก repo
3. Build: npm install / Start: npm start / Env: Node
4. (ออปชัน) เปลี่ยนรหัส Host: ตั้ง Env Variable HOST_CODE

## โครงสร้าง
guest-picture/
├── server.js
├── package.json
├── README.md
└── public/ (index/host/user .html, app-host.js, app-user.js, style.css)
