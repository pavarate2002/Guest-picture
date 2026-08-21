# Guest Picture (simple) - ทายรุ่นรถ

ทุกไฟล์อยู่ root (ไม่มีโฟลเดอร์ public) -> อัปโหลดขึ้น GitHub ง่าย ไม่มีปัญหาโฟลเดอร์หาย

## ฟีเจอร์
- Host รหัส pqc -> อัปโหลดรูป + ตั้งโจทย์
- Countdown 5..1 -> เปิดรูปสุ่ม / เปิดทันที / รูปถัดไป / กลับหน้ารอ
- User: ปุ่ม Host มุมซ้ายล่าง, โจทย์โชว์ด้านบนจอ

## รัน
    npm install
    npm start

## Deploy Render
Build: npm install / Start: npm start / Env: Node

## สำคัญ! ตอน push ขึ้น GitHub
อัปโหลด "ทุกไฟล์" (server.js, package.json, index.html, host.html, user.html)
ให้อยู่ที่ระดับ root ของ repo เหมือนกันหมด
