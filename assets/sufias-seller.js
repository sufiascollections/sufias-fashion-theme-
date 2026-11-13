/* Sufias wholesale marketplace: approved sellers list and remove their own designs. */
(() => {
  'use strict';
  const root = document.querySelector('[data-seller]');
  if (!root) return;
  const $ = s => root.querySelector(s);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const money = n => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n / 100);
  const status = $('[data-seller-status]'), form = $('[data-seller-form]'), formStatus = $('[data-seller-form-status]');
  const MAX_PHOTOS = 8, MAX_SIDE = 1600;
  let photos = [];

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

  function drawThumbs() {
    const box = $('[data-seller-thumbs]'); box.replaceChildren();
    photos.forEach((p, i) => {
      const t = el('div', 'ss-thumb'), img = el('img'), x = el('button', '', '×');
      img.src = p.preview; img.alt = 'Photo ' + (i + 1);
      x.type = 'button'; x.setAttribute('aria-label', 'Remove photo ' + (i + 1));
      x.addEventListener('click', () => { URL.revokeObjectURL(p.preview); photos.splice(i, 1); drawThumbs(); });
      t.append(img, x); box.append(t);
    });
  }
  $('[data-seller-files]').addEventListener('change', async event => {
    const files = [...event.target.files]; event.target.value = '';
    for (const file of files) {
      if (photos.length >= MAX_PHOTOS) { formStatus.textContent = 'You can add up to ' + MAX_PHOTOS + ' photos.'; break; }
      try { const blob = await shrink(file); photos.push({ blob, preview: URL.createObjectURL(blob) }); }
      catch (e) { formStatus.textContent = e.message; }
    }
    drawThumbs();
  });

  function drawList(products) {
    const list = $('[data-seller-list]'); list.replaceChildren();
    if (!products.length) { list.append(el('p', 'sw-muted', 'No designs listed yet. Publish your first design above.')); return; }
    products.forEach(p => {
      const row = el('div', 'ss-item'), img = el('img'), info = el('div'), remove = el('button', 'sw-btn sw-btn--outline', 'Remove');
      if (p.image) img.src = p.image; img.alt = ''; img.loading = 'lazy';
      info.append(el('p', '', p.title), el('p', 'sw-muted', money(p.unitPrice) + ' / suit · ' + p.variants.map(v => v.title).join(', ')));
      remove.type = 'button';
      remove.addEventListener('click', async () => {
        if (!confirm('Remove "' + p.title + '" from the wholesale page?')) return;
        remove.disabled = true;
        try { await api('product/remove', 'POST', { id: p.id }); await load(); }
        catch (e) { alert(e.message); remove.disabled = false; }
      });
      row.append(img, info, remove); list.append(row);
    });
  }

  async function load() {
    try {
      const data = await api('status');
      status.hidden = true;
      if (!data.seller) { $('[data-seller-pending]').hidden = false; return; }
      $('[data-seller-dashboard]').hidden = false;
      $('[data-seller-name]').textContent = data.name || '';
      drawList(data.products || []);
    } catch (e) { status.textContent = e.message; }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('[data-seller-submit]'), f = new FormData(form);
    const colours = String(f.get('colours') || '').split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    if (String(f.get('title') || '').trim().length < 3) { formStatus.textContent = 'Enter a design name.'; return; }
    if (!(Number(f.get('price')) >= 100)) { formStatus.textContent = 'Enter the wholesale price per suit.'; return; }
    if (!colours.length) { formStatus.textContent = 'Add at least one colour.'; return; }
    if (!photos.length) { formStatus.textContent = 'Add at least one photo.'; return; }
    button.disabled = true;
    try {
      const images = [];
      for (let i = 0; i < photos.length; i++) {
        formStatus.textContent = 'Uploading photo ' + (i + 1) + ' of ' + photos.length + '…';
        images.push((await api('image', 'POST', { type: 'image/jpeg', data: await toBase64(photos[i].blob) })).resourceUrl);
      }
      formStatus.textContent = 'Publishing your design…';
      const result = await api('product', 'POST', {
        title: f.get('title'), description: f.get('description'), colours, images,
        price: Math.round(Number(f.get('price'))), compareAt: f.get('compareAt') ? Math.round(Number(f.get('compareAt'))) : ''
      });
      form.reset(); photos.forEach(p => URL.revokeObjectURL(p.preview)); photos = []; drawThumbs();
      formStatus.textContent = result.message || 'Your design is live.';
      await load();
    } catch (e) { formStatus.textContent = e.message; }
    finally { button.disabled = false; }
  });

  load();
})();
