// Local browser harness: real React providers/header, synthetic auth callbacks and
// an in-memory HTTP backend. No cloud credentials, users or documents are written.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import path from 'node:path';
import {acceptanceGame} from './iphone-fixture.ts';
const require=createRequire(import.meta.url),webpack=require('next/dist/compiled/webpack/webpack').webpack;
const engine=process.env.UI_BROWSER_ENGINE??'chromium';assert(['chromium','webkit'].includes(engine));
const root=process.cwd(),dir=path.resolve('work/jury-navigation-fix/harness'+(engine==='chromium'?'':'-'+engine)),baseline=process.argv.includes('--baseline');
await mkdir(dir,{recursive:true});
const generated=(file,text)=>writeFile(file,'// @ts-nocheck — generated browser-test fixture\n'+text);
const manifest=JSON.parse(await readFile('work/jury-staging/deployment/source-manifest.json','utf8'));
assert(path.basename(manifest.destination).startsWith('fantasy-jury-staging-'));
let provider=await readFile(path.join(manifest.destination,'app/game-provider.tsx'),'utf8');
assert(provider.includes('stagingCommissioner({uid:user.uid'));
provider=provider.replace("from './league-client'",'from '+JSON.stringify(path.join(root,'app/league-client.ts')));
if(baseline){
  provider=provider.replace("commissionerAccessForAccount(user,accessState)&&Boolean(user&&stagingCommissioner({uid:user.uid,email:user.email??'',verified:user.emailVerified}))","Boolean(user?.emailVerified&&accessState.uid===user.uid&&accessState.commissioner)");
  provider=provider.replace("setAccessState({uid:nextUser?.uid??'',status:nextUser?'loading':'signed-out',error:''});",'');
  assert(provider.includes('const isAdmin = Boolean(user?.emailVerified&&accessState.uid===user.uid&&accessState.commissioner)'));
}
await generated(path.join(dir,'provider.tsx'),provider);
await generated(path.join(dir,'loader.cjs'),`module.exports=function(source){return require(${JSON.stringify(require.resolve('typescript'))}).transpileModule(source,{compilerOptions:{jsx:4,module:99,target:9}}).outputText;};`);
await generated(path.join(dir,'firebase.ts'),`export const firebaseConfigured=true,missingFirebaseSettings=[];const listeners=new Set();const auth={currentUser:null};export function getFirebase(){return {auth};}export function authenticationError(error){return error.message;}export function subscribe(callback){listeners.add(callback);callback(auth.currentUser);return()=>listeners.delete(callback);}export async function select(role){auth.currentUser=null;for(const cb of listeners)cb(null);await Promise.resolve();auth.currentUser={uid:'staging-'+role,email:role+'@jury.test',emailVerified:true,displayName:'Synthetic '+role,getIdToken:async()=>role};for(const cb of listeners)cb(auth.currentUser);}`);
await generated(path.join(dir,'auth.ts'),`import {subscribe,select} from './firebase';export const onAuthStateChanged=(_auth,cb)=>subscribe(cb);export const signOut=()=>select('signed-out');export const signInWithPopup=()=>{throw Error('Not used by this test');};export class GoogleAuthProvider{setCustomParameters(){}}`);
await generated(path.join(dir,'empty.ts'),'export {};');
await generated(path.join(dir,'hooks.ts'),'export const useCurrentSeasonOpenPolls=()=>({rows:[]});export const useDiscussions=()=>({unreadCount:0});');
await generated(path.join(dir,'link.tsx'),`import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>;}`);
await generated(path.join(dir,'entry.tsx'),`import React from 'react';import {createRoot} from 'react-dom/client';import {GameProvider,useGame} from './provider';import {SiteHeader} from ${JSON.stringify(path.join(root,'app/site-header.tsx'))};import {StagingOperatorProvider,useStagingOperator} from ${JSON.stringify(path.join(root,'staging/app/staging/operator-navigation.tsx'))};import {select} from './firebase';function Controls(){const {user,isAdmin,leagueAccess}=useGame(),{refresh}=useStagingOperator();return <><output id="identity">{user?.uid??'signed-out'}:{String(isAdmin)}</output><output id="access">{user?.uid??'signed-out'}:{leagueAccess}</output>{['commissioner','active','jury','complete','legacy','unlinked'].map(role=><button key={role} data-role={role} onClick={()=>void select(role)}>{role}</button>)}<button id="refresh-operator" onClick={()=>void refresh()}>Refresh operator</button></>;}createRoot(document.getElementById('root')).render(<GameProvider><StagingOperatorProvider><SiteHeader active="/" subtitle="Navigation regression"/><Controls/></StagingOperatorProvider></GameProvider>);`);
const compiler=webpack({mode:'development',devtool:false,target:'web',entry:path.join(dir,'entry.tsx'),output:{path:dir,filename:'browser.js'},resolve:{extensions:['.ts','.tsx','.js'],alias:{'@/lib/firebase':path.join(dir,'firebase.ts'),'@/lib/staging-fetch':path.join(dir,'empty.ts'),'firebase/auth':path.join(dir,'auth.ts'),'next/link':path.join(dir,'link.tsx'),'@':root},modules:[path.join(root,'node_modules'),'node_modules']},module:{rules:[{test:/\.tsx?$/,use:path.join(dir,'loader.cjs')},{test:/\.css$/,type:'asset/source'}]},plugins:[new webpack.DefinePlugin({'process.env.NODE_ENV':JSON.stringify('production'),'process.env.NEXT_PUBLIC_JURY_STAGING':JSON.stringify('1')}),new webpack.NormalModuleReplacementPlugin(/(?:^|\/)game-provider(?:\.tsx)?$/,path.join(dir,'provider.tsx')),new webpack.NormalModuleReplacementPlugin(/(?:community-polls|discussion-provider)(?:\.tsx)?$/,path.join(dir,'hooks.ts'))],stats:'errors-only'});
await new Promise((resolve,reject)=>compiler.run((error,stats)=>error?reject(error):stats.hasErrors()?reject(Error(stats.toString('errors-only'))):resolve()));
await new Promise((resolve,reject)=>compiler.close(error=>error?reject(error):resolve()));
const game=acceptanceGame();game.players.forEach(player=>{if(player.uid)player.uid=player.uid.replace('iphone-','staging-');});
let forcedGrant=false,operator=true,holdCommissioner=false;
const server=createServer(async(req,res)=>{try{
  if(req.url==='/browser.js'){res.setHeader('Content-Type','text/javascript');res.end(await readFile(path.join(dir,'browser.js')));return;}
  if(req.url==='/api/staging/operator'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({operator,version:10}));return;}
  if(req.url==='/api/league'){
    const role=req.headers.authorization?.slice(7);if(holdCommissioner&&role==='commissioner')await new Promise(resolve=>setTimeout(resolve,600));
    res.statusCode=role==='unlinked'?403:200;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(role==='unlinked'?{error:'No active league profile.'}:{game,commissioner:forcedGrant||role==='commissioner'}));return;
  }
  if(req.url==='/api/registration'){const role=req.headers.authorization?.slice(7);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.method==='GET'?{rows:[]}:{signup:{uid:'staging-'+role,email:role+'@jury.test',name:'Synthetic '+role,createdAt:'2026-10-17T12:00:00Z'}}));return;}
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><div id="root"></div><script src="/browser.js"></script>');
}catch(error){res.statusCode=500;res.end(error.message);}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port,checks=[],errors=[];
const engines=createRequire('C:/Users/donoh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
let browser;async function check(name,run){try{await run();checks.push({name,passed:true});console.log('PASS '+name);}catch(error){checks.push({name,passed:false,error:error.message});console.log('FAIL '+name+': '+error.message);}}
try{
  browser=await engines[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));let navigations=0;page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations++;});await page.goto(base);await page.locator('#identity').waitFor();const initialNavigations=navigations;
  async function choose(role,admin=role==='commissioner'){await page.locator('[data-role="'+role+'"]').click();await page.locator('#access').filter({hasText:'staging-'+role+':'+(role==='unlinked'?'unlinked':'authorized')}).waitFor({timeout:4000});assert.equal(await page.locator('#identity').innerText(),'staging-'+role+':'+admin);assert.equal(await page.locator('nav a[href="/admin"]').count(),admin?1:0);assert.equal(navigations,initialNavigations,'Unexpected full-page navigation');}
  await check('actual Commissioner navigation with operator controls',async()=>{await choose('commissioner');await page.getByRole('link',{name:'Staging Controls',exact:true}).waitFor();});
  for(const role of ['active','jury','complete','legacy','unlinked']){
    await check('Commissioner -> '+role+' drops Game Master without reload; operator controls stay',async()=>{await choose(role);assert.equal(await page.getByRole('link',{name:'Staging Controls',exact:true}).count(),1);});
    await check(role+' -> Commissioner restores only actual player authority without reload',async()=>choose('commissioner'));
  }
  forcedGrant=true;
  for(const role of ['active','jury','complete','legacy'])await check(role+' rejects stale/misassigned commissioner metadata while operator remains valid',async()=>{await choose(role);assert.equal(await page.getByRole('link',{name:'Staging Controls',exact:true}).count(),1);});
  forcedGrant=false;holdCommissioner=true;
  await check('late Commissioner response cannot restore its grant after switching to Active',async()=>{await page.locator('[data-role="commissioner"]').click();await page.locator('#identity').filter({hasText:'staging-commissioner:false'}).waitFor();await choose('active');await page.waitForTimeout(800);assert.equal(await page.locator('nav a[href="/admin"]').count(),0);});holdCommissioner=false;
  await check('Commissioner privilege does not require the separate operator grant',async()=>{operator=false;await page.locator('#refresh-operator').click();await page.getByRole('link',{name:'Staging Controls',exact:true}).waitFor({state:'hidden'});await choose('commissioner');});
  await check('no uncaught browser errors',async()=>assert.deepEqual(errors,[]));
  await page.screenshot({path:path.join(dir,baseline?'baseline.jpg':'verified.jpg'),fullPage:true});
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
const failed=checks.filter(check=>!check.passed).length;
await writeFile(path.resolve('work/jury-navigation-fix/'+(engine==='chromium'?'':engine+'-')+(baseline?'browser-baseline.json':'browser-results.json')),JSON.stringify({engine,baseline,passed:checks.length-failed,failed,checks,cloudWrites:0,pageReloads:0},null,2));
console.log(JSON.stringify({baseline,passed:checks.length-failed,failed,cloudWrites:0}));if(failed)process.exitCode=1;
