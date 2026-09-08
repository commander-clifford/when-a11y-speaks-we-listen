function expandHiddenContent() {
  document.querySelectorAll('details:not([open])').forEach(el => el.open = true);

  const toggleKeywords = ['accordion', 'toggle', 'tab', 'more', 'expand'];
  const clickable = Array.from(document.querySelectorAll('button, a, div')).filter(el => {
    const text = el.innerText.toLowerCase();
    return toggleKeywords.some(keyword => text.includes(keyword));
  });

  clickable.forEach(el => {
    const isLink = el.tagName === 'A';
    const href = el.getAttribute('href') || '';
  
    const isSafeLink = href === '' || href === '#' || href.startsWith('javascript');
  
    if (!isLink || isSafeLink) {
      try { el.click(); } catch {}
    }
  });  

  document.querySelectorAll('[hidden], [aria-hidden="true"], [style*="display: none"]').forEach(el => {
    el.removeAttribute('hidden');
    el.setAttribute('aria-hidden', 'false');
    el.style.display = 'block';
  });
}

function forceLoadLazyImages() {
  document.querySelectorAll('img').forEach(img => {
    if (img.dataset.src && !img.src) img.src = img.dataset.src;
    if (img.dataset.srcset && !img.srcset) img.srcset = img.dataset.srcset;
  });
}

function scrollToBottomFully(callback) {
  let lastHeight = 0;
  let attempts = 0;

  const interval = setInterval(() => {
    window.scrollTo(0, document.body.scrollHeight);
    expandHiddenContent();
    forceLoadLazyImages();

    const newHeight = document.body.scrollHeight;
    if (newHeight === lastHeight) {
      attempts++;
      if (attempts >= 3) {
        clearInterval(interval);
        waitForAllImages(callback);
      }
    } else {
      attempts = 0;
      lastHeight = newHeight;
    }
  }, 1000);
}

function waitForAllImages(callback) {
  const images = Array.from(document.querySelectorAll('img'));
  const unloaded = images.filter(img => !img.complete || img.naturalHeight === 0);

  if (unloaded.length === 0) {
    callback();
  } else {
    let remaining = unloaded.length;
    images.forEach(img => {
      if (!img.complete || img.naturalHeight === 0) {
        img.addEventListener('load', () => {
          remaining--;
          if (remaining <= 0) callback();
        }, { once: true });
      }
    });

    setTimeout(callback, 5000); // fallback
  }
}

function collectAndDisplayImages() {
  const images = Array.from(document.querySelectorAll('img')).map(img => {
    const src = img.currentSrc || img.src;
    const fileName = src ? decodeURIComponent(src.split('/').pop().split('?')[0]) : '(no src)';
    return {
      src,
      alt: img.alt || '!!! No alt text !!!',
      fileName
    };
  });

  const style = `
    <style>
      body { display: flex; flex-wrap: wrap; justify-content: center; padding: 10px; }
      .image-container { display: flex; flex-direction: column; width: 250px; padding: 1em; margin: 1em; background-color: #f8f8f8; font-family: sans-serif; border-radius: 6px; }
      .image-container img { max-width: 100%; height: auto; margin-bottom: 0.5em; }
      .image-container p { margin: 0.2em 0; font-size: 0.9em; text-align: center; word-break: break-word; }
      .label { font-weight: bold; color: #333; }
    </style>
  `;

  const imagesHtml = images.map(img => `
    <div class="image-container">
      <img src="${img.src}" alt="${img.alt}">
      <p><span class="label">Alt:</span> ${img.alt}</p>
      <p><span class="label">Filename:</span> ${img.fileName}</p>
    </div>`).join('');

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Image Alt Text Inspector</title>
  ${style}
</head>
<body>
  ${imagesHtml}
</body>
</html>`;

  const blob = new Blob([fullHtml], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

// Kick off
scrollToBottomFully(collectAndDisplayImages);
