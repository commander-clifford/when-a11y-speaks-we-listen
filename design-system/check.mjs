import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { launchChrome } from '../tests/chrome.mjs';

const browser = await launchChrome();
try {
  const version = await browser.send('Browser.getVersion');
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  for (const method of ['Page.enable', 'Runtime.enable', 'Network.enable', 'Log.enable']) await browser.send(method, {}, sessionId);
  const evaluate = async expression => {
    const result = await browser.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await browser.send('Page.navigate', { url: new URL('./index.html', import.meta.url).href }, sessionId);
  const initial = await evaluate(`new Promise((resolve,reject)=>{let ticks=0;const check=()=>{if(document.documentElement.dataset.spectrumReady==='true'){requestAnimationFrame(()=>requestAnimationFrame(()=>resolve({cards:document.querySelectorAll('.image-card').length,registered:['sp-theme','sp-button','sp-status-light','sp-progress-circle'].every(n=>!!customElements.get(n)),textColor:getComputedStyle(document.querySelector('sp-theme')).color,canvas:getComputedStyle(document.querySelector('sp-theme')).backgroundColor})));}else if(ticks++>100)reject(Error('Spectrum did not load'));else setTimeout(check,50)};check()})`);
  assert.equal(initial.registered, true);
  assert.equal(initial.cards, 3);
  assert.equal(initial.textColor, 'rgb(34, 34, 34)');
  assert.equal(initial.canvas, 'rgb(248, 248, 248)');
  const scan = await evaluate(`document.getElementById('scan-button').click();({state:document.getElementById('state-picker').value,focus:document.activeElement.id,stopVisible:!document.getElementById('stop-button').hidden})`);
  assert.equal(scan.state, 'scanning');
  assert.equal(scan.focus, 'stop-button');
  assert.equal(scan.stopVisible, true);
  const stop = await evaluate(`document.getElementById('stop-button').click();({state:document.getElementById('state-picker').value,focus:document.activeElement.id,results:!document.getElementById('results').hidden})`);
  assert.equal(stop.state, 'stopped');
  assert.equal(stop.focus, 'scan-button');
  assert.equal(stop.results, true);
  const opened = await evaluate(`document.querySelector('.inspect-image').click();({open:document.getElementById('image-dialog').open,focus:document.activeElement.id})`);
  assert.equal(opened.open, true);
  assert.equal(opened.focus, 'dialog-title');
  await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }, sessionId);
  await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }, sessionId);
  const closed = await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>resolve({open:document.getElementById('image-dialog').open,focusCard:document.activeElement.classList.contains('inspect-image')})))`);
  assert.equal(closed.open, false);
  assert.equal(closed.focusCard, true);
  const stateResults = [];
  for (const state of ['complete', 'partial', 'scanning', 'stopped', 'error', 'empty']) {
    const result = await evaluate(`document.getElementById('state-picker').value=${JSON.stringify(state)};document.getElementById('state-picker').dispatchEvent(new Event('change'));({state:document.getElementById('state-picker').value,label:document.getElementById('status-light').textContent,resultsVisible:!document.getElementById('results').hidden})`);
    assert.equal(result.state, state);
    assert.equal(result.resultsVisible, !['error', 'empty'].includes(state));
    stateResults.push(result);
  }
  await browser.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, sessionId);
  const reducedMotion = await evaluate(`document.getElementById('state-picker').value='scanning';document.getElementById('state-picker').dispatchEvent(new Event('change'));new Promise(resolve=>requestAnimationFrame(()=>resolve([...document.getElementById('scan-progress').shadowRoot.querySelectorAll('*')].map(e=>({name:getComputedStyle(e).animationName,duration:getComputedStyle(e).animationDuration})).filter(e=>e.name!=='none'))))`);
  assert.equal(reducedMotion.length, 3);
  assert.ok(reducedMotion.every(animation => animation.duration === '0s'));
  const remoteRequests = browser.events.filter(event => event.sessionId === sessionId && event.method === 'Network.requestWillBeSent' && /^https?:/.test(event.params.request.url)).map(event => event.params.request.url);
  const exceptions = browser.events.filter(event => event.sessionId === sessionId && event.method === 'Runtime.exceptionThrown').map(event => event.params.exceptionDetails);
  const errors = browser.events.filter(event => event.sessionId === sessionId && event.method === 'Log.entryAdded' && event.params.entry.level === 'error').map(event => event.params.entry.text);
  assert.deepEqual(remoteRequests, []);
  assert.deepEqual(exceptions, []);
  assert.deepEqual(errors, []);
  const results = { browser: version.product, origin: 'file:', initial, scan, stop, opened, closed, stateResults, reducedMotion, remoteRequests, exceptions, errors, scope: 'Local-file runtime and selected interaction checks; not screen-reader testing or extension integration.' };
  await writeFile(new URL('./check-results.json', import.meta.url), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
