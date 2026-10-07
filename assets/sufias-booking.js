(() => {
  const money = (amount) => `Rs. ${new Intl.NumberFormat('en-PK').format(Math.round(amount))}`;

  document.querySelectorAll('[data-booking-catalog]').forEach((root) => {
    if (root.dataset.initialized) return;
    document.body.classList.add('sfbc-booking-page');
    root.dataset.initialized = 'true';
    const quickModal = root.querySelector('[data-quick-modal]');
    const requestModal = root.querySelector('[data-request-modal]');
    const quickName = root.querySelector('[data-quick-name]');
    const quickPrice = root.querySelector('[data-quick-price]');
    const quickImage = root.querySelector('[data-quick-image]');
    const quickTotal = root.querySelector('[data-quick-total]');
    const variantSelect = root.querySelector('[data-variant-select]');
    const singleQuantity = root.querySelector('[data-single-quantity]');
    const cartForm = root.querySelector('[data-shopify-cart-form]');
    const cartVariantInput = root.querySelector('[data-cart-variant]');
    const cartQuantityInput = root.querySelector('[data-cart-quantity]');
    const toast = root.querySelector('[data-booking-toast]');
    const form = root.querySelector('.sfbc-request-form');
    const request = [];
    const loggedIn = root.dataset.customerLoggedIn === 'true';
    const storageKey = 'sufias-booking-selection-v1';
    function rememberSelection() {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify({
          savedAt: Date.now(),
          items: request.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.pieces }))
        }));
      } catch (_) {}
    }
    function continueToLogin() {
      rememberSelection();
      window.location.assign(root.dataset.bookingLoginUrl);
    }
    let submitting = false;
    let product = null;
    let variants = [];
    let selectedVariant = null;
    let quantity = 1;
    let toastTimer;

    const cards = [...root.querySelectorAll('[data-product-card]')];
    const upcomingCards = cards.filter((card) => card.closest('.sfbc-upcoming'));
    const archiveCards = cards.filter((card) => card.closest('.sfbc-archive'));
    const comingEmpty = root.querySelector('[data-empty-coming]');
    const previousEmpty = root.querySelector('[data-empty-previous]');
    const noResults = root.querySelector('[data-no-results]');
    if (comingEmpty) comingEmpty.hidden = upcomingCards.length > 0;
    if (previousEmpty) previousEmpty.hidden = archiveCards.length > 0;

    function updateCountdowns() {
      upcomingCards.forEach((card) => {
        const end = Date.parse(card.dataset.releaseAt || '');
        const release = card.querySelector('.sfbc-release');
        if (!Number.isFinite(end)) return;
        const remaining = Math.max(0, Math.floor((end - Date.now()) / 1000));
        if (remaining === 0) {
          if (release) release.textContent = 'AVAILABLE NOW';
          const timer = card.querySelector('.sfbc-timer');
          if (timer) timer.hidden = true;
          card.hidden = true;
          if (comingEmpty && upcomingCards.every((upcomingCard) => upcomingCard.hidden)) comingEmpty.hidden = false;
          return;
        }
        const values = {
          days: Math.floor(remaining / 86400),
          hours: Math.floor((remaining % 86400) / 3600),
          minutes: Math.floor((remaining % 3600) / 60),
          seconds: remaining % 60
        };
        Object.entries(values).forEach(([unit, value]) => {
          const output = card.querySelector(`[data-${unit}]`);
          if (output) output.textContent = String(value).padStart(2, '0');
        });
      });
    }
    updateCountdowns();
    window.setInterval(updateCountdowns, 1000);

    function showToast(message) {
      toast.textContent = message;
      toast.classList.add('is-visible');
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
    }

    function openModal(modal) {
      modal.hidden = false;
      document.body.classList.add('sfbc-modal-open');
      const focusable = modal.querySelector('button, input, textarea, select');
      if (focusable) focusable.focus();
    }

    function closeModal(modal) {
      modal.hidden = true;
      if (quickModal.hidden && requestModal.hidden) document.body.classList.remove('sfbc-modal-open');
    }

    function currentTotal() {
      return selectedVariant ? selectedVariant.price * quantity : 0;
    }

    function updateTotal() {
      quickTotal.textContent = money(currentTotal());
      if (cartVariantInput && selectedVariant) cartVariantInput.value = String(selectedVariant.id);
      if (cartQuantityInput) cartQuantityInput.value = String(quantity);
      singleQuantity.textContent = String(quantity);
    }

    function buildQuickView(card) {
      product = card;
      quantity = 1;
      try { variants = JSON.parse(card.dataset.productVariants || '[]'); } catch (_) { variants = []; }
      if (!variants.length) return;
      selectedVariant = variants[0];
      quickName.textContent = card.dataset.productName;
      quickPrice.textContent = money(selectedVariant.price);
      if (card.dataset.productImage) {
        quickImage.src = card.dataset.productImage;
        quickImage.alt = card.querySelector('img')?.alt || card.dataset.productName;
        quickImage.hidden = false;
      } else {
        quickImage.removeAttribute('src');
        quickImage.alt = '';
        quickImage.hidden = true;
      }
      root.querySelector('[data-quick-tag]').textContent = 'Previous arrival';
      singleQuantity.textContent = '1';
      variantSelect.replaceChildren(...variants.map((variant) => {
        const option = document.createElement('option');
        option.value = String(variant.id);
        option.textContent = variant.title;
        return option;
      }));
      updateTotal();
    }

    variantSelect.addEventListener('change', () => {
      selectedVariant = variants.find((variant) => String(variant.id) === variantSelect.value) || variants[0];
      quickPrice.textContent = money(selectedVariant.price);
      updateTotal();
    });

    function renderRequest() {
      const lines = root.querySelector('[data-request-lines]');
      lines.replaceChildren(...request.map((item, index) => {
        const row = document.createElement('div'); row.className = 'sfbc-request-line';
        const image = document.createElement('img'); image.src = item.image; image.alt = '';
        const description = document.createElement('div');
        const title = document.createElement('strong'); title.textContent = item.name;
        const detail = document.createElement('small'); detail.textContent = `${item.details} · ${money(item.total)}`;
        description.append(title, detail);
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'sfbc-remove'; remove.textContent = 'Remove';
        remove.addEventListener('click', () => { request.splice(index, 1); renderRequest(); });
        row.append(image, description, remove); return row;
      }));
      const count = request.reduce((sum, item) => sum + item.pieces, 0);
      root.querySelector('[data-request-count]').textContent = String(count);
      root.querySelector('[data-request-empty]').hidden = request.length > 0;
      root.querySelector('[data-request-total]').hidden = request.length === 0;
      root.querySelector('[data-request-total-value]').textContent = money(request.reduce((sum, item) => sum + item.total, 0));
    }

    root.addEventListener('click', (event) => {
      const opener = event.target.closest('[data-open-product]');
      if (opener) {
        const card = opener.closest('[data-product-card]');
        if (!card || !card.closest('.sfbc-archive')) return;
        buildQuickView(card);
        if (variants.length) openModal(quickModal);
        return;
      }
      if (event.target.closest('[data-open-request]')) { renderRequest(); openModal(requestModal); return; }
      if (event.target.closest('[data-close-modal]')) { closeModal(event.target.closest('.sfbc-modal')); return; }
      if (event.target.classList.contains('sfbc-modal')) { closeModal(event.target); return; }
      const step = event.target.closest('[data-single-step]');
      if (step) { quantity = Math.max(1, quantity + Number(step.dataset.singleStep)); updateTotal(); return; }
      if (event.target.closest('[data-add-request]')) {
        if (!selectedVariant) { showToast('Choose a product option first.'); return; }
        request.push({
          productId: product.dataset.productId, variantId: String(selectedVariant.id),
          name: product.dataset.productName,
          image: product.dataset.productImage || '',
          details: `${selectedVariant.title} × ${quantity} @ ${money(selectedVariant.price)}`,
          pieces: quantity, total: selectedVariant.price * quantity,
          emailLines: `  ${selectedVariant.title}: ${quantity} × ${money(selectedVariant.price)}`
        });
        renderRequest(); closeModal(quickModal);
        if (!loggedIn) { continueToLogin(); return; }
        openModal(requestModal);
      }
    });

    root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (!quickModal.hidden) closeModal(quickModal);
        if (!requestModal.hidden) closeModal(requestModal);
      }
    });

    const search = root.querySelector('[data-booking-search]');
    search.addEventListener('input', () => {
      const query = search.value.trim().toLocaleLowerCase();
      let visible = 0;
      archiveCards.forEach((card) => {
        const match = card.dataset.productName.toLocaleLowerCase().includes(query);
        card.hidden = !match;
        if (match) visible += 1;
      });
      if (noResults) noResults.hidden = archiveCards.length === 0 || visible !== 0;
    });

    if (cartForm) cartForm.addEventListener('submit', (event) => {
      if (!selectedVariant || quantity < 1) {
        event.preventDefault();
        showToast('Choose a product option and quantity.');
        return;
      }
      cartVariantInput.value = String(selectedVariant.id);
      cartQuantityInput.value = String(quantity);
    });

    if (form) form.addEventListener('submit', (event) => {
      if (submitting) { event.preventDefault(); return; }
      if (request.length === 0) {
        event.preventDefault();
        const error = root.querySelector('[data-submit-error]'); error.hidden = false; error.focus(); return;
      }
      if (!loggedIn) { event.preventDefault(); continueToLogin(); return; }
      root.querySelector('[data-submit-error]').hidden = true;
      const lines = request.map((item) => `- ${item.name}\n${item.emailLines}\n  Subtotal: ${money(item.total)}`).join('\n\n');
      const name = form.querySelector('[name="contact[name]"]').value;
      const phone = form.querySelector('[name="contact[phone]"]').value;
      const email = form.querySelector('[name="contact[email]"]').value;
      const city = form.querySelector('[name="contact[city]"]').value;
      const address = form.querySelector('[name="contact[address]"]').value;
      const preferredDate = form.querySelector('[name="booking[preferred_date]"]').value;
      const preferredTime = form.querySelector('[name="booking[preferred_time]"]').value;
      form.querySelector('[data-request-message]').value = `Booking/order request from the Booking page\n\nCustomer: ${name}\nPhone: ${phone}\nEmail: ${email || 'Not provided'}\nCity: ${city || 'Not provided'}\nPreferred booking date: ${preferredDate || 'Not provided'}\nPreferred booking time: ${preferredTime || 'Not provided'}\nAddress / notes: ${address || 'Not provided'}\nSubmitted at: ${new Date().toLocaleString()}\n\nRequested styles:\n${lines}\n\nEstimated total: ${money(request.reduce((sum, item) => sum + item.total, 0))}\nPrices and availability require confirmation by Sufias Fashion.`;
      submitting = true;
      const submitButton = form.querySelector('[data-submit-request]');
      submitButton.disabled = true; submitButton.setAttribute('aria-busy', 'true'); submitButton.textContent = 'Sending request…';
    });
    if (root.querySelector('[data-request-success]')) {
      try { sessionStorage.removeItem(storageKey); } catch (_) {}
    } else if (loggedIn) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
        sessionStorage.removeItem(storageKey);
        if (saved && Date.now() - saved.savedAt < 30 * 60 * 1000 && Array.isArray(saved.items)) {
          saved.items.slice(0, 50).forEach((item) => {
            const card = archiveCards.find((entry) => entry.dataset.productId === String(item.productId));
            if (!card || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) return;
            const available = JSON.parse(card.dataset.productVariants || '[]');
            const variant = available.find((entry) => String(entry.id) === String(item.variantId));
            if (!variant) return;
            request.push({
              productId: card.dataset.productId, variantId: String(variant.id),
              name: card.dataset.productName, image: card.dataset.productImage || '',
              details: `${variant.title} × ${item.quantity} @ ${money(variant.price)}`,
              pieces: item.quantity, total: variant.price * item.quantity,
              emailLines: `  ${variant.title}: ${item.quantity} × ${money(variant.price)}`
            });
          });
        }
      } catch (_) {}
      if (request.length) openModal(requestModal);
    }
    renderRequest();
  });
})();
