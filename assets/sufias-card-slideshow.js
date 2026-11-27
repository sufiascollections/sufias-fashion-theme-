/* Sufias: product cards across the store cycle through every photo of the product on their own.
   Photos load only for cards on screen, one photo ahead, so mobile pages stay light. */
(() => {
  const STEP = 2500;
  const cache = new Map();
  const seen = new WeakSet();

  const sized = (src, width) => {
    const url = new URL(src.startsWith('//') ? 'https:' + src : src, location.origin);
    url.searchParams.set('width', width);
    return url.toString();
  };

  const photos = (handle) => {
    if (!cache.has(handle)) {
      const root = (window.Shopify && Shopify.routes && Shopify.routes.root) || '/';
      cache.set(handle, fetch(root + 'products/' + encodeURIComponent(handle) + '.js', { credentials: 'same-origin' })
        .then((r) => (r.ok ? r.json() : null))
        .then((p) => (p && Array.isArray(p.images) ? p.images.filter(Boolean) : []))
        .catch(() => []));
    }
    return cache.get(handle);
  };

  const start = async (card) => {
    if (card.classList.contains('sf-soon')) return; // photos stay blurred until launch
    let box, handle;
    if (card.hasAttribute('data-sf-handle')) { box = card; handle = card.getAttribute('data-sf-handle'); }
    else {
      box = card.querySelector('.t4s-product-img');
      try { handle = JSON.parse(card.getAttribute('data-product-options')).handle; } catch (e) { return; }
    }
    if (box && box.querySelector('.sf-cardshow')) return;
    if (!box || !handle) return;
    const list = await photos(handle);
    if (list.length < 2) return;

    const width = Math.min(800, Math.ceil(box.clientWidth * Math.min(window.devicePixelRatio || 1, 2)) || 600);
    const layer = document.createElement('div');
    layer.className = 'sf-cardshow';
    layer.setAttribute('aria-hidden', 'true');
    const dots = document.createElement('div');
    dots.className = 'sf-cardshow__dots';
    const frames = list.map((src, i) => {
      const img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.dataset.src = sized(src, width);
      if (i === 0) img.className = 'is-on';
      layer.appendChild(img);
      const dot = document.createElement('span');
      dot.appendChild(document.createElement('i'));
      dots.appendChild(dot);
      return { img, dot };
    });
    if (list.length <= 12) layer.appendChild(dots);
    box.appendChild(layer);

    const load = (n) => { const f = frames[n].img; if (!f.src) f.src = f.dataset.src; };
    load(0); load(1);
    let index = 0, timer = null;
    const bar = (n) => {
      frames.forEach((f, i) => { f.dot.classList.toggle('is-done', i < n); f.dot.classList.remove('is-on'); });
      void frames[n].dot.offsetWidth; // restart the fill animation
      frames[n].dot.classList.add('is-on');
    };
    const show = (n) => {
      frames[index].img.classList.remove('is-on');
      index = n;
      frames[index].img.classList.add('is-on');
      bar(index);
      load((index + 1) % frames.length);
    };
    const tick = () => {
      const next = (index + 1) % frames.length;
      const img = frames[next].img;
      if (img.src && !img.complete) return;
      show(next);
    };
    const run = () => { if (!timer) timer = setInterval(tick, STEP); };
    const stop = () => { clearInterval(timer); timer = null; };
    layer.style.setProperty('--sf-step', STEP + 'ms');
    layer.classList.add('is-ready');
    bar(0);
    setTimeout(tick, 900);
    new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? run() : stop()));
    }, { threshold: 0.35 }).observe(box);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : null));
  };

  const watcher = 'IntersectionObserver' in window && new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      watcher.unobserve(e.target);
      // Stagger the cards so a row does not change all at once.
      setTimeout(() => start(e.target), Math.random() * 500);
    });
  }, { rootMargin: '200px 0px' });

  /* Coming-soon designs: "Coming soon" label and a countdown to the launch time. */
  const soon = new Set();
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const markSoon = (card) => {
    const inner = card.querySelector('.t4s-product-inner');
    if (!inner || inner.querySelector('.sf-soon__tag')) return;
    const tag = document.createElement('span'); tag.className = 'sf-soon__tag'; tag.textContent = 'Coming soon';
    const count = document.createElement('span'); count.className = 'sf-soon__count';
    inner.append(tag, count);
    const at = Number(card.getAttribute('data-sf-launch')) || 0;
    if (at > 0) { soon.add({ at, count }); countdown(); }
  };
  let ticking = null;
  const countdown = () => {
    const now = Date.now() / 1000;
    soon.forEach((s) => {
      const left = Math.floor(s.at - now);
      if (left <= 0) { s.count.textContent = 'Live now'; soon.delete(s); return; }
      const d = Math.floor(left / 86400), h = Math.floor(left % 86400 / 3600), m = Math.floor(left % 3600 / 60);
      s.count.textContent = (d ? d + 'd ' : '') + pad(h) + 'h ' + pad(m) + 'm ' + pad(left % 60) + 's';
    });
    if (soon.size && !ticking) ticking = setInterval(countdown, 1000);
    if (!soon.size && ticking) { clearInterval(ticking); ticking = null; }
  };

  const SELECTOR = '.t4s-product[data-product-options], [data-sf-handle]';
  const scan = (root) => {
    if (!watcher) return;
    const cards = [...root.querySelectorAll(SELECTOR)];
    if (root.matches && root.matches(SELECTOR)) cards.push(root);
    cards.forEach((card) => {
      if (seen.has(card)) return;
      seen.add(card);
      if (card.classList.contains('sf-soon')) { markSoon(card); return; }
      watcher.observe(card);
    });
  };

  const css = document.createElement('style');
  css.textContent = [
    '.sf-cardshow{position:absolute;inset:0;z-index:1;pointer-events:none;opacity:0;transition:opacity .4s}',
    '.sf-cardshow.is-ready{opacity:1}',
    '.sf-cardshow img{position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity .6s ease}',
    '.sf-cardshow img.is-on{opacity:1}',
    '[data-sf-handle] .sf-cardshow img{object-fit:cover;object-position:center top}',
    '.sf-cardshow__dots{position:absolute;left:10px;right:10px;bottom:8px;display:flex;gap:4px}',
    '.sf-cardshow__dots span{position:relative;flex:1;height:3px;border-radius:3px;overflow:hidden;background:rgba(255,255,255,.45);box-shadow:0 0 2px rgba(0,0,0,.25)}',
    '.sf-cardshow__dots i{position:absolute;inset:0;background:#fff;transform:scaleX(0);transform-origin:left center}',
    '.sf-cardshow__dots span.is-done i{transform:scaleX(1)}',
    '.sf-cardshow__dots span.is-on i{animation:sfFill var(--sf-step,2000ms) linear forwards}',
    '@keyframes sfFill{from{transform:scaleX(0)}to{transform:scaleX(1)}}',
    '@media (prefers-reduced-motion:reduce){.sf-cardshow__dots span.is-on i{animation:none;transform:scaleX(1)}}',
    '@media (max-width:560px){.sf-cardshow__dots{left:8px;right:8px;bottom:6px;gap:3px}.sf-cardshow__dots span{height:2.5px}}',
  ].join('');
  document.head.appendChild(css);

  // iPhones can treat the first tap on a card as "hover" (the theme shows buttons and a second photo on hover),
  // so the product only opened on a second tap. A short, still tap on the card photo now opens the product.
  let touch = null;
  document.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    touch = e.touches.length === 1 ? { x: t.clientX, y: t.clientY, at: Date.now() } : null;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!touch) return;
    const t = e.changedTouches[0];
    const still = Math.abs(t.clientX - touch.x) < 10 && Math.abs(t.clientY - touch.y) < 10 && Date.now() - touch.at < 600;
    touch = null;
    if (!still) return;
    const inner = e.target.closest && e.target.closest('.t4s-product-inner');
    if (!inner || e.target.closest('button, input, select, .t4s-pr-item-btn, .t4s-product-btns, .t4s-product-btns2, [data-swatch-item], .t4s-product-sizes')) return;
    const link = inner.querySelector('a.t4s-full-width-link[href]');
    if (!link) return;
    e.preventDefault();
    location.href = link.href;
  }, { passive: false });

  /* Product page: the main photo gallery moves to the next photo on its own until the shopper touches it. */
  const autoGallery = () => {
    const el = document.querySelector('.t4s-product__media-wrapper .flickityt4s-enabled');
    const F = window.Flickityt4s;
    if (!el || !F || !F.data || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const inst = F.data(el);
    if (!inst || !inst.cells || inst.cells.length < 2) return;
    let timer = null, visible = false, stopped = false;
    const run = () => { if (!timer && visible && !stopped && !document.hidden) timer = setInterval(() => inst.next(true), 3500); };
    const stop = () => { clearInterval(timer); timer = null; };
    const quit = () => { stopped = true; stop(); };
    const area = el.closest('.t4s-product__media-wrapper') || el;
    ['pointerdown', 'touchstart', 'keydown', 'wheel'].forEach((t) => area.addEventListener(t, quit, { passive: true, once: true }));
    new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; visible ? run() : stop(); }, { threshold: 0.5 }).observe(el);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : run()));
  };

  const boot = () => {
    scan(document);
    autoGallery();
    new MutationObserver((records) => {
      for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1) scan(n);
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'complete') boot(); else window.addEventListener('load', boot, { once: true });
})();
