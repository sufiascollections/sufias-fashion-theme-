/* Sufias wholesale: monthly PIN unlock, product detail sheet and colour-wise bulk requests. */
(() => {
  'use strict';

  /* Older mobile browsers (Safari < 15.4/16, old Android WebViews, in-app browsers) lack these APIs. */
  const uuid = () => {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(b);
    b[6] = b[6] & 15 | 64; b[8] = b[8] & 63 | 128;
    const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  };
  const timeoutSignal = ms => {
    if (window.AbortSignal && AbortSignal.timeout) return AbortSignal.timeout(ms);
    if (!window.AbortController) return undefined;
    const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal;
  };

  /* The unlock token is valid for one month from the day the PIN is entered; keep it on this device until then.
     Shared with the ledger page, so one PIN opens both. */
  const tokenExpiry = token => {
    try {
      let p = String(token).split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
      p += '==='.slice((p.length + 3) % 4);
      return Number(JSON.parse(atob(p)).expires) || 0;
    } catch (e) { return 0; }
  };
  const store = {
    key: id => 'sufias-unlock:' + id,
    read(id) {
      try {
        const t = localStorage.getItem(this.key(id)) || '';
        if (t && tokenExpiry(t) > Date.now()) return t;
        localStorage.removeItem(this.key(id));
      } catch (e) {}
      return '';
    },
    write(id, t) { try { localStorage.setItem(this.key(id), t); } catch (e) {} },
    clear(id) { try { localStorage.removeItem(this.key(id)); } catch (e) {} }
  };

  const money = n => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n / 100);
  const untilText = exp => new Date(exp - 1).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', timeZone: 'Asia/Karachi' });
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const decode = s => new DOMParser().parseFromString('<!doctype html><body>' + String(s || ''), 'text/html').body.textContent;
  const COLOUR_OPTION = /^(colou?r|shade|rang)$/i;

  document.querySelectorAll('[data-wholesale]').forEach(root => {
    const $ = s => root.querySelector(s);
    const status = $('[data-wholesale-status]');
    if (!status) return;
    const customerId = root.dataset.customer || '';
    const gate = $('[data-wholesale-gate]'), apply = $('[data-wholesale-apply]'), unlockForm = $('[data-wholesale-unlock]'), content = $('[data-wholesale-content]');
    const lockBtn = $('[data-wholesale-lock]'), grid = $('[data-wholesale-products]'), upcomingGrid = $('[data-wholesale-upcoming]');
    const search = $('[data-wholesale-search]'), modal = $('[data-wholesale-modal]'), sheet = modal.querySelector('[role=dialog]');
    const orderStatus = $('[data-wholesale-order-status]'), note = $('[data-wholesale-note]');

    let token = '', products = [], key = uuid(), openProduct = null, lastFocus = null;
    const selected = new Map();

    /* ---------- access & unlock ---------- */
    function lock(message) {
      token = ''; products = []; selected.clear();
      content.hidden = true; gate.hidden = false; lockBtn.hidden = true;
      grid.replaceChildren(); upcomingGrid.replaceChildren();
      closeDetail();
      unlockForm.hidden = false;
      if (message) status.textContent = message;
    }

    async function api(path, method = 'GET', body) {
      let response;
      try {
        response = await fetch('/apps/sufias-ledger/' + path, {
          method, credentials: 'same-origin', signal: timeoutSignal(30000),
          headers: { 'Content-Type': 'application/json', 'X-Ledger-Request': '1', 'X-Ledger-Unlock': token },
          ...(body ? { body: JSON.stringify(body) } : {})
        });
      } catch (e) { throw Error('Connection problem. Check your internet and try again.'); }
      const data = (response.headers.get('content-type') || '').includes('application/json')
        ? await response.json()
        : { error: 'Wholesale is temporarily unavailable. Please try again or contact Sufias Fashion.' };
      if (!response.ok) {
        if (data.code === 'PIN_REQUIRED') {
          store.clear(customerId);
          lock('Your one-month access has ended. Enter your PIN to unlock wholesale for another month.');
        } else if (data.code === 'WHOLESALE_APPROVAL_REQUIRED') {
          store.clear(customerId); lock(); unlockForm.hidden = true; apply.hidden = false;
        }
        const error = Error(data.error || 'Unable to complete request'); error.code = data.code; throw error;
      }
      return data;
    }

    async function openCatalog() {
      const catalog = await api('wholesale/catalog');
      products = catalog.products || [];
      render();
      gate.hidden = true; content.hidden = false; lockBtn.hidden = false;
      const exp = tokenExpiry(token);
      $('[data-wholesale-unlocked]').textContent = exp ? 'Unlocked until ' + untilText(exp) : '';
    }

    async function access() {
      try {
        const data = await api('access');
        apply.hidden = data.approval !== 'none';
        /* Owner approval is the only gate: an approved, logged-in customer goes straight in, no PIN. */
        unlockForm.hidden = true;
        status.textContent = data.approval === 'approved' ? 'Opening wholesale collection…'
          : data.approval === 'pending' ? 'Your wholesale request is awaiting owner approval. This page opens automatically once Sufias Fashion approves your account.'
          : data.approval === 'revoked' ? 'Your wholesale access is blocked. Please contact Sufias Fashion.'
          : 'Request approval below to become a wholesale customer.';
        if (data.approval === 'approved') {
          await openCatalog();
          status.textContent = '';
          lockBtn.hidden = true;
        }
      } catch (error) { status.textContent = error.message; }
    }

    apply.addEventListener('submit', async event => {
      event.preventDefault();
      const button = apply.querySelector('button'); button.disabled = true;
      try { const data = await api('wholesale/request', 'POST', Object.fromEntries(new FormData(apply))); apply.hidden = true; status.textContent = data.message; }
      catch (error) { status.textContent = error.message; }
      finally { button.disabled = false; }
    });

    unlockForm.addEventListener('submit', async event => {
      event.preventDefault();
      const button = unlockForm.querySelector('button'); button.disabled = true;
      status.textContent = 'Opening wholesale collection…';
      try {
        const result = await api('unlock', 'POST', { pin: new FormData(unlockForm).get('pin') });
        token = result.token; unlockForm.reset();
        store.write(customerId, token);
        await openCatalog();
        content.scrollIntoView({ block: 'start' });
      } catch (error) { status.textContent = error.message; }
      finally { button.disabled = false; }
    });

    lockBtn.addEventListener('click', () => { store.clear(customerId); lock('Wholesale locked on this device. Enter your PIN to open it again.'); window.scrollTo(0, 0); });

    /* ---------- helpers for products ---------- */
    const colourIndex = p => (p.options || []).findIndex(o => COLOUR_OPTION.test(String(o).trim()));
    function variantLabel(p, v) {
      const i = colourIndex(p);
      if (i >= 0 && v.options && v.options[i]) {
        const rest = v.options.filter((_, j) => j !== i);
        return { colour: v.options[i], extra: rest.join(' / ') };
      }
      return { colour: v.title === 'Default Title' ? 'Standard' : v.title, extra: '' };
    }
    const SHADES = { navyblue: '#1f2a44', navy: '#1f2a44', deepnavy: '#14213d', olivegreen: '#556b2f', deepteal: '#0f5257', tealblue: '#367588', deepplum: '#5b2a4a', champagnebeige: '#e8d6b3', emeraldgreen: '#047857', sagegreen: '#9caf88', mustard: '#d4a017', mustardorange: '#e0a030', dustyrose: '#c08081', chocolatebrown: '#5c3a21', charcoalgrey: '#36454f', mochabrown: '#6f4e37', camel: '#c19a6b', taupe: '#8b7d6b', mauve: '#b784a7', burgundy: '#800020', maroon: '#6b1d2a', lightgrey: '#d3d3d3', blue: '#2c5aa0' };
    function swatch(name) {
      const value = String(name || '').toLowerCase().replace(/[^a-z]/g, '');
      if (SHADES[value]) return SHADES[value];
      return window.CSS && CSS.supports && CSS.supports('color', value) ? value : '';
    }
    /* Optional struck-through "was" price, from the product's custom.wholesale_compare_price metafield. */
    const priceInto = (node, p, suffix) => {
      node.textContent = money(p.unitPrice) + ' ';
      if (p.wholesaleCompareAt > p.unitPrice) { node.append(el('s', 'sw-was', money(p.wholesaleCompareAt)), ' '); }
      node.append(el('small', '', suffix));
    };
    const qtyFor = p => p.variants.reduce((sum, v) => sum + (selected.get(v.id) || 0), 0);
    const imagesFor = p => (p.images && p.images.length ? p.images : (p.image ? [p.image] : []));

    /* ---------- grid ---------- */
    function card(p) {
      const art = el('article', 'sw-cardp' + (p.upcoming ? ' sw-cardp--upcoming' : ''));
      const media = el(p.upcoming ? 'div' : 'button', 'sw-cardp__media');
      if (!p.upcoming) { media.type = 'button'; media.setAttribute('aria-label', 'View ' + p.title); media.addEventListener('click', () => openDetail(p)); }
      if (p.image) { const img = el('img'); img.src = p.image; img.alt = p.upcoming ? '' : p.title; img.loading = 'lazy'; media.append(img); }
      if (p.upcoming) media.append(el('span', 'sw-cardp__tag', 'Coming soon'));
      const q = qtyFor(p);
      if (q) media.append(el('span', 'sw-cardp__tag sw-cardp__tag--sel', q + ' in request'));
      const body = el('div', 'sw-cardp__body');
      const title = el(p.upcoming ? 'h3' : 'button', 'sw-cardp__title', p.title);
      if (!p.upcoming) { title.type = 'button'; title.addEventListener('click', () => openDetail(p)); }
      const price = el('p', 'sw-cardp__price'); priceInto(price, p, '/ suit');
      body.append(title, price);
      if (p.upcoming) {
        const launch = el('p', 'sw-cardp__launch', p.launchAt ? 'Launch: ' + new Date(p.launchAt).toLocaleString('en-PK') : 'Coming soon');
        launch.dataset.launch = p.launchAt || '';
        body.append(launch);
      } else {
        const colours = [...new Set(p.variants.map(v => variantLabel(p, v).colour))];
        const available = p.variants.filter(v => v.available).length;
        body.append(el('p', 'sw-cardp__meta', colours.length + (colours.length === 1 ? ' colour' : ' colours') + (available < p.variants.length ? ' · ' + available + ' available' : '')));
        const dots = el('div', 'sw-cardp__dots');
        colours.slice(0, 8).forEach(c => { const s = swatch(c); if (s) { const d = el('span', 'sw-dot'); d.style.setProperty('--sw-dot', s); d.title = c; dots.append(d); } });
        if (dots.children.length) body.append(dots);
        const btn = el('button', 'sw-btn ' + (q ? 'sw-btn--primary' : 'sw-btn--outline'), q ? 'Edit quantities' : 'View & order');
        btn.type = 'button'; btn.addEventListener('click', () => openDetail(p));
        body.append(btn);
      }
      art.append(media, body);
      return art;
    }

    function render() {
      const term = (search.value || '').trim().toLowerCase();
      grid.replaceChildren(); upcomingGrid.replaceChildren();
      for (const p of products) {
        if (term && !p.title.toLowerCase().includes(term)) continue;
        (p.upcoming ? upcomingGrid : grid).append(card(p));
      }
      $('[data-upcoming-section]').hidden = !upcomingGrid.children.length;
      if (!grid.children.length) grid.append(el('p', 'sw-empty', term ? 'No designs match "' + search.value + '".' : 'No wholesale designs available right now.'));
      const min = products.find(p => p.minQuantity);
      if (min) $('[data-wholesale-min]').textContent = min.minQuantity;
      bag();
    }
    search.addEventListener('input', render);

    /* ---------- detail sheet ---------- */
    function showImage(index) {
      const track = $('[data-wholesale-gallery]');
      const target = track.children[index];
      if (target) track.scrollTo({ left: target.offsetLeft, behavior: 'smooth' });
      $('[data-wholesale-thumbs]').querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-current', String(i === index)));
    }

    function detailTotals(p) {
      const q = qtyFor(p);
      $('[data-wholesale-detail-count]').textContent = q + (q === 1 ? ' suit' : ' suits');
      $('[data-wholesale-detail-total]').textContent = money(q * p.unitPrice);
      $('[data-wholesale-detail-status]').textContent = q > 0 && q < p.minQuantity ? 'Add at least ' + p.minQuantity + ' suits for this design (you can mix colours).' : '';
    }

    function openDetail(p) {
      openProduct = p; lastFocus = document.activeElement;
      const images = imagesFor(p);
      const track = $('[data-wholesale-gallery]'), thumbs = $('[data-wholesale-thumbs]');
      track.replaceChildren(); thumbs.replaceChildren();
      images.forEach((src, i) => {
        const img = el('img'); img.src = src; img.alt = p.title + ' — image ' + (i + 1); img.loading = i ? 'lazy' : 'eager'; track.append(img);
        if (images.length > 1) {
          const b = el('button'); b.type = 'button'; b.setAttribute('aria-label', 'Show image ' + (i + 1));
          const t = el('img'); t.src = src; t.alt = ''; t.loading = 'lazy'; b.append(t);
          b.addEventListener('click', () => showImage(i)); thumbs.append(b);
        }
      });
      thumbs.hidden = images.length < 2;
      $('[data-wholesale-detail-type]').textContent = p.type || 'Wholesale design';
      $('[data-wholesale-detail-title]').textContent = p.title;
      priceInto($('[data-wholesale-detail-price]'), p, 'per suit');
      $('[data-wholesale-detail-min]').textContent = 'Min. ' + p.minQuantity + ' suits per design';

      const rows = $('[data-wholesale-detail-rows]'); rows.replaceChildren();
      for (const v of p.variants) {
        const { colour, extra } = variantLabel(p, v);
        const row = el('div', 'sw-row' + (v.available ? '' : ' sw-row--off'));
        const name = el('button', 'sw-row__name'); name.type = 'button';
        const s = swatch(colour); if (s) { const d = el('span', 'sw-dot'); d.style.setProperty('--sw-dot', s); name.append(d); }
        const label = el('span', '', colour); name.append(label);
        if (extra) name.append(el('small', '', extra));
        if (!v.available) name.append(el('small', '', 'Unavailable'));
        const imageIndex = v.image ? images.indexOf(v.image) : -1;
        name.addEventListener('click', () => { if (imageIndex >= 0) showImage(imageIndex); });
        const step = el('div', 'sw-step');
        const minus = el('button', '', '−'), plus = el('button', '', '+'), input = el('input');
        minus.type = plus.type = 'button';
        minus.setAttribute('aria-label', 'Fewer ' + colour); plus.setAttribute('aria-label', 'More ' + colour);
        input.type = 'number'; input.inputMode = 'numeric'; input.min = '0'; input.max = '1000'; input.step = '1';
        input.setAttribute('aria-label', colour + (extra ? ' ' + extra : '') + ' quantity');
        input.value = String(selected.get(v.id) || 0);
        const set = q => {
          q = Math.max(0, Math.min(1000, Math.floor(Number(q) || 0)));
          if (q) selected.set(v.id, q); else selected.delete(v.id);
          input.value = String(q); minus.disabled = !v.available || q === 0;
          key = uuid(); detailTotals(p); bag();
          if (q && imageIndex >= 0) showImage(imageIndex);
        };
        [minus, plus, input].forEach(n => { n.disabled = !v.available; });
        minus.disabled = !v.available || !selected.get(v.id);
        minus.addEventListener('click', () => set((selected.get(v.id) || 0) - 1));
        plus.addEventListener('click', () => set((selected.get(v.id) || 0) + 1));
        input.addEventListener('change', () => set(input.value));
        input.addEventListener('focus', () => input.select());
        step.append(minus, input, plus);
        row.append(name, step); rows.append(row);
      }

      const desc = $('[data-wholesale-detail-desc]'); desc.replaceChildren();
      decode(p.description).split('¶').map(s => s.trim()).filter(Boolean).forEach(text => desc.append(el('p', '', text)));

      detailTotals(p);
      modal.hidden = false; document.documentElement.classList.add('sw-lock');
      track.scrollLeft = 0; showImage(0);
      sheet.scrollTop = 0; sheet.focus();
    }

    function closeDetail() {
      if (modal.hidden) return;
      modal.hidden = true; document.documentElement.classList.remove('sw-lock');
      openProduct = null;
      render();
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    }
    modal.querySelectorAll('[data-wholesale-close]').forEach(n => n.addEventListener('click', closeDetail));
    $('[data-wholesale-detail-done]').addEventListener('click', closeDetail);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeDetail(); });

    /* ---------- bulk request ---------- */
    function bag() {
      const target = $('[data-wholesale-bag]'); target.replaceChildren();
      let total = 0, count = 0;
      for (const p of products) {
        const parts = [];
        let q = 0;
        for (const v of p.variants) {
          const n = selected.get(v.id) || 0; if (!n) continue;
          const { colour, extra } = variantLabel(p, v);
          parts.push(colour + (extra ? ' (' + extra + ')' : '') + ' × ' + n); q += n;
        }
        if (!q) continue;
        total += q * p.unitPrice; count += q;
        const line = el('div', 'sw-line');
        const img = el('img'); if (p.image) img.src = p.image; img.alt = ''; img.loading = 'lazy';
        const info = el('div'); info.append(el('p', 'sw-line__title', p.title), el('p', 'sw-line__sub', parts.join(', ')));
        if (q < p.minQuantity) info.append(el('p', 'sw-line__sub', 'Add ' + (p.minQuantity - q) + ' more to reach the minimum.'));
        const amt = el('div', 'sw-line__amt', money(q * p.unitPrice));
        const edit = el('button', 'sw-line__edit', 'Edit'); edit.type = 'button'; edit.addEventListener('click', () => openDetail(p));
        amt.append(edit);
        line.append(img, info, amt); target.append(line);
      }
      if (count) {
        const t = el('div', 'sw-total'); t.append(el('span', '', count + ' suits'), el('strong', '', money(total))); target.append(t);
      } else target.append(el('p', 'sw-muted', 'No designs added yet. Tap a design above to choose colours and quantities.'));
      $('[data-wholesale-count]').textContent = String(count);
      const jump = $('[data-wholesale-jump]');
      jump.hidden = !count || !modal.hidden;
      jump.textContent = count + ' suits · ' + money(total) + ' — Review order';
    }

    note.addEventListener('input', () => { key = uuid(); });
    $('[data-wholesale-submit]').addEventListener('click', async () => {
      const button = $('[data-wholesale-submit]');
      if (!selected.size) { orderStatus.textContent = 'Choose a design, colour and quantity first.'; return; }
      for (const p of products) {
        const q = qtyFor(p);
        if (q > 0 && q < p.minQuantity) { orderStatus.textContent = 'Choose at least ' + p.minQuantity + ' suits for ' + p.title + '. You can mix colours.'; return; }
      }
      button.disabled = true; orderStatus.textContent = 'Placing your order…';
      try {
        const result = await api('wholesale/order', 'POST', { items: [...selected].map(([variantId, quantity]) => ({ variantId, quantity })), note: note.value, key, checkout: true });
        selected.clear(); key = uuid(); note.value = ''; render();
        orderStatus.textContent = result.message;
        /* Shopify checkout for the wholesale draft order: shipping address and bank transfer payment. */
        if (result.invoiceUrl && /^https:\/\//.test(result.invoiceUrl)) { window.location.assign(result.invoiceUrl); return; }
      } catch (error) {
        orderStatus.textContent = error.message;
        if (!gate.hidden) status.textContent = error.message;
      } finally { button.disabled = false; }
    });

    /* ---------- timers: launch countdowns and month-end lock ---------- */
    let refreshing = false;
    setInterval(async () => {
      if (token && tokenExpiry(token) <= Date.now()) {
        store.clear(customerId);
        lock('Your one-month access has ended. Enter your PIN to unlock wholesale for another month.');
        return;
      }
      for (const node of root.querySelectorAll('[data-launch]')) {
        const left = Math.max(0, Date.parse(node.dataset.launch) - Date.now());
        if (Number.isFinite(left)) node.textContent = 'Launches in ' + Math.floor(left / 864e5) + 'd ' + Math.floor(left / 36e5 % 24) + 'h ' + Math.floor(left / 6e4 % 60) + 'm ' + Math.floor(left / 1e3 % 60) + 's';
      }
      if (!token || refreshing || !products.some(p => p.upcoming && p.launchAt && Date.parse(p.launchAt) <= Date.now())) return;
      refreshing = true;
      try { products = (await api('wholesale/catalog')).products; render(); }
      catch (error) { status.textContent = error.message; }
      finally { refreshing = false; }
    }, 1000);

    access();
  });
})();
