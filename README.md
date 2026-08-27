# Transformation Night · GUEST PICTURE (v5.0)

เกมทายภาพ real-time · แผ่นปิดภาพ 4×4 (แบบเรียบ) · ธีมนีออน · หน้า User แบบ 2 คอลัมน์
ไฟล์เดียวจบ ไม่มีโฟลเดอร์ public ไม่มีไฟล์ .html

### repo ต้องมีแค่ 3 ไฟล์นี้
server.js       ← v5.0
package.json
README.md

### เปิดใช้งาน (ห้ามมี .html!)
- User = https://<app>.onrender.com/
- Host = https://<app>.onrender.com/host   (รหัส pqc)
- เช็ค = https://<app>.onrender.com/version → {"version":"v5.0"}

### เปลี่ยนใน v5.0 (แก้เฉพาะช่องรูป)
- รูปที่อัปเข้าไป **แสดงเต็มรูปตามอัตราส่วนจริง ไม่ถูกครอป** (object-fit:contain)
- **ไม่บีบอัด/ไม่ย่อ** — ใช้ไฟล์รูปต้นฉบับตรงๆ ตอนอัปโหลด
- ที่เหลือเหมือน v4.9 ทุกอย่าง (2 รูป/ข้อ, ปุ่ม Show Puzzle / Show Meaning ฯลฯ)

### Deploy
Build: npm install · Start: npm start · Root Directory: เว้นว่าง
