# @ChiangMai — Menu Web App

เว็บแอพแสดงเมนูร้าน @ChiangMai (ณ เชียงใหม่) พร้อม dashboard จัดการเมนู

## วิธีรัน

```bash
npm install
npm start
```

เปิด http://localhost:3456

- **หน้าเมนู** — `/` แสดงเมนูแยกตาม tab หมวดหมู่ (Entree, Stir Fry, Curry, … , ปิ่นโตคุณแม่)
- **Dashboard** — `/dashboard.html` เพิ่ม / แก้ไข / ลบเมนู พร้อมอัพโหลดรูป

## โครงสร้าง

- `server.js` — Express server + REST API (`/api/categories`, `/api/menu`)
- `db.js` — SQLite schema + seed ข้อมูลเมนูเริ่มต้น (รันครั้งแรกจะ seed อัตโนมัติ)
- `atchiangmai.db` — ไฟล์ database (SQLite)
- `public/` — หน้าเว็บ (menu, dashboard) และรูปที่อัพโหลด (`public/uploads/`)

## หมายเหตุ

- ราคาเริ่มต้นทุกเมนูเป็น `$0.00` — อัพเดทได้จาก dashboard (ปุ่ม "แก้ไข")
- เมนูที่ยังไม่มีรูป จะแสดงรูป placeholder ตามธีมแบรนด์ — อัพโหลดรูปจริงได้จาก dashboard
- ธีมสี: ส้ม `#FF873C`, สีหลัก `#3c271d` (โกโก้เข้ม), ครีม/ขาว · ฟอนต์ Prata (แทน Perandory), Poppins (แทน Garet), Kanit (ภาษาไทย) · โลโก้ `public/img/logo.png`
- ความสูงหน้ายืดหยุ่นตามเนื้อหา · แถบ tab ติดบนเมื่อเลื่อน (sticky) · footer ตรึงล่างจอเสมอ · รูป placeholder ของเมนู: `public/img/placeholder.png`
