import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {launchChrome} from './chrome.mjs';
const root=resolve(new URL('..',import.meta.url).pathname);
const image=await readFile(join(root,'extension/icons/icon128.png'));
const server=createServer((req,res)=>{
  if(req.url.startsWith('/image')) {res.setHeader('Content-Type','image/png');res.end(image);return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');
  if(req.url==='/csp') res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'");
  res.end(`<!doctype html><html lang="en"><head><title>Image review fixture</title><meta name="description" content="A local page with image attributes and social metadata."><meta property="og:title" content="Social title"><meta property="og:type" content="article"><meta property="og:image" content="/image.png"><meta property="og:url" content="javascript:alert('unsafe')"><meta name="twitter:card" content="summary"><link rel="canonical" href="/canonical"></head><body><h1>Source</h1><button onclick="document.body.dataset.clicked='yes'">Delete table</button><article><img src="/image.png" alt="Inspector symbol"><img src="/image.png" alt=""><img src="/image.png"><img src="/image.png" alt="   "><img src="/image.png" alt="Different text for repeated URL" aria-label="Separate ARIA name" role="img"></article></body></html>`);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const b=await launchChrome();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const results={date:new Date().toISOString(),checks:[]};
async function evaluate(sessionId,expression){const r=await b.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function key(sessionId,key,code=key,modifiers=0){const windowsVirtualKeyCode={Enter:13,Tab:9,Escape:27,ArrowRight:39,ArrowLeft:37}[key]||0;await b.send('Input.dispatchKeyEvent',{type:key==='Enter'?'keyDown':'rawKeyDown',key,code,modifiers,windowsVirtualKeyCode,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})},sessionId);await b.send('Input.dispatchKeyEvent',{type:'keyUp',key,code,modifiers,windowsVirtualKeyCode},sessionId);}
async function screenshot(sessionId,name){await mkdir(join(root,'audit/screenshots'),{recursive:true});const p=await b.send('Page.captureScreenshot',{format:'png'},sessionId);await writeFile(join(root,'audit/screenshots',name+'.png'),Buffer.from(p.data,'base64'));}
try{
  results.browser=await b.send('Browser.getVersion');
  const {id}=await b.send('Extensions.loadUnpacked',{path:join(root,'extension')});
  results.extensionId=id;
  const {targetId:controlTarget}=await b.send('Target.createTarget',{url:`chrome-extension://${id}/report.html`,background:true});
  const {sessionId:controlSession}=await b.send('Target.attachToTarget',{targetId:controlTarget,flatten:true});
  for(const path of ['/plain','/csp']){
    const {targetId}=await b.send('Target.createTarget',{url:base+path});
    const {sessionId}=await b.send('Target.attachToTarget',{targetId,flatten:true});
    await sleep(300);
    const tab=(await b.send('Target.getTargets',{filter:[{type:'tab',exclude:false}]})).targetInfos.find(t=>t.url===base+path);
    await b.send('Extensions.triggerAction',{id,targetId:tab.targetId});
    let report;
    for(let i=0;i<60;i++){report=(await b.send('Target.getTargets')).targetInfos.find(t=>t.url.startsWith(`chrome-extension://${id}/report.html?id=`));if(report)break;await sleep(100);}
    assert.ok(report,'report opened');
    const {sessionId:rs}=await b.send('Target.attachToTarget',{targetId:report.targetId,flatten:true});
    await b.send('Runtime.enable',{},rs);await b.send('Log.enable',{},rs);
    await b.send('Page.bringToFront',{},rs);
    await b.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false},rs);
    await sleep(400);
    const sourceClicked=await evaluate(sessionId,"document.body.dataset.clicked || 'no'");
    assert.equal(sourceClicked,'no');
    const state=await evaluate(rs,`({cards:document.querySelectorAll('.image-card').length,status:document.getElementById('report-status').textContent,summary:document.getElementById('alt-summary').textContent,unsafeLinks:document.querySelectorAll('a[href^="javascript:"]').length,canonical:document.getElementById('page-context').textContent,overflow:document.documentElement.scrollWidth>innerWidth})`);
    assert.equal(state.cards,5);assert.equal(state.unsafeLinks,0);assert.match(state.summary,/1 missing; 1 empty; 1 whitespace only; 2 with text/);assert.equal(state.overflow,false);
    if(path==='/csp') await screenshot(rs,'01-report-desktop');
    await evaluate(rs,"document.querySelector('.detail-trigger').focus()");
    await key(rs,'Enter');await sleep(100);
    const modal=await evaluate(rs,"({open:document.getElementById('image-modal').open,active:document.activeElement.id,position:document.getElementById('modal-position').textContent})");
    assert.equal(modal.open,true,JSON.stringify(modal));assert.equal(modal.active,'modal-close');
    await key(rs,'ArrowRight');
    assert.equal(await evaluate(rs,"document.getElementById('modal-position').textContent"),'Image 2 of 5');
    for(let i=0;i<12;i++){await key(rs,'Tab');assert.equal(await evaluate(rs,"document.getElementById('image-modal').contains(document.activeElement)"),true,'native dialog traps tab focus');}
    if(path==='/csp') await screenshot(rs,'02-image-dialog');
    await key(rs,'Escape');await sleep(100);
    assert.equal(await evaluate(rs,"document.getElementById('image-modal').open"),false);
    assert.equal(await evaluate(rs,"document.activeElement.classList.contains('detail-trigger')"),true);
    await b.send('Emulation.setDeviceMetricsOverride',{width:320,height:800,deviceScaleFactor:1,mobile:false},rs);
    await evaluate(rs,"window.scrollTo({top:0,behavior:'instant'})");
    assert.equal(await evaluate(rs,'document.documentElement.scrollWidth>innerWidth'),false,'320px report has no horizontal overflow');
    if(path==='/csp') await screenshot(rs,'03-report-narrow');
    await evaluate(rs,"document.querySelector('.detail-trigger').focus()");
    await key(rs,'Enter');await sleep(100);
    assert.equal(await evaluate(rs,"document.getElementById('image-modal').scrollWidth>document.getElementById('image-modal').clientWidth"),false,'narrow modal no horizontal overflow');
    await key(rs,'Escape');
    await b.send('Emulation.setEmulatedMedia',{features:[{name:'forced-colors',value:'active'},{name:'prefers-reduced-motion',value:'reduce'}]},rs);
    await evaluate(rs,"document.querySelector('.detail-trigger').focus()");
    await evaluate(rs,"document.querySelector('.detail-trigger').scrollIntoView({block:'center',behavior:'instant'})");
    const focus=await evaluate(rs,"({outline:getComputedStyle(document.activeElement).outlineStyle,width:getComputedStyle(document.activeElement).outlineWidth,transition:getComputedStyle(document.activeElement).transitionDuration})");
    assert.equal(focus.outline,'solid');assert.equal(focus.width,'3px');assert.equal(focus.transition,'0s');
    if(path==='/csp') await screenshot(rs,'04-forced-colors');
    const logs=b.events.filter(e=>e.method==='Log.entryAdded'&&e.sessionId===rs).map(e=>e.params.entry);
    assert.equal(logs.filter(l=>l.level==='error').length,0,'packaged report has no browser error log');
    results.checks.push({path,sourceClicked,state,modal,focus,reportErrors:logs.filter(l=>l.level==='error'),keyboard:'Enter / ArrowRight / 12 Tab presses / Escape / focus restore passed',layout:'1440px and 320px report + 320px modal passed'});
    const token=new URL(report.url).searchParams.get('id');
    await b.send('Target.closeTarget',{targetId:report.targetId});
    const cleanupStarted=Date.now();
    let storage;
    for(let attempt=0;attempt<50;attempt++) {
      storage=await evaluate(controlSession,`chrome.storage.session.get(${JSON.stringify('report:'+token)})`);
      if(Object.keys(storage).length===0) break;
      await sleep(100);
    }
    assert.equal(Object.keys(storage).length,0,'closing report removes session snapshot');
    results.checks.at(-1).sessionCleanupMs=Date.now()-cleanupStarted;
    await b.send('Target.closeTarget',{targetId});
  }
  assert.match(await evaluate(controlSession,"document.getElementById('report-error').textContent"),/incomplete or invalid/);
  results.invalidReport='actionable error displayed';
  results.status='passed';
}catch(error){results.status='failed';results.error=error.stack;process.exitCode=1;}
finally{await b.close();server.close();}
await writeFile(join(root,'audit/browser-working.json'),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));
