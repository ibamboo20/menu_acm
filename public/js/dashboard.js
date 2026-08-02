const PLACEHOLDER = '/img/placeholder.png';
let categories = [];
let allItems = [];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const fmtPrice = (p) => `$${(Number(p) || 0).toFixed(2)}`;

function toast(msg, isErr = false) {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast show${isErr ? ' err' : ''}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ---- drop zones ----
function setupDropZone(zoneId, textId, fileInputId) {
  const zone = $(zoneId);
  const input = $(fileInputId);
  const showPreview = (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    zone.innerHTML = `<img src="${url}" alt=""><span>${esc(file.name)}</span>`;
  };
  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', () => showPreview(input.files[0]));
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag');
    if (e.dataTransfer.files[0]) {
      input.files = e.dataTransfer.files;
      showPreview(e.dataTransfer.files[0]);
    }
  });
  return {
    reset(text) {
      input.value = '';
      zone.innerHTML = `<span>${text}</span>`;
    },
  };
}

const addDrop = setupDropZone('add-drop', 'add-drop-text', 'add-file');
const editDrop = setupDropZone('edit-drop', 'edit-drop-text', 'edit-file');

// ---- data ----
async function loadCategories() {
  const keep = { add: $('add-category').value, filter: $('filter-category').value };
  categories = await fetch('/api/categories').then((r) => r.json());
  const opts = categories.map((c) =>
    `<option value="${c.id}">${esc(c.name_en)} · ${esc(c.name_th)}</option>`).join('');
  $('add-category').innerHTML = opts;
  $('edit-category').innerHTML = opts;
  $('filter-category').innerHTML = `<option value="">ทุกหมวดหมู่ · All categories</option>${opts}`;
  if (categories.some((c) => String(c.id) === keep.add)) $('add-category').value = keep.add;
  if (categories.some((c) => String(c.id) === keep.filter)) $('filter-category').value = keep.filter;
}

async function loadItems() {
  allItems = await fetch('/api/menu').then((r) => r.json());
  const subs = [...new Set(allItems.map((i) => i.subcategory).filter(Boolean))];
  document.getElementById('subcat-list').innerHTML =
    subs.map((s) => `<option value="${esc(s)}"></option>`).join('');
  renderList();
}

function renderList() {
  const filter = $('filter-category').value;
  const items = filter ? allItems.filter((i) => String(i.category_id) === filter) : allItems;
  $('count-label').textContent = `${items.length} รายการ`;
  $('item-list').innerHTML = items.length === 0
    ? '<div class="empty-note">ไม่มีรายการ</div>'
    : items.map((it) => {
      const cat = categories.find((c) => c.id === it.category_id);
      const badge = '<span class="r-shadow">🌙 เมนูเงา</span>';
      return `
        <div class="item-row" data-id="${it.id}">
          <img src="${esc(it.image || PLACEHOLDER)}" alt="" onerror="this.src='${PLACEHOLDER}'">
          <div class="r-names">
            <div class="r-cat">${esc(cat ? cat.name_en : '')}${it.subcategory ? ` · ${esc(it.subcategory)}` : ''}${it.is_shadow ? ` <span class="r-shadow-desktop">${badge}</span>` : ''}</div>
            <div class="r-th">${esc(it.name_th)}</div>
            <div class="r-en">${esc(it.name_en)}</div>
          </div>
          <div class="r-side">
            ${it.is_shadow ? `<span class="r-shadow-mobile">${badge}</span>` : ''}
            <div class="r-price">${fmtPrice(it.price)}</div>
            <div class="r-actions">
              <button class="btn btn-ghost" data-act="edit">แก้ไข</button>
              <button class="btn btn-danger" data-act="del">ลบ</button>
            </div>
          </div>
        </div>`;
    }).join('');
}

$('filter-category').addEventListener('change', renderList);

// ---- add ----
$('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('add-btn');
  btn.disabled = true;
  try {
    const fd = new FormData(e.target);
    fd.set('is_shadow', e.target.elements.is_shadow.checked ? '1' : '0');
    const res = await fetch('/api/menu', { method: 'POST', body: fd });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed');
    e.target.reset();
    addDrop.reset('คลิกเลือกรูป หรือลากรูปมาวางที่นี่');
    toast('เพิ่มเมนูเรียบร้อย ✓');
    await loadItems();
  } catch (err) {
    toast(`เกิดข้อผิดพลาด: ${err.message}`, true);
  } finally {
    btn.disabled = false;
  }
});

// ---- edit / delete ----
$('item-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = Number(btn.closest('.item-row').dataset.id);
  const item = allItems.find((i) => i.id === id);
  if (!item) return;

  if (btn.dataset.act === 'del') {
    if (!confirm(`ลบเมนู "${item.name_th}" ?`)) return;
    const res = await fetch(`/api/menu/${id}`, { method: 'DELETE' });
    if (res.ok) { toast('ลบเมนูแล้ว'); await loadItems(); }
    else toast('ลบไม่สำเร็จ', true);
    return;
  }

  // edit
  const f = $('edit-form');
  f.elements.id.value = item.id;
  f.elements.category_id.value = item.category_id;
  f.elements.name_th.value = item.name_th;
  f.elements.name_en.value = item.name_en;
  f.elements.price.value = item.price;
  f.elements.description.value = item.description || '';
  f.elements.is_shadow.checked = !!item.is_shadow;
  f.elements.subcategory.value = item.subcategory || '';
  editDrop.reset('คลิกเลือกรูปใหม่ (ถ้าต้องการเปลี่ยน)');
  if (item.image) {
    $('edit-drop').innerHTML = `<img src="${esc(item.image)}" alt=""><span>รูปปัจจุบัน — คลิกเพื่อเปลี่ยน</span>`;
  }
  $('edit-modal').classList.add('open');
});

$('edit-cancel').addEventListener('click', () => $('edit-modal').classList.remove('open'));
$('edit-modal').addEventListener('click', (e) => {
  if (e.target === $('edit-modal')) $('edit-modal').classList.remove('open');
});

$('edit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  fd.set('is_shadow', e.target.elements.is_shadow.checked ? '1' : '0');
  const id = fd.get('id');
  fd.delete('id');
  try {
    const res = await fetch(`/api/menu/${id}`, { method: 'PUT', body: fd });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed');
    $('edit-modal').classList.remove('open');
    toast('บันทึกเรียบร้อย ✓');
    await loadItems();
  } catch (err) {
    toast(`เกิดข้อผิดพลาด: ${err.message}`, true);
  }
});

// ---- categories ----
let editingCatId = null;

function renderCategories() {
  $('cat-list').innerHTML = categories.map((c, i) => {
    if (c.id === editingCatId) {
      return `
        <div class="cat-row editing" data-id="${c.id}">
          <div class="c-fields">
            <input type="text" class="c-in" data-f="name_en" value="${esc(c.name_en)}" placeholder="English Name">
            <input type="text" class="c-in" data-f="name_th" value="${esc(c.name_th)}" placeholder="ชื่อไทย">
            <input type="text" class="c-in" data-f="note" value="${esc(c.note || '')}" placeholder="คำอธิบายหมวด (ไม่บังคับ)">
          </div>
          <div class="c-actions">
            <button class="btn btn-primary c-save" data-act="save">บันทึก</button>
            <button class="btn btn-ghost" data-act="cancel">ยกเลิก</button>
          </div>
        </div>`;
    }
    return `
      <div class="cat-row" data-id="${c.id}">
        <div class="c-info">
          <div class="c-en">${esc(c.name_en)}</div>
          <div class="c-th">${esc(c.name_th)} · ${c.item_count} เมนู</div>
          ${c.note ? `<div class="c-note">${esc(c.note)}</div>` : ''}
        </div>
        <div class="c-actions">
          <button class="btn btn-ghost c-arrow" data-act="up" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn btn-ghost c-arrow" data-act="down" ${i === categories.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="btn btn-ghost" data-act="edit">แก้ไข</button>
          <button class="btn btn-danger" data-act="del">ลบ</button>
        </div>
      </div>`;
  }).join('');
}

async function refreshCategories() {
  await loadCategories();
  await loadItems();
  renderCategories();
}

$('cat-manage').addEventListener('click', () => {
  editingCatId = null;
  renderCategories();
  $('cat-modal').classList.add('open');
});
$('cat-close').addEventListener('click', () => $('cat-modal').classList.remove('open'));
$('cat-modal').addEventListener('click', (e) => {
  if (e.target === $('cat-modal')) $('cat-modal').classList.remove('open');
});

$('cat-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const row = btn.closest('.cat-row');
  const id = Number(row.dataset.id);
  const cat = categories.find((c) => c.id === id);
  if (!cat) return;
  const act = btn.dataset.act;

  if (act === 'edit') {
    editingCatId = id;
    renderCategories();
    return;
  }
  if (act === 'cancel') {
    editingCatId = null;
    renderCategories();
    return;
  }

  if (act === 'save') {
    const body = {};
    row.querySelectorAll('.c-in').forEach((inp) => { body[inp.dataset.f] = inp.value; });
    if (!body.name_en.trim() || !body.name_th.trim()) {
      toast('ต้องกรอกชื่อทั้งอังกฤษและไทย', true);
      return;
    }
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      editingCatId = null;
      toast('แก้ไขหมวดหมู่แล้ว ✓');
      await refreshCategories();
    } catch (err) {
      toast(`เกิดข้อผิดพลาด: ${err.message}`, true);
    }
    return;
  }

  if (act === 'up' || act === 'down') {
    await fetch(`/api/categories/${id}/move`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dir: act }),
    });
    await refreshCategories();
    return;
  }

  if (act === 'del') {
    if (!confirm(`ลบหมวดหมู่ "${cat.name_en} · ${cat.name_th}" ?`)) return;
    let res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    if (res.status === 409) {
      const info = await res.json();
      const ok = confirm(
        `หมวดนี้มี ${info.items} เมนูอยู่ข้างใน\n\nถ้าลบหมวด เมนูทั้ง ${info.items} รายการจะถูกลบไปด้วย และกู้คืนไม่ได้\n\nยืนยันลบทั้งหมด?`
      );
      if (!ok) return;
      res = await fetch(`/api/categories/${id}?force=1`, { method: 'DELETE' });
    }
    if (!res.ok) {
      toast('ลบไม่สำเร็จ', true);
      return;
    }
    const out = await res.json();
    toast(out.deleted_items ? `ลบหมวดและ ${out.deleted_items} เมนูแล้ว` : 'ลบหมวดหมู่แล้ว');
    editingCatId = null;
    await refreshCategories();
  }
});

$('cat-add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('cat-add-btn');
  btn.disabled = true;
  try {
    const body = Object.fromEntries(new FormData(e.target).entries());
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed');
    e.target.reset();
    toast('เพิ่มหมวดหมู่เรียบร้อย ✓');
    await refreshCategories();
  } catch (err) {
    toast(`เกิดข้อผิดพลาด: ${err.message}`, true);
  } finally {
    btn.disabled = false;
  }
});

(async () => {
  await loadCategories();
  await loadItems();
})();
