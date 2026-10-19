// Explicit allowlist from CURRENT working files. No Git archive, environment files or credentials.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,mkdtemp} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('../',import.meta.url));
assert.equal(execFileSync('git',['branch','--show-current'],{cwd:source,encoding:'utf8'}).trim(),'feature/jury-mode-release-a');
// Fresh unsynced directory avoids stale files and OneDrive locking generated Next output.
const destination=process.argv[2]==='--refresh'?JSON.parse(await readFile(path.join(source,'work/jury-staging/deployment/source-manifest.json'),'utf8')).destination:await mkdtemp(path.join(os.tmpdir(),'fantasy-jury-staging-'));
assert(path.dirname(destination)===os.tmpdir()&&path.basename(destination).startsWith('fantasy-jury-staging-'),'Only the generated staging temporary directory can be refreshed.');
async function files(directory){const out=[];for(const item of await readdir(path.join(source,directory),{withFileTypes:true})){const name=directory+'/'+item.name;if(item.isSymbolicLink())throw Error('No symlinks allowed: '+name);if(item.isDirectory())out.push(...await files(name));else out.push(name);}return out;}
// This historical operational correction module is not imported by application runtime.
const selected=[...(await files('app')).filter(p=>!p.startsWith('app/acceptance/')&&/\.(tsx?|css|ico)$/.test(p)),...(await files('staging/app')).filter(p=>/\.(tsx?|css)$/.test(p)),...(await files('lib')).filter(p=>/\.ts$/.test(p)&&p!=='lib/episode4-recap-correction.ts'),...(await files('public')).filter(p=>/^public\/branding\/survivor-51-(main\.jpg|icon-(192|512)\.png)$/.test(p)),...['package.json','package-lock.json','tsconfig.json','next.config.ts','eslint.config.mjs','scripts/iphone-fixture.ts']];
const buildHash=createHash('sha256').update(await readFile(fileURLToPath(import.meta.url)));
for(const name of [...selected].sort())buildHash.update(name+'\0').update(await readFile(path.join(source,name)));
const sourceDigest=buildHash.digest('hex'),stagingBuildId='JURY-A-DIAG-'+sourceDigest.slice(0,12);
function replaceOnce(text,old,value,file){assert.equal(text.split(old).length-1,1,'Expected exactly one transform in '+file+': '+old.slice(0,60));return text.replace(old,value);}
const manifest=[];
for(const sourceName of selected){
  const name=sourceName.replace(/^staging\//,'');
  let bytes=await readFile(path.join(source,sourceName));const originalHash=createHash('sha256').update(bytes).digest('hex');
  if(/\.(tsx?|mjs|json|css)$/.test(name)){
    let text=bytes.toString('utf8');
    if(name==='app/staging/build-info.ts'){text=replaceOnce(text,'__STAGING_BUILD_ID__',stagingBuildId,name);text=replaceOnce(text,'__STAGING_SOURCE_DIGEST__',sourceDigest,name);}
    if(name==='lib/private-league-seed.ts')text=`// Synthetic-only compatibility boundary for the isolated staging package.\nimport {initialGame as publicGame,type GameState,type SeasonArchive,type Possession} from './game-data.ts';\nimport type {HistoricalResult} from './history-data.ts';\nexport const initialGame:GameState=publicGame;\nexport const historicalResults:HistoricalResult[]=[];\nexport const historicalArchives:SeasonArchive[]=[];\nexport function withHistoricalSeed(game:GameState){return game;}\nexport function migrateLegacyDraftOrder(game:GameState){return game;}\nexport function seedCurrentSeasonPossessions(seasonId:string,seasonNumber:number,existing:Possession[]|undefined){void seasonId;void seasonNumber;return existing??[];}\n`;
    if(name==='lib/community-authority.ts'){
      text=replaceOnce(text,"import {localAcceptance} from './acceptance-environment.ts';","import {requireCloudStaging,stagingCommissioner} from './staging-environment.ts';",name);
      text=replaceOnce(text,"const communityOwner='donohue.js@gmail.com';",'',name);
      text=replaceOnce(text,"export function isCommunityOwner(actor:CommunityActor){return actor.verified&&actor.email.toLowerCase()===(localAcceptance()?'commissioner@jury.test':communityOwner);}","export function isCommunityOwner(actor:CommunityActor){requireCloudStaging();return stagingCommissioner(actor);}",name);
    }
    if(name==='lib/firebase-admin.ts'){
      text=replaceOnce(text,"import {localAcceptance} from './acceptance-environment';","import {requireCloudStaging} from './staging-environment';",name);
      text=replaceOnce(text,'  localAcceptance();','  requireCloudStaging();',name);
    }
    if(name==='lib/community-auth.ts'){
      text="import {stagingRequestDatabase} from './staging-request';\n"+text;
      text=replaceOnce(text,'return {server,actor} as const;','const db=await stagingRequestDatabase(server.db,request);return {server:{...server,db},actor} as const;',name);
      text=replaceOnce(text,"}catch{return {error:communityReply({error:'Your sign-in expired. Sign out and sign in again.',code:'authentication-invalid'},401)} as const;}","}catch(error){if(error instanceof CommunityError)return {error:communityReply({error:error.message,code:error.code},error.status)} as const;return {error:communityReply({error:'Your sign-in expired. Sign out and sign in again.',code:'authentication-invalid'},401)} as const;}",name);
    }
    if(name==='app/api/scoring/route.ts'){
      text="import {stagingRequestDatabase} from '@/lib/staging-request';\nimport {CommunityError} from '@/lib/community';\n"+text;
      text=replaceOnce(text,'return {server,actor} as const;','const db=await stagingRequestDatabase(server.db,request);return {server:{...server,db},actor} as const;',name);
      text=replaceOnce(text,'if(error instanceof ScoreCorrectionError)return {error:reply','if(error instanceof CommunityError)return {error:reply({error:error.message},error.status)} as const;\n    if(error instanceof ScoreCorrectionError)return {error:reply',name);
      text=replaceOnce(text,'function failure(error:unknown){','function failure(error:unknown){\n  if(error instanceof CommunityError)return reply({error:error.message},error.status);',name);
    }
    if(name==='app/api/league/route.ts')text=replaceOnce(text,"if(!snapshot.exists&&!isCommunityOwner(auth.actor))","if(!snapshot.exists)",name);
    if(name==='app/game-provider.tsx'){
      text=replaceOnce(text,"'use client';","'use client';\nimport '@/lib/staging-fetch';\nimport {stagingCommissioner} from '@/lib/staging-environment';",name);
      text=replaceOnce(text,'  const isAdmin = localSetup || commissionerAccessForAccount(user,accessState);',"  const isAdmin = commissionerAccessForAccount(user,accessState)&&Boolean(user&&stagingCommissioner({uid:user.uid,email:user.email??'',verified:user.emailVerified}));",name);
      text=replaceOnce(text,'{children}</GameContext.Provider>','<span hidden data-staging-provider-diagnostics="true" data-user-uid={user?.uid??\'\'} data-access-uid={accessState.uid} data-access-status={accessState.status} data-server-commissioner={String(accessState.commissioner??false)} data-is-admin={String(isAdmin)}/>{children}</GameContext.Provider>',name);
      text=replaceOnce(text,"    if(process.env.NEXT_PUBLIC_LOCAL_ACCEPTANCE==='1')","    if(process.env.NEXT_PUBLIC_JURY_STAGING==='1'){window.location.assign('/staging');return;}\n    if(process.env.NEXT_PUBLIC_LOCAL_ACCEPTANCE==='1')",name);
    }
    if(name==='app/site-header.tsx'){
      text=replaceOnce(text,'<header className="site-header">','<header className="site-header" data-staging-component="SiteHeader" data-staging-is-admin={String(isAdmin)} data-staging-user-uid={user?.uid??\'\'}>',name);
      text=replaceOnce(text,'<Link key={href} href={href}','<Link key={href} href={href} data-staging-nav-source={href===\'/admin\'?\'SiteHeader:GameMaster\':undefined}',name);
    }
    if(name==='app/league-gate.tsx')text=replaceOnce(text,"path==='/rules'","(path==='/staging'&&process.env.NEXT_PUBLIC_JURY_STAGING==='1')||path==='/rules'",name);
    if(name==='app/auth-controls.tsx')text=text.replaceAll('Sign in with Google','Synthetic sign-in');
    if(name==='app/layout.tsx'){
      text="import {StagingOperatorProvider} from './staging/operator-navigation';\n"+text;
      text=replaceOnce(text,'<GameProvider><CommunityPollProvider>','<GameProvider><StagingOperatorProvider><CommunityPollProvider>',name);
      text=replaceOnce(text,'</CommunityPollProvider></GameProvider>','</CommunityPollProvider></StagingOperatorProvider></GameProvider>',name);
    }
    if(name==='next.config.ts')text=replaceOnce(text,'const nextConfig: NextConfig = {','const nextConfig: NextConfig = {\n  outputFileTracingRoot:process.cwd(),\n  async headers(){return [{source:"/:path*",headers:[{key:"X-Jury-Staging-Build",value:'+JSON.stringify(stagingBuildId)+'}]}];},',name);
    if(name==='lib/discussion-store.ts'){
      text=replaceOnce(text,"await ref.set({migrationUntil:''},{merge:true});","await this.db.runTransaction(async tx=>{tx.set(ref,{migrationUntil:''},{merge:true});});",name);
      text=replaceOnce(text,'await this.user().set({hideSpoilers:input.hideSpoilers},{merge:true});','await this.db.runTransaction(async tx=>{tx.set(this.user(),{hideSpoilers:input.hideSpoilers},{merge:true});});',name);
      text=replaceOnce(text,'await this.user().collection(\'episodes\').doc(episode.id).set({watched:input.watched});','await this.db.runTransaction(async tx=>{tx.set(this.user().collection(\'episodes\').doc(episode.id),{watched:input.watched});});',name);
    }
    // Deny real league seed identifiers/configuration in every text input, including server sources.
    for(const forbidden of ['donohue.js@gmail.com','fantasy-survivor-9da59','fantasy-survivor-preview','possession-final-five-idol-rob','possession-final-five-idol-jelly','player-chad','player-jackie','338.2083333333333','-----BEGIN PRIVATE KEY-----','AIzaSyAPYRLjEdB4Qu4kXH2Y1zxy0DIUN4WgAk8'])assert(!text.includes(forbidden),'Forbidden content in '+name+': '+forbidden);
    bytes=Buffer.from(text);
  }
  const target=path.join(destination,name);assert(target.startsWith(destination+path.sep));await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes);
  manifest.push({path:name,sourcePath:sourceName,sourceSha256:originalHash,packagedSha256:createHash('sha256').update(bytes).digest('hex'),transformed:originalHash!==createHash('sha256').update(bytes).digest('hex')});
}
await writeFile(path.join(destination,'.vercelignore'),'node_modules\n.next\n.vercel\n.env*\n');
await mkdir(path.join(destination,'.vercel'),{recursive:true});await writeFile(path.join(destination,'.vercel/project.json'),JSON.stringify({projectId:'prj_QHqT5XrfpsbdSKO3CavYwe7C7bcG',orgId:'team_n5VDA1nwqjDaz8BuCbsBlORz',projectName:'fantasy-survivor-jury-staging'}));
await writeFile(path.join(source,'work/jury-staging/deployment/source-manifest.json'),JSON.stringify({branch:'feature/jury-mode-release-a',destination,build:{id:stagingBuildId,sourceDigest},files:manifest},null,2));
console.log(JSON.stringify({destination,buildId:stagingBuildId,files:manifest.length,transformed:manifest.filter(f=>f.transformed).map(f=>f.path),credentialsIncluded:false}));
