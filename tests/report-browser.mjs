import { launchChrome } from './chrome.mjs';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const extensionPath = resolve(process.argv[2] || new URL('../extension/', import.meta.url).pathname);
const outputPath = resolve(process.argv[3] || new URL('../audit/report-browser.json', import.meta.url).pathname);
const b = await launchChrome();
const browser = await b.send('Browser.getVersion');
const evidence = { date: new Date().toISOString(), browser, extensionPath, checks: [], limitations: ['Controlled session-storage fixtures; collection and end-to-end scans have separate tests.', 'Chrome automation does not establish screen-reader or WCAG conformance.'] };
async function saveEvidence() {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(evidence, null, 2) + '\n');
}
const results = [];
const pause = ms => new Promise(r => setTimeout(r, ms));
async function run(session, expression) {
  const r = await b.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, session);
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function key(session, key, code) {
  for (const type of ['keyDown', 'keyUp']) await b.send('Input.dispatchKeyEvent', {
    type, key, code, windowsVirtualKeyCode: key === 'Tab' ? 9 : 27,
  }, session);
}
async function waitFor(session, expression) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try { if (await run(session, expression)) return; } catch { /* Page may still be loading. */ }
    await pause(50);
  }
  throw new Error('Condition did not become true: ' + expression);
}

try {
  const { id } = await b.send('Extensions.loadUnpacked', { path: extensionPath });
  const token = '12345678-1234-4123-8123-123456789abc';
  const { targetId } = await b.send('Target.createTarget', { url: `chrome-extension://${id}/report.html?id=${token}` });
  const { sessionId: s } = await b.send('Target.attachToTarget', { targetId, flatten: true });
  await b.send('Runtime.enable', {}, s);
  await waitFor(s, "document.getElementById('report-error')?.textContent.includes('no longer available')");
  assert.match(await run(s, "document.getElementById('report-error').textContent"), /no longer available/);
  results.push('missing-session guidance');
  const gif = 'data:image/gif;base64,R0lGODlhAQABAIAAAAEBAQAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  const data = {
    schemaVersion: 1, createdAt: new Date().toISOString(),
    meta: {
      title: '<img src=x onerror=alert(1)> Source title', sourceUrl: 'https://fixture.invalid/page',
      url: 'javascript:alert(1)', canonical: 'javascript:alert(2)', description: 'A plain description', lang: 'en',
      og: { title: 'Social title', image: 'data:image/svg+xml,<svg></svg>' }, twitter: { card: 'summary' },
    },
    images: ['missing', 'empty', 'whitespace', 'present'].map((altState, i) => ({
      id: i, src: gif, alt: altState === 'present' ? '<img src=x onerror=alert(3)> Accessible label' : altState === 'whitespace' ? ' \n ' : '',
      altState, fileName: 'test-' + i + '.gif', width: 1, height: 1, title: 'Title', ariaLabel: 'Raw aria label',
      ariaLabelledby: 'label-id', role: 'img', ariaHidden: 'false', hiddenAttribute: false,
      lazySource: 'https://fixture.invalid/lazy.png', srcset: 'image.png 1x', loading: 'lazy', decoding: 'async', fetchpriority: 'low',
    })),
    scan: { reason: 'complete', partial: false, containersVisited: 2, warnings: [] },
  };
  const seed = async (value, error = null) => run(s, `(async()=>{
    const tab = await chrome.tabs.getCurrent();
    await chrome.storage.session.set({['report:${token}']:{data:${JSON.stringify(value)},error:${JSON.stringify(error)},sourceTabId:999999,reportTabId:tab.id,createdAt:new Date().toISOString()}});
  })()`);
  await seed(data);
  await waitFor(s, "document.querySelectorAll('.image-card').length === 4");
  let state = await run(s, `({
    cards:document.querySelectorAll('.image-card').length,
    head:document.getElementById('page-title').textContent,
    unsafeLinks:document.querySelectorAll('a[href^=javascript]').length,
    svgPreviews:document.querySelectorAll('img[src^="data:image/svg"]').length,
    summary:document.getElementById('alt-summary').textContent
  })`);
  assert.equal(state.cards, 4);
  assert.equal(state.unsafeLinks, 0);
  assert.equal(state.svgPreviews, 0);
  assert.match(state.head, /<img/);
  assert.match(state.summary, /1 missing; 1 empty; 1 whitespace only; 1 with text/);
  results.push('four alt states + text-safe metadata + inactive unsafe links/SVG');
  await run(s, "document.getElementById('image-modal').addEventListener('close',()=>{window.closeEventFocus=document.activeElement.outerHTML});document.querySelector('.detail-trigger').focus();document.querySelector('.detail-trigger').click()");
  await pause(50);
  state = await run(s, `({
    open:document.getElementById('image-modal').open,focus:document.activeElement.id,
    details:document.getElementById('modal-details').textContent,
    backgroundFocusBlocked:(document.getElementById('scan-again').focus(),document.activeElement.id!=='scan-again')
  })`);
  assert.equal(state.open, true);
  assert.equal(state.focus, 'modal-close');
  assert.equal(state.backgroundFocusBlocked, true);
  assert.match(state.details, /ARIA labelledby attributelabel-id/);
  results.push('native modal focus + inert background + complete raw metadata');
  await run(s, "document.getElementById('modal-prev').click()");
  assert.equal(await run(s, "document.getElementById('modal-position').textContent"), 'Image 4 of 4');
  await run(s, "document.getElementById('modal-next').click()");
  assert.equal(await run(s, "document.getElementById('modal-position').textContent"), 'Image 1 of 4');
  results.push('previous/next wrap');
  await run(s, "Array.from(document.getElementById('image-modal').querySelectorAll('button,a[href]')).filter(e=>!e.disabled).at(-1).focus()");
  await key(s, 'Tab', 'Tab');
  state = await run(s, "({focus:document.activeElement.id,inside:document.getElementById('image-modal').contains(document.activeElement)})");
  assert.equal(state.inside, true);
  results.push({ tabFromLast: state });
  await key(s, 'Escape', 'Escape');
  await pause(50);
  state = await run(s, "({open:document.getElementById('image-modal').open,returned:document.activeElement.classList.contains('detail-trigger'),focus:document.activeElement.outerHTML.slice(0,300),closeEventFocus:window.closeEventFocus})");
  results.push({afterEscape:state});
  assert.equal(state.open, false);
  assert.equal(state.returned, true);
  results.push('Escape closes and returns focus');
  await run(s, "document.activeElement.blur();document.querySelectorAll('.detail-trigger')[1].click()");
  await key(s, 'Escape', 'Escape');
  await waitFor(s, "document.activeElement === document.querySelectorAll('.detail-trigger')[1]");
  results.push('synthetic activation without prior DOM focus restores its trigger');
  await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] }, s);
  await run(s, "document.querySelector('.detail-trigger').focus()");
  await key(s, 'Tab', 'Tab');
  state = await run(s, "(()=>{const el=document.activeElement;const cs=getComputedStyle(el);return {tag:el.tagName,outline:cs.outlineStyle,width:cs.outlineWidth,color:cs.outlineColor}})()");
  assert.equal(state.outline, 'solid');
  assert.equal(state.width, '3px');
  results.push({ forcedColorsFocus: state });
  await b.send('Emulation.setEmulatedMedia', { features: [] }, s);
  await b.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 800, deviceScaleFactor: 1, mobile: false }, s);
  await pause(50);
  state = await run(s, "({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth})");
  assert.ok(state.scrollWidth <= state.width);
  results.push({ width320: state });
  await run(s, "document.getElementById('scan-again').click()");
  await waitFor(s, "document.getElementById('report-error').textContent.includes('source tab is closed')");
  assert.match(await run(s, "document.getElementById('report-error').textContent"), /source tab is closed/);
  assert.equal(await run(s, "document.querySelectorAll('.image-card').length"), 4);
  results.push('failed rescan retains prior report and displays error');
  await seed({ ...data, images: [], scan: { reason: 'payload-limit', partial: true, warnings: ['Two records omitted.'] } });
  await pause(50);
  assert.equal(await run(s, "document.getElementById('empty-results').hidden"), false);
  assert.match(await run(s, "document.getElementById('scan-outcome').textContent"), /Partial report.*storage size limit/);
  results.push('empty partial report and payload limit');
  await seed(null, 'Cannot inspect protected page');
  await pause(50);
  assert.equal(await run(s, "document.getElementById('report-content').hidden"), true);
  assert.match(await run(s, "document.getElementById('report-error').textContent"), /Cannot inspect protected page/);
  results.push('initial error record');
  evidence.status = 'passed';
  evidence.checks = results;
  await saveEvidence();
  console.log(JSON.stringify(evidence, null, 2));
} catch (error) {
  evidence.status = 'failed';
  evidence.checks = results;
  evidence.error = error.stack || error.message;
  await saveEvidence();
  console.error(JSON.stringify(evidence, null, 2));
  throw error;
} finally {
  await b.close();
}
