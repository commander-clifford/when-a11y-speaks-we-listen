// contentScript.js
// Image Alt Text Inspector — MV3 content script
// - Expands hidden/accordion content
// - Waits for lazy images to load
// - Scrapes meta (title/description/og/twitter/etc.)
// - Opens a blob page styled via a packaged CSS file

// ---------- Utilities to reveal content & load images ----------
function expandHiddenContent() {
  // <details>
  document.querySelectorAll('details:not([open])').forEach((el) => (el.open = true));

  // Click common “expand” UI that doesn't navigate away
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

// Scroll until page height stabilizes (for infinite/lazy lists)
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

// Wait for all <img> to finish loading (with a hard timeout)
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

  // Fallback in case some never resolve
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

// Collect common page metadata
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

  const images = Array.from(document.querySelectorAll('img')).map((img) => {
    const src = img.currentSrc || img.src || '';
    const fileName = src ? decodeURIComponent(src.split('/').pop().split('?')[0]) : '(no src)';
    const alt = img.getAttribute('alt') || '';
    return {
      src,
      alt: alt.trim() || '!!! No alt text !!!',
      fileName,
    };
  });

  const esc = (s) => String(s).replace(/</g, '&lt;');
  const escAttr = (s) => String(s).replace(/"/g, '&quot;');

  const metaBlock = `
    <div class="page-header">
      <div>
        <h1>${meta.title ? esc(meta.title) : '(no title found)'}</h1>
        <div class="row"><span class="label">URL:</span><a href="${escAttr(
          meta.url
        )}" target="_blank" rel="noopener">${esc(meta.url)}</a></div>
        ${
          meta.canonical
            ? `<div class="row"><span class="label">Canonical:</span><a href="${escAttr(
                meta.canonical
              )}" target="_blank" rel="noopener">${esc(meta.canonical)}</a></div>`
            : ''
        }
        <div class="kvs">
          ${
            meta.lang
              ? `<div class="kv"><div class="k">Lang</div><div class="v">${esc(
                  meta.lang
                )}</div></div>`
              : ''
          }
          ${
            meta.robots
              ? `<div class="kv"><div class="k">Robots</div><div class="v">${esc(
                  meta.robots
                )}</div></div>`
              : ''
          }
          ${
            meta.viewport
              ? `<div class="kv"><div class="k">Viewport</div><div class="v">${esc(
                  meta.viewport
                )}</div></div>`
              : ''
          }
          ${
            meta.author
              ? `<div class="kv"><div class="k">Author</div><div class="v">${esc(
                  meta.author
                )}</div></div>`
              : ''
          }
          ${
            meta.generator
              ? `<div class="kv"><div class="k">Generator</div><div class="v">${esc(
                  meta.generator
                )}</div></div>`
              : ''
          }
          ${
            meta.og.title
              ? `<div class="kv"><div class="k">OG Title</div><div class="v">${esc(
                  meta.og.title
                )}</div></div>`
              : ''
          }
          ${
            meta.og.description
              ? `<div class="kv"><div class="k">OG Desc</div><div class="v">${esc(
                  meta.og.description
                )}</div></div>`
              : ''
          }
          ${
            meta.og.type
              ? `<div class="kv"><div class="k">OG Type</div><div class="v">${esc(
                  meta.og.type
                )}</div></div>`
              : ''
          }
          ${
            meta.twitter.card
              ? `<div class="kv"><div class="k">Twitter Card</div><div class="v">${esc(
                  meta.twitter.card
                )}</div></div>`
              : ''
          }
          ${
            meta.twitter.title
              ? `<div class="kv"><div class="k">Twitter Title</div><div class="v">${esc(
                  meta.twitter.title
                )}</div></div>`
              : ''
          }
          ${
            meta.twitter.description
              ? `<div class="kv"><div class="k">Twitter Desc</div><div class="v">${esc(
                  meta.twitter.description
                )}</div></div>`
              : ''
          }
        </div>
        ${
          meta.description
            ? `<p class="desc"><span class="label">Description:</span> ${esc(meta.description)}</p>`
            : ''
        }
        <div class="row"><span class="count">${images.length} images found</span></div>
      </div>
      <div class="preview">
        ${
          meta.og.image || meta.twitter.image
            ? `<img src="${escAttr(meta.og.image || meta.twitter.image)}" alt="">`
            : `<div class="row" style="color:var(--muted)">No preview image</div>`
        }
      </div>
    </div>
  `;

  const imagesHtml = images
    .map(
      (img) => `
      <div class="image-card">
        <img src="${escAttr(img.src)}" alt="${escAttr(img.alt)}">
        <div class="row alt"><span class="label">Alt:</span>${esc(img.alt)}</div>
        <div class="row"><span class="label">File:</span>${esc(img.fileName)}</div>
        <div class="row"><span class="label">Src:</span>${esc(img.src)}</div>
      </div>`
    )
    .join('');

  const cssUrl = chrome.runtime.getURL('styles/inspector.css');

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Image Alt Text Inspector</title>
  <link rel="stylesheet" href="${cssUrl}">
</head>
<body>
  <div class="wrap">
    ${metaBlock}
    <div class="grid">
      ${imagesHtml}
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([fullHtml], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ---------- Kickoff ----------
scrollToBottomFully(() => waitForAllImages(collectAndDisplayImages));
