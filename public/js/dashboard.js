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
  categories = await fetch('/api/categories').then((r) => r.json());
  const opts = categories.map((c) =>
    `<option value="${c.id}">${esc(c.name_en)} · ${esc(c.name_th)}</option>`).join('');
  $('add-category').innerHTML = opts;
  $('edit-category').innerHTML = opts;
  $('filter-category').innerHTML = `<option value="">ทุกหมวดหมู่ · All categories</option>${opts}`;
}

async function loadItems() {
  allItems = await fetch('/api/menu').then((r) => r.json());
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
      return `
        <div class="item-row" data-id="${it.id}">
          <img src="${esc(it.image || PLACEHOLDER)}" alt="" onerror="this.src='${PLACEHOLDER}'">
          <div class="r-names">
            <div class="r-cat">${esc(cat ? cat.name_en : '')}</div>
            <div class="r-th">${esc(it.name_th)}</div>
            <div class="r-en">${esc(it.name_en)}</div>
          </div>
          <div class="r-price">${fmtPrice(it.price)}</div>
          <div class="r-actions">
            <button class="btn btn-ghost" data-act="edit">แก้ไข</button>
            <button class="btn btn-danger" data-act="del">ลบ</button>
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

(async () => {
  await loadCategories();
  await loadItems();
})();
