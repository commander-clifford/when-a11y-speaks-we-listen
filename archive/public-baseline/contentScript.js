// contentScript.js
// Image Alt Text Inspector — MV3 content script
// - Expands hidden/accordion content
// - Waits for lazy images to load
// - Scrapes meta (title/description/og/twitter/etc.)
// - Opens a blob page styled via a packaged CSS file

// ---------- Utilities to reveal content & load images ----------
function expandHiddenContent() {
  document.querySelectorAll('details:not([open])').forEach((el) => (el.open = true));

  const toggleKeywords = ['accordion', 'toggle', 'tab', 'more', 'expand', 'show more', 'read more'];
  const clickable = Array.from(document.querySelectorAll('button, a, div')).filter((el) => {
    const text = (el.innerText || '').toLowerCase().trim();
    return text && toggleKeywords.some((k) => text.includes(k));
  });

  clickable.forEach((el) => {
    const isLink = el.tagName === 'A';
    const href = (el.getAttribute('href') || '').trim();
    const isSafeLink = !isLink || href === '' || href === '#' || href.startsWith('javascript:');

    if (isSafeLink) {
      try {
        el.click();
      } catch (_) {}
    }
  });
}

function scrollToBottomFully(done) {
  let lastHeight = document.documentElement.scrollHeight;
  let attempts = 0;

  const tick = () => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    setTimeout(() => {
      const newHeight = document.documentElement.scrollHeight;
      if (newHeight !== lastHeight) {
        lastHeight = newHeight;
        attempts = 0;
        tick();
      } else if (attempts < 3) {
        attempts++;
        tick();
      } else {
        done();
      }
    }, 500);
  };

  expandHiddenContent();
  tick();
}

function waitForAllImages(callback) {
  const images = Array.from(document.querySelectorAll('img'));
  const unloaded = images.filter((img) => !img.complete || img.naturalHeight === 0);

  if (unloaded.length === 0) {
    callback();
    return;
  }

  let remaining = unloaded.length;
  unloaded.forEach((img) => {
    img.addEventListener(
      'load',
      () => {
        remaining--;
        if (remaining <= 0) callback();
      },
      { once: true }
    );
    img.addEventListener(
      'error',
      () => {
        remaining--;
        if (remaining <= 0) callback();
      },
      { once: true }
    );
  });

  setTimeout(callback, 5000);
}

// ---------- Meta helpers ----------
function getMetaByName(name) {
  const el = document.querySelector(`meta[name="${name}"]`);
  return el?.getAttribute('content') || '';
}

function getMetaByProp(prop) {
  const el = document.querySelector(`meta[property="${prop}"]`);
  return el?.getAttribute('content') || '';
}

function getLink(rel) {
  const el = document.querySelector(`link[rel="${rel}"]`);
  return el?.getAttribute('href') || '';
}

function getPageMeta() {
  const title = (document.querySelector('title')?.textContent || '').trim();
  const description =
    getMetaByName('description') ||
    getMetaByProp('og:description') ||
    getMetaByName('twitter:description') ||
    '';
  const url = getMetaByProp('og:url') || getLink('canonical') || window.location.href;
  const lang = document.documentElement.getAttribute('lang') || '';
  const canonical = getLink('canonical');
  const robots = getMetaByName('robots');
  const viewport = getMetaByName('viewport');
  const author = getMetaByName('author');
  const generator = getMetaByName('generator');

  const og = {
    title: getMetaByProp('og:title') || '',
    description: getMetaByProp('og:description') || '',
    type: getMetaByProp('og:type') || '',
    image: getMetaByProp('og:image') || '',
  };

  const twitter = {
    title: getMetaByName('twitter:title') || '',
    description: getMetaByName('twitter:description') || '',
    image: getMetaByName('twitter:image') || getMetaByName('twitter:image:src') || '',
    card: getMetaByName('twitter:card') || '',
  };

  return {
    title,
    description,
    url,
    lang,
    canonical,
    robots,
    viewport,
    author,
    generator,
    og,
    twitter,
  };
}

// ---------- Core: scrape images and render ----------
function collectAndDisplayImages() {
  const meta = getPageMeta();

  const images = Array.from(document.querySelectorAll('img')).map((img, index) => {
    const src = img.currentSrc || img.src || '';
    const fileName = src ? decodeURIComponent(src.split('/').pop().split('?')[0]) : '(no src)';
    const alt = img.getAttribute('alt') || '';
    const width = img.naturalWidth || img.width || 0;
    const height = img.naturalHeight || img.height || 0;

    return {
      id: index,
      src,
      alt: alt.trim() || '!!! No alt text !!!',
      fileName,
      width,
      height,
      loading: img.getAttribute('loading') || '',
      decoding: img.getAttribute('decoding') || '',
      fetchpriority: img.getAttribute('fetchpriority') || '',
      title: img.getAttribute('title') || '',
      ariaLabel: img.getAttribute('aria-label') || '',
    };
  });

  const esc = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const escAttr = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const kvClass = (key) => ({
    lang: 'kv-sm',
    robots: 'kv-sm',
    author: 'kv-sm',
    ogType: 'kv-sm',
    viewport: 'kv-md',
    generator: 'kv-md',
    twitterCard: 'kv-md',
    ogTitle: 'kv-lg',
    twitterTitle: 'kv-lg',
    ogDesc: 'kv-full',
    twitterDesc: 'kv-full',
  }[key] || 'kv-md');

  const kv = (key, label, value) =>
    value ? `<div class="kv ${kvClass(key)}"><div class="k">${esc(label)}</div><div class="v">${esc(value)}</div></div>` : '';

  const metaBlock = `
    <div class="page-header md-surface md-elevation-1">
      <div>
        <h1>${meta.title ? esc(meta.title) : '(no title found)'}</h1>
        <div class="row"><span class="label">URL:</span><a href="${escAttr(meta.url)}" target="_blank" rel="noopener">${esc(meta.url)}</a></div>
        ${
          meta.canonical
            ? `<div class="row"><span class="label">Canonical:</span><a href="${escAttr(meta.canonical)}" target="_blank" rel="noopener">${esc(meta.canonical)}</a></div>`
            : ''
        }
        <div class="kvs">
          ${kv('lang', 'Lang', meta.lang)}
          ${kv('robots', 'Robots', meta.robots)}
          ${kv('viewport', 'Viewport', meta.viewport)}
          ${kv('author', 'Author', meta.author)}
          ${kv('generator', 'Generator', meta.generator)}
          ${kv('ogTitle', 'OG Title', meta.og.title)}
          ${kv('ogDesc', 'OG Desc', meta.og.description)}
          ${kv('ogType', 'OG Type', meta.og.type)}
          ${kv('twitterCard', 'Twitter Card', meta.twitter.card)}
          ${kv('twitterTitle', 'Twitter Title', meta.twitter.title)}
          ${kv('twitterDesc', 'Twitter Desc', meta.twitter.description)}
        </div>
        ${meta.description ? `<p class="desc"><span class="label">Description:</span> ${esc(meta.description)}</p>` : ''}
        <div class="row"><span class="count">${images.length} images found</span></div>
      </div>
      <div class="preview md-surface-variant">
        ${
          meta.og.image || meta.twitter.image
            ? `<img src="${escAttr(meta.og.image || meta.twitter.image)}" alt="">`
            : `<div class="row muted">No preview image</div>`
        }
      </div>
    </div>
  `;

  const imagesJson = JSON.stringify(images)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  const imagesHtml = images
    .map(
      (img, index) => `
      <button
        type="button"
        class="image-card js-image-card md-surface md-elevation-1"
        data-index="${index}"
        aria-haspopup="dialog"
        aria-label="Open image ${index + 1} of ${images.length}: ${escAttr(img.fileName || img.alt)}"
      >
        <div class="thumb-wrap">
          <img src="${escAttr(img.src)}" alt="${escAttr(img.alt)}">
        </div>
        <div class="card-content">
          <div class="row alt"><span class="label">Alt:</span><span class="value">${esc(img.alt)}</span></div>
          <div class="row"><span class="label">File:</span><span class="value">${esc(img.fileName)}</span></div>
          <div class="row"><span class="label">Dimensions:</span><span class="value">${img.width} × ${img.height}</span></div>
          <div class="row src-row"><span class="label">Src:</span><span class="value">${esc(img.src)}</span></div>
        </div>
      </button>`
    )
    .join('');

  const cssUrl = chrome.runtime.getURL('styles/inspector.css');

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Image Alt Text Inspector</title>
  <link rel="stylesheet" href="${cssUrl}">
</head>
<body>
  <div class="wrap">
    ${metaBlock}
    <div class="grid" aria-label="Image results">
      ${imagesHtml}
    </div>
  </div>

  <div class="modal-backdrop" id="modal-backdrop" hidden>
    <div
      class="modal-shell"
      id="image-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-details"
      tabindex="-1"
    >
      <button type="button" class="icon-button modal-close" id="modal-close" aria-label="Close image details">×</button>

      <div class="modal-nav-row">
        <button type="button" class="nav-button" id="modal-prev" aria-label="Previous image">‹</button>
        <div class="modal-position" id="modal-position" aria-live="polite"></div>
        <button type="button" class="nav-button" id="modal-next" aria-label="Next image">›</button>
      </div>

      <div class="modal-layout">
        <div class="modal-media md-surface-variant">
          <img id="modal-image" alt="">
        </div>

        <div class="modal-content">
          <h2 id="modal-title">Image details</h2>
          <div class="modal-meta" id="modal-details"></div>
        </div>
      </div>
    </div>
  </div>

  <script>
    (() => {
      const images = ${imagesJson};
      const body = document.body;
      const cards = Array.from(document.querySelectorAll('.js-image-card'));
      const backdrop = document.getElementById('modal-backdrop');
      const modal = document.getElementById('image-modal');
      const modalImage = document.getElementById('modal-image');
      const modalTitle = document.getElementById('modal-title');
      const modalDetails = document.getElementById('modal-details');
      const modalPosition = document.getElementById('modal-position');
      const prevButton = document.getElementById('modal-prev');
      const nextButton = document.getElementById('modal-next');
      const closeButton = document.getElementById('modal-close');

      let currentIndex = 0;
      let lastFocused = null;

      const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

      function esc(value) {
        return String(value ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      function detailRow(label, value, extraClass = '') {
        if (!value && value !== 0) return '';
        return '<div class="detail-row ' + extraClass + '"><div class="detail-label">' + esc(label) + '</div><div class="detail-value">' + esc(value) + '</div></div>';
      }

      function renderModal(index) {
        const image = images[index];
        if (!image) return;

        currentIndex = index;
        modalImage.src = image.src || '';
        modalImage.alt = image.alt || '';
        modalTitle.textContent = image.fileName || image.alt || 'Image details';
        modalPosition.textContent = 'Image ' + (index + 1) + ' of ' + images.length;

        modalDetails.innerHTML = [
          detailRow('Alt text', image.alt, image.alt === '!!! No alt text !!!' ? 'is-warning' : ''),
          detailRow('Filename', image.fileName),
          detailRow('Source URL', image.src, 'is-long'),
          detailRow('Dimensions', (image.width || 0) + ' × ' + (image.height || 0)),
          detailRow('Title attribute', image.title),
          detailRow('ARIA label', image.ariaLabel),
          detailRow('Loading', image.loading),
          detailRow('Decoding', image.decoding),
          detailRow('Fetch priority', image.fetchpriority)
        ].join('');

        prevButton.disabled = images.length <= 1;
        nextButton.disabled = images.length <= 1;
      }

      function openModal(index) {
        lastFocused = document.activeElement;
        renderModal(index);
        backdrop.hidden = false;
        body.classList.add('modal-open');
        requestAnimationFrame(() => {
          modal.classList.add('is-open');
          closeButton.focus();
        });
      }

      function closeModal() {
        modal.classList.remove('is-open');
        backdrop.hidden = true;
        body.classList.remove('modal-open');
        if (lastFocused && typeof lastFocused.focus === 'function') {
          lastFocused.focus();
        }
      }

      function showNext() {
        renderModal((currentIndex + 1) % images.length);
      }

      function showPrev() {
        renderModal((currentIndex - 1 + images.length) % images.length);
      }

      function trapFocus(event) {
        if (event.key !== 'Tab' || backdrop.hidden) return;

        const focusables = Array.from(modal.querySelectorAll(focusableSelector)).filter((el) => !el.disabled);
        if (!focusables.length) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }

      cards.forEach((card, index) => {
        card.addEventListener('click', () => openModal(index));
      });

      closeButton.addEventListener('click', closeModal);
      nextButton.addEventListener('click', showNext);
      prevButton.addEventListener('click', showPrev);

      backdrop.addEventListener('click', (event) => {
        if (event.target === backdrop) {
          closeModal();
        }
      });

      document.addEventListener('keydown', (event) => {
        if (backdrop.hidden) return;

        if (event.key === 'Escape') {
          event.preventDefault();
          closeModal();
          return;
        }

        if (event.key === 'ArrowRight') {
          event.preventDefault();
          showNext();
          return;
        }

        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          showPrev();
          return;
        }

        trapFocus(event);
      });
    })();
  </script>
</body>
</html>`;

  const blob = new Blob([fullHtml], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
}

scrollToBottomFully(() => waitForAllImages(collectAndDisplayImages));
