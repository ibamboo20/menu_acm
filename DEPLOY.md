# คู่มือ Deploy — @ChiangMai Menu

แอพนี้เป็น Node.js (Express + SQLite) ต้องการ host ที่มี **persistent disk/volume**
เพื่อเก็บไฟล์ database และรูปที่อัพโหลด (ถ้าไม่มี volume ข้อมูลจะหายทุกครั้งที่ redeploy)

## Environment Variables

| ตัวแปร | ค่าแนะนำ | ความหมาย |
|---|---|---|
| `PORT` | (host กำหนดให้เอง) | พอร์ตของเซิร์ฟเวอร์ (default 3456) |
| `DATA_DIR` | `/data` | โฟลเดอร์เก็บ `atchiangmai.db` + รูปอัพโหลด — ชี้ไปที่ volume |
| `ADMIN_PASSWORD` | ตั้งเอง | ป้องกันหน้า dashboard และ API เพิ่ม/แก้/ลบเมนู (HTTP Basic auth — ใส่รหัสนี้ในช่อง password, ช่อง username ปล่อยว่างหรือใส่อะไรก็ได้) **ควรตั้งเสมอเมื่อออนไลน์** |

รันครั้งแรก database จะถูก seed เมนูเริ่มต้น 51 รายการอัตโนมัติ

---

## ทางเลือก 1: Railway (แนะนำ — ง่ายสุด)

1. push โค้ดขึ้น GitHub (repo นี้ init + commit ไว้ให้แล้ว)
   ```bash
   git remote add origin https://github.com/<your-user>/atchiangmai-menu.git
   git push -u origin main
   ```
2. เข้า [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo** → เลือก repo นี้
   (Railway จะเห็น `Dockerfile` และ build ให้อัตโนมัติ)
3. ที่ service → **Variables** เพิ่ม:
   - `ADMIN_PASSWORD` = รหัสที่ต้องการ
   - `DATA_DIR` = `/data`
4. ที่ service → คลิกขวา/เมนู **Attach Volume** → mount path = `/data`
5. **Settings → Networking → Generate Domain** จะได้ URL เช่น `https://atchiangmai.up.railway.app`

## ทางเลือก 2: Render

1. push ขึ้น GitHub เหมือนข้อ 1 ด้านบน
2. [render.com](https://render.com) → **New → Web Service** → เลือก repo (Render ใช้ Dockerfile อัตโนมัติ)
3. เลือกแพลน **Starter ขึ้นไป** (free tier ไม่มี persistent disk — ข้อมูลจะหาย)
4. **Disks → Add Disk**: mount path `/data` ขนาด 1 GB+
5. ตั้ง Environment: `ADMIN_PASSWORD`, `DATA_DIR=/data`

## ทางเลือก 3: VPS / เครื่องของตัวเอง (Docker)

```bash
docker build -t atchiangmai-menu .
docker run -d --name atchiangmai \
  -p 80:3456 \
  -v atchiangmai-data:/data \
  -e ADMIN_PASSWORD=<รหัสของคุณ> \
  --restart unless-stopped \
  atchiangmai-menu
```

หรือไม่ใช้ Docker: `npm ci && DATA_DIR=/var/atchiangmai ADMIN_PASSWORD=<รหัส> node server.js`
(แนะนำรันผ่าน pm2/systemd และตั้ง reverse proxy + HTTPS ด้วย Caddy หรือ nginx)

---

## เช็คหลัง deploy

- `https://<domain>/api/health` → `{"ok":true}`
- หน้าเมนูเปิดได้ เห็น 11 หมวด เมนู 51 รายการ
- เปิด `/dashboard.html` → มี popup ถามรหัส (แสดงว่า `ADMIN_PASSWORD` ทำงาน)
- ทดลองอัพโหลดรูป 1 เมนู → redeploy → รูปยังอยู่ (แสดงว่า volume ทำงาน)

## ย้ายข้อมูลจากเครื่องนี้ขึ้น server (ถ้าต้องการ)

ข้อมูลปัจจุบันอยู่ที่ `atchiangmai.db` (+ รูปใน `public/uploads/`) — คัดลอกไฟล์เหล่านี้
ไปไว้ใน volume (`/data/atchiangmai.db`, `/data/uploads/…`) ก่อน start ครั้งแรก
