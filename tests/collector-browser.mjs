import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { launchChrome } from './chrome.mjs';

// Real Chromium DOM/scroll/click integration checks. No external sites or packages.
const source = await readFile(new URL('../extension/contentScript.js', import.meta.url), 'utf8');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const image = (name, attrs = '') => `<img src="/image/${name}.svg" width="100" height="70" ${attrs}>`;
const page = (body, script = '', style = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Collector fixture</title><meta name="description" content="Local integration fixture"><style>body{margin:16px;font:16px system-ui}img{object-fit:contain}${style}</style></head><body>${body}<script>${script}</script></body></html>`;
const railStyle = '.rail{width:320px;height:120px;overflow:auto;position:relative}.track{width:1600px;height:100px;position:relative}.track img{position:absolute;top:0}';
const fixtures = {
  '/dom': page(`<button onclick="window.clicks++">Delete table</button><button onclick="window.clicks++">Next</button>${image('same','alt="First description"')}${image('same','alt="Second description"')}${image('missing')}${image('empty','alt=""')}${image('whitespace','alt="   "')}${image('offscreen','alt="Offscreen" style="position:absolute;left:4000px;top:3000px"')}<img src="http://[" alt="Malformed URL"><img src="/bad%ZZ.svg" alt="Malformed escape"><img data-src="/image/lazy.svg" alt="Lazy declared">`, 'window.clicks=0'),
  '/horizontal-dom': page(`<div class="rail" id="rail"><div class="track">${[0,1,2,3,4].map(n=>image('rail-'+n,`alt="Rail ${n}" style="left:${n*300}px"`)).join('')}</div></div>`, 'rail.scrollLeft=177', railStyle),
  '/horizontal-virtual': page(`<div style="height:1000px"></div><div class="rail" id="rail"><div class="track" id="track">${image('virtual-0','id="slide" alt="Slide zero"')}</div></div>`, `window.positions=[];rail.addEventListener('scroll',()=>{const index=Math.floor(rail.scrollLeft/200);positions.push(rail.scrollLeft);slide.src='/image/virtual-'+index+'.svg';slide.alt='Slide '+index;slide.style.left=rail.scrollLeft+'px'});window.scrollTo(0,240);`, railStyle),
  '/horizontal-lazy': page(`<div class="rail" id="rail"><div class="track" id="track">${image('loaded-0','alt="Loaded initially"')}</div></div>`, `window.loaded=new Set([0]);rail.addEventListener('scroll',()=>{const i=Math.floor(rail.scrollLeft/200);if(!loaded.has(i)){loaded.add(i);const img=document.createElement('img');img.src='/image/loaded-'+i+'.svg';img.alt='Loaded '+i;img.style.left=rail.scrollLeft+'px';track.append(img)}});`, railStyle),
  '/rtl': page(`<div class="rail" id="rail" style="direction:rtl"><div class="track" id="track">${image('rtl-0','id="slide" alt="RTL slide"')}</div></div>`, `window.positions=[];rail.addEventListener('scroll',()=>{positions.push(rail.scrollLeft);slide.src='/image/rtl-'+Math.floor(Math.abs(rail.scrollLeft)/200)+'.svg';});rail.scrollLeft=-100`, railStyle),
  '/vertical': page(`<div class="rail" id="rail"><div id="track" style="height:600px;position:relative">${image('vertical-0','id="slide" alt="Vertical slide"')}</div></div>`, `window.positions=[];rail.addEventListener('scroll',()=>{positions.push(rail.scrollTop);slide.src='/image/vertical-'+Math.floor(rail.scrollTop/80)+'.svg';slide.style.top=rail.scrollTop+'px'});rail.scrollTop=31`, '.rail{width:320px;height:120px;overflow:auto;position:relative}img{position:absolute}'),
  '/growth': page(`<div class="rail" id="rail"><div class="track" id="track">${image('growth-0','alt="Initially visible"')}</div></div>`, `window.growthEvents=0;rail.addEventListener('scroll',()=>{if(rail.scrollLeft>0){growthEvents++;track.style.width=(track.offsetWidth+500)+'px';const img=document.createElement('img');img.src='/image/growth-'+growthEvents+'.svg';img.alt='Growing image '+growthEvents;img.style.left=rail.scrollLeft+'px';track.append(img)}})`, railStyle),
  '/step-limit': page(`<div class="rail" id="rail"><div class="track" style="width:20000px">${image('long','alt="Long component"')}</div></div>`, '', railStyle),
  '/time-limit': page(`<div class="rail" id="rail"><div class="track" style="width:20000px">${image('slow','alt="Slow component"')}</div></div>`, `rail.addEventListener('scroll',()=>{const until=performance.now()+700;while(performance.now()<until){}})`, railStyle),
  '/image-limit': page(Array.from({length:501},(_,i)=>image('budget-'+i,`alt="Image ${i}"`)).join('')),
  '/exact-image-limit': page(Array.from({length:500},(_,i)=>image('boundary-'+i,`alt="Image ${i}"`)).join('')),
  '/empty': page('<p>No images.</p>'),
  '/stop': page(`<div style="height:1000px"></div><div class="rail" id="rail"><div class="track" id="track" style="width:20000px">${image('stop-0','alt="Before stop"')}</div></div>`, `rail.addEventListener('scroll',()=>{if(rail.scrollLeft>0){const img=document.createElement('img');img.src='/image/stop-'+rail.scrollLeft+'.svg';img.alt='Collected while scanning';track.append(img)}});rail.scrollLeft=27;window.scrollTo(0,220);`, railStyle),
  '/containers-limit': page(Array.from({length:13},(_,i)=>`<div class="rail"><div class="track" style="width:324px">${image('container-'+i,`alt="Container ${i}"`)}</div></div>`).join(''), '', railStyle),
};
const server = createServer((req, res) => {
  if (req.url.startsWith('/image/') || req.url.startsWith('/bad')) {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.end('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="70"><rect width="100" height="70" fill="#6750a4"/></svg>');
  } else {
    res.setHeader('Content-Type','text/html;charset=utf-8');
    res.end(fixtures[req.url] || fixtures['/empty']);
  }
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await launchChrome();
const report = {date:new Date().toISOString(),source:'extension/contentScript.js',sourceSha256:createHash('sha256').update(source).digest('hex'),method:'Isolated headless Chrome; local HTTP fixtures; collector evaluated with CDP in real browser DOM; Stop activated through browser input.',limitations:['Collector integration checks do not exercise extension worker/report messaging.','No claim of screen-reader speech testing or WCAG conformance.','Controlled fixtures do not establish exhaustive third-party carousel compatibility.'],checks:[]};
async function evaluate(sessionId, expression) {
  const result = await browser.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);
  if(result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function open(path) {
  const {targetId} = await browser.send('Target.createTarget',{url:base+path});
  const {sessionId} = await browser.send('Target.attachToTarget',{targetId,flatten:true});
  await browser.send('Page.bringToFront',{},sessionId);
  await browser.send('Runtime.enable',{},sessionId);
  for(let i=0;i<30;i++) {
    if(await evaluate(sessionId,'document.readyState === "complete"')) break;
    await sleep(50);
  }
  await sleep(80);
  return {targetId,sessionId};
}
const positionsExpression = `({window:[scrollX,scrollY],containers:[...document.querySelectorAll('.rail')].map(el=>[el.scrollLeft,el.scrollTop])})`;
const cases = [
  {name:'DOM image elements, duplicate URLs, offscreen coverage, alt states, malformed URLs, no arbitrary clicks',path:'/dom',verify:async(data,session)=>{
    assert.equal(data.images.length,9);
    assert.equal(data.images.filter(img=>img.src.endsWith('/same.svg')).length,2,'Separate elements with identical URLs must remain separate records');
    assert.deepEqual(data.images.filter(img=>img.src.endsWith('/same.svg')).map(img=>img.alt),['First description','Second description']);
    for(const [name,state,raw] of [['missing','missing',''],['empty','empty',''],['whitespace','whitespace','   ']]) {
      const record=data.images.find(img=>img.src.endsWith('/'+name+'.svg'));assert.equal(record.altState,state);assert.equal(record.alt,raw);
    }
    assert.equal(data.images.find(img=>img.alt==='Offscreen').discoveredVia,'initial-dom');
    assert(data.images.some(img=>img.alt==='Malformed URL'));
    assert(data.images.some(img=>img.fileName==='bad%ZZ.svg'));
    assert(data.images.some(img=>img.lazySource.endsWith('/lazy.svg')));
    assert.equal(await evaluate(session,'window.clicks'),0);
    assert.equal(data.scan.reason,'complete');
  }},
  {name:'Horizontal offscreen DOM images collected automatically and original offset restored',path:'/horizontal-dom',verify:async(data)=>{
    assert.equal(data.images.length,5);assert(data.images.every(img=>img.discoveredVia==='initial-dom'));
    assert.equal(data.scan.containersVisited,1);assert.equal(data.scan.reason,'complete');
  }},
  {name:'Horizontal reused virtual slide materializes distinct sources automatically',path:'/horizontal-virtual',verify:async(data,session)=>{
    assert(data.images.length>=6,`Expected >=6 virtual variants, got ${data.images.length}`);
    assert(data.images.some(img=>img.src.endsWith('/virtual-6.svg')),'Initial far extent must be visited');
    assert((await evaluate(session,'positions')).some(left=>left>=1200));
    assert.equal(data.scan.reason,'complete');
  }},
  {name:'Horizontal scroll events materialize lazy image elements',path:'/horizontal-lazy',verify:async(data)=>{
    assert(data.images.length>=6);assert(data.images.some(img=>img.discoveredVia==='component-scroll'));
    assert(data.images.some(img=>img.src.endsWith('/loaded-6.svg')));assert.equal(data.scan.reason,'complete');
  }},
  {name:'RTL horizontal traversal uses negative offsets and restores original position',path:'/rtl',verify:async(data,session)=>{
    assert(data.images.length>=6);assert((await evaluate(session,'positions')).some(left=>left<=-1200));
    assert.equal(data.scan.reason,'complete');
  }},
  {name:'Vertical component traversal reveals image variants and restores original position',path:'/vertical',verify:async(data,session)=>{
    assert(data.images.length>=5);assert((await evaluate(session,'positions')).some(top=>top>=480));
    assert.equal(data.scan.reason,'complete');
  }},
  {name:'Indefinitely growing component bounded by initial extent with partial warning',path:'/growth',verify:async(data,session)=>{
    assert((await evaluate(session,'growthEvents'))>0);assert(data.images.length>1);
    assert(data.scan.steps<=7);assert.equal(data.scan.partial,true);
    assert(data.scan.warnings.some(warning=>warning.includes('grew')));
  }},
  {name:'Long component stops at configured 24 steps and retains results',path:'/step-limit',verify:async(data)=>{
    assert.equal(data.scan.steps,24);assert.equal(data.scan.reason,'step-limit');assert.equal(data.scan.partial,true);assert.equal(data.images.length,1);
    assert(data.scan.durationMs<13000,'Default finite budget should complete near 7.2 seconds');
  }},
  {name:'501 images enforce 500-record cap with explicit partial result',path:'/image-limit',verify:async(data)=>{
    assert.equal(data.images.length,500);assert.equal(data.scan.reason,'image-limit');assert.equal(data.scan.partial,true);assert.equal(data.scan.steps,0);
  }},
  {name:'Exactly 500 DOM images finish without a false truncation claim',path:'/exact-image-limit',verify:async(data)=>{
    assert.equal(data.images.length,500);assert.equal(data.scan.reason,'complete');assert.equal(data.scan.partial,false);
  }},
  {name:'Real elapsed-time limit stops slow scroll handlers before 24 steps',path:'/time-limit',verify:async(data)=>{
    assert.equal(data.scan.reason,'time-limit');assert.equal(data.scan.partial,true);assert.equal(data.images.length,1);
    assert(data.scan.steps<24);assert(data.scan.durationMs>=12000);assert(data.scan.durationMs<14500,'Main-thread handler can delay the deadline by one bounded event');
  }},
  {name:'Zero-image page completes without overlay residue',path:'/empty',verify:async(data)=>{
    assert.equal(data.images.length,0);assert.equal(data.scan.reason,'complete');assert.equal(data.scan.partial,false);
  }},
  {name:'User Stop is accessible in DOM, clickable, retains collected results and restores position',path:'/stop',stop:true,verify:async(data)=>{
    assert.equal(data.scan.reason,'user-stop');assert.equal(data.scan.partial,true);assert(data.images.length>=2);
    assert(data.scan.steps<24);assert(data.scan.durationMs<3500,'Stop should finish promptly');
  }},
  {name:'Switching away from source tab ends discovery with honest partial coverage',path:'/stop',hide:true,verify:async(data)=>{
    assert.equal(data.scan.reason,'page-hidden');assert.equal(data.scan.partial,true);assert(data.images.length>=1);
    assert(data.scan.steps<24);assert(data.scan.durationMs<3500);
  }},
  {name:'Scrollable component budget reports remaining components as partial',path:'/containers-limit',verify:async(data)=>{
    assert.equal(data.images.length,13);assert.equal(data.scan.containersVisited,12);
    assert.equal(data.scan.partial,true);assert(data.scan.warnings.some(warning=>warning.includes('12 component limit')));
  }},
];
async function run(test) {
  const check={name:test.name,fixture:test.path,status:'failed'};
  let tab,backgroundTab;
  try {
    tab=await open(test.path);
    const before=await evaluate(tab.sessionId,positionsExpression);
    const pending=evaluate(tab.sessionId,source);
    pending.catch(()=>{}); // Prevent an unhandled rejection if a control assertion fails first.
    if(test.hide) {
      await sleep(750);
      backgroundTab=await open('/empty');
    }
    if(test.stop) {
      await sleep(750);
      const tree=await browser.send('Accessibility.getFullAXTree',{},tab.sessionId);
      const button=tree.nodes.find(node=>node.role?.value==='button'&&node.name?.value==='Stop scan and show results');
      assert(button?.backendDOMNodeId,'Stop must be exposed as a named button in Chromium accessibility tree');
      const {model}=await browser.send('DOM.getBoxModel',{backendNodeId:button.backendDOMNodeId},tab.sessionId);
      const bounds=model.border;
      const x=(bounds[0]+bounds[2]+bounds[4]+bounds[6])/4, y=(bounds[1]+bounds[3]+bounds[5]+bounds[7])/4;
      await browser.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1},tab.sessionId);
      await browser.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1},tab.sessionId);
      check.stopButton={role:button.role.value,name:button.name.value,activation:'CDP browser mouse input'};
    }
    const data=await pending;
    check.scan=data.scan;check.imageCount=data.images.length;
    await test.verify(data,tab.sessionId);
    const after=await evaluate(tab.sessionId,positionsExpression);
    assert.deepEqual(after,before,'Window and every fixture component position must be restored');
    assert.equal(await evaluate(tab.sessionId,"document.querySelectorAll('#a11y-chats-scan-control').length"),0,'Scan control must be removed');
    assert.equal(await evaluate(tab.sessionId,"Object.prototype.hasOwnProperty.call(globalThis,'__a11yChatsScan')"),false,'Scan guard must be released');
    check.positionsRestored=true;check.overlayRemoved=true;check.guardReleased=true;check.status='passed';
  } catch(error) {check.error=error.stack;process.exitCode=1;}
  finally {
    if(backgroundTab) await browser.send('Target.closeTarget',{targetId:backgroundTab.targetId});
    if(tab) await browser.send('Target.closeTarget',{targetId:tab.targetId});
  }
  report.checks.push(check);console.log(`${check.status.toUpperCase()}: ${check.name}${check.error?'\n'+check.error:''}`);
}
try {
  report.browser=await browser.send('Browser.getVersion');
  // Keep the source tab foreground: Chromium throttles scroll events in hidden tabs.
  // Serial execution matches the extension action's ordinary active-tab context.
  for(const test of cases) await run(test);
} catch(error) {report.fatalError=error.stack;process.exitCode=1;}
finally {
  await browser.close();await new Promise(resolve=>server.close(resolve));
  report.summary={passed:report.checks.filter(check=>check.status==='passed').length,failed:report.checks.filter(check=>check.status==='failed').length,total:report.checks.length};
  await writeFile(new URL('../audit/collector-browser.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report.summary));
}
