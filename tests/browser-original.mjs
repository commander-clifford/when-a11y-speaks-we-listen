import { launchChrome } from './chrome.mjs';
import { createServer } from 'node:http';
import { mkdtemp, copyFile, rm, mkdir, writeFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const source = resolve(process.argv[2] || new URL('../originals/', import.meta.url).pathname);
const output = process.argv[3] ? resolve(process.argv[3]) : null;
const names = ['background.js','contentScript.js','contentScript_rel-2.js','contentScript_OLD.js','manifest.json','readme.md'];
const scratch = await mkdtemp(join(tmpdir(), 'a11y-original-package-'));
for (const name of names) await copyFile(join(source,name), join(scratch,name));
const svg = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180"><rect width="300" height="180" fill="#6750a4"/><text x="20" y="90" fill="white">Fixture image</text></svg>');
const fixture = `<!doctype html><html lang="en"><head><title>Engineering fixture</title><meta name="description" content="Controlled local image and metadata fixture"><meta property="og:title" content="Social title"></head><body><main><h1>Source page</h1><button onclick="document.body.dataset.clicked='yes'">Delete table</button><article><img src="${svg}" alt="Purple rectangle"><img src="${svg}" alt=""><img src="${svg}"></article></main></body></html>`;
const server = createServer((req,res) => {
  res.setHeader('Content-Type','text/html; charset=utf-8');
  if (req.url === '/csp') res.setHeader('Content-Security-Policy', "script-src 'self'");
  res.end(fixture);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const b = await launchChrome();
const result = {date:new Date().toISOString(),source,checks:[]};
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
async function evaluate(session, expression) {
  const r = await b.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},session);
  if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
try {
  result.browser = await b.send('Browser.getVersion');
  try {
    result.sixFileLoad = await b.send('Extensions.loadUnpacked',{path:scratch});
  } catch(error) {result.sixFileLoadError = error.message;}
  let assets=source;
  try { await access(join(assets,'styles/inspector.css')); }
  catch { assets=resolve(new URL('../archive/supplemental-assets/',import.meta.url).pathname); }
  for(const relative of ['styles/inspector.css','icons/icon16.png','icons/icon48.png','icons/icon128.png']) {
    await mkdir(join(scratch,relative.split('/')[0]),{recursive:true});
    await copyFile(join(assets,relative),join(scratch,relative));
  }
  result.supplementalAssetSource=assets;
  const loaded = await b.send('Extensions.loadUnpacked',{path:scratch});
  result.supplementedLoad = loaded;
  for(const path of ['/plain','/csp']) {
    const {targetId} = await b.send('Target.createTarget',{url:base+path});
    const {sessionId} = await b.send('Target.attachToTarget',{targetId,flatten:true});
    await b.send('Runtime.enable',{},sessionId);
    await sleep(400);
    const tabTargets = (await b.send('Target.getTargets',{filter:[{type:'tab',exclude:false}]})).targetInfos;
    const tabTarget = tabTargets.find(t=>t.url===base+path);
    if(!tabTarget) throw new Error('No tab target: '+JSON.stringify(tabTargets));
    await b.send('Extensions.triggerAction',{id:loaded.id,targetId:tabTarget.targetId});
    await sleep(3500);
    const sourceClicked = await evaluate(sessionId,"document.body.dataset.clicked || 'no'");
    const targets = (await b.send('Target.getTargets')).targetInfos.filter(t=>t.url.startsWith('blob:'+base));
    const check = {path,sourceClicked,reports:[]};
    for(const target of targets) {
      const {sessionId: reportSession} = await b.send('Target.attachToTarget',{targetId:target.targetId,flatten:true});
      await b.send('Log.enable',{},reportSession);
      const before = await evaluate(reportSession,`({title:document.title,cards:document.querySelectorAll('.js-image-card').length,modalHidden:document.getElementById('modal-backdrop')?.hidden,bodyFont:getComputedStyle(document.body).fontFamily,cardFont:getComputedStyle(document.querySelector('button')).fontFamily})`);
      const afterClick = await evaluate(reportSession,`document.querySelector('.js-image-card').click(); ({modalHidden:document.getElementById('modal-backdrop')?.hidden})`);
      await sleep(100);
      const focused = await evaluate(reportSession,'document.activeElement.id');
      check.reports.push({url:target.url,before,afterClick,focused});
      if(output) {
        await mkdir(join(output,'screenshots'),{recursive:true});
        const png = await b.send('Page.captureScreenshot',{format:'png'},reportSession);
        await writeFile(join(output,'screenshots',path.slice(1)+'-original.png'),Buffer.from(png.data,'base64'));
      }
      await b.send('Target.closeTarget',{targetId:target.targetId});
    }
    check.logs = b.events.filter(e=>e.method==='Log.entryAdded').map(e=>e.params.entry.text);
    result.checks.push(check);
    await b.send('Target.closeTarget',{targetId});
  }
} catch(error) {result.fatalError=error.stack;process.exitCode=1;}
finally {await b.close();server.close();await rm(scratch,{recursive:true,force:true});}
console.log(JSON.stringify(result,null,2));
if(output) {await mkdir(output,{recursive:true});await writeFile(join(output,'browser-original.json'),JSON.stringify(result,null,2)+'\n');}
