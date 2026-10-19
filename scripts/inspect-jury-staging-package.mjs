import assert from 'node:assert/strict';import {readFile,readdir,writeFile} from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
const base='work/jury-staging/deployment',manifest=JSON.parse(await readFile(base+'/source-manifest.json','utf8')),root=manifest.destination;
assert(path.basename(root).startsWith('fantasy-jury-staging-'));const allowed=new Set(manifest.files.map(f=>f.path));
for(const item of manifest.files){const bytes=await readFile(path.join(root,item.path));assert.equal(createHash('sha256').update(bytes).digest('hex'),item.packagedSha256,'Packaged input changed: '+item.path);}
const credentials=JSON.parse(await readFile(base+'/synthetic-credentials.json','utf8'));
const forbidden=['donohue.js@gmail.com','fantasy-survivor-9da59','fantasy-survivor-preview','possession-final-five-idol-rob','possession-final-five-idol-jelly','player-chad','player-jackie','player-zoda','338.2083333333333','-----BEGIN PRIVATE KEY-----',...Object.values(credentials).map(v=>v.password)];
const environment=JSON.parse(await readFile(base+'/vercel-env-input.json','utf8'));const operatorSecret=environment.find(value=>value.key==='STAGING_OPERATOR_SECRET')?.value;if(operatorSecret)forbidden.push(operatorSecret);
const checked=[];async function walk(directory,relative=''){for(const item of await readdir(directory,{withFileTypes:true})){const name=relative?relative+'/'+item.name:item.name;if(name==='node_modules'||name==='.next/cache')continue;const target=path.join(directory,item.name);assert(!item.isSymbolicLink(),'Unexpected symlink: '+name);if(item.isDirectory())await walk(target,name);else{
  assert(!name.startsWith('.env'),'Environment file in deployment directory');
  if(!name.startsWith('.next/')&&!name.startsWith('.vercel/'))assert(allowed.has(name)||['.vercelignore','next-env.d.ts'].includes(name),'Unexpected upload input: '+name);
  const bytes=await readFile(target);for(const value of forbidden)assert(!bytes.includes(Buffer.from(value)),'Forbidden content in '+name);checked.push(name);
}}}
await walk(root);assert(checked.some(p=>p.startsWith('.next/server/'))&&checked.some(p=>p.startsWith('.next/static/')),'Production build required.');
const maps=checked.filter(p=>p.startsWith('.next/static/')&&p.endsWith('.map'));assert.equal(maps.length,0,'Public browser source map found.');
await writeFile(base+'/package-inspection.json',JSON.stringify({directory:root,sourceFiles:manifest.files.length,filesInspected:checked.length,publicSourceMaps:maps.length,forbiddenMatches:0,credentialValuesPrinted:false},null,2));console.log(JSON.stringify({sourceFiles:manifest.files.length,filesInspected:checked.length,publicSourceMaps:0,forbiddenMatches:0}));
