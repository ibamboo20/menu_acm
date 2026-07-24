const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// In production set DATA_DIR to a persistent volume (e.g. /data)
const dataDir = process.env.DATA_DIR || __dirname;
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'atchiangmai.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name_en TEXT NOT NULL,
  name_th TEXT NOT NULL,
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name_th TEXT NOT NULL,
  name_en TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  image TEXT,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Migrations for databases created before newer features
const itemCols = db.prepare('PRAGMA table_info(menu_items)').all().map((c) => c.name);
if (!itemCols.includes('is_shadow')) {
  db.exec('ALTER TABLE menu_items ADD COLUMN is_shadow INTEGER NOT NULL DEFAULT 0');
}
if (!itemCols.includes('subcategory')) {
  db.exec('ALTER TABLE menu_items ADD COLUMN subcategory TEXT');
}

function seed() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM categories').get().c;
  if (count > 0) return;

  const categories = [
    ['entree', 'Entree', 'ออเดิร์ฟ', null],
    ['stir-fry', 'Stir Fry', 'เมนูผัด', 'เลือกเนื้อสัตว์ได้ · Meat options: Pork / Beef / Chicken / Prawn / Tofu or Veg'],
    ['curry', 'Curry', 'เมนูแกง', null],
    ['salad', 'Salad', 'ยำ · ตำ', null],
    ['grilled', 'Grilled', 'เมนูย่าง', null],
    ['deep-fried', 'Deep Fried', 'เมนูทอด', null],
    ['soup', 'Soup', 'เมนูต้ม · ซุป', null],
    ['noodle', 'Noodle', 'ก๋วยเตี๋ยว', null],
    ['special', 'Special', 'เมนูพิเศษ', null],
    ['special-lanna', 'Special Lanna', 'เมนูพิเศษล้านนา', null],
    ['pinto', "Mom's Pinto", 'ปิ่นโตคุณแม่', 'ปิ่นโต 3 ชั้น · 1 แกง + 1 ผัด + 1 น้ำพริก + ข้าว 2 ที่'],
  ];

  const insCat = db.prepare('INSERT INTO categories (slug, name_en, name_th, note, sort_order) VALUES (?, ?, ?, ?, ?)');
  const catId = {};
  categories.forEach((c, i) => {
    const info = insCat.run(c[0], c[1], c[2], c[3], i);
    catId[c[0]] = info.lastInsertRowid;
  });

  const items = {
    'entree': [
      ['ทอดมัน', 'Thai Fish Cakes (Tod Mun)'],
      ['เฟรนฟราย', 'French Fries'],
      ['BBQ', 'Thai BBQ Skewers'],
      ['ลูกชิ้นปลาลวกจิ้ม', 'Boiled Fish Balls with Spicy Dipping Sauce'],
      ['ลูกชิ้นทอดรวม', 'Mixed Fried Meatballs'],
    ],
    'stir-fry': [
      ['ผัดไทย', 'Pad Thai'],
      ['ผัดซีอิ๊ว', 'Pad See Ew'],
      ['เตี๋ยวคั่วไก่', 'Kua Gai — Stir-fried Noodles with Chicken'],
      ['ข้าวผัด', 'Fried Rice'],
      ['ผัดกะเพรา (เนื้อสด / เนื้อตุ๋น)', 'Pad Krapao — Holy Basil Stir Fry (Fresh or Braised Beef)'],
      ['ผัดพริกแกงเนื้อตุ๋น', 'Braised Beef Stir-fried with Red Curry Paste'],
      ['ผัดผักรวม', 'Stir-fried Mixed Vegetables'],
      ['หอยลายผัดฉ่า', 'Spicy Stir-fried Clams (Pad Cha)'],
      ['หอยลายพริกเผา', 'Stir-fried Clams with Chili Jam'],
    ],
    'curry': [
      ['แกงเผ็ดเนื้อ', 'Beef Red Curry'],
      ['แกงเขียวไก่', 'Chicken Green Curry'],
      ['แกงอ่อมเนื้อ', 'Gaeng Om — Northern Herbal Beef Curry'],
      ['แกงฮังเล', 'Gaeng Hung Lay — Northern Pork Belly Curry'],
    ],
    'salad': [
      ['ตำไทย', 'Som Tum Thai — Papaya Salad'],
      ['ตำปูปลาร้า', 'Papaya Salad with Salted Crab & Fermented Fish'],
      ['ยำคอหมูย่าง', 'Grilled Pork Neck Spicy Salad'],
      ['ยำทะเลรวม', 'Mixed Seafood Spicy Salad'],
      ['ยำหมูยอ', 'Moo Yor Sausage Spicy Salad'],
      ['ยำวุ้นเส้นทะเล', 'Seafood Glass Noodle Salad'],
    ],
    'grilled': [
      ['ปีกไก่ย่าง', 'Grilled Chicken Wings'],
      ['คอหมูย่าง', 'Grilled Pork Neck'],
      ['เนื้อย่าง', 'Grilled Beef'],
      ['ลิ้นวัวย่าง ไทยชิมิชูริ', 'Grilled Beef Tongue with Thai Chimichurri'],
    ],
    'deep-fried': [
      ['ไก่ทอด ณ เชียงใหม่', 'Chiang Mai Fried Chicken'],
      ['หมูแดดเดียว', 'Sun-dried Pork'],
      ['เนื้อแดดเดียว', 'Sun-dried Beef'],
    ],
    'soup': [
      ['ต้มจืดสาหร่าย เต้าหู้ หมูสับ', 'Clear Soup with Seaweed, Tofu & Minced Pork'],
      ['แกงเห็ด', 'Northern Mushroom Curry Soup'],
      ['ต้มแซ่บเนื้อ', 'Tom Saab — Spicy Beef Soup'],
      ['ต้มยำน้ำข้น Seafood', 'Creamy Tom Yum with Seafood'],
      ['ซุปเปอร์น้ำแดง', 'Super Spicy Red Broth Soup'],
    ],
    'noodle': [
      ['ก๋วยเตี๋ยวเนื้อน้ำใส', 'Clear Broth Beef Noodle Soup'],
      ['เหลาเนื้อหม้อไฟ', 'Beef Hot Pot Noodles'],
    ],
    'special': [
      ['กุ้งอบวุ้นเส้น', 'Baked Prawns with Glass Noodles'],
      ['แซลม่อนฟู', 'Crispy Salmon Fluff'],
      ['ตีนไก่ตุ๋นวอม', 'Slow-braised Chicken Feet Soup'],
    ],
    'special-lanna': [
      ['ออเดิร์ฟ ขันโตก', 'Khantoke Hors d’oeuvres Platter'],
      ['ไส้อั่ว', 'Sai Ua — Northern Thai Herb Sausage'],
      ['แกงฮังเล', 'Gaeng Hung Lay — Northern Pork Belly Curry'],
      ['อุ๊บไก่', 'Oop Gai — Lanna Spiced Chicken'],
      ['น้ำพริกอ่อง', 'Nam Prik Ong — Tomato & Minced Pork Chili Dip'],
      ['น้ำพริกมะเขือส้ม', 'Nam Prik Makhuea Som — Sour Tomato Chili Dip'],
      ['น้ำพริกหนุ่ม', 'Nam Prik Noom — Roasted Green Chili Dip'],
      ['แกงอ่อมเนื้อ', 'Gaeng Om — Northern Herbal Beef Curry'],
      ['จิ้นนึ่ง น้ำพริกข่า', 'Steamed Beef with Galangal Chili Dip'],
    ],
    'pinto': [
      ['ปิ่นโต 3 ชั้น', "Mom's 3-Tier Pinto Set",
        'เลือก 1 แกง + 1 ผัด + 1 น้ำพริก + ข้าว 2 ที่ · แกง: แกงเผ็ดเนื้อ / แกงเขียวไก่ / แกงอ่อมเนื้อ · ผัด: แตงกวาผัดไข่ / หน่อไม้ผัดไข่ / ฟักทองผัดไข่ · น้ำพริก: น้ำพริกอ่อง / น้ำพริกกะปิ / น้ำพริกมะเขือส้ม / จิ้นนึ่ง น้ำพริกข่า'],
    ],
  };

  const insItem = db.prepare('INSERT INTO menu_items (category_id, name_th, name_en, price, image, description, sort_order) VALUES (?, ?, ?, 0, NULL, ?, ?)');
  const seedAll = db.transaction(() => {
    for (const [slug, list] of Object.entries(items)) {
      list.forEach((it, i) => insItem.run(catId[slug], it[0], it[1], it[2] || null, i));
    }
  });
  seedAll();
}

seed();

// One-time data seeds, recorded in meta so items deleted later via the
// dashboard are never re-added on restart.
db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)');

function runOnce(key, fn) {
  if (db.prepare('SELECT 1 FROM meta WHERE key = ?').get(key)) return;
  fn();
  db.prepare('INSERT INTO meta (key) VALUES (?)').run(key);
}

runOnce('shadow-items-v1', () => {
  const shadowItems = [
    ['entree', 'ทอดมันกุ้ง', 'Shrimp Cakes (Tod Mun Goong)'],
    ['entree', 'หมูยอทอด/ลวก', 'Moo Yor Sausage — Fried or Boiled'],
    ['entree', 'ไก่สเตะ', 'Chicken Satay'],
    ['entree', 'หมึกชุบแป้งทอด', 'Crispy Battered Squid'],
    ['entree', 'แฮกึน', 'Hae Kuen — Deep-fried Shrimp Rolls'],
    ['entree', 'ขลุ่ยกุ้ง', 'Crispy Shrimp Spring Rolls'],
    ['entree', 'กุ้ยช่ายทอด', 'Fried Garlic Chive Cakes'],
    ['stir-fry', 'หมูทอดกระเทียม', 'Garlic Fried Pork'],
    ['stir-fry', 'หมึกทอดกระเทียม', 'Garlic Fried Squid'],
    ['stir-fry', 'กุ้งทอดซอสมะขาม', 'Fried Prawns in Tamarind Sauce'],
    ['salad', 'ตำเส้นเล็ก', 'Som Tum with Rice Noodles (Tum Sen Lek)'],
    ['grilled', 'ปลาหมึกย่าง', 'Grilled Squid'],
    ['deep-fried', 'ปีกไก่ทอดผัดพริกเกลือ', 'Fried Chicken Wings with Chili & Salt'],
    ['noodle', 'ก๋วยเตี๋ยวไก่มะระ', 'Chicken & Bitter Gourd Noodle Soup'],
    ['special', 'ปลากะพงทอดน้ำปลา', 'Deep-fried Sea Bass with Fish Sauce'],
    ['special', 'ปลากะพง 3 รส', 'Three-Flavour Sea Bass'],
    ['special', 'ปลานึ่งมะนาว', 'Steamed Fish with Lime, Garlic & Chili'],
    ['special', 'ปลานึ่งซิอื้ว', 'Steamed Fish with Soy Sauce'],
  ];
  const bySlug = {};
  for (const c of db.prepare('SELECT id, slug FROM categories').all()) bySlug[c.slug] = c.id;
  const ins = db.prepare(`
    INSERT INTO menu_items (category_id, name_th, name_en, price, image, description, sort_order, is_shadow)
    SELECT ?, ?, ?, 0, NULL, NULL,
      COALESCE((SELECT MAX(sort_order) FROM menu_items WHERE category_id = ?), -1) + 1, 1
    WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name_th = ?)`);
  const tx = db.transaction(() => {
    for (const [slug, th, en] of shadowItems) {
      const cid = bySlug[slug];
      if (cid) ins.run(cid, th, en, cid, th);
    }
  });
  tx();
});

runOnce('drinks-v1', () => {
  const info = db.prepare(`
    INSERT INTO categories (slug, name_en, name_th, note, sort_order)
    SELECT 'drinks', 'Drinks', 'เครื่องดื่ม', NULL,
      COALESCE((SELECT MAX(sort_order) FROM categories), -1) + 1
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'drinks')`).run();
  const cat = db.prepare("SELECT id FROM categories WHERE slug = 'drinks'").get();
  if (!cat) return;

  // [subcategory, name_th, name_en, price]
  const drinks = [
    ['Refreshment', 'ชานมไทย', 'Thai Milk Tea', 7],
    ['Refreshment', 'กาแฟนมไทย', 'Thai Milk Coffee', 7],
    ['Refreshment', 'นมเย็น', 'Pink Milk', 7],
    ['Refreshment', 'ชานมมัทฉะ', 'Matcha Milk Tea', 7],
    ['Refreshment', 'ชามะนาว', 'Lemon Tea', 7],
    ['Refreshment', 'น้ำอัญชันมะนาว', 'Lemon Butterfly Pea', 7],
    ['Refreshment', 'ไลม์บิทเทอร์', 'Lime Bitter', 7],
    ['Refreshment', 'ลิ้นจี่สปาร์คกลิ้ง', 'Lychee Sparkling', 7],
    ['Refreshment', 'แอปเปิ้ลสปาร์คกลิ้ง', 'Apple Sparkling', 7],
    ['Refreshment', 'สตรอว์เบอร์รีสปาร์คกลิ้ง', 'Strawberry Sparkling', 7],
    ['Smoothie', 'สมูทตี้มะม่วง', 'Mango Tango', 9.5],
    ['Smoothie', 'มะม่วงมะพร้าว', 'Mango Cocokiss', 10],
    ['Smoothie', 'ลิ้นจี่บลัชอินพิงก์', 'Lychee Blush in Pink', 9.5],
    ['Smoothie', 'สับปะรดป๊อป', 'Pine Pop', 9.5],
    ['Smoothie', 'พันช์ชี่ไพน์', 'Punchy Pine', 10],
    ['Smoothie', 'ส้มแทงยูเลเทอร์', 'Tang You Later', 9.5],
    ['Smoothie', 'มะขามซ่าส์', 'Spicy Tamarind Rush', 10],
    ['Smoothie', 'แตงโมปั่น', 'Watermeloooon', 9.5],
    ['Smoothie', 'มะพร้าวปั่น', 'Cocoo-nut', 9.5],
    ['Soft Drink', 'โค้ก / โค้กซีโร่ / แฟนต้า / สไปรท์', 'Coke // Coke Zero // Fanta // Sprite', 4.5],
    ['Soft Drink', 'โซดา', 'Tap Sparkling', 5],
  ];
  const ins = db.prepare(`
    INSERT INTO menu_items (category_id, name_th, name_en, price, image, description, sort_order, is_shadow, subcategory)
    SELECT ?, ?, ?, ?, NULL, NULL,
      COALESCE((SELECT MAX(sort_order) FROM menu_items WHERE category_id = ?), -1) + 1, 0, ?
    WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name_th = ? AND category_id = ?)`);
  const tx = db.transaction(() => {
    for (const [sub, th, en, price] of drinks) {
      ins.run(cat.id, th, en, price, cat.id, sub, th, cat.id);
    }
  });
  tx();
});

// Stock photos (Wikimedia Commons, see ATTRIBUTIONS.md) backfilled into items
// that have no image yet. Never overwrites images uploaded via the dashboard.
const seedImages = {
  "ทอดมัน": '/img/menu/tod-mun.jpg',
  "เฟรนฟราย": '/img/menu/french-fries.jpg',
  "BBQ": '/img/menu/bbq.jpg',
  "ลูกชิ้นปลาลวกจิ้ม": '/img/menu/fish-balls.jpg',
  "ลูกชิ้นทอดรวม": '/img/menu/fried-meatballs.jpg',
  "ผัดไทย": '/img/menu/pad-thai.jpg',
  "ผัดซีอิ๊ว": '/img/menu/pad-see-ew.jpg',
  "เตี๋ยวคั่วไก่": '/img/menu/kua-gai.jpg',
  "ข้าวผัด": '/img/menu/fried-rice.jpg',
  "ผัดกะเพรา (เนื้อสด / เนื้อตุ๋น)": '/img/menu/pad-krapao.jpg',
  "ผัดพริกแกงเนื้อตุ๋น": '/img/menu/pad-prik-gaeng.jpg',
  "ผัดผักรวม": '/img/menu/mixed-veg.jpg',
  "หอยลายผัดฉ่า": '/img/menu/clams-pad-cha.jpg',
  "หอยลายพริกเผา": '/img/menu/clams-chili-jam.jpg',
  "แกงเผ็ดเนื้อ": '/img/menu/red-curry.jpg',
  "แกงเขียวไก่": '/img/menu/green-curry.jpg',
  "แกงอ่อมเนื้อ": '/img/menu/gaeng-om.jpg',
  "แกงฮังเล": '/img/menu/hang-le.jpg',
  "ตำไทย": '/img/menu/som-tum.jpg',
  "ตำปูปลาร้า": '/img/menu/tum-poo-plara.jpg',
  "ยำคอหมูย่าง": '/img/menu/yum-kor-moo.jpg',
  "ยำทะเลรวม": '/img/menu/yum-talay.jpg',
  "ยำหมูยอ": '/img/menu/yum-moo-yor.jpg',
  "ยำวุ้นเส้นทะเล": '/img/menu/yum-woon-sen.jpg',
  "ปีกไก่ย่าง": '/img/menu/grilled-wings.jpg',
  "คอหมูย่าง": '/img/menu/kor-moo-yang.jpg',
  "เนื้อย่าง": '/img/menu/grilled-beef.jpg',
  "ลิ้นวัวย่าง ไทยชิมิชูริ": '/img/menu/beef-tongue.jpg',
  "ไก่ทอด ณ เชียงใหม่": '/img/menu/fried-chicken.jpg',
  "หมูแดดเดียว": '/img/menu/moo-dad-diew.jpg',
  "เนื้อแดดเดียว": '/img/menu/nuea-dad-diew.jpg',
  "ต้มจืดสาหร่าย เต้าหู้ หมูสับ": '/img/menu/tom-jued.jpg',
  "แกงเห็ด": '/img/menu/gaeng-hed.jpg',
  "ต้มแซ่บเนื้อ": '/img/menu/tom-saab.jpg',
  "ซุปเปอร์น้ำแดง": '/img/menu/super-nam-daeng.jpg',
  "ก๋วยเตี๋ยวเนื้อน้ำใส": '/img/menu/beef-noodle.jpg',
  "เหลาเนื้อหม้อไฟ": '/img/menu/beef-hotpot.jpg',
  "แซลม่อนฟู": '/img/menu/salmon-foo.jpg',
  "ตีนไก่ตุ๋นวอม": '/img/menu/chicken-feet.jpg',
  "ทอดมันกุ้ง": '/img/menu/shrimp-cakes.jpg',
  "หมูยอทอด/ลวก": '/img/menu/moo-yor-fried.jpg',
  "ไก่สเตะ": '/img/menu/chicken-satay.jpg',
  "หมึกชุบแป้งทอด": '/img/menu/fried-calamari.jpg',
  "แฮกึน": '/img/menu/hae-kuen.jpg',
  "ขลุ่ยกุ้ง": '/img/menu/shrimp-flutes.jpg',
  "กุ้ยช่ายทอด": '/img/menu/chive-cakes.jpg',
  "หมูทอดกระเทียม": '/img/menu/garlic-pork.jpg',
  "หมึกทอดกระเทียม": '/img/menu/garlic-squid.jpg',
  "กุ้งทอดซอสมะขาม": '/img/menu/tamarind-prawns.jpg',
  "ตำเส้นเล็ก": '/img/menu/tum-sen-lek.jpg',
  "ปลาหมึกย่าง": '/img/menu/grilled-squid.jpg',
  "ปีกไก่ทอดผัดพริกเกลือ": '/img/menu/salt-chili-wings.jpg',
  "ก๋วยเตี๋ยวไก่มะระ": '/img/menu/chicken-noodle-mara.jpg',
  "ปลากะพงทอดน้ำปลา": '/img/menu/seabass-fish-sauce.jpg',
  "ปลากะพง 3 รส": '/img/menu/seabass-3-flavour.jpg',
  "ปลานึ่งมะนาว": '/img/menu/steamed-fish-lime.jpg',
  "ปลานึ่งซิอื้ว": '/img/menu/steamed-fish-soy.jpg',
  "ชานมไทย": '/img/menu/thai-milk-tea.jpg',
  "กาแฟนมไทย": '/img/menu/thai-milk-coffee.jpg',
  "นมเย็น": '/img/menu/pink-milk.jpg',
  "ชานมมัทฉะ": '/img/menu/matcha-milk-tea.jpg',
  "ชามะนาว": '/img/menu/lemon-tea.jpg',
  "น้ำอัญชันมะนาว": '/img/menu/lemon-butterfly-pea.jpg',
  "ไลม์บิทเทอร์": '/img/menu/lime-bitter.jpg',
  "ลิ้นจี่สปาร์คกลิ้ง": '/img/menu/lychee-sparkling.jpg',
  "แอปเปิ้ลสปาร์คกลิ้ง": '/img/menu/apple-sparkling.jpg',
  "สตรอว์เบอร์รีสปาร์คกลิ้ง": '/img/menu/strawberry-sparkling.jpg',
  "สมูทตี้มะม่วง": '/img/menu/mango-tango.jpg',
  "มะม่วงมะพร้าว": '/img/menu/mango-cocokiss.jpg',
  "ลิ้นจี่บลัชอินพิงก์": '/img/menu/lychee-blush.jpg',
  "สับปะรดป๊อป": '/img/menu/pine-pop.jpg',
  "พันช์ชี่ไพน์": '/img/menu/punchy-pine.jpg',
  "ส้มแทงยูเลเทอร์": '/img/menu/tang-you-later.jpg',
  "มะขามซ่าส์": '/img/menu/spicy-tamarind.jpg',
  "แตงโมปั่น": '/img/menu/watermelon-smoothie.jpg',
  "มะพร้าวปั่น": '/img/menu/coconut-smoothie.jpg',
  "โค้ก / โค้กซีโร่ / แฟนต้า / สไปรท์": '/img/menu/soft-drinks.jpg',
  "โซดา": '/img/menu/tap-sparkling.jpg',
  "ออเดิร์ฟ ขันโตก": '/img/menu/khantoke.jpg',
  "ไส้อั่ว": '/img/menu/sai-ua.jpg',
  "น้ำพริกอ่อง": '/img/menu/nam-prik-ong.jpg',
  "น้ำพริกมะเขือส้ม": '/img/menu/nam-prik-makhuea.jpg',
  "น้ำพริกหนุ่ม": '/img/menu/nam-prik-noom.jpg',
  "จิ้นนึ่ง น้ำพริกข่า": '/img/menu/jin-nueng.jpg',
  "ต้มยำน้ำข้น Seafood": '/img/menu/tom-yum.jpg',
  "กุ้งอบวุ้นเส้น": '/img/menu/goong-ob.jpg',
};

function backfillImages() {
  const upd = db.prepare("UPDATE menu_items SET image = ? WHERE name_th = ? AND (image IS NULL OR image = '')");
  const fill = db.transaction(() => {
    for (const [nameTh, img] of Object.entries(seedImages)) upd.run(img, nameTh);
  });
  fill();
}

backfillImages();

module.exports = db;
