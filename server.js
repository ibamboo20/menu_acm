const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3456;

// In production set DATA_DIR to a persistent volume (e.g. /data)
// so the database and uploaded images survive redeploys.
const uploadDir = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'uploads')
  : path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

// Optional dashboard protection: set ADMIN_PASSWORD to enable HTTP Basic auth
function requireAuth(req, res, next) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return next();
  const token = (req.headers.authorization || '').split(' ')[1] || '';
  const decoded = Buffer.from(token, 'base64').toString();
  const pass = decoded.slice(decoded.indexOf(':') + 1);
  if (pass === pw) return next();
  res.set('WWW-Authenticate', 'Basic realm="@Chiang Mai Dashboard"');
  res.status(401).send('Authentication required');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

app.use(express.json());
app.get('/dashboard.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});
app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.join(__dirname, 'public')));

// ---- API ----

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/categories', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM menu_items m WHERE m.category_id = c.id) AS item_count
    FROM categories c ORDER BY c.sort_order, c.id`).all();
  res.json(rows);
});

// Slugs stay fixed once created so shared links keep working after a rename.
function uniqueSlug(nameEn) {
  const base = String(nameEn || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `cat-${Date.now()}`;
  let slug = base;
  for (let n = 2; db.prepare('SELECT 1 FROM categories WHERE slug = ?').get(slug); n += 1) {
    slug = `${base}-${n}`;
  }
  return slug;
}

app.post('/api/categories', requireAuth, (req, res) => {
  const { name_en, name_th, note } = req.body;
  if (!name_en || !name_th) {
    return res.status(400).json({ error: 'name_en and name_th are required' });
  }
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM categories').get().m;
  const info = db.prepare('INSERT INTO categories (slug, name_en, name_th, note, sort_order) VALUES (?, ?, ?, ?, ?)')
    .run(uniqueSlug(name_en), name_en.trim(), name_th.trim(), (note || '').trim() || null, maxOrder + 1);
  res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/categories/:id', requireAuth, (req, res) => {
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!cat) return res.status(404).json({ error: 'Not found' });
  const { name_en, name_th, note } = req.body;
  db.prepare('UPDATE categories SET name_en = ?, name_th = ?, note = ? WHERE id = ?')
    .run(
      name_en !== undefined ? String(name_en).trim() || cat.name_en : cat.name_en,
      name_th !== undefined ? String(name_th).trim() || cat.name_th : cat.name_th,
      note !== undefined ? (String(note).trim() || null) : cat.note,
      cat.id
    );
  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(cat.id));
});

app.put('/api/categories/:id/move', requireAuth, (req, res) => {
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!cat) return res.status(404).json({ error: 'Not found' });
  const all = db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all();
  const i = all.findIndex((c) => c.id === cat.id);
  const j = req.body.dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= all.length) return res.json({ ok: true });
  const upd = db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?');
  db.transaction(() => {
    all.forEach((c, idx) => upd.run(idx, c.id));
    upd.run(j, all[i].id);
    upd.run(i, all[j].id);
  })();
  res.json({ ok: true });
});

app.delete('/api/categories/:id', requireAuth, (req, res) => {
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!cat) return res.status(404).json({ error: 'Not found' });
  const items = db.prepare('SELECT id, image FROM menu_items WHERE category_id = ?').all(cat.id);
  if (items.length > 0 && req.query.force !== '1') {
    return res.status(409).json({ error: `หมวดนี้มี ${items.length} เมนูอยู่`, items: items.length });
  }
  for (const it of items) {
    if (it.image && it.image.startsWith('/uploads/')) {
      fs.unlink(path.join(uploadDir, path.basename(it.image)), () => {});
    }
  }
  db.transaction(() => {
    db.prepare('DELETE FROM menu_items WHERE category_id = ?').run(cat.id);
    db.prepare('DELETE FROM categories WHERE id = ?').run(cat.id);
  })();
  res.json({ ok: true, deleted_items: items.length });
});

app.get('/api/menu', (req, res) => {
  let rows;
  if (req.query.category) {
    rows = db.prepare(`
      SELECT m.*, c.slug AS category_slug, c.name_en AS category_name
      FROM menu_items m JOIN categories c ON c.id = m.category_id
      WHERE c.slug = ? ORDER BY m.sort_order, m.id`).all(req.query.category);
  } else {
    rows = db.prepare(`
      SELECT m.*, c.slug AS category_slug, c.name_en AS category_name
      FROM menu_items m JOIN categories c ON c.id = m.category_id
      ORDER BY c.sort_order, m.sort_order, m.id`).all();
  }
  res.json(rows);
});

app.post('/api/menu', requireAuth, upload.single('image'), (req, res) => {
  const { category_id, name_th, name_en, price, description, subcategory } = req.body;
  if (!category_id || !name_th || !name_en) {
    return res.status(400).json({ error: 'category_id, name_th and name_en are required' });
  }
  const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(category_id);
  if (!cat) return res.status(400).json({ error: 'Unknown category' });

  const image = req.file ? `/uploads/${req.file.filename}` : null;
  const isShadow = req.body.is_shadow === '1' || req.body.is_shadow === 'on' ? 1 : 0;
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM menu_items WHERE category_id = ?').get(category_id).m;
  const info = db.prepare(`
    INSERT INTO menu_items (category_id, name_th, name_en, price, image, description, sort_order, is_shadow, subcategory)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(category_id, name_th.trim(), name_en.trim(), parseFloat(price) || 0, image, description || null, maxOrder + 1, isShadow, (subcategory || '').trim() || null);
  res.status(201).json(db.prepare('SELECT * FROM menu_items WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/menu/:id', requireAuth, upload.single('image'), (req, res) => {
  const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  const { category_id, name_th, name_en, price, description, subcategory } = req.body;
  let image = item.image;
  if (req.file) {
    if (item.image && item.image.startsWith('/uploads/')) {
      fs.unlink(path.join(uploadDir, path.basename(item.image)), () => {});
    }
    image = `/uploads/${req.file.filename}`;
  }
  const isShadow = req.body.is_shadow !== undefined
    ? (req.body.is_shadow === '1' || req.body.is_shadow === 'on' ? 1 : 0)
    : item.is_shadow;
  db.prepare(`
    UPDATE menu_items SET
      category_id = ?, name_th = ?, name_en = ?, price = ?, image = ?, description = ?, is_shadow = ?, subcategory = ?
    WHERE id = ?`)
    .run(
      category_id || item.category_id,
      (name_th || item.name_th).trim(),
      (name_en || item.name_en).trim(),
      price !== undefined && price !== '' ? parseFloat(price) || 0 : item.price,
      image,
      description !== undefined ? (description || null) : item.description,
      isShadow,
      subcategory !== undefined ? (subcategory.trim() || null) : item.subcategory,
      item.id
    );
  res.json(db.prepare('SELECT * FROM menu_items WHERE id = ?').get(item.id));
});

app.delete('/api/menu/:id', requireAuth, (req, res) => {
  const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  if (item.image && item.image.startsWith('/uploads/')) {
    fs.unlink(path.join(uploadDir, path.basename(item.image)), () => {});
  }
  db.prepare('DELETE FROM menu_items WHERE id = ?').run(item.id);
  res.json({ ok: true });
});

app.use((err, req, res, next) => {
  res.status(400).json({ error: err.message || 'Bad request' });
});

app.listen(PORT, () => {
  console.log(`@Chiang Mai menu app running at http://localhost:${PORT}`);
});
