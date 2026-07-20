const PLACEHOLDER = '/img/placeholder.png';
let categories = [];
let activeSlug = null;
let showShadow = localStorage.getItem('showShadow') !== '0';

const $tabs = document.getElementById('tabs');
const $menu = document.getElementById('menu');

const fmtPrice = (p) => `$${(Number(p) || 0).toFixed(2)}`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

async function init() {
  const $toggle = document.getElementById('shadow-toggle-input');
  $toggle.checked = showShadow;
  $toggle.addEventListener('change', () => {
    showShadow = $toggle.checked;
    localStorage.setItem('showShadow', showShadow ? '1' : '0');
    if (activeSlug) selectTab(activeSlug);
  });

  categories = await fetch('/api/categories').then((r) => r.json());
  $tabs.innerHTML = categories.map((c) =>
    `<button class="tab" data-slug="${c.slug}">${esc(c.name_en)}</button>`
  ).join('');
  $tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (btn) selectTab(btn.dataset.slug);
  });
  const hash = location.hash.replace('#', '');
  selectTab(categories.some((c) => c.slug === hash) ? hash : categories[0].slug);
}

async function selectTab(slug) {
  activeSlug = slug;
  history.replaceState(null, '', `#${slug}`);
  [...$tabs.children].forEach((b) => b.classList.toggle('active', b.dataset.slug === slug));
  $tabs.querySelector('.active')?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });

  const cat = categories.find((c) => c.slug === slug);
  const allItems = await fetch(`/api/menu?category=${encodeURIComponent(slug)}`).then((r) => r.json());
  if (slug !== activeSlug) return;

  window.scrollTo(0, 0);

  const items = showShadow ? allItems : allItems.filter((it) => !it.is_shadow);
  $menu.innerHTML = `
    <div class="cat-heading">
      <h2>${esc(cat.name_en)}</h2>
      <span class="cat-th">${esc(cat.name_th)}</span>
    </div>
    ${cat.note ? `<div class="cat-note">${esc(cat.note)}</div>` : ''}
    ${items.length === 0
      ? '<div class="empty-note">ยังไม่มีเมนูในหมวดนี้ — เพิ่มได้จาก Dashboard</div>'
      : `<div class="grid">${items.map(cardHTML).join('')}</div>`}
  `;
}

function cardHTML(it) {
  return `
    <article class="card${it.is_shadow ? ' shadow-item' : ''}">
      ${it.is_shadow ? '<span class="shadow-badge">🌙 เมนูเงา · Shadow</span>' : ''}
      <img class="photo" src="${esc(it.image || PLACEHOLDER)}" alt="${esc(it.name_en)}"
           loading="lazy" onerror="this.src='${PLACEHOLDER}'">
      <div class="info">
        <div class="names">
          <div class="name-th">${esc(it.name_th)}</div>
          <div class="name-en">${esc(it.name_en)}</div>
        </div>
        <div class="price">${fmtPrice(it.price)}</div>
      </div>
      ${it.description ? `<div class="desc">${esc(it.description)}</div>` : ''}
    </article>
  `;
}

init();
