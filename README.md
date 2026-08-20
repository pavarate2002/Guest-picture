# Transformation Night · Guest Picture (v3)

เกมทายภาพแบบ real-time แยกบทบาท **Host** (ควบคุม) และ **User** (จอโชว์)

## โครงสร้างไฟล์ (แค่ 3 ไฟล์ — GitHub จับง่าย)
```
guest-picture/
├── server.js        ← ทั้งหมดอยู่ในไฟล์เดียว (server + หน้า User + หน้า Host)
├── package.json
└── README.md
```

## ฟีเจอร์
- **ธงวาดด้วย CSS** 🇹🇭🇺🇸🇯🇵 — แสดงผลได้ทุกเครื่อง รวมถึง Windows (emoji ธงไม่แสดงบน Windows)
- **หน้า User** — รูปใหญ่ / คำถามเล็ก / เลขนับถอยหลังซ้อนบนรูปหน้าเดียว ไม่ต้องเลื่อน / ไม่โชว์จำนวนข้อ
- **คำถาม 3 บรรทัด + ธงนำหน้า** ทั้งหน้า User และช่องกรอกในหน้า Host
- **ปุ่มควบคุมทั้งหมดอยู่หน้า Host**: Prev / Next / Countdown Start / Start / **Pause (หยุดเวลา)** / Reset
- **Reset 3 แบบ**: Restart Game (เริ่มใหม่ ทุกอย่างอยู่ครบ) · Reset Match (กลับข้อแรก) · Reset All (ลบหมด)

## รันในเครื่อง
```bash
npm install
npm start
# User:  http://localhost:3000
# Host:  http://localhost:3000/host   (รหัส pqc)
```

## Deploy บน Render
- Build Command: `npm install`
- Start Command: `npm start`
- Environment: Node

## เปลี่ยนรหัส Host
แก้ค่า `HOST_CODE` ที่ต้นไฟล์ `server.js`
