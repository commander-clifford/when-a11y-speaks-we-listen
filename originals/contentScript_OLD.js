function scrollToBottom(callback) {
  let lastScrollHeight = 0;
  const interval = setInterval(() => {
      window.scrollTo(0, document.body.scrollHeight);
      const newScrollHeight = document.body.scrollHeight;
      if (newScrollHeight === lastScrollHeight) {
          clearInterval(interval);
          callback(); // All content likely loaded, proceed to collect and display images
      } else {
          lastScrollHeight = newScrollHeight;
      }
  }, 1000); // Adjust time as needed to allow for lazy-loaded content
}

function collectAndDisplayImages() {
  // Only select images that are children of <article> elements
  const images = Array.from(document.querySelectorAll('article img')).map(img => ({
      src: img.src,
      alt: img.alt || '!!! No alt text !!!'
  }));

  const style = `
      <style>
          body { display: flex; flex-wrap: wrap; justify-content: center; padding: 10px; }
          .image-container { display: flex; flex-direction: column; width: 200px; padding: 1em; margin: 1em; background-color: #f8f8f8; }
          .image-container img { max-width: 100%; height: auto; }
          .image-container p { text-align: center; }
      </style>
  `;

  const imagesHtml = images.map(img => `<div class="image-container"><img src="${img.src}" alt="${img.alt}"><p>${img.alt}</p></div>`).join('');

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

  const blob = new Blob([fullHtml], {type: 'text/html'});
  const url = URL.createObjectURL(blob);

  window.open(url, '_blank');
}

// Start the process after ensuring the page has been fully scrolled
scrollToBottom(collectAndDisplayImages);
