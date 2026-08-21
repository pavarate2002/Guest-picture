# Transformation Night · GUEST PICTURE (v4.6)

เกมทายภาพ real-time · แผ่น LED 4×4 · ธีมนีออน · **หน้า User แบบ 2 คอลัมน์**
ไฟล์เดียวจบ ไม่มีโฟลเดอร์ public ไม่มีไฟล์ .html

## repo ต้องมีแค่ 3 ไฟล์นี้
```
server.js       ← v4.6
package.json
README.md
```

## เปิดใช้งาน (ห้ามมี .html!)
- User = `https://<app>.onrender.com/`
- Host = `https://<app>.onrender.com/host`   (รหัส pqc)
- เช็ค = `https://<app>.onrender.com/version` → `{"version":"v4.6"}`

## Layout หน้า User
- ซ้าย: ชื่อ GUEST·PICTURE + คำถาม 3 บรรทัด (ธง ไทย→อเมริกา→ญี่ปุ่น บนลงล่าง)
- ขวา: รูปใหญ่ + แผ่น LED 4×4 สุ่มเปิดทุก 5 วิ

## ปุ่ม Host
1. หยุดเวลา / Pause
2. Reset ลบข้อมูลทั้งหมด
3. Reset เริ่มเกมใหม่ (รูป+โจทย์ยังอยู่)
4. เพิ่มโจทย์: 1 รูป + 3 คำถาม (บังคับครบ)

## Deploy
Build: `npm install` · Start: `npm start` · Root Directory: เว้นว่าง
