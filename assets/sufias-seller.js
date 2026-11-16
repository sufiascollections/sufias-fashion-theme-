/* Sufias wholesale marketplace: approved sellers list, edit and remove their own designs. */
(() => {
  'use strict';
  const root = document.querySelector('[data-seller]');
  if (!root) return;
  const $ = s => root.querySelector(s);
  const $$ = s => [...root.querySelectorAll(s)];
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const money = n => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n);
  const MAX_PHOTOS = 10, MAX_SIDE = 1600;
  const PRESETS = ['Black', 'White', 'Maroon', 'Red', 'Pink', 'Hot Pink', 'Purple', 'Plum', 'Mauve', 'Navy Blue', 'Royal Blue', 'Teal Blue', 'Bottle Green', 'Olive Green', 'Mustard', 'Beige', 'Cream', 'Brown'];
  const SHADES = { navyblue: '#1f2a44', royalblue: '#2a4bb0', tealblue: '#367588', bottlegreen: '#0b5d3b', olivegreen: '#556b2f', mustard: '#d4a017', mauve: '#b784a7', maroon: '#6b1d2a', plum: '#6e2a5a', hotpink: '#e0218a', beige: '#e8d9bf', cream: '#f3ead6', brown: '#6b4226', pistachiogreen: '#93c572', lilac: '#c8a2c8', shockingpink: '#fc0fc0', skyblue: '#87ceeb', peach: '#ffcba4', rust: '#b7410e', grey: '#8a8a8a', offwhite: '#f5f2ea' };
  const swatch = name => {
    const v = String(name || '').toLowerCase().replace(/[^a-z]/g, '');
    if (SHADES[v]) return SHADES[v];
    return window.CSS && CSS.supports && CSS.supports('color', v) ? v : '#d9d3c7';
  };
  const titleCase = s => s.replace(/\s+/g, ' ').trim().replace(/\b\w/g, m => m.toUpperCase());

  const status = $('[data-seller-status]'), listStatus = $('[data-seller-list-status]');
  const dashboard = $('[data-seller-dashboard]'), form = $('[data-seller-form]'), formStatus = $('[data-seller-form-status]');
  let products = [], editing = null, photos = [], colours = [], dirty = false;

  async function api(path, method = 'GET', body) {
    let response;
    try {
      response = await fetch('/apps/sufias-ledger/seller/' + path, {
        method, credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Ledger-Request': '1' },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
    } catch (e) { throw Error('Connection problem. Check your internet and try again.'); }
    const data = (response.headers.get('content-type') || '').includes('application/json')
      ? await response.json() : { error: 'Selling is temporarily unavailable. Please try again.' };
    if (!response.ok) { const error = Error(data.error || 'Something went wrong'); error.code = data.code; throw error; }
    return data;
  }

  /* ---------- photos ---------- */
  /* Shrink each photo in the browser (longest side 1600px, JPEG) so uploads stay fast on mobile data. */
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale); canvas.height = Math.round(img.naturalHeight * scale);
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(blob => blob ? resolve(blob) : reject(Error('This photo could not be read')), 'image/jpeg', 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(Error('This photo could not be read. Use JPG or PNG.')); };
      img.src = url;
    });
  }
  const toBase64 = blob => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(Error('This photo could not be read'));
    r.readAsDataURL(blob);
  });

  async function addFiles(files) {
    for (const file of files) {
      if (!/^image\//.test(file.type)) continue;
      if (photos.length >= MAX_PHOTOS) { formStatus.textContent = 'You can add up to ' + MAX_PHOTOS + ' photos.'; break; }
      try { const blob = await shrink(file); photos.push({ key: Math.random().toString(36).slice(2), blob, preview: URL.createObjectURL(blob) }); dirty = true; }
      catch (e) { formStatus.textContent = e.message; }
    }
    drawPhotos(); drawColours(); drawPreview();
  }
  /* Colour-photo links follow their photo when photos move or are removed. */
  function movePhoto(from, to) {
    const keys = colours.map(c => c.photo != null ? photos[c.photo]?.key : null);
    const [p] = photos.splice(from, 1);
    if (to != null) photos.splice(to, 0, p); else if (p.blob) URL.revokeObjectURL(p.preview);
    colours.forEach((c, i) => { const idx = photos.findIndex(x => x.key === keys[i]); c.photo = idx >= 0 ? idx : null; });
    dirty = true; drawPhotos(); drawColours(); drawPreview();
  }
  function drawPhotos() {
    const box = $('[data-seller-thumbs]'); box.replaceChildren();
    photos.forEach((p, i) => {
      const t = el('div', 'ss-photo'), img = el('img');
      img.src = p.preview; img.alt = 'Photo ' + (i + 1); img.loading = 'lazy';
      t.append(img, el('span', 'ss-photo__no', String(i + 1)));
      if (!i) t.append(el('span', 'ss-photo__cover', 'Cover'));
      const tools = el('div', 'ss-photo__tools');
      const left = el('button', '', '‹'), x = el('button', '', '✕'), right = el('button', '', '›');
      [left, x, right].forEach(b => { b.type = 'button'; });
      left.setAttribute('aria-label', 'Move photo ' + (i + 1) + ' earlier'); left.disabled = !i;
      right.setAttribute('aria-label', 'Move photo ' + (i + 1) + ' later'); right.disabled = i === photos.length - 1;
      x.setAttribute('aria-label', 'Remove photo ' + (i + 1));
      left.addEventListener('click', () => movePhoto(i, i - 1));
      right.addEventListener('click', () => movePhoto(i, i + 1));
      x.addEventListener('click', () => movePhoto(i, null));
      tools.append(left, x, right); t.append(tools); box.append(t);
    });
    $('[data-seller-photo-count]').textContent = photos.length + ' / ' + MAX_PHOTOS;
  }
  const drop = $('[data-seller-drop]');
  $('[data-seller-files]').addEventListener('change', event => { const files = [...event.target.files]; event.target.value = ''; addFiles(files); });
  ['dragenter', 'dragover'].forEach(n => drop.addEventListener(n, e => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach(n => drop.addEventListener(n, () => drop.classList.remove('is-over')));
  drop.addEventListener('drop', e => { e.preventDefault(); addFiles([...(e.dataTransfer?.files || [])]); });

  /* ---------- colours ---------- */
  function addColour(name) {
    const n = titleCase(name || '');
    if (!n) return;
    if (colours.some(c => c.name.toLowerCase() === n.toLowerCase())) { formStatus.textContent = n + ' is already added.'; return; }
    if (colours.length >= 20) { formStatus.textContent = 'You can add up to 20 colours.'; return; }
    colours.push({ name: n, photo: null }); dirty = true; formStatus.textContent = '';
    drawColours(); drawPreview();
  }
  function drawColours() {
    const box = $('[data-seller-colours]'); box.replaceChildren();
    colours.forEach((c, i) => {
      const row = el('div', 'ss-colour'), dot = el('span', 'sw-dot'), sel = el('select'), x = el('button', 'ss-colour__x', '×');
      dot.style.setProperty('--sw-dot', swatch(c.name));
      sel.setAttribute('aria-label', 'Photo for ' + c.name);
      sel.append(new Option('No photo', ''));
      photos.forEach((p, n) => sel.append(new Option('Photo ' + (n + 1) + (n ? '' : ' (cover)'), String(n))));
      sel.value = c.photo == null ? '' : String(c.photo);
      sel.addEventListener('change', () => { c.photo = sel.value === '' ? null : Number(sel.value); dirty = true; drawPreview(); });
      x.type = 'button'; x.setAttribute('aria-label', 'Remove ' + c.name);
      x.addEventListener('click', () => { colours.splice(i, 1); dirty = true; drawColours(); drawPreview(); });
      row.append(dot, el('span', 'ss-colour__name', c.name), sel, x); box.append(row);
    });
    $('[data-seller-colour-count]').textContent = String(colours.length);
    $$('.ss-preset').forEach(b => b.setAttribute('aria-pressed', String(colours.some(c => c.name.toLowerCase() === b.dataset.colour.toLowerCase()))));
  }
  const colourInput = $('[data-seller-colour-input]');
  const addTyped = () => { colourInput.value.split(/[,\n]/).forEach(addColour); colourInput.value = ''; colourInput.focus(); };
  $('[data-seller-colour-add]').addEventListener('click', addTyped);
  colourInput.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTyped(); } });
  const presetBox = $('[data-seller-presets]');
  PRESETS.forEach(name => {
    const b = el('button', 'ss-preset'), dot = el('span', 'sw-dot');
    b.type = 'button'; b.dataset.colour = name; b.setAttribute('aria-pressed', 'false');
    dot.style.setProperty('--sw-dot', swatch(name));
    b.append(dot, name);
    b.addEventListener('click', () => {
      const i = colours.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
      if (i >= 0) { colours.splice(i, 1); dirty = true; drawColours(); drawPreview(); } else addColour(name);
    });
    presetBox.append(b);
  });

  /* ---------- live preview (same card as the wholesale page) ---------- */
  let previewTimer;
  function drawPreview() {
    const f = form.elements, box = $('[data-seller-preview]');
    const price = Number(f.price.value) || 0, was = Number(f.compareAt.value) || 0;
    const name = f.title.value.trim() || 'Your design name', code = f.code.value.trim().toUpperCase();
    const art = el('article', 'sw-cardp'), media = el('div', 'sw-cardp__media'), body = el('div', 'sw-cardp__body');
    const imgs = photos.map(p => p.preview);
    if (imgs.length) { const img = el('img'); img.src = imgs[0]; img.alt = ''; media.append(img); }
    else media.append(el('span', 'sw-cardp__tag', 'Add photos'));
    const pr = el('p', 'sw-cardp__price', (price ? money(price) : 'Rs —') + ' ');
    if (was > price && price) pr.append(el('s', 'sw-was', money(was)), ' ');
    pr.append(el('small', '', '/ suit'));
    body.append(el('h3', 'sw-cardp__title', code && !name.toUpperCase().includes(code) ? name + ' – ' + code : name), pr,
      el('p', 'sw-cardp__meta', 'Sold by ' + ($('[data-seller-name]').textContent || 'you')),
      el('p', 'sw-cardp__meta', colours.length + (colours.length === 1 ? ' colour' : ' colours')));
    const dots = el('div', 'sw-cardp__dots');
    colours.slice(0, 8).forEach(c => { const d = el('span', 'sw-dot'); d.style.setProperty('--sw-dot', swatch(c.name)); dots.append(d); });
    if (dots.children.length) body.append(dots);
    const btn = el('span', 'sw-btn sw-btn--outline', 'View & order'); body.append(btn);
    art.append(media, body); box.replaceChildren(art);
    const disc = $('[data-seller-discount]');
    disc.hidden = !(was > price && price);
    if (!disc.hidden) disc.textContent = Math.round((1 - price / was) * 100) + '% off';
    clearInterval(previewTimer);
    if (imgs.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      let n = 0; const img = media.querySelector('img');
      previewTimer = setInterval(() => { if (!img.isConnected) return clearInterval(previewTimer); n = (n + 1) % imgs.length; img.src = imgs[n]; }, 2500);
    }
  }
  form.addEventListener('input', e => { if (e.target.name) { dirty = true; drawPreview(); } });

  /* ---------- dashboard ---------- */
  function drawList() {
    const list = $('[data-seller-list]'); list.replaceChildren();
    $('[data-seller-count]').textContent = products.length ? products.length + (products.length === 1 ? ' design live on the wholesale page' : ' designs live on the wholesale page') : '';
    if (!products.length) {
      const empty = el('div', 'ss-empty');
      empty.append(el('h3', '', 'No designs yet'), el('p', 'sw-muted', 'Add your first design. It goes live on the Sufias wholesale page as soon as you publish it.'));
      list.append(empty); return;
    }
    products.forEach(p => {
      const card = el('article', 'ss-item'), pic = el('div', 'ss-item__img'), body = el('div', 'ss-item__body'), btns = el('div', 'ss-item__btns');
      if (p.image) { const img = el('img'); img.src = p.image; img.alt = ''; img.loading = 'lazy'; pic.append(img); }
      body.append(el('p', 'ss-item__title', p.title), el('p', 'ss-item__meta', money(p.unitPrice / 100) + ' / suit · ' + p.variants.length + (p.variants.length === 1 ? ' colour' : ' colours')));
      const edit = el('button', 'sw-btn sw-btn--primary', 'Edit'), remove = el('button', 'sw-btn sw-btn--outline', 'Remove');
      edit.type = remove.type = 'button';
      edit.addEventListener('click', () => openEditor(p));
      remove.addEventListener('click', async () => {
        if (!confirm('Remove "' + p.title + '" from the wholesale page?')) return;
        remove.disabled = true;
        try { await api('product/remove', 'POST', { id: p.id }); listStatus.textContent = '"' + p.title + '" removed.'; await load(); }
        catch (e) { listStatus.textContent = e.message; remove.disabled = false; }
      });
      btns.append(edit, remove); card.append(pic, body, btns); list.append(card);
    });
  }

  function openEditor(p) {
    editing = p || null; dirty = false; formStatus.textContent = '';
    photos.forEach(x => x.blob && URL.revokeObjectURL(x.preview));
    form.reset();
    const e = p && p.edit || {};
    photos = (e.media || []).map(m => ({ key: m.id, id: m.id, preview: m.url }));
    colours = (e.colours || []).map(c => ({ name: c.name, photo: c.image }));
    if (p) {
      const f = form.elements;
      f.title.value = e.code && p.title.endsWith(' – ' + e.code) ? p.title.slice(0, -(' – ' + e.code).length) : p.title;
      ['code', 'shirt', 'dupatta', 'trouser', 'work', 'about', 'price', 'compareAt'].forEach(k => { if (e[k] != null) f[k].value = e[k]; });
      if (e.category) f.category.value = e.category;
      if (e.stitching) f.stitching.value = e.stitching;
      f.size.value = e.size || 'Free size';
    }
    $('[data-seller-form-title]').textContent = p ? 'Edit design' : 'New design';
    $('[data-seller-submit]').textContent = p ? 'Save changes' : 'Publish design';
    drawPhotos(); drawColours(); drawPreview();
    dashboard.hidden = true; form.hidden = false;
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function closeEditor(force) {
    if (!force && dirty && !confirm('Leave without saving your changes?')) return;
    clearInterval(previewTimer);
    form.hidden = true; dashboard.hidden = false; dirty = false;
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('[data-seller-new]').addEventListener('click', () => openEditor(null));
  $$('[data-seller-cancel]').forEach(b => b.addEventListener('click', () => closeEditor(false)));
  window.addEventListener('beforeunload', e => { if (!form.hidden && dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- earnings: paid sales minus Sufias commission, and payments received ---------- */
  async function loadEarnings() {
    const box = $('[data-seller-earnings]');
    let data;
    try { data = await api('earnings'); } catch (e) { return; }
    const s = data.summary; if (!s) return;
    const rs = v => money(v / 100);
    box.querySelector('[data-earn="due"]').textContent = rs(s.due);
    box.querySelector('[data-earn="earned"]').textContent = rs(s.earned);
    box.querySelector('[data-earn="paid"]').textContent = rs(s.paid);
    box.querySelector('[data-earn="suits"]').textContent = String(s.suits);
    $('[data-seller-commission]').textContent = s.commissionPercent + '% commission';
    $('[data-earn-pending]').textContent = (s.pendingSuits ? s.pendingSuits + (s.pendingSuits === 1 ? ' suit is' : ' suits are') + ' awaiting the buyer\'s payment (' + rs(s.pendingEarnings) + ' for you once paid). ' : '')
      + 'You earn each paid sale minus ' + s.commissionPercent + '% Sufias commission. Sufias Fashion pays you the amount due.';
    const sales = $('[data-earn-sales]'), pays = $('[data-earn-payouts]');
    sales.replaceChildren(); pays.replaceChildren();
    const day = d => new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
    data.sales.slice(0, 50).forEach(l => {
      const row = el('div', 'ss-line'), amt = el('span', 'ss-line__amt', rs(l.earning));
      amt.append(el('small', l.status === 'Paid' ? 'is-paid' : l.status === 'Awaiting payment' ? 'is-wait' : 'is-off', l.status));
      row.append(el('span', '', l.title + (l.variant ? ' · ' + l.variant : '')), amt, el('span', 'ss-line__sub', day(l.date) + ' · ' + l.order + ' · ' + l.quantity + (l.quantity === 1 ? ' suit' : ' suits')));
      sales.append(row);
    });
    if (!data.sales.length) sales.append(el('p', 'ss-hint', 'No sales yet. Your earnings appear here once buyers order your designs.'));
    data.payouts.forEach(p => {
      const row = el('div', 'ss-line');
      row.append(el('span', '', p.method + (p.reference ? ' · ' + p.reference : '')), el('span', 'ss-line__amt', rs(p.amount)), el('span', 'ss-line__sub', day(p.date) + (p.note ? ' · ' + p.note : '')));
      pays.append(row);
    });
    if (!data.payouts.length) pays.append(el('p', 'ss-hint', 'No payments yet.'));
    box.hidden = false;
  }

  async function load() {
    try {
      const data = await api('status');
      status.hidden = true;
      if (!data.seller) { $('[data-seller-pending]').hidden = false; return; }
      $('[data-seller-name]').textContent = data.name || '';
      products = data.products || [];
      drawList();
      if (form.hidden) dashboard.hidden = false;
      loadEarnings();
    } catch (e) { status.hidden = false; status.textContent = e.message; }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('[data-seller-submit]'), f = form.elements;
    const fail = (msg, field) => { formStatus.textContent = msg; if (field) field.focus(); };
    if (f.title.value.trim().length < 3) return fail('Enter a design name.', f.title);
    if (!(Number(f.price.value) >= 100)) return fail('Enter the wholesale price per suit.', f.price);
    if (f.compareAt.value && Number(f.compareAt.value) <= Number(f.price.value)) return fail('The "was" price must be higher than the price, or leave it empty.', f.compareAt);
    if (!photos.length) return fail('Add at least one photo.');
    if (!colours.length) return fail('Add at least one colour.', colourInput);
    button.disabled = true;
    try {
      const images = [];
      const fresh = photos.filter(p => p.blob && !p.url).length; let done = 0;
      for (const p of photos) {
        if (p.id) { images.push({ id: p.id }); continue; }
        if (!p.url) {
          formStatus.textContent = 'Uploading photo ' + (++done) + ' of ' + fresh + '…';
          p.url = (await api('image', 'POST', { type: 'image/jpeg', data: await toBase64(p.blob) })).resourceUrl;
        }
        images.push({ url: p.url });
      }
      formStatus.textContent = editing ? 'Saving changes…' : 'Publishing your design…';
      const result = await api('product', 'POST', {
        id: editing ? editing.id : null,
        title: f.title.value, code: f.code.value, category: f.category.value, stitching: f.stitching.value, size: f.size.value,
        shirt: f.shirt.value, dupatta: f.dupatta.value, trouser: f.trouser.value, work: f.work.value, about: f.about.value,
        price: Math.round(Number(f.price.value)), compareAt: f.compareAt.value ? Math.round(Number(f.compareAt.value)) : '',
        images, colours: colours.map(c => ({ name: c.name, image: c.photo }))
      });
      listStatus.textContent = result.message || 'Saved.';
      closeEditor(true);
      await load();
    } catch (e) { formStatus.textContent = e.message; }
    finally { button.disabled = false; }
  });

  load();
})();
