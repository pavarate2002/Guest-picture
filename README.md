# Transformation Night · GUEST PICTURE (v4.4)

เกมทายภาพ real-time · แผ่น LED 4×4 สุ่มเปิด · ธีมนีออน · **ไฟล์เดียวจบ ไม่มีโฟลเดอร์ public**

## ⚠️ ก่อนอัป — ลบไฟล์เก่าใน repo ให้หมด!
repo ต้องเหลือแค่ 3 ไฟล์:
```
server.js       ← v4.4
package.json
README.md
```
ห้ามมีโฟลเดอร์ `public/` หรือไฟล์ `.html` ใดๆ

## 4 ปุ่มที่ Host (ตามที่ขอ)
1. **⏸ หยุดเวลา / Pause** — อยู่หน้า Host คุมการเปิดแผ่น LED (กดซ้ำ = ไปต่อ)
2. **🗑 Reset ลบข้อมูลทั้งหมด** — ล้างรูป+โจทย์ทั้งหมด
3. **🔄 Reset เริ่มเกมใหม่** — เริ่มใหม่ทั้งหมด แต่รูป+โจทย์ยังอยู่ครบ
4. **➕ เพิ่มโจทย์** — 1 ข้อ = 1 รูป + 3 คำถาม (ไทย/อังกฤษ/ญี่ปุ่น) **บังคับกรอกครบทุกแถว** ถึงเพิ่มได้

## เปิดใช้งาน (ห้ามมี .html!)
- User = `https://<app>.onrender.com/`
- Host = `https://<app>.onrender.com/host`
- เช็ค = `https://<app>.onrender.com/version` → `{"version":"v4.4"}`

## Deploy
Build: `npm install` · Start: `npm start` · Root Directory: เว้นว่าง · รหัส Host: `pqc`
