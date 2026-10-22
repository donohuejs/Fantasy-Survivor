// Reproducible source-only packaging. No deployment or cloud access.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile,mkdtemp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function productionFiles(root=process.cwd()){
  const manifest=JSON.parse(await readFile(path.join(root,'deployment/production-source.json'),'utf8'));
  assert.equal(manifest.format,1);
  const names=manifest.files.map(file=>file.path);
  assert.equal(new Set(names).size,names.length);
  for(const name of names){
    assert(!path.isAbsolute(name)&&!name.split('/').includes('..'));
    assert(/^(?:app\/|lib\/|public\/branding\/|\.vercelignore$|vercel\.json$|package(?:-lock)?\.json$|tsconfig\.json$|next\.config\.ts$|eslint\.config\.mjs$)/.test(name),'Unexpected production path: '+name);
    assert(!/^(?:app\/(?:acceptance|staging|api\/staging)\/|lib\/staging-)/.test(name));
    assert(!/\.env|service-account|firebase-adminsdk|\.pem$|\.fsbackup/i.test(name));
  }
  return names;
}
export async function makeProductionPackage({root=process.cwd()}={}){
  const manifest=JSON.parse(await readFile(path.join(root,'deployment/production-source.json'),'utf8'));
  const names=await productionFiles(root),destination=await mkdtemp(path.join(tmpdir(),'fantasy-reconciled-production-')),files=[];
  for(const name of names){
    const bytes=await readFile(path.join(root,name)),expected=manifest.files.find(file=>file.path===name);
    assert.equal(sha(bytes),expected.sha256,'Source differs from reviewed manifest: '+name);
    const output=path.join(destination,name);assert(output.startsWith(destination+path.sep));
    await mkdir(path.dirname(output),{recursive:true});await writeFile(output,bytes);
    files.push({path:name,sha256:sha(bytes),sha1:createHash('sha1').update(bytes).digest('hex')});
  }
  const descriptor={format:1,destination,baseline:manifest.provenance,files,sourceDigest:sha(JSON.stringify(files))};
  // Excluded by .vercelignore. It is local evidence, not an upload input.
  await writeFile(path.join(destination,'production-package.json'),JSON.stringify(descriptor,null,2)+'\n');
  return descriptor;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const descriptor=await makeProductionPackage();console.log(JSON.stringify(descriptor,null,2));
}
