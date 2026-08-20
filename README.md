# Transformation Night · Guest Picture 🎮

เกมทายภาพ (ทายรุ่นรถ) แบบ real-time แยกบทบาท **Host** (ควบคุม) และ **User** (จอโชว์ให้คนทาย)

## ฟีเจอร์
- **Host / User แยกบทบาท** — Host เข้าด้วยรหัส `pqc`, เข้า Host ได้จากหน้า User (ปุ่ม 🔒 Host มุมขวาบน)
- **ปุ่มควบคุมทั้งหมดอยู่ที่หน้า Host** — Prev/Next, Countdown Start, Start, Pause, Reset
- **หน้า User** — รูปใหญ่, คำถามเล็ก, เลขนับถอยหลังอยู่บนรูปหน้าเดียวกัน (ไม่ต้องเลื่อน), ไม่โชว์จำนวนข้อ
- **คำถาม 3 บรรทัด** — 🇹🇭 ไทย / 🇺🇸 อังกฤษ / 🇯🇵 ญี่ปุ่น (มีธงนำหน้าแต่ละบรรทัด)
- **Countdown ซิงก์ด้วย server timestamp** — ไม่มี delay สะสมทีละวินาที
- **ปุ่ม Reset 3 แบบ**
  - `🔄 Restart Game` — เริ่มเกมใหม่ ทุกอย่าง (รูป+คำถาม) ยังอยู่ครบ
  - `↩️ Reset Match` — กลับไปข้อแรก เก็บรูป+คำถามไว้
  - `🗑️ Reset All` — ลบทั้งหมด

## รันในเครื่อง
```bash
npm install
npm start
# เปิด http://localhost:3000  (หน้า User)
# เปิด http://localhost:3000/host.html  (หน้า Host, รหัส pqc)
```

## Deploy บน Render
1. push โค้ดขึ้น GitHub
2. Render → New → Web Service → เลือก repo
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Environment: Node

## เปลี่ยนรหัส Host
แก้ค่า `HOST_CODE` ใน `server.js`
