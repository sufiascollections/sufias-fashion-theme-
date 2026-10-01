(() => {
  const colours = [
    { name: 'Black', hex: '#171717' }, { name: 'Red', hex: '#a52b2b' },
    { name: 'Grey', hex: '#999999' }, { name: 'Navy', hex: '#24385c' },
    { name: 'Green', hex: '#347052' }, { name: 'Purple', hex: '#76558c' }
  ];
  const money = (amount) => `Rs. ${new Intl.NumberFormat('en-PK').format(Math.round(amount))}`;

  document.querySelectorAll('[data-booking-catalog]').forEach((root) => {
    if (root.dataset.initialized) return;
    root.dataset.initialized = 'true';
    const quickModal = root.querySelector('[data-quick-modal]');
    const requestModal = root.querySelector('[data-request-modal]');
    const quickName = root.querySelector('[data-quick-name]');
    const quickPrice = root.querySelector('[data-quick-price]');
    const quickImage = root.querySelector('[data-quick-image]');
    const quickTotal = root.querySelector('[data-quick-total]');
    const selectedColour = root.querySelector('[data-selected-colour]');
    const singleQuantity = root.querySelector('[data-single-quantity]');
    const bulkRows = root.querySelector('[data-bulk-rows]');
    const toast = root.querySelector('[data-booking-toast]');
    const form = root.querySelector('.sfbc-request-form');
    const request = [];
    let submitting = false;
    let product = null;
    let mode = 'single';
    let colour = 'Black';
    let quantity = 1;
    let toastTimer;

    const cards = [...root.querySelectorAll('[data-product-card]')];
    const releaseEnds = new Map();
    cards.filter((card) => card.dataset.releaseHours).forEach((card) => {
      const key = `sfbc-release-${card.dataset.productId}`;
      let end = Number(sessionStorage.getItem(key));
      if (!end || end < Date.now()) {
        end = Date.now() + Number(card.dataset.releaseHours) * 60 * 60 * 1000;
        sessionStorage.setItem(key, String(end));
      }
      releaseEnds.set(card, end);
    });

    function updateCountdowns() {
      releaseEnds.forEach((end, card) => {
        let seconds = Math.max(0, Math.floor((end - Date.now()) / 1000));
        const values = {
          days: Math.floor(seconds / 86400),
          hours: Math.floor((seconds % 86400) / 3600),
          minutes: Math.floor((seconds % 3600) / 60),
          seconds: seconds % 60
        };
        Object.entries(values).forEach(([unit, value]) => {
          const element = card.querySelector(`[data-${unit}]`);
          if (element) element.textContent = String(value).padStart(2, '0');
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
      const focusable = modal.querySelector('button, input, textarea');
      if (focusable) focusable.focus();
    }

    function closeModal(modal) {
      modal.hidden = true;
      if (quickModal.hidden && requestModal.hidden) document.body.classList.remove('sfbc-modal-open');
    }

    function bulkQuantities() {
      return [...bulkRows.querySelectorAll('input')].map((input) => Number(input.value) || 0);
    }

    function currentTotal() {
      if (!product) return 0;
      if (mode === 'single') return Number(product.dataset.price) * quantity;
      const pieces = bulkQuantities().reduce((sum, count) => sum + count, 0);
      const discount = pieces >= 15 ? 0.2 : pieces >= 10 ? 0.15 : pieces >= 5 ? 0.1 : 0;
      return Number(product.dataset.price) * pieces * (1 - discount);
    }

    function updateTotal() {
      quickTotal.textContent = money(currentTotal());
      if (mode === 'bulk') {
        const pieces = bulkQuantities().reduce((sum, count) => sum + count, 0);
        const discount = pieces >= 15 ? 20 : pieces >= 10 ? 15 : pieces >= 5 ? 10 : 0;
        root.querySelector('[data-bulk-info]').textContent = pieces < 5
          ? 'Add at least 5 pieces for a bulk request.'
          : `${pieces} pieces · ${discount}% estimated bulk discount`;
      }
    }

    function selectColour(name) {
      colour = name;
      selectedColour.textContent = name;
      root.querySelectorAll('[data-swatch]').forEach((swatch) => {
        const selected = swatch.dataset.swatch === name;
        swatch.classList.toggle('is-active', selected);
        swatch.setAttribute('aria-pressed', String(selected));
      });
    }

    function buildQuickView(card) {
      product = card;
      mode = 'single';
      colour = 'Black';
      quantity = 1;
      quickName.textContent = card.dataset.productName;
      quickPrice.textContent = money(Number(card.dataset.price));
      quickImage.src = card.dataset.productImage;
      quickImage.alt = card.querySelector('img').alt;
      root.querySelector('[data-quick-tag]').textContent = card.dataset.releaseHours ? 'Limited upcoming drop' : 'Previous arrival';
      singleQuantity.textContent = '1';
      root.querySelectorAll('[data-mode]').forEach((button) => button.classList.toggle('is-active', button.dataset.mode === mode));
      root.querySelector('[data-single-options]').hidden = false;
      root.querySelector('[data-bulk-options]').hidden = true;
      const swatches = root.querySelector('[data-swatches]');
      swatches.replaceChildren(...colours.map((item) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'sfbc-swatch';
        button.dataset.swatch = item.name;
        button.title = item.name;
        button.setAttribute('aria-label', item.name);
        button.setAttribute('aria-pressed', 'false');
        button.style.backgroundColor = item.hex;
        button.addEventListener('click', () => selectColour(item.name));
        return button;
      }));
      selectColour(colour);
      bulkRows.replaceChildren(...colours.map((item) => {
        const row = document.createElement('label');
        row.className = 'sfbc-bulk-row';
        row.innerHTML = `<span>${item.name}</span><input type="number" min="0" step="1" value="0" aria-label="${item.name} pieces"><span>pcs</span>`;
        row.querySelector('input').addEventListener('input', updateTotal);
        return row;
      }));
      updateTotal();
    }

    function renderRequest() {
      const lines = root.querySelector('[data-request-lines]');
      lines.replaceChildren(...request.map((item, index) => {
        const row = document.createElement('div');
        row.className = 'sfbc-request-line';
        const image = document.createElement('img');
        image.src = item.image;
        image.alt = '';
        const description = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = item.name;
        const detail = document.createElement('small');
        detail.textContent = `${item.details} · ${money(item.total)}`;
        description.append(title, detail);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'sfbc-remove';
        remove.textContent = 'Remove';
        remove.addEventListener('click', () => { request.splice(index, 1); renderRequest(); });
        row.append(image, description, remove);
        return row;
      }));
      const count = request.reduce((sum, item) => sum + item.pieces, 0);
      root.querySelector('[data-request-count]').textContent = String(count);
      root.querySelector('[data-request-empty]').hidden = request.length > 0;
      const total = root.querySelector('[data-request-total]');
      total.hidden = request.length === 0;
      root.querySelector('[data-request-total-value]').textContent = money(request.reduce((sum, item) => sum + item.total, 0));
    }

    root.addEventListener('click', (event) => {
      const opener = event.target.closest('[data-open-product]');
      if (opener) {
        const card = opener.closest('[data-product-card]');
        buildQuickView(card);
        openModal(quickModal);
        return;
      }
      if (event.target.closest('[data-open-request]')) { renderRequest(); openModal(requestModal); return; }
      if (event.target.closest('[data-close-modal]')) { closeModal(event.target.closest('.sfbc-modal')); return; }
      if (event.target.classList.contains('sfbc-modal')) { closeModal(event.target); return; }
      const modeButton = event.target.closest('[data-mode]');
      if (modeButton) {
        mode = modeButton.dataset.mode;
        root.querySelectorAll('[data-mode]').forEach((button) => button.classList.toggle('is-active', button === modeButton));
        root.querySelector('[data-single-options]').hidden = mode !== 'single';
        root.querySelector('[data-bulk-options]').hidden = mode !== 'bulk';
        updateTotal();
        return;
      }
      const step = event.target.closest('[data-single-step]');
      if (step) {
        quantity = Math.max(1, quantity + Number(step.dataset.singleStep));
        singleQuantity.textContent = String(quantity);
        updateTotal();
        return;
      }
      if (event.target.closest('[data-add-request]')) {
        const selected = mode === 'single' ? [{ colour, count: quantity }] : colours.map((item, i) => ({ colour: item.name, count: bulkQuantities()[i] })).filter((line) => line.count > 0);
        const pieces = selected.reduce((sum, line) => sum + line.count, 0);
        if (!pieces || (mode === 'bulk' && pieces < 5)) { showToast(mode === 'bulk' ? 'Bulk requests start at 5 pieces.' : 'Choose at least one piece.'); return; }
        request.push({ name: product.dataset.productName, image: product.dataset.productImage, details: selected.map((line) => `${line.colour} × ${line.count}`).join(', '), pieces, total: currentTotal() });
        renderRequest();
        closeModal(quickModal);
        showToast('Added to your request list.');
      }
    });

    root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (!quickModal.hidden) closeModal(quickModal);
        if (!requestModal.hidden) closeModal(requestModal);
      }
    });

    const search = root.querySelector('[data-booking-search]');
    const noResults = root.querySelector('[data-no-results]');
    search.addEventListener('input', () => {
      const query = search.value.trim().toLocaleLowerCase();
      let visible = 0;
      cards.filter((card) => !card.dataset.releaseHours).forEach((card) => {
        const match = card.dataset.productName.toLocaleLowerCase().includes(query);
        card.hidden = !match;
        if (match) visible += 1;
      });
      noResults.hidden = visible !== 0;
    });

    if (form) form.addEventListener('submit', (event) => {
      if (submitting) { event.preventDefault(); return; }
      if (request.length === 0) {
        event.preventDefault();
        const error = root.querySelector('[data-submit-error]');
        error.hidden = false;
        error.focus();
        return;
      }
      root.querySelector('[data-submit-error]').hidden = true;
      const lines = request.map((item) => `- ${item.name}: ${item.details}; estimated ${money(item.total)}`).join('\n');
      const name = form.querySelector('[name="contact[name]"]').value;
      const phone = form.querySelector('[name="contact[phone]"]').value;
      const email = form.querySelector('[name="contact[email]"]').value;
      const city = form.querySelector('[name="contact[city]"]').value;
      const address = form.querySelector('[name="contact[address]"]').value;
      const preferredDate = form.querySelector('[name="booking[preferred_date]"]').value;
      const preferredTime = form.querySelector('[name="booking[preferred_time]"]').value;
      form.querySelector('[data-request-message]').value = `Booking/order request from the Booking page\n\nCustomer: ${name}\nPhone: ${phone}\nEmail: ${email || 'Not provided'}\nCity: ${city}\nPreferred booking date: ${preferredDate || 'Not provided'}\nPreferred booking time: ${preferredTime || 'Not provided'}\nAddress / notes: ${address}\n\nRequested styles:\n${lines}\n\nEstimated total: ${money(request.reduce((sum, item) => sum + item.total, 0))}\nPrices and availability require confirmation by Sufias Fashion.`;
      submitting = true;
      const submitButton = form.querySelector('[data-submit-request]');
      submitButton.disabled = true;
      submitButton.setAttribute('aria-busy', 'true');
      submitButton.textContent = 'Sending request…';
    });
    renderRequest();
  });
})();
