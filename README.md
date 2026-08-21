# 🚗 Guest Picture — Guess the Car Model

เกมทายรูป (ทายรุ่นรถ) สำหรับงาน **Transformation Night TOYOTA**
Real-time sync ระหว่างจอ **Host** (คุมเกม) และจอ **User** (แชร์ให้ผู้เล่นดู)

## ✨ ฟีเจอร์
- 👤 **Host** ใส่รหัส (default: `pqc`) — อัปโหลดรูป + โจทย์ และคุมเกม
- 🖥️ **User** ไม่ต้องใส่ชื่อ กดเข้าได้เลย (จอสำหรับแชร์ให้คนทาย) — Host เข้าได้จากหน้านี้ด้วย
- ⏱️ **Countdown Start** — นับ 5→1 แล้วเปิดภาพ **สุ่มจริง** (Fisher–Yates, ไม่ซ้ำจนครบ)
- ▶ **Start** — เปิดภาพสุ่มทันที
- ⏭️ **Next** — ไปรูปสุ่มถัดไป
- ⏸ **Pause / Resume** — อยู่ที่หน้า **User** เพื่อจับเวลาแม่นยำ (นับเวลาโดย server = ไม่ดีเลย์)
- 🔁 **Reset Math** — รีเกม แต่เก็บรูป/โจทย์ไว้
- 🗑️ **Reset All** — ลบทั้งหมด

> ⚙️ นับเวลาแบบ **server-authoritative** ทุกจอเห็นเลขตรงกัน แก้ปัญหา pause delay / วินาทีสะดุด

## 🖥️ รันในเครื่อง
```bash
npm install
npm start
# เปิด http://localhost:3000
```

## ☁️ Deploy บน Render
1. Push โค้ดขึ้น GitHub (`pavarate2002/Guest-picture`)
2. Render → New → **Web Service** → เลือก repo
3. ตั้งค่า:
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. (ออปชัน) เปลี่ยนรหัส Host: ตั้ง Environment Variable `HOST_CODE`

## 🎮 วิธีเล่นในงาน
1. เปิด **Host** บนโน้ตบุ๊ก → ใส่รหัส → อัปโหลดรูปรถ + ตั้งโจทย์
2. เปิด **User** บนจอโปรเจกเตอร์ (แชร์จอ)
3. Host กด **Countdown Start** → นับถอยหลัง → เปิดภาพสุ่ม → ให้คนทาย
4. กด **Next** ไปข้อต่อไป · ใช้ **Pause** ที่หน้า User เมื่ออยากหยุดเวลา

## 🗂️ โครงสร้าง
```
guest-picture/
├── server.js            # Express + Socket.io (game state + timer)
├── package.json
├── README.md
└── public/
    ├── index.html       # เลือก Host / User
    ├── host.html        # แผงคุมเกม
    ├── user.html        # จอแชร์ + ปุ่ม Pause
    ├── app-host.js
    ├── app-user.js
    └── style.css
```

## 🔧 หมายเหตุ
- รูปเก็บใน memory ของ server (เหมาะกับงาน live ครั้งเดียว) — ถ้า Render restart รูปจะหาย ค่อยอัปใหม่
- Free plan จะ spin down ตอนไม่มีคนใช้ ครั้งแรกอาจโหลด ~50 วิ
