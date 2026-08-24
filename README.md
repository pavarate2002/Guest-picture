# Transformation Night · GUEST PICTURE (v4.9)

เกมทายภาพ real-time · แผ่นปิดภาพ 4×4 (แบบเรียบ) · ธีมนีออน · หน้า User แบบ 2 คอลัมน์
ไฟล์เดียวจบ ไม่มีโฟลเดอร์ public ไม่มีไฟล์ .html

### repo ต้องมีแค่ 3 ไฟล์นี้
server.js       ← v4.9
package.json
README.md

### เปิดใช้งาน (ห้ามมี .html!)
- User = https://<app>.onrender.com/
- Host = https://<app>.onrender.com/host   (รหัส pqc)
- เช็ค = https://<app>.onrender.com/version → {"version":"v4.9"}

### ใหม่ใน v4.9
- เพิ่มโจทย์: 1 ข้อ = **2 รูป** (รูปโจทย์ Puzzle + รูป Meaning เฉลย) + คำถาม 3 ภาษา (บังคับครบ)
- ปุ่มใหม่ 2 ปุ่มที่หน้า Host:
  - ✅ รูปเฉลย (Show Puzzle) — เปิดรูปโจทย์เต็ม (เอาแผ่นออกหมด)
  - 🔍 เปิดรูป Meaning (Show Meaning) — สลับจอ User ไปโชว์รูป Meaning (กดซ้ำ = กลับรูปโจทย์)

### Deploy
Build: npm install · Start: npm start · Root Directory: เว้นว่าง
