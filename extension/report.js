'use strict';

(() => {
  const byId = (id) => document.getElementById(id);
  const ui = {
    content: byId('report-content'), status: byId('report-status'), error: byId('report-error'),
    rescan: byId('scan-again'), title: byId('page-title'), context: byId('page-context'),
    description: byId('page-description'), metadata: byId('page-metadata'), social: byId('social-preview'),
    outcome: byId('scan-outcome'), warnings: byId('scan-warnings'), grid: byId('image-grid'),
    count: byId('image-count'), altSummary: byId('alt-summary'), empty: byId('empty-results'),
    dialog: byId('image-modal'), close: byId('modal-close'), prev: byId('modal-prev'), next: byId('modal-next'),
    position: byId('modal-position'), modalTitle: byId('modal-title'), details: byId('modal-details'),
    media: byId('modal-media'),
  };
  const reportId = new URL(location.href).searchParams.get('id');
  const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reportId || '');
  const storageKey = 'report:' + reportId;
  const text = (value) => typeof value === 'string' ? value : '';
  const count = (value) => Number.isFinite(value) && value >= 0 ? value : 0;
  let record = null;
  let images = [];
  let sourceUrl = '';
  let sourceLanguage = '';
  let currentIndex = 0;
  let trigger = null;
  let busy = false;

  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = String(value);
    return node;
  }

  function urlFor(value, image = false) {
    const raw = text(value).trim();
    if (!raw) return null;
    try {
      const url = new URL(raw, sourceUrl || undefined);
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
      if (image && url.protocol === 'blob:' && /^blob:https?:\/\//i.test(url.href)) return url.href;
      if (image && url.protocol === 'data:' && /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon)(?:;[^,]*)?,/i.test(raw)) return url.href;
    } catch { /* Malformed and unsupported URLs remain plain text. */ }
    return null;
  }

  function localized(node) {
    if (sourceLanguage) node.lang = sourceLanguage;
    return node;
  }

  function row(list, label, value, options = {}) {
    if (value === undefined || value === null || value === '') return;
    const group = element('div', options.className || 'row');
    const term = element('dt', options.termClass || 'label', label);
    const definition = element('dd', options.valueClass || 'value');
    if (options.link && urlFor(value)) {
      const anchor = element('a', '', value);
      anchor.href = urlFor(value);
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      definition.append(anchor);
    } else {
      definition.textContent = String(value);
    }
    if (options.localize) localized(definition);
    group.append(term, definition);
    list.append(group);
  }

  function preview(container, rawUrl, alt, { lazy = false, social = false } = {}) {
    container.replaceChildren();
    const url = urlFor(rawUrl, true);
    const fallback = element('p', 'preview-unavailable', social ? 'No social preview available' : 'Image preview unavailable');
    if (!url) {
      container.append(fallback);
      return;
    }
    const img = element('img');
    img.alt = text(alt);
    if (sourceLanguage && img.alt) img.lang = sourceLanguage;
    img.referrerPolicy = 'no-referrer';
    img.decoding = 'async';
    if (lazy) img.loading = 'lazy';
    img.addEventListener('error', () => img.replaceWith(fallback), { once: true });
    img.src = url;
    container.append(img);
  }

  function altState(image) {
    return ['missing', 'empty', 'whitespace', 'present'].includes(image.altState) ? image.altState : 'unknown';
  }

  function altLabel(image) {
    return {
      missing: 'Missing alt attribute',
      empty: 'Empty alt attribute — review decorative intent',
      whitespace: 'Whitespace-only alt attribute — review',
      present: 'Alt text present — review in context',
      unknown: 'Alt attribute state unavailable',
    }[altState(image)];
  }

  function altValue(image) {
    const state = altState(image);
    if (state === 'missing') return 'Attribute not present';
    if (state === 'empty') return 'Empty string ("")';
    if (state === 'whitespace') return JSON.stringify(text(image.alt));
    return text(image.alt) || 'Not recorded';
  }

  function showError(message) {
    ui.error.textContent = message || '';
    ui.error.hidden = !message;
  }

  function setBusy(value) {
    busy = value;
    ui.rescan.disabled = value || !Number.isInteger(record?.sourceTabId);
    ui.rescan.textContent = value ? 'Scanning…' : 'Scan again';
    ui.content.setAttribute('aria-busy', String(value));
  }

  function reportUnavailable(message) {
    record = null;
    images = [];
    if (ui.dialog.open) ui.dialog.close();
    ui.content.hidden = true;
    ui.status.textContent = '';
    setBusy(false);
    showError(message);
  }

  function renderMeta(meta, data) {
    sourceUrl = text(meta.sourceUrl);
    sourceLanguage = text(meta.lang);
    ui.title.textContent = text(meta.title) || 'Untitled source page';
    ui.title.removeAttribute('lang');
    if (meta.title) localized(ui.title);
    ui.context.replaceChildren();
    row(ui.context, 'Source page', sourceUrl || 'Source URL unavailable', { link: true });
    if (text(meta.url) && meta.url !== sourceUrl) row(ui.context, 'Metadata URL', meta.url, { link: true });
    row(ui.context, 'Canonical URL', text(meta.canonical), { link: true });
    const timestamp = Date.parse(text(data.createdAt) || text(record.createdAt));
    if (Number.isFinite(timestamp)) row(ui.context, 'Recorded', new Date(timestamp).toLocaleString());
    ui.description.textContent = text(meta.description);
    ui.description.hidden = !ui.description.textContent;
    ui.description.removeAttribute('lang');
    localized(ui.description);
    ui.metadata.replaceChildren();
    const og = meta.og || {};
    const twitter = meta.twitter || {};
    const values = [
      ['Language', meta.lang], ['Robots', meta.robots], ['Viewport', meta.viewport],
      ['Author', meta.author], ['Generator', meta.generator], ['OG title', og.title, true],
      ['OG description', og.description, true], ['OG type', og.type], ['OG image URL', og.image],
      ['Twitter card', twitter.card], ['Twitter title', twitter.title, true],
      ['Twitter description', twitter.description, true], ['Twitter image URL', twitter.image],
    ];
    for (const [label, value, localize] of values) {
      row(ui.metadata, label, text(value), { className: 'kv', termClass: 'k', valueClass: 'v', localize });
    }
    preview(ui.social, text(og.image) || text(twitter.image), '', { social: true });
  }

  function renderScan(scan) {
    const reasons = {
      complete: 'The scoped scan finished.',
      'time-limit': 'The scan reached its time limit.',
      'step-limit': 'The scan reached its scroll-step limit.',
      'image-limit': 'The scan reached its image-element limit; additional elements may be omitted.',
      'payload-limit': 'The report reached its storage size limit; some image records were omitted.',
      'scan-error': 'The scan encountered an error; the available records are shown.',
      'page-hidden': 'The source tab became hidden. Keep it active during a new scan to continue checking scrollable components.',
      'user-stop': 'The scan was stopped from the source page.',
    };
    const partial = scan.partial === true || scan.reason !== 'complete';
    let outcome = (partial ? 'Partial report. ' : '') + (reasons[scan.reason] || 'Scan completion details are unavailable.');
    if (Number.isFinite(scan.containersVisited)) {
      const total = count(scan.containersVisited);
      outcome += ' ' + total + ' scrollable component' + (total === 1 ? '' : 's') + ' visited.';
    }
    ui.outcome.textContent = outcome;
    ui.warnings.replaceChildren();
    for (const warning of Array.isArray(scan.warnings) ? scan.warnings : []) {
      if (text(warning)) ui.warnings.append(element('li', '', warning));
    }
    ui.warnings.hidden = !ui.warnings.childElementCount;
    return partial;
  }

  function renderImages() {
    ui.grid.replaceChildren();
    const totals = { missing: 0, empty: 0, whitespace: 0, present: 0, unknown: 0 };
    const fragment = document.createDocumentFragment();
    images.forEach((image, index) => {
      totals[altState(image)]++;
      const card = element('article', 'image-card md-surface md-elevation-1');
      const media = element('div', 'thumb-wrap');
      preview(media, image.src, altState(image) === 'present' ? image.alt : '', { lazy: true });
      const content = element('div', 'card-content');
      const heading = element('h3', 'image-heading', 'Image ' + (index + 1));
      const fields = element('dl', 'card-metadata');
      row(fields, 'Alt status', altLabel(image));
      row(fields, 'Alt text', altValue(image), { valueClass: 'value raw-text', localize: altState(image) === 'present' });
      row(fields, 'File', text(image.fileName) || '(no filename)');
      row(fields, 'Dimensions', count(image.width) + ' × ' + count(image.height));
      row(fields, 'Source', text(image.src) || 'No source URL recorded', { className: 'row src-row', link: true });
      const button = element('button', 'action-button detail-trigger', 'Open details');
      button.type = 'button';
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-label', 'Open details for image ' + (index + 1) + ': ' + (text(image.fileName) || 'no filename'));
      button.addEventListener('click', () => openModal(index, button));
      content.append(heading, fields, button);
      card.append(media, content);
      fragment.append(card);
    });
    ui.grid.append(fragment);
    ui.count.textContent = images.length + ' image element' + (images.length === 1 ? '' : 's') + ' recorded';
    ui.altSummary.textContent = 'Alt attributes: ' + totals.missing + ' missing; ' + totals.empty + ' empty; ' +
      totals.whitespace + ' whitespace only; ' + totals.present + ' with text.' +
      (totals.unknown ? ' ' + totals.unknown + ' with unknown state.' : '') +
      ' Empty alt attributes may be correct for decorative images.';
    ui.empty.hidden = images.length !== 0;
  }

  function renderRecord(nextRecord) {
    if (!nextRecord || typeof nextRecord !== 'object') {
      reportUnavailable('This saved report is no longer available. Open the source page and activate A11y Chats to create a new report.');
      return;
    }
    record = nextRecord;
    const data = record.data;
    if (!data) {
      images = [];
      if (ui.dialog.open) ui.dialog.close();
      ui.content.hidden = true;
      ui.status.textContent = '';
      showError(text(record.error) || 'The scan did not produce a report. Open the source page and try again.');
      setBusy(false);
      return;
    }
    if (data.schemaVersion !== 1 || !Array.isArray(data.images)) {
      reportUnavailable('This saved report has an unsupported format. Open the source page and activate A11y Chats to create a new report.');
      return;
    }
    if (ui.dialog.open) ui.dialog.close();
    images = data.images.filter((image) => image && typeof image === 'object');
    renderMeta(data.meta || {}, data);
    const partial = renderScan(data.scan || {});
    renderImages();
    ui.content.hidden = false;
    ui.status.textContent = (partial ? 'Partial report ready. ' : 'Report ready. ') + images.length + ' image elements recorded.';
    showError(text(record.error));
    setBusy(false);
  }

  function renderModal(index) {
    const image = images[index];
    if (!image) return;
    currentIndex = index;
    preview(ui.media, image.src, altState(image) === 'present' ? image.alt : '');
    ui.modalTitle.textContent = text(image.fileName) || 'Image details';
    ui.position.textContent = 'Image ' + (index + 1) + ' of ' + images.length;
    ui.details.replaceChildren();
    const detail = (label, value, extra = {}) => row(ui.details, label, value, {
      className: 'detail-row', termClass: 'detail-label', valueClass: 'detail-value', ...extra,
    });
    detail('Alt attribute', altLabel(image), { className: 'detail-row' + (['missing', 'whitespace'].includes(altState(image)) ? ' is-warning' : '') });
    detail('Alt text', altValue(image), { valueClass: 'detail-value raw-text', localize: altState(image) === 'present' });
    detail('Filename', text(image.fileName));
    detail('Source URL', text(image.src) || 'No source URL recorded', { className: 'detail-row is-long', link: true });
    detail('Lazy source URL', text(image.lazySource), { className: 'detail-row is-long', link: true });
    detail('Source set attribute', text(image.srcset), { className: 'detail-row is-long' });
    detail('Dimensions', count(image.width) + ' × ' + count(image.height));
    detail('Title attribute', text(image.title), { localize: true });
    detail('ARIA label', text(image.ariaLabel), { localize: true });
    detail('ARIA labelledby attribute', text(image.ariaLabelledby));
    detail('Role attribute', text(image.role));
    detail('ARIA hidden attribute', text(image.ariaHidden));
    if (typeof image.hiddenAttribute === 'boolean') detail('Hidden attribute', image.hiddenAttribute ? 'Present' : 'Not present');
    detail('Loading', text(image.loading));
    detail('Decoding', text(image.decoding));
    detail('Fetch priority', text(image.fetchpriority));
    ui.prev.disabled = images.length <= 1;
    ui.next.disabled = images.length <= 1;
  }

  function openModal(index, button) {
    if (!images[index]) return;
    trigger = button;
    renderModal(index);
    ui.dialog.showModal();
    document.body.classList.add('modal-open');
    ui.dialog.scrollTop = 0;
    ui.close.focus();
  }

  function changeImage(direction) {
    if (!images.length) return;
    renderModal((currentIndex + direction + images.length) % images.length);
  }

  ui.close.addEventListener('click', () => ui.dialog.close());
  ui.prev.addEventListener('click', () => changeImage(-1));
  ui.next.addEventListener('click', () => changeImage(1));
  ui.dialog.addEventListener('close', () => {
    document.body.classList.remove('modal-open');
    if (trigger?.isConnected) trigger.focus();
    trigger = null;
  });
  ui.dialog.addEventListener('click', (event) => {
    if (event.target !== ui.dialog) return;
    const rect = ui.dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) ui.dialog.close();
  });
  ui.dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      const controls = Array.from(ui.dialog.querySelectorAll('button:not([disabled]), a[href]'));
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      if (window.getSelection()?.toString()) return;
      event.preventDefault();
      changeImage(event.key === 'ArrowRight' ? 1 : -1);
    }
  });

  ui.rescan.addEventListener('click', async () => {
    if (busy || !validId) return;
    setBusy(true);
    showError('');
    ui.status.textContent = 'Scanning the source page. Use Stop there to finish early. The previous report stays available until the new scan finishes.';
    try {
      const response = await chrome.runtime.sendMessage({ type: 'rescan', id: reportId });
      if (!response?.ok) throw new Error(text(response?.error) || 'The scan could not finish. Return to the source page and try again.');
      const saved = await chrome.storage.session.get(storageKey);
      renderRecord(saved[storageKey]);
    } catch (error) {
      setBusy(false);
      ui.status.textContent = record?.data ? 'The previous report is still available.' : '';
      showError(error.message || 'The scan could not finish. Return to the source page and try again.');
    }
  });

  async function start() {
    if (!validId) {
      reportUnavailable('This report link is incomplete or invalid. Open a webpage and activate A11y Chats to create a report.');
      return;
    }
    if (!globalThis.chrome?.storage?.session) {
      reportUnavailable('Open this report from the installed A11y Chats extension. A saved report cannot be opened as a standalone file.');
      return;
    }
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'session' && changes[storageKey]) renderRecord(changes[storageKey].newValue);
    });
    try {
      const saved = await chrome.storage.session.get(storageKey);
      renderRecord(saved[storageKey]);
    } catch {
      reportUnavailable('The saved report could not be read. Open the source page and activate A11y Chats to try again.');
    }
  }
  start();
})();
