// Review-only source package. Never deploys, changes Firebase, or promotes an alias.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {productionFiles} from './package-production.mjs';

const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const modified=['app/game-provider.tsx','lib/firebase.ts','next.config.ts','vercel.json'];
const added=['lib/pwa-auth.ts'];

export async function inspectIosAuthCandidate(root=process.cwd()){
  const baseline=JSON.parse(await readFile(path.join(root,'deployment/production-source.json'),'utf8'));
  const candidate=JSON.parse(await readFile(path.join(root,'deployment/ios-pwa-auth-candidate.json'),'utf8'));
  assert.equal(candidate.format,1);
  assert.equal(candidate.status,'review-only');
  assert.equal(candidate.baselineDeployment,baseline.provenance.deployment);
  assert.deepEqual(Object.keys(candidate.modified).sort(),modified);
  assert.deepEqual(Object.keys(candidate.added).sort(),added);

  const originalPaths=await productionFiles(root);
  const original=new Map(baseline.files.map(file=>[file.path,file.sha256]));
  assert.deepEqual(originalPaths,[...original.keys()]);
  for(const name of modified){
    assert(original.has(name),'Modified input not present in protected release: '+name);
    assert.notEqual(candidate.modified[name],original.get(name),'Changed input unexpectedly matches protected release: '+name);
  }
  for(const name of added)assert(!original.has(name),'New input already present in protected release: '+name);

  const files=[];
  for(const name of [...originalPaths,...added]){
    const bytes=await readFile(path.join(root,name));
    const expected=candidate.modified[name]??candidate.added[name]??original.get(name);
    assert.equal(sha256(bytes),expected,'Unreviewed change to production input: '+name);
    files.push({path:name,sha256:expected,sha1:createHash('sha1').update(bytes).digest('hex')});
  }
  return {
    status:'review-only',baselineDeployment:baseline.provenance.deployment,
    changedInputs:modified,newInputs:added,files,sourceDigest:sha256(JSON.stringify(files)),
  };
}

export async function makeIosAuthCandidatePackage(root=process.cwd()){
  const inspected=await inspectIosAuthCandidate(root);
  const destination=await mkdtemp(path.join(tmpdir(),'fantasy-ios-auth-review-'));
  for(const file of inspected.files){
    const bytes=await readFile(path.join(root,file.path));
    assert.equal(sha256(bytes),file.sha256,'Source changed during packaging: '+file.path);
    const output=path.join(destination,file.path);
    assert(output.startsWith(destination+path.sep));
    await mkdir(path.dirname(output),{recursive:true});
    await writeFile(output,bytes);
  }
  const descriptor={...inspected,destination};
  // The source package's .vercelignore excludes this local review descriptor.
  await writeFile(path.join(destination,'production-package.json'),JSON.stringify(descriptor,null,2)+'\n');
  return descriptor;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const packaged=process.argv.includes('--package');
  const result=packaged?await makeIosAuthCandidatePackage():await inspectIosAuthCandidate();
  console.log(JSON.stringify({status:result.status,baselineDeployment:result.baselineDeployment,sourceDigest:result.sourceDigest,productionInputs:result.files.length,changedInputs:result.changedInputs,newInputs:result.newInputs,...(packaged?{destination:result.destination}:{})},null,2));
}
