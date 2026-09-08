import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { launchChrome } from './chrome.mjs';

const review = process.argv.includes('--review');
const motionOnly = process.argv.includes('--motion-only');
const statePromptsOnly = process.argv.includes('--state-prompts-only');
const source = new URL('../design-system/index.html', import.meta.url);
const evidencePath = new URL('../audit/design-browser.json', import.meta.url);
const screenshotDirectory = new URL('../audit/screenshots/', import.meta.url);
const browser = await launchChrome();
const evidence = (motionOnly || statePromptsOnly) ? JSON.parse(await readFile(evidencePath, 'utf8')) : {
  date: new Date().toISOString(), source: source.href, reviewMode: review, checks: [], screenshots: [], actions: [],
  limitations: ['Isolated Chrome with a local-file component fixture, not extension integration.', 'Automated DOM, keyboard, and style checks plus AI visual inspection do not establish accessibility conformance.'],
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let session;

async function evaluate(expression) {
  const result = await browser.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, session);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(expression) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try { if (await evaluate(expression)) return; } catch { /* Navigation can replace the context. */ }
    await sleep(40);
  }
  throw new Error('Condition did not become true: ' + expression);
}
async function snapshot(selector) {
  const state = await evaluate(`(() => {
    const matches = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
    const el = matches[0]; if (!el) return { count: 0 };
    const rect = el.getBoundingClientRect(); const style = getComputedStyle(el);
    return { count: matches.length, tag: el.tagName, id: el.id, text: el.textContent.trim(), disabled: !!el.disabled,
      visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden',
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, active: document.activeElement.id,
      state: document.getElementById('state-picker').value, dialogOpen: document.getElementById('image-dialog').open };
  })()`);
  assert.equal(state.count, 1, 'Expected one target: ' + selector);
  return state;
}
async function focus(selector) {
  const before = await snapshot(selector);
  assert.equal(before.visible, true, 'Cannot focus hidden target: ' + selector);
  evidence.actions.push({ action: 'focus', selector, before });
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
}
async function click(selector) {
  await snapshot(selector);
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({ block: 'nearest' })`);
  const before = await snapshot(selector);
  assert.equal(before.visible, true, 'Cannot click hidden target: ' + selector);
  assert.equal(before.disabled, false, 'Cannot click disabled target: ' + selector);
  evidence.actions.push({ action: 'click', selector, before });
  const x = before.rect.x + before.rect.width / 2;
  const y = before.rect.y + before.rect.height / 2;
  for (const type of ['mousePressed', 'mouseReleased']) {
    await browser.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }, session);
  }
}
async function key(key, code, virtualKey, text) {
  const before = await evaluate(`({tag:document.activeElement.tagName,id:document.activeElement.id,
    label:document.activeElement.getAttribute('label'),text:document.activeElement.textContent.trim().slice(0,120),
    state:document.getElementById('state-picker').value,dialogOpen:document.getElementById('image-dialog').open})`);
  evidence.actions.push({ action: 'key', key, before });
  await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtualKey, ...(text ? { text } : {}) }, session);
  await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtualKey }, session);
}
async function setState(value) {
  const before = await snapshot('#state-picker');
  evidence.actions.push({ action: 'select state/change event', value, before });
  await evaluate(`document.getElementById('state-picker').value=${JSON.stringify(value)};
    document.getElementById('state-picker').dispatchEvent(new Event('change',{bubbles:true}))`);
  await waitFor(`document.getElementById('status-light').textContent === ${JSON.stringify(value[0].toUpperCase() + value.slice(1))}`);
}
async function top() { await evaluate('window.scrollTo(0,0)'); }
async function capture(name, description) {
  await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const state = await evaluate(`({ state:document.getElementById('state-picker').value, dialogOpen:document.getElementById('image-dialog').open,
    viewport:{width:innerWidth,height:innerHeight},scrollY, cards:document.querySelectorAll('article.image-card').length,
    resultsVisible:!document.getElementById('results').hidden,
    foundationBounds:(()=>{const r=document.getElementById('foundation').getBoundingClientRect();return{top:r.top,bottom:r.bottom}})() })`);
  const png = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, session);
  const path = new URL(name + '.png', screenshotDirectory);
  await writeFile(path, Buffer.from(png.data, 'base64'));
  const item = { name, description, path: fileURLToPath(path), state, visuallyReviewedByAI: false };
  const existing = evidence.screenshots.findIndex(screenshot => screenshot.name === name);
  if (existing >= 0) evidence.screenshots[existing] = item;
  else evidence.screenshots.push(item);
  console.log(JSON.stringify({ screenshot: item.path, description, state }));
  if (review) {
    await new Promise(resolve => {
      process.stdin.once('data', () => { process.stdin.pause(); resolve(); });
      process.stdin.resume();
    });
    item.visuallyReviewedByAI = true;
  }
}
async function save() {
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
}
async function inspectReducedMotion() {
  return evaluate(`(() => {
    const hosts=Array.from(document.querySelectorAll('sp-progress-circle'));
    return {matches:matchMedia('(prefers-reduced-motion:reduce)').matches,components:hosts.map(host=>({id:host.id,hidden:host.hidden,
      animations:Array.from(host.shadowRoot?.querySelectorAll('*')||[]).map(el=>{const s=getComputedStyle(el);return{tag:el.tagName,class:el.className?.baseVal||el.className,name:s.animationName,duration:s.animationDuration,playState:s.animationPlayState}}).filter(el=>el.name!=='none')}))};
  })()`);
}

try {
  evidence.browser = await browser.send('Browser.getVersion');
  await mkdir(screenshotDirectory, { recursive: true });
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const attached = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  session = attached.sessionId;
  for (const method of ['Page.enable', 'Runtime.enable', 'Network.enable', 'Log.enable', 'DOM.enable', 'CSS.enable']) await browser.send(method, {}, session);
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, session);
  await browser.send('Page.navigate', { url: source.href }, session);
  await waitFor("document.documentElement.dataset.spectrumReady === 'true' && document.querySelectorAll('article.image-card .inspect-image').length === 3");
  await browser.send('Page.bringToFront', {}, session);
  if (statePromptsOnly) {
    const states=[];
    for (const value of ['complete','partial','scanning','stopped','empty','error']) {
      await setState(value);await top();
      const prompt=await snapshot('#image-selection-prompt');
      const shouldShow=!['empty','error'].includes(value);
      assert.equal(prompt.visible,shouldShow);
      assert.equal(await evaluate("document.getElementById('result-count').textContent"),shouldShow?'3':'0');
      states.push({state:value,promptVisible:prompt.visible,resultCount:shouldShow?3:0});
      if(value==='empty') await capture('spectrum-06-empty','Empty state with the image-selection instruction correctly hidden.');
      if(value==='error') await capture('spectrum-07-error','Error state with the image-selection instruction correctly hidden.');
    }
    evidence.statePromptRecheck={date:new Date().toISOString(),browser:evidence.browser.product,status:'passed',states,
      note:'Focused verification after the final zero-result instruction fix; screenshots06 and07 replaced and prior audit evidence preserved.'};
    evidence.status='passed';
    await save();
    console.log(JSON.stringify({status:'passed',statePromptRecheck:evidence.statePromptRecheck,evidence:fileURLToPath(evidencePath)},null,2));
  } else if (motionOnly) {
    await browser.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]},session);
    await setState('scanning');
    const reduced=await inspectReducedMotion();
    assert.equal(reduced.matches,true);
    assert.ok(reduced.components.every(component=>component.animations.every(animation=>animation.duration==='0s')));
    const check=evidence.checks.find(item=>item.name==='Reduced-motion actual shadow-component animation inspection');
    check.status='passed';check.details=reduced;
    evidence.motionRecheck={date:new Date().toISOString(),browser:evidence.browser.product,note:'Fresh page after the scoped Spectrum animation token fix. Existing default-state screenshots are unaffected.',details:reduced};
    evidence.status='passed';
    await save();
    console.log(JSON.stringify({status:'passed',motionRecheck:evidence.motionRecheck,evidence:fileURLToPath(evidencePath)},null,2));
  } else {
  const initial = await evaluate(`(() => {
    const theme=document.querySelector('sp-theme'),style=getComputedStyle(theme);
    const names=['sp-theme','sp-button','sp-status-light','sp-progress-circle'];
    return { definitions:Object.fromEntries(names.map(name=>[name,!!customElements.get(name)])),
      instances:Object.fromEntries(names.map(name=>[name,document.querySelectorAll(name).length])),
      theme:{system:theme.system,color:theme.color,scale:theme.scale},color:style.color,canvas:style.backgroundColor,font:style.fontFamily,
      vendorTokens:Object.fromEntries(['--spectrum-gray-100','--spectrum-accent-color-900','--spectrum-font-size-700','--spectrum-spacing-300'].map(name=>[name,style.getPropertyValue(name).trim()])),
      headingSize:getComputedStyle(document.querySelector('h1')).fontSize,
      buttonFont:getComputedStyle(document.getElementById('scan-button')).fontFamily,
      imageArticles:document.querySelectorAll('article.image-card').length,
      actionNames:Array.from(document.querySelectorAll('.inspect-image')).map(el=>({visible:el.textContent,label:el.getAttribute('label'),tag:el.tagName})) };
  })()`);
  assert.ok(Object.values(initial.definitions).every(Boolean));
  assert.ok(Object.values(initial.vendorTokens).every(Boolean));
  assert.equal(initial.color, 'rgb(34, 34, 34)');
  assert.equal(initial.canvas, 'rgb(248, 248, 248)');
  assert.equal(initial.headingSize, '28px');
  assert.equal(initial.imageArticles, 3);
  evidence.checks.push({ name: 'Actual Spectrum definitions, instances, core theme tokens, and separated image actions', status: 'passed', details: initial });
  const { root } = await browser.send('DOM.getDocument', {}, session);
  const { nodeId } = await browser.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'h1' }, session);
  evidence.platformFonts = await browser.send('CSS.getPlatformFontsForNode', { nodeId }, session);
  evidence.accessibilityNodes = (await browser.send('Accessibility.getFullAXTree', {}, session)).nodes
    .filter(node => !node.ignored && ['button','progressbar','status'].includes(node.role?.value))
    .map(node=>({role:node.role.value,name:node.name?.value,properties:node.properties}));
  await top();
  await capture('spectrum-01-complete', 'Complete local example: three readable image records and explicit Inspect actions.');

  await focus('#image-list article:first-child .inspect-image');
  await key('Enter', 'Enter', 13, '\r');
  await waitFor("document.getElementById('image-dialog').open");
  assert.equal(await evaluate('document.activeElement.id'), 'dialog-title');
  const inert = await evaluate("document.getElementById('scan-button').focus();document.activeElement.id !== 'scan-button'");
  assert.equal(inert, true);
  await capture('spectrum-02-modal', 'Image details opened from the keyboard, with raw alt evidence and navigation.');
  await click('#previous-image');
  assert.equal(await evaluate("document.getElementById('dialog-position').textContent"), 'Example 3 of 3');
  await click('#next-image');
  assert.equal(await evaluate("document.getElementById('dialog-position').textContent"), 'Example 1 of 3');
  await key('Escape', 'Escape', 27);
  await waitFor("!document.getElementById('image-dialog').open && document.activeElement.classList.contains('inspect-image')");
  evidence.checks.push({name:'Keyboard Inspect opens native modal; initial heading focus, background inertness, wrapping navigation, Escape and focus return',status:'passed'});

  await top();
  await click('#scan-button');
  await waitFor("document.getElementById('state-picker').value==='scanning'");
  assert.equal(await evaluate('document.activeElement.id'), 'stop-button');
  await capture('spectrum-03-scanning', 'Scanning sample with labeled progress, retained results, and focused Stop action.');
  // A manual screenshot review can outlast the six-second sample timer. Restart
  // only if it completed, then test Stop immediately against the fresh state.
  if (await evaluate("document.getElementById('state-picker').value !== 'scanning'")) await click('#scan-button');
  await click('#stop-button');
  await waitFor("document.getElementById('state-picker').value==='stopped'");
  const stopped = await evaluate("({focus:document.activeElement.id,count:document.getElementById('result-count').textContent,visible:!document.getElementById('results').hidden,announcement:document.getElementById('announcement').textContent})");
  assert.equal(stopped.focus,'scan-button');assert.equal(stopped.count,'3');assert.equal(stopped.visible,true);
  evidence.checks.push({name:'Run sample → Stop keeps three records and returns focus',status:'passed',details:stopped});
  await top();
  await capture('spectrum-04-stopped','Stopped state retains the image evidence and explains the early ending.');

  for (const [value, number] of [['partial','05'],['empty','06'],['error','07']]) {
    await setState(value);await top();
    const state=await evaluate("({label:document.getElementById('status-light').textContent,description:document.getElementById('scan-description').textContent,count:document.getElementById('result-count').textContent,resultsVisible:!document.getElementById('results').hidden,emptyHeading:document.getElementById('no-results-title').textContent})");
    assert.equal(state.resultsVisible,value==='partial');assert.equal(state.count,value==='partial'?'3':'0');
    assert.equal((await snapshot('#image-selection-prompt')).visible,value==='partial');
    evidence.checks.push({name:'Example state: '+value,status:'passed',details:state});
    await capture('spectrum-'+number+'-'+value,'Example state: '+value+'.');
  }
  await setState('complete');
  await snapshot('#foundation');
  await evaluate("document.getElementById('foundation').scrollIntoView({block:'start'})");
  await capture('spectrum-08-foundation','Spectrum actions, status language, typography, and seven mapped colors.');

  await top();
  await browser.send('Emulation.setDeviceMetricsOverride',{width:320,height:1000,deviceScaleFactor:1,mobile:false},session);
  await sleep(60);
  const narrow=await evaluate("({width:innerWidth,documentWidth:document.documentElement.scrollWidth,overflowing:Array.from(document.querySelectorAll('main *')).filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.right>innerWidth+1}).map(el=>({tag:el.tagName,id:el.id,class:el.className})).slice(0,12)})");
  assert.equal(narrow.documentWidth,320);
  evidence.checks.push({name:'320px layout has no horizontal document overflow',status:'passed',details:narrow});
  await capture('spectrum-09-narrow','320px starting view of the responsive component sample.');

  await browser.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false},session);
  await browser.send('Emulation.setEmulatedMedia',{features:[{name:'forced-colors',value:'active'}]},session);
  await top();await focus('#state-picker');await key('Tab','Tab',9);
  const forced=await evaluate("(()=>{const el=document.activeElement,s=getComputedStyle(el);return{id:el.id,tag:el.tagName,focusVisible:el.matches(':focus-visible'),outlineStyle:s.outlineStyle,outlineWidth:s.outlineWidth,outlineColor:s.outlineColor,shadow:s.boxShadow}})()");
  assert.equal(forced.id,'scan-button');assert.equal(forced.focusVisible,true);
  evidence.checks.push({name:'Forced colors focused Spectrum action',status:'passed',details:forced});
  await capture('spectrum-10-forced-colors','Forced-colors mode with keyboard focus on Run sample scan.');

  await browser.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]},session);
  await setState('scanning');
  const reduced=await inspectReducedMotion();
  assert.equal(reduced.matches,true);
  assert.ok(reduced.components.every(component=>component.animations.every(animation=>animation.duration==='0s')));
  evidence.checks.push({name:'Reduced-motion actual shadow-component animation inspection',status:'passed',details:reduced});
  await setState('complete');
  const events=browser.events.filter(event=>event.sessionId===session);
  evidence.remoteRequests=events.filter(event=>event.method==='Network.requestWillBeSent'&&/^https?:/.test(event.params.request.url)).map(event=>event.params.request.url);
  evidence.runtimeExceptions=events.filter(event=>event.method==='Runtime.exceptionThrown').map(event=>event.params.exceptionDetails);
  evidence.browserErrors=events.filter(event=>event.method==='Log.entryAdded'&&event.params.entry.level==='error').map(event=>event.params.entry.text);
  assert.deepEqual(evidence.remoteRequests,[]);assert.deepEqual(evidence.runtimeExceptions,[]);assert.deepEqual(evidence.browserErrors,[]);
  evidence.checks.push({name:'No remote requests, runtime exceptions, or browser/CSP errors',status:'passed'});
  evidence.status='passed';
  await save();
  console.log(JSON.stringify({status:evidence.status,checks:evidence.checks.length,screenshots:evidence.screenshots.length,evidence:fileURLToPath(evidencePath),reducedMotion:reduced},null,2));
  }
} catch(error) {
  evidence.status='failed';evidence.error=error.stack||error.message;
  await save();
  console.error(JSON.stringify({status:evidence.status,error:evidence.error,checks:evidence.checks.length,evidence:fileURLToPath(evidencePath)},null,2));
  process.exitCode=1;
} finally {
  await browser.close();
  if (review) process.stdin.destroy();
}
