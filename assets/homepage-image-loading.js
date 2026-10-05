/* Fetch secondary homepage product images when the shopper interacts with a card. */
(() => {
  'use strict';
  function loadHover(event) {
    const card = event.target instanceof Element && event.target.closest('.t4s-product');
    if (!card) return;
    card.querySelectorAll('img.t4s-hover-pending').forEach(image => {
      image.classList.remove('t4s-hover-pending');
      image.classList.add('lazyloadt4s');
      if (window.lazySizes && window.lazySizes.loader) window.lazySizes.loader.unveil(image);
    });
  }
  document.addEventListener('pointerover', loadHover, {passive: true});
  document.addEventListener('focusin', loadHover);
})();
