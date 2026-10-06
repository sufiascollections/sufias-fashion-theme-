(() => {
  'use strict';
  const loader = document.querySelector('script[data-sufias-widgets]');
  if (!loader) return;
  const editor = loader.dataset.designMode === 'true';
  let googleScheduled = false;
  function startGoogle() {
    if (googleScheduled || document.getElementById('merchantWidgetScript')) return;
    googleScheduled = true;
    const options = JSON.parse(loader.dataset.googleWidget);
    const script = document.createElement('script');
    script.id = 'merchantWidgetScript';
    script.src = 'https://www.gstatic.com/shopping/merchant/merchantwidget.js';
    script.async = true;
    loader.dataset.googleState = 'loading';
    script.addEventListener('load', () => {
      if (window.merchantwidget && typeof window.merchantwidget.start === 'function') {
        window.merchantwidget.start(options);
        loader.dataset.googleState = 'ready';
      } else {
        loader.dataset.googleState = 'failed';
      }
    }, {once: true});
    script.addEventListener('error', () => {
      loader.dataset.googleState = 'failed';
    }, {once: true});
    document.head.appendChild(script);
  }
  function scheduleGoogle() {
    if (editor) { startGoogle(); return; }
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(startGoogle, {timeout: 1500});
    } else {
      window.setTimeout(startGoogle, 0);
    }
  }
  if (document.readyState === 'complete') scheduleGoogle();
  else window.addEventListener('load', scheduleGoogle, {once: true});

  const observed = new WeakSet();
  async function mountFeed(host) {
    const template = host.querySelector('template[data-sufias-instafeed-template]');
    if (!template || host.dataset.feedState) return;
    host.dataset.feedState = 'loading';
    const fragment = template.content.cloneNode(true);
    const scripts = Array.from(fragment.querySelectorAll('script'));
    template.replaceWith(fragment);
    try {
      for (const inert of scripts) {
        const script = document.createElement('script');
        for (const attribute of inert.attributes) {
          script.setAttribute(attribute.name, attribute.value);
        }
        script.textContent = inert.textContent;
        if (script.src) {
          script.async = false;
          await new Promise((resolve, reject) => {
            script.addEventListener('load', resolve, {once: true});
            script.addEventListener('error', reject, {once: true});
            inert.replaceWith(script);
          });
        } else {
          inert.replaceWith(script);
        }
      }
      host.dataset.feedState = 'mounted';
    } catch (error) {
      host.dataset.feedState = 'failed';
      console.error('Sufias Instagram feed could not load.', error);
    }
    host.setAttribute('aria-busy', 'false');
  }
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      mountFeed(entry.target);
    }
  }, {rootMargin: '400px 0px'}) : null;
  function initFeeds(root) {
    root.querySelectorAll('[data-sufias-instafeed]').forEach(host => {
      if (observed.has(host)) return;
      observed.add(host);
      if (observer && !editor) observer.observe(host);
      else mountFeed(host);
    });
  }
  initFeeds(document);
  document.addEventListener('shopify:section:load', event => initFeeds(event.target));
})();


