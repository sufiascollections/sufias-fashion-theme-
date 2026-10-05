/* Keep dynamically rendered storefront controls accessible without changing their appearance. */
(() => {
  'use strict';
  const merchantTitle = document.currentScript?.dataset.merchantTitle || document.title;
  const cellSelector = '.flickityt4s-slider > [aria-hidden]';
  function updateCell(cell) {
    cell.inert = cell.getAttribute('aria-hidden') === 'true';
  }
  function updateAdded(root) {
    if (!(root instanceof Element)) return;
    const cells = root.matches(cellSelector) ? [root] : root.querySelectorAll(cellSelector);
    cells.forEach(updateCell);
    const frames = root.matches('#merchantwidgetiframe') ? [root] : root.querySelectorAll('#merchantwidgetiframe');
    frames.forEach(frame => { if (!frame.title) frame.title = merchantTitle; });
    const statuses = root.matches('ul.instafeed-shoppable__track > [role="status"]')
      ? [root] : root.querySelectorAll('ul.instafeed-shoppable__track > [role="status"]');
    statuses.forEach(status => {
      if (status.tagName === 'LI') {
        status.setAttribute('role', 'listitem');
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        while (status.firstChild) announcement.append(status.firstChild);
        status.append(announcement);
        return;
      }
      const item = document.createElement('li');
      item.style.listStyle = 'none';
      status.replaceWith(item);
      item.append(status);
    });
  }
  updateAdded(document.documentElement);
  new MutationObserver(records => {
    records.forEach(record => {
      if (record.type === 'attributes') {
        if (record.target.matches(cellSelector)) updateCell(record.target);
      } else record.addedNodes.forEach(updateAdded);
    });
  }).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['aria-hidden']});
})();
