function expandHiddenContent() {
  document.querySelectorAll('details:not([open])').forEach((el) => {
    el.open = true;
  });

  const toggleKeywords = ['accordion', 'toggle', 'tab', 'more', 'expand', 'show more', 'read more'];
  const clickable = Array.from(document.querySelectorAll('button, a, div')).filter((el) => {
    const text = (el.innerText || '').toLowerCase().trim();
    return text && toggleKeywords.some((keyword) => text.includes(keyword));
  });

  clickable.forEach((el) => {
    const isLink = el.tagName === 'A';
    const href = (el.getAttribute('href') || '').trim();
    const isSafeLink = !isLink || href === '' || href === '#' || href.startsWith('javascript:');

    if (isSafeLink) {
      try {
        el.click();
      } catch (_error) {}
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
        attempts += 1;
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

  const resolveOne = () => {
    remaining -= 1;
    if (remaining <= 0) callback();
  };

  unloaded.forEach((img) => {
    img.addEventListener('load', resolveOne, { once: true });
    img.addEventListener('error', resolveOne, { once: true });
  });

  setTimeout(callback, 5000);
}

function getMetaByName(name) {
  return document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || '';
}

function getMetaByProp(prop) {
  return document.querySelector(`meta[property="${prop}"]`)?.getAttribute('content') || '';
}

function getLink(rel) {
  return document.querySelector(`link[rel="${rel}"]`)?.getAttribute('href') || '';
}

function getPageMeta() {
  const title = (document.querySelector('title')?.textContent || '').trim();
  const description =
    getMetaByName('description') ||
    getMetaByProp('og:description') ||
    getMetaByName('twitter:description') ||
    '';

  return {
    title,
    description,
    url: getMetaByProp('og:url') || getLink('canonical') || window.location.href,
    lang: document.documentElement.getAttribute('lang') || '',
    canonical: getLink('canonical'),
    robots: getMetaByName('robots'),
    viewport: getMetaByName('viewport'),
    author: getMetaByName('author'),
    generator: getMetaByName('generator'),
    og: {
      title: getMetaByProp('og:title') || '',
      description: getMetaByProp('og:description') || '',
      type: getMetaByProp('og:type') || '',
      image: getMetaByProp('og:image') || ''
    },
    twitter: {
      title: getMetaByName('twitter:title') || '',
      description: getMetaByName('twitter:description') || '',
      image: getMetaByName('twitter:image') || getMetaByName('twitter:image:src') || '',
      card: getMetaByName('twitter:card') || ''
    }
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getAltStatus(rawAlt) {
  if (rawAlt === null) return 'missing';
  if (rawAlt.trim() === '') return 'empty';
  return 'present';
}

function getStatusLabel(status, alt) {
  if (status === 'present') return alt;
  if (status === 'empty') return '(empty alt)';
  return '!!! No alt text !!!';
}

function collectAndDisplayImages() {
  const meta = getPageMeta();

  const images = Array.from(document.querySelectorAll('img')).map((img) => {
    const src = img.currentSrc || img.src || '';
    const fileName = src ? decodeURIComponent(src.split('/').pop().split('?')[0]) : '(no src)';
    const rawAlt = img.getAttribute('alt');
    const status = getAltStatus(rawAlt);
    const altText = getStatusLabel(status, rawAlt || '');

    return {
      src,
      fileName,
      rawAlt,
      altText,
      status
    };
  });

  const metaCards = [
    meta.lang ? `<div class="kv"><div class="k">Lang</div><div class="v">${escapeHtml(meta.lang)}</div></div>` : '',
    meta.robots ? `<div class="kv"><div class="k">Robots</div><div class="v">${escapeHtml(meta.robots)}</div></div>` : '',
    meta.viewport ? `<div class="kv"><div class="k">Viewport</div><div class="v">${escapeHtml(meta.viewport)}</div></div>` : '',
    meta.author ? `<div class="kv"><div class="k">Author</div><div class="v">${escapeHtml(meta.author)}</div></div>` : '',
    meta.generator ? `<div class="kv"><div class="k">Generator</div><div class="v">${escapeHtml(meta.generator)}</div></div>` : '',
    meta.og.title ? `<div class="kv"><div class="k">OG Title</div><div class="v">${escapeHtml(meta.og.title)}</div></div>` : '',
    meta.og.description ? `<div class="kv"><div class="k">OG Desc</div><div class="v">${escapeHtml(meta.og.description)}</div></div>` : '',
    meta.og.type ? `<div class="kv"><div class="k">OG Type</div><div class="v">${escapeHtml(meta.og.type)}</div></div>` : '',
    meta.twitter.card ? `<div class="kv"><div class="k">Twitter Card</div><div class="v">${escapeHtml(meta.twitter.card)}</div></div>` : '',
    meta.twitter.title ? `<div class="kv"><div class="k">Twitter Title</div><div class="v">${escapeHtml(meta.twitter.title)}</div></div>` : '',
    meta.twitter.description ? `<div class="kv"><div class="k">Twitter Desc</div><div class="v">${escapeHtml(meta.twitter.description)}</div></div>` : ''
  ].join('');

  const imagesHtml = images
    .map(
      (img) => `
        <article class="image-card">
          <img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.rawAlt || '')}">
          <div class="row alt alt-${img.status}"><span class="label">Alt:</span>${escapeHtml(img.altText)}</div>
          <div class="row"><span class="label">Status:</span>${escapeHtml(img.status)}</div>
          <div class="row"><span class="label">File:</span>${escapeHtml(img.fileName)}</div>
          <div class="row"><span class="label">Src:</span>${escapeHtml(img.src || '(no src)')}</div>
        </article>
      `
    )
    .join('');

  const cssUrl = chrome.runtime.getURL('styles/inspector.css');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>a11y-chats</title>
  <link rel="stylesheet" href="${cssUrl}">
</head>
<body>
  <main class="wrap">
    <section class="page-header">
      <div>
        <p class="eyebrow">a11y-chats</p>
        <h1>${meta.title ? escapeHtml(meta.title) : '(no title found)'}</h1>
        <div class="row"><span class="label">URL:</span><a href="${escapeHtml(meta.url)}" target="_blank" rel="noopener">${escapeHtml(meta.url)}</a></div>
        ${meta.canonical ? `<div class="row"><span class="label">Canonical:</span><a href="${escapeHtml(meta.canonical)}" target="_blank" rel="noopener">${escapeHtml(meta.canonical)}</a></div>` : ''}
        ${meta.description ? `<p class="desc"><span class="label">Description:</span> ${escapeHtml(meta.description)}</p>` : ''}
        <div class="row"><span class="count">${images.length} images found</span></div>
        <div class="kvs">${metaCards}</div>
      </div>
      <div class="preview">
        ${meta.og.image || meta.twitter.image ? `<img src="${escapeHtml(meta.og.image || meta.twitter.image)}" alt="">` : `<div class="muted">No preview image</div>`}
      </div>
    </section>
    <section class="grid">${imagesHtml}</section>
  </main>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
}

scrollToBottomFully(() => waitForAllImages(collectAndDisplayImages));
