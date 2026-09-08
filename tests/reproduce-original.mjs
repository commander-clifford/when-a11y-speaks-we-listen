#!/usr/bin/env node
/**
 * Characterize the imported contentScript.js using isolated, deterministic stubs.
 * Usage: node tests/reproduce-original.mjs [directory-containing-contentScript.js]
 * Default input: ../originals relative to this file, independent of the current dir.
 * These are original-defect probes, not a browser test or a readiness test suite.
 * No source files are modified, no real controls are clicked, and no network runs.
 * findingObserved=true means the named defect was reproduced (except encoding,
 * which reports its safety observation explicitly). A nonzero exit means the
 * harness could not complete; false observations do not themselves fail the run.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const sourceDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : fileURLToPath(new URL('../originals/', import.meta.url));
const sourcePath = path.join(sourceDir, 'contentScript.js');
const originalSource = fs.readFileSync(sourcePath, 'utf8');
const entryPoint = /scrollToBottomFully\(\(\) => waitForAllImages\(collectAndDisplayImages\)\);\s*$/;
if (!entryPoint.test(originalSource)) {
  throw new Error('Expected original entry point not found; adapt this characterization harness before using a different implementation.');
}
// Remove only automatic startup so probes can invoke individual original functions.
const source = originalSource.replace(entryPoint, '');

function makeContext(overrides = {}) {
  let emittedHtml = '';
  let windowsOpened = 0;
  const timers = [];
  const context = {
    document: {
      querySelectorAll: () => [],
      querySelector: () => null,
      documentElement: { getAttribute: () => '', scrollHeight: 100 },
    },
    window: {
      location: { href: 'https://fixture.invalid/' },
      open: () => { windowsOpened += 1; },
      scrollTo: () => {},
    },
    chrome: { runtime: { getURL: p => `chrome-extension://fixture/${p}` } },
    Blob: class { constructor(parts) { emittedHtml = parts.join(''); } },
    URL: { createObjectURL: () => 'blob:https://fixture.invalid/report' },
    setTimeout: (fn, ms) => { const timer = { fn, ms }; timers.push(timer); return timer; },
    clearTimeout: id => { const index = timers.indexOf(id); if (index >= 0) timers.splice(index, 1); },
    ...overrides,
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: sourcePath, timeout: 1000 });
  return { context, timers, html: () => emittedHtml, opened: () => windowsOpened };
}

function image(attributes = {}, properties = {}) {
  return {
    currentSrc: 'https://fixture.invalid/photo.png', src: '',
    naturalWidth: 1, naturalHeight: 1, width: 1, height: 1, complete: true,
    getAttribute: name => Object.hasOwn(attributes, name) ? attributes[name] : null,
    ...properties,
  };
}

function reportImages(html) {
  const match = html.match(/const images = ([\s\S]*?);\s*\n/);
  if (!match) throw new Error('Generated report image data not found.');
  return JSON.parse(match[1]);
}

const results = [];

{
  const clicks = [];
  const controls = [
    { tagName: 'BUTTON', innerText: 'Show more and submit', getAttribute: () => null, click: () => clicks.push('submit-like-button') },
    { tagName: 'A', innerText: 'Read more', getAttribute: () => 'javascript:fixtureAction()', click: () => clicks.push('javascript-url-link') },
    { tagName: 'DIV', innerText: 'Remove table', getAttribute: () => null, click: () => clicks.push('ancestor-div-containing-table') },
    { tagName: 'A', innerText: 'Read more', getAttribute: () => 'https://fixture.invalid/next', click: () => clicks.push('ordinary-navigation-link') },
  ];
  const run = makeContext({ document: { querySelectorAll: selector => selector === 'details:not([open])' ? [] : controls } });
  run.context.expandHiddenContent();
  results.push({
    probe: 'unsafe-automatic-clicks', findingObserved: clicks.includes('submit-like-button') && clicks.includes('javascript-url-link'),
    evidence: { selectedControls: clicks },
    limit: 'Stubs prove control selection and click invocation, not a real website transaction or JavaScript URL execution.',
  });
}

{
  const events = {};
  let callbackCount = 0;
  const run = makeContext({ document: { querySelectorAll: () => [image({}, {
    complete: false, naturalHeight: 0,
    addEventListener: (type, handler) => { events[type] = handler; },
  })] } });
  run.context.waitForAllImages(() => { callbackCount += 1; });
  events.load();
  const fallback = run.timers.find(timer => timer.ms === 5000);
  if (!fallback) throw new Error('Expected original image timeout was not scheduled.');
  fallback.fn();
  results.push({ probe: 'image-load-plus-timeout-duplicate-callback', findingObserved: callbackCount > 1, evidence: { callbackCount } });
}

{
  const run = makeContext();
  run.context.document.querySelectorAll = () => [image({}, { currentSrc: 'https://fixture.invalid/bad%name.png' })];
  let exception = null;
  try { run.context.collectAndDisplayImages(); } catch (error) { exception = `${error.name}: ${error.message}`; }
  results.push({ probe: 'malformed-percent-image-url-aborts-report', findingObserved: exception?.startsWith('URIError:') === true && run.opened() === 0, evidence: { exception, windowsOpened: run.opened() } });
}

{
  const run = makeContext();
  run.context.document.querySelectorAll = () => [image({ alt: '\"</script><script>globalThis.INJECTED=true</script>&' })];
  run.context.collectAndDisplayImages();
  const html = run.html();
  const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (inlineScripts.length !== 1) throw new Error(`Expected one generated script, found ${inlineScripts.length}.`);
  new vm.Script(inlineScripts[0][1], { filename: 'generated-report-inline-script.js' });
  const literalInjectedScript = html.includes('<script>globalThis.INJECTED');
  results.push({
    probe: 'html-script-breakout-encoding', safetyObserved: !literalInjectedScript,
    evidence: { inlineScriptCount: inlineScripts.length, generatedScriptSyntax: 'valid', literalInjectedScript, recoveredAlt: reportImages(html)[0].alt },
    limit: 'One adversarial payload and a syntax check; not a comprehensive XSS proof or browser CSP execution check.',
  });
}

{
  const run = makeContext();
  run.context.document.querySelector = selector => selector === 'meta[property="og:url"]'
    ? { getAttribute: () => 'javascript:fixtureAction()' } : null;
  run.context.collectAndDisplayImages();
  const unsafeLinkPreserved = run.html().includes('href="javascript:fixtureAction()"');
  results.push({
    probe: 'untrusted-metadata-url-scheme-preserved', findingObserved: unsafeLinkPreserved,
    evidence: { unsafeLinkPreserved },
    limit: 'Shows lack of URL scheme validation. Does not establish execution of a clicked link in Chrome.',
  });
}

{
  const run = makeContext();
  let completed = 0;
  run.context.scrollToBottomFully(() => { completed += 1; });
  let changingTicks = 0;
  for (; changingTicks < 125 && run.timers.length; changingTicks += 1) {
    run.context.document.documentElement.scrollHeight += 100;
    run.timers.shift().fn();
  }
  const stable = makeContext();
  let stableCompleted = 0;
  stable.context.scrollToBottomFully(() => { stableCompleted += 1; });
  let stableTicks = 0;
  for (; stableTicks < 10 && stable.timers.length; stableTicks += 1) stable.timers.shift().fn();
  results.push({
    probe: 'continuously-growing-page-has-no-total-scroll-limit',
    findingObserved: changingTicks === 125 && completed === 0 && run.timers.length > 0,
    evidence: { changingTicks, simulatedElapsedMs: changingTicks * 500, completed, pendingTimers: run.timers.length, stableTicks, stableCompleted },
    limit: '125 deterministic height increases; no real scrolling. Source control flow resets the stabilization counter on each increase.',
  });
}

{
  const run = makeContext();
  run.context.document.querySelectorAll = () => [image(), image({ alt: '' }), image({ alt: '   ' })];
  run.context.collectAndDisplayImages();
  const alts = reportImages(run.html()).map(entry => entry.alt);
  results.push({
    probe: 'missing-empty-whitespace-alt-collapse', findingObserved: new Set(alts).size === 1,
    evidence: { inputKinds: ['absent', 'empty', 'whitespace-only'], reportValues: alts },
    limit: 'Demonstrates lost source distinction; deciding whether empty alt is appropriate requires image context.',
  });
}

console.log(JSON.stringify({
  kind: 'original-source-characterization',
  sourcePath,
  sourceSha256: createHash('sha256').update(originalSource).digest('hex'),
  runtime: process.version,
  scope: 'Deterministic VM/DOM stubs. No extension loading, browser policy, network, or assistive-technology behavior tested.',
  results,
}, null, 2));
