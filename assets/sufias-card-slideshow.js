/* Sufias: product cards across the store cycle through every photo of the product on their own.
   Photos load only for cards on screen, one photo ahead, so mobile pages stay light. */
(() => {
  const STEP = 2200;
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
    const box = card.querySelector('.t4s-product-img');
    let handle;
    try { handle = JSON.parse(card.getAttribute('data-product-options')).handle; } catch (e) { return; }
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
      if (i === 0) dot.className = 'is-on';
      dots.appendChild(dot);
      return { img, dot };
    });
    if (list.length <= 12) layer.appendChild(dots);
    box.appendChild(layer);

    const load = (n) => { const f = frames[n].img; if (!f.src) f.src = f.dataset.src; };
    load(0); load(1);
    let index = 0, timer = null;
    const show = (n) => {
      frames[index].img.classList.remove('is-on'); frames[index].dot.classList.remove('is-on');
      index = n;
      frames[index].img.classList.add('is-on'); frames[index].dot.classList.add('is-on');
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
    layer.classList.add('is-ready');
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
      setTimeout(() => start(e.target), Math.random() * STEP);
    });
  }, { rootMargin: '200px 0px' });

  const SELECTOR = '.t4s-product[data-product-options]';
  const scan = (root) => {
    if (!watcher) return;
    const cards = [...root.querySelectorAll(SELECTOR)];
    if (root.matches && root.matches(SELECTOR)) cards.push(root);
    cards.forEach((card) => {
      if (seen.has(card)) return;
      seen.add(card);
      watcher.observe(card);
    });
  };

  const css = document.createElement('style');
  css.textContent = [
    '.sf-cardshow{position:absolute;inset:0;z-index:1;pointer-events:none;opacity:0;transition:opacity .4s}',
    '.sf-cardshow.is-ready{opacity:1}',
    '.sf-cardshow img{position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity .6s ease}',
    '.sf-cardshow img.is-on{opacity:1}',
    '.sf-cardshow__dots{position:absolute;left:0;right:0;bottom:8px;display:flex;justify-content:center;gap:4px}',
    '.sf-cardshow__dots span{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.55);box-shadow:0 0 2px rgba(0,0,0,.35)}',
    '.sf-cardshow__dots span.is-on{background:#fff}',
    '@media (max-width:560px){.sf-cardshow__dots{bottom:6px;gap:3px}.sf-cardshow__dots span{width:5px;height:5px}}',
  ].join('');
  document.head.appendChild(css);

  const boot = () => {
    scan(document);
    new MutationObserver((records) => {
      for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1) scan(n);
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'complete') boot(); else window.addEventListener('load', boot, { once: true });
})();
