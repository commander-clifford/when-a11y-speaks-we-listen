(() => {
  const header = document.querySelector('.site-header');
  const root = document.documentElement;
  const sections = ['how-it-works', 'install'].map(id => ({
    id,
    link: header?.querySelector(`nav a[href="#${id}"]`),
    section: document.getElementById(id),
  }));
  if (!header || sections.some(item => !item.link || !item.section)) return;

  let headerHeight = 0;
  let frame = 0;
  let pending = null;
  let pendingTimer = 0;
  let tween = null;
  let motionLink = null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const gsap = window.gsap;
  let enhanced = false;
  if (gsap && window.ScrollToPlugin) {
    try {
      gsap.registerPlugin(window.ScrollToPlugin);
      // ScrollToPlugin and CSS smooth scrolling must not run together.
      root.style.scrollBehavior = 'auto';
      enhanced = true;
    } catch {
      // Real anchor links and CSS remain the fallback if registration fails.
    }
  }

  function markCurrent(id) {
    for (const item of sections) {
      if (item.id === id) item.link.setAttribute('aria-current', 'location');
      else item.link.removeAttribute('aria-current');
    }
  }

  function updateCurrent() {
    frame = 0;
    if (pending) {
      markCurrent(pending);
      return;
    }
    const readingEdge = headerHeight + 24 + 2;
    const atBottom = window.scrollY > 0 &&
      window.scrollY + window.innerHeight >= root.scrollHeight - 2;
    let current = null;
    for (const item of sections) {
      if (item.section.getBoundingClientRect().top <= readingEdge) current = item.id;
    }
    markCurrent(atBottom ? 'install' : current);
  }

  function scheduleUpdate() {
    if (!frame) frame = requestAnimationFrame(updateCurrent);
  }

  function measureHeader() {
    const height = Math.ceil(header.getBoundingClientRect().height);
    if (height !== headerHeight) {
      cancelMotion();
      headerHeight = height;
      root.style.setProperty('--header-offset', `${height}px`);
    }
    scheduleUpdate();
  }

  function clearPending() {
    pending = null;
    clearTimeout(pendingTimer);
    scheduleUpdate();
  }

  function cancelMotion() {
    const previous = tween;
    tween = null;
    motionLink = null;
    previous?.kill();
    clearPending();
  }

  function focusDestination(section) {
    const temporaryTabIndex = !section.hasAttribute('tabindex');
    if (temporaryTabIndex) section.setAttribute('tabindex', '-1');
    section.focus({ preventScroll: true });
    if (temporaryTabIndex) section.addEventListener('blur', () => {
      section.removeAttribute('tabindex');
    }, { once: true });
  }

  function animateTo(item, event) {
    const destination = Math.max(0, Math.min(
      root.scrollHeight - window.innerHeight,
      item.section.getBoundingClientRect().top + window.scrollY - headerHeight - 24,
    ));
    try {
      // Build a paused tween before taking over the native link. Failure leaves
      // the original href action available to the browser.
      tween = gsap.to(window, {
        paused: true,
        duration: Math.min(0.9, Math.max(0.35, Math.abs(destination - window.scrollY) / 2200)),
        ease: 'power2.inOut',
        scrollTo: { y: destination, autoKill: true, onAutoKill: cancelMotion },
        onComplete: () => {
          tween = null;
          motionLink = null;
          clearPending();
          focusDestination(item.section);
        },
      });
      // Native fragment links add an entry only when the fragment changes.
      // Let the browser retain its usual Back/Forward scroll restoration.
      if (location.hash !== item.link.hash) history.pushState(history.state, '', item.link.hash);
      event.preventDefault();
      motionLink = item.link;
      clearTimeout(pendingTimer);
      tween.play();
    } catch {
      cancelMotion();
    }
  }

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element
      ? event.target.closest('a[href^="#"]') : null;
    if (!link) return;
    const item = sections.find(section => section.link === link);
    cancelMotion();
    if (!item) return;
    pending = item.id;
    markCurrent(item.id);
    // Reduced motion retains native instant fragment navigation. Missing GSAP
    // retains the CSS/native fallback, including native focus and history.
    pendingTimer = setTimeout(clearPending, 2000);
    if (enhanced && !reducedMotion.matches) animateTo(item, event);
  });

  document.addEventListener('scroll', scheduleUpdate, { passive: true });
  document.addEventListener('scrollend', () => { if (!tween) clearPending(); });
  window.addEventListener('wheel', cancelMotion, { passive: true });
  window.addEventListener('touchstart', cancelMotion, { passive: true });
  window.addEventListener('pointerdown', cancelMotion, { passive: true });
  document.addEventListener('keydown', event => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Tab'].includes(event.key)) {
      cancelMotion();
    }
  });
  document.addEventListener('focusin', event => {
    if (tween && event.target !== motionLink) cancelMotion();
  });
  window.addEventListener('popstate', cancelMotion);
  window.addEventListener('hashchange', cancelMotion);
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches && tween) tween.progress(1);
  });
  window.addEventListener('resize', measureHeader, { passive: true });
  window.addEventListener('load', measureHeader);
  window.addEventListener('pageshow', measureHeader);
  if ('ResizeObserver' in window) new ResizeObserver(measureHeader).observe(header);
  measureHeader();
})();
