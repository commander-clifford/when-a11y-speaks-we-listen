// A11y Chats: inspect existing image elements, then bounded scrollable components.
// Returns structured data to the extension worker; never clicks site controls.
(async () => {
  if (globalThis.__a11yChatsScan) return globalThis.__a11yChatsScan;
  const scan = async () => {
    const limits = { imageLimit: 500, maxSteps: 24, maxDurationMs: 12000, containerLimit: 12 };
    const start = performance.now();
    const originalWindow = { x: window.scrollX, y: window.scrollY };
    const records = [];
    const seen = new WeakMap();
    const warnings = [];
    let stopped = false, wake = null, reason = 'complete', steps = 0, containersVisited = 0;
    let truncated = false, imageLimitHit = false;
    const onVisibility = () => {
      if(document.hidden) { reason = 'page-hidden'; if(wake) wake(); }
    };
    const cut = (value, limit = 8000) => {
      const text = String(value ?? '');
      if (text.length > limit) truncated = true;
      return text.slice(0, limit);
    };
    const resolveUrl = value => {
      if (!value) return '';
      try { return cut(new URL(value, document.baseURI).href); } catch { return cut(value); }
    };
    const attr = (element, name) => element.getAttribute(name) || '';
    const metaName = name => attr(document.querySelector(`meta[name="${name}"]`) || document.createElement('meta'), 'content');
    const metaProp = name => attr(document.querySelector(`meta[property="${name}"]`) || document.createElement('meta'), 'content');
    const canonical = resolveUrl(document.querySelector('link[rel~="canonical"]')?.getAttribute('href'));
    const meta = {
      title: cut(document.title), description: cut(metaName('description') || metaProp('og:description') || metaName('twitter:description')),
      sourceUrl: cut(location.href), url: resolveUrl(metaProp('og:url')) || canonical || cut(location.href),
      lang: cut(document.documentElement.lang), canonical, robots: cut(metaName('robots')),
      viewport: cut(metaName('viewport')), author: cut(metaName('author')), generator: cut(metaName('generator')),
      og: {title:cut(metaProp('og:title')), description:cut(metaProp('og:description')), type:cut(metaProp('og:type')), image:resolveUrl(metaProp('og:image'))},
      twitter: {title:cut(metaName('twitter:title')), description:cut(metaName('twitter:description')), image:resolveUrl(metaName('twitter:image') || metaName('twitter:image:src')), card:cut(metaName('twitter:card'))}
    };
    function collect(discoveredVia) {
      for (const img of document.querySelectorAll('img')) {
        const lazySource = resolveUrl(attr(img, 'data-src') || attr(img, 'data-lazy-src'));
        const src = cut(img.currentSrc || (attr(img, 'src') ? img.src : '') || lazySource);
        const srcset = cut(attr(img, 'srcset') || attr(img, 'data-srcset'));
        const identity = lazySource || src || srcset;
        let variants = seen.get(img);
        if (!variants) { variants = new Map(); seen.set(img, variants); }
        let record = variants.get(identity);
        if (!record && records.length >= limits.imageLimit) { imageLimitHit = true; break; }
        const rawAlt = img.getAttribute('alt');
        const altState = rawAlt === null ? 'missing' : rawAlt === '' ? 'empty' : rawAlt.trim() === '' ? 'whitespace' : 'present';
        let fileName = '(no source)';
        if (src) {
          try { fileName = new URL(src, document.baseURI).pathname.split('/').pop() || '(image)'; }
          catch { fileName = src.split('/').pop().split('?')[0]; }
          try { fileName = decodeURIComponent(fileName); } catch { /* preserve malformed escapes */ }
          if (src.startsWith('data:')) fileName = '(embedded image)';
        }
        const values = {
          src, lazySource, srcset, alt:cut(rawAlt), altState, fileName:cut(fileName, 1000),
          width:img.naturalWidth || img.width || 0, height:img.naturalHeight || img.height || 0,
          title:cut(attr(img,'title')), ariaLabel:cut(attr(img,'aria-label')),
          ariaLabelledby:cut(attr(img,'aria-labelledby')), role:cut(attr(img,'role'),200),
          ariaHidden:cut(attr(img,'aria-hidden'),100), hiddenAttribute:img.hasAttribute('hidden'),
          loading:cut(attr(img,'loading'),100), decoding:cut(attr(img,'decoding'),100), fetchpriority:cut(attr(img,'fetchpriority'),100)
        };
        if (record) Object.assign(record, values);
        else { record = {id:records.length, discoveredVia, ...values}; records.push(record); variants.set(identity,record); }
      }
    }
    const control = document.createElement('div');
    control.id = 'a11y-chats-scan-control';
    const shadow = control.attachShadow({mode:'closed'});
    const style = document.createElement('style');
    style.textContent = `:host{all:initial!important;position:fixed!important;right:16px!important;bottom:16px!important;z-index:2147483647!important;display:block!important}section{box-sizing:border-box;max-width:min(360px,90vw);padding:16px;border:2px solid #6750a4;border-radius:12px;background:#fffbfe;color:#1d1b20;font:16px/1.45 system-ui,sans-serif;box-shadow:0 4px 20px #0003}p{margin:0 0 10px}button{font:inherit;padding:10px;border:2px solid #6750a4;border-radius:8px;background:#6750a4;color:#fff;cursor:pointer}button:focus-visible{outline:3px solid #1d1b20;outline-offset:3px}@media(forced-colors:active){section,button{border-color:ButtonText}button:focus-visible{outline-color:Highlight}}`;
    const panel = document.createElement('section');
    panel.setAttribute('aria-label','A11y Chats scan');
    const status = document.createElement('p');
    status.setAttribute('role','status');
    status.textContent = 'A11y Chats is inspecting images in this page and scrollable components.';
    const stop = document.createElement('button');
    stop.type = 'button'; stop.textContent = 'Stop scan and show results';
    stop.addEventListener('click', () => { stopped = true; if(wake) wake(); });
    panel.append(status,stop); shadow.append(style,panel);
    const wait = () => new Promise(resolve => {
      let done = false;
      const finish = () => { if(done)return;done=true;clearTimeout(timer);wake=null;resolve(); };
      const timer = setTimeout(finish, 300); wake = finish;
      if(stopped) finish();
    });
    const capped = () => {
      if(stopped) reason='user-stop';
      else if(imageLimitHit) reason='image-limit';
      else if(performance.now()-start >= limits.maxDurationMs) reason='time-limit';
      else if(steps >= limits.maxSteps) reason='step-limit';
      return reason !== 'complete';
    };
    const containers = [];
    try {
      collect('initial-dom');
      document.addEventListener('visibilitychange',onVisibility);
      onVisibility();
      (document.body || document.documentElement).append(control);
      // Initial extents only: do not chase an indefinitely expanding document/feed.
      let examined = 0;
      for(const element of document.querySelectorAll('*')) {
        if(++examined > 25000) {warnings.push('Container search stopped after 25,000 elements.');break;}
        if(element===document.body || element===document.documentElement || element===control || element.clientWidth < 2 || element.clientHeight < 2) continue;
        const css = getComputedStyle(element);
        const horizontal = /(auto|scroll|hidden)/.test(css.overflowX) && element.scrollWidth > element.clientWidth + 2;
        const vertical = /(auto|scroll|hidden)/.test(css.overflowY) && element.scrollHeight > element.clientHeight + 2;
        if(!horizontal && !vertical) continue;
        if(!element.querySelector('img') && !element.matches('[aria-roledescription="carousel"], [role="region"], [data-carousel]')) continue;
        if(containers.length >= limits.containerLimit) {warnings.push('Additional scrollable components were not explored (12 component limit).');break;}
        containers.push({element,x:element.scrollLeft,y:element.scrollTop,horizontal,vertical,rtl:css.direction==='rtl',maxX:element.scrollWidth-element.clientWidth,maxY:element.scrollHeight-element.clientHeight});
      }
      for(const item of containers) {
        if(capped()) break;
        const {element,horizontal,vertical,rtl,maxX,maxY} = item;
        if(!element.isConnected) continue;
        containersVisited++;
        element.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
        // Sample each scroll axis independently; no arbitrary controls are activated.
        for(const axis of ['x','y']) {
          if((axis==='x' && !horizontal) || (axis==='y' && !vertical)) continue;
          const maximum = axis==='x' ? maxX : maxY;
          const stride = Math.max(1, Math.floor((axis==='x' ? element.clientWidth : element.clientHeight)*0.8));
          for(let offset=0;;offset=Math.min(offset+stride,maximum)) {
            if(capped()) break;
            element.scrollTo({left:axis==='x' ? (rtl ? -offset : offset) : item.x,top:axis==='y' ? offset : item.y,behavior:'instant'});
            steps++;
            await wait();
            collect('component-scroll');
            if(offset===maximum || stopped) break;
          }
          if(capped()) break;
        }
        if(element.scrollWidth-element.clientWidth > maxX+2 || element.scrollHeight-element.clientHeight > maxY+2) warnings.push('A component grew during inspection; exploration used its initial extent.');
      }
      collect('final-dom');
      capped();
    } catch(error) {
      reason='scan-error'; warnings.push('Inspection stopped early: '+cut(error.message,300));
    } finally {
      document.removeEventListener('visibilitychange',onVisibility);
      for(const {element,x,y} of containers) {
        if(element.isConnected) element.scrollTo({left:x,top:y,behavior:'instant'});
      }
      window.scrollTo({left:originalWindow.x,top:originalWindow.y,behavior:'instant'});
      control.remove();
    }
    if(truncated) warnings.push('One or more attribute values exceeded the 8,000-character limit and were shortened.');
    return {
      schemaVersion:1,createdAt:new Date().toISOString(),meta,images:records,
      scan:{...limits,scope:'dom-and-scrollable-components',reason,partial:reason!=='complete' || warnings.length>0,steps,containersVisited,durationMs:Math.round(performance.now()-start),warnings}
    };
  };
  globalThis.__a11yChatsScan = scan();
  try { return await globalThis.__a11yChatsScan; }
  finally { delete globalThis.__a11yChatsScan; }
})();
