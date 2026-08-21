# Guest Picture (simple) - ทายรุ่นรถ

เกมง่ายๆ แบบเดียวกับเกมปุ่มกด: Host คุมเกม, User คือจอแชร์ให้คนทาย

## ฟีเจอร์
- Host ใส่รหัส `pqc` -> อัปโหลดรูป + ตั้งโจทย์
- Countdown นับ 5..1 แล้วเปิดรูปสุ่ม
- เปิดรูปสุ่มทันที / รูปถัดไป / กลับหน้ารอ
- User ไม่ต้องใส่ชื่อ กดเข้าได้เลย (Host เข้าจากหน้านี้ได้)

## รัน
    npm install
    npm start
    # http://localhost:3000

## Deploy บน Render
Build: `npm install` · Start: `npm start` · Env: Node

## ไฟล์
server.js, package.json, public/(index.html, host.html, user.html)
