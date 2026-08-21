# Guest Picture v3 — Guess the Car Model

เกมทายรูป (ทายรุ่นรถ) สำหรับงาน Transformation Night TOYOTA
Real-time sync ระหว่างจอ Host (คุมเกม) และจอ User (แชร์ให้ผู้เล่นดู)

## ใหม่ใน v3
- Blur-Reveal: ภาพเริ่มเบลอแล้วค่อยๆ ชัดตามเวลา (ลุ้นกว่าเดิม)
- เฉลยรายรูป + ปุ่ม Show Answer โชว์บนจอ User
- ปรับเวลา Countdown และเวลา Blur ได้
- Scoreboard: เพิ่มทีม / +1 / +5 / -1 โชว์คะแนนมุมจอ User
- เสียง (Web Audio) ไม่ต้องมีไฟล์เสียง + Confetti ตอนเฉลย
- ปุ่ม Fullscreen + เปิด/ปิดเสียง บนจอ User

## ฟีเจอร์เดิมที่ยังมี
- Host รหัส pqc / User ไม่ต้องใส่ชื่อ (Host เข้าจากหน้า User ได้)
- อัปโหลดหลายรูป, สุ่มจริง (ไม่ซ้ำจนครบ)
- Pause/Resume อยู่ที่หน้า User, นับเวลาโดย server = ไม่ดีเลย์
- Reset Math (เก็บรูป/ทีม) / Reset All (ลบหมด)

## รันในเครื่อง
    npm install
    npm start
    # http://localhost:3000

## Deploy บน Render
1. Push โค้ดขึ้น GitHub (pavarate2002/Guest-picture)
2. Render -> Web Service -> Build: npm install / Start: npm start / Env: Node
3. (ออปชัน) เปลี่ยนรหัส Host: ตั้ง Env Variable HOST_CODE

## วิธีเล่น
1. เปิด Host -> ใส่รหัส -> อัปโหลดรูป + ใส่เฉลย -> ตั้งเวลา Countdown/Blur
2. เพิ่มทีมใน Scoreboard
3. เปิด User บนโปรเจกเตอร์ (กด Fullscreen)
4. Host กด Countdown Start -> ภาพเบลอ->ชัด -> คนทาย -> Show Answer -> ให้คะแนนทีม -> Next

## โครงสร้าง
guest-picture/
├── server.js
├── package.json
├── README.md
└── public/ (index/host/user .html, app-host.js, app-user.js, sound.js, style.css)
