import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {join,resolve} from 'node:path';
const root = resolve(new URL('..',import.meta.url).pathname);
const provenance = JSON.parse(await readFile(join(root,'audit/provenance.json'),'utf8'));
for(const item of provenance.entries) {
  const bytes = await readFile(join(root,item.file));
  assert.equal(bytes.length,item.bytes,item.file+' size changed');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256,item.file+' no longer matches import');
}
assert.equal(provenance.entries.filter(e=>e.file.startsWith('originals/')).length,6);
const manifest = JSON.parse(await readFile(join(root,'extension/manifest.json'),'utf8'));
assert.equal(manifest.manifest_version,3);
assert.deepEqual([...manifest.permissions].sort(),['activeTab','scripting','storage']);
assert.equal(manifest.host_permissions,undefined);
const refs = [manifest.background.service_worker,...Object.values(manifest.icons),...Object.values(manifest.action.default_icon)];
const html = await readFile(join(root,'extension/report.html'),'utf8');
for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) if(!/^(?:https?:|#)/.test(match[1])) refs.push(match[1]);
for(const file of new Set(refs)) await readFile(join(root,'extension',file));
let syntaxFiles=0;
async function syntax(dir) {
  for(const item of await readdir(join(root,dir),{withFileTypes:true})) {
    const path=join(dir,item.name);
    if(item.isDirectory()) await syntax(path);
    else if(/\.(?:m?js)$/.test(item.name)) {
      const result=spawnSync(process.execPath,['--check',join(root,path)],{encoding:'utf8'});
      assert.equal(result.status,0,path+': '+result.stderr);syntaxFiles++;
    }
  }
}
for(const dir of ['originals','archive/local-variants','extension','tests','design-system']) await syntax(dir);
console.log(JSON.stringify({preservedFiles:provenance.entries.length,originals:6,cloudEquivalenceVerified:provenance.cloudEquivalenceVerified,referencedAssets:new Set(refs).size,syntaxFiles,manifestVersion:manifest.manifest_version,permissions:manifest.permissions},null,2));
