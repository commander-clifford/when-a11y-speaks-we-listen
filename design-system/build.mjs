import { build } from 'esbuild';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const result = await build({
  absWorkingDir: root,
  entryPoints: ['design-system/sample.js'],
  outfile: 'design-system/dist/sample.js',
  bundle: true, format: 'iife', platform: 'browser', target: ['chrome120'],
  minify: true, legalComments: 'linked', metafile: true,
  define: { 'process.env.NODE_ENV': '"production"' },
});
await mkdir(path.join(root, 'design-system/dist'), { recursive: true });
await writeFile(path.join(root, 'design-system/dist/metafile.json'), JSON.stringify(result.metafile, null, 2) + '\n');
const names = [...new Set(Object.keys(result.metafile.inputs).filter(file => file.startsWith('node_modules/')).map(file => {
  const parts = file.slice('node_modules/'.length).split('/');
  return parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}))].sort();
const packages = [];
for (const name of names) {
  const manifest = JSON.parse(await readFile(path.join(root, 'node_modules', name, 'package.json'), 'utf8'));
  packages.push({ name, version: manifest.version, license: manifest.license, repository: manifest.repository });
}
const bytes = (await stat(path.join(root, 'design-system/dist/sample.js'))).size;
const imports = Object.values(result.metafile.outputs).flatMap(output => output.imports);
const evidence = { format: 'classic-iife', target: 'chrome120', bytes, runtimeRemoteImports: imports.filter(item => /^(https?:)?\/\//.test(item.path)).length, externalImports: imports.filter(item => item.external), packages };
await writeFile(path.join(root, 'design-system/dist/package-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ bundleBytes: bytes, packagesInBundle: packages.length, output: 'design-system/dist/sample.js', format: 'classic-iife' }, null, 2));
