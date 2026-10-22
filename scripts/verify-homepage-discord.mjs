// Loopback-only browser regression using the real homepage, access gate and game
// provider. Firebase callbacks and HTTP responses use synthetic data; no cloud writes.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {homedir} from 'node:os';
import path from 'node:path';
import {acceptanceGame} from './iphone-fixture.ts';

const require=createRequire(import.meta.url),root=process.cwd();
const engine=process.env.UI_BROWSER_ENGINE??'chromium';
assert(['chromium','webkit'].includes(engine));
const dir=path.resolve('work/discord-homepage',engine);
await mkdir(dir,{recursive:true});
const generated=(name,source)=>writeFile(path.join(dir,name),'// @ts-nocheck — generated browser-test fixture\n'+source);
await generated('loader.cjs',`module.exports=source=>require(${JSON.stringify(require.resolve('typescript'))}).transpileModule(source,{compilerOptions:{jsx:4,module:99,target:9}}).outputText;`);
await generated('css.cjs','module.exports=()=>\'export default {invite:"discord-invite"};\';');
await generated('firebase.ts',`
export const firebaseConfigured=true,missingFirebaseSettings=[];
const listeners=new Set();const auth={currentUser:null};let finish;
export const getFirebase=()=>({auth});
export const authenticationError=error=>error.message;
export function subscribe(callback){listeners.add(callback);return()=>listeners.delete(callback);}
export function select(role){auth.currentUser=role==='signed-out'?null:{uid:'discord-'+role,email:role+'@jury.test',emailVerified:true,displayName:'Synthetic '+role,getIdToken:async()=>role};for(const callback of listeners)callback(auth.currentUser);}
export function signOut(){return new Promise(resolve=>{finish=()=>{select('signed-out');resolve();};});}
export function finishSignOut(){finish?.();}
`);
await generated('auth.ts',`import {subscribe,signOut as logout} from './firebase';export const onAuthStateChanged=(_auth,callback)=>subscribe(callback);export const signOut=logout;export const signInWithPopup=()=>{throw Error('Not used');};export class GoogleAuthProvider{setCustomParameters(){}}`);
await generated('next.tsx',`import React from 'react';export const usePathname=()=>'/';export function Link({children,...props}){return <a {...props}>{children}</a>;}export function Image({priority,...props}){return <img {...props}/>;}`);
await generated('hooks.tsx',`export const useCurrentSeasonOpenPolls=()=>({rows:[]});export const useDiscussions=()=>({unreadCount:0});export const CampfireCommentary=()=>null;`);
await generated('entry.tsx',`
import React from 'react';import {createRoot} from 'react-dom/client';
import Home from ${JSON.stringify(path.join(root,'app/page.tsx'))};
import {GameProvider,useGame} from ${JSON.stringify(path.join(root,'app/game-provider.tsx'))};
import {LeagueGate} from ${JSON.stringify(path.join(root,'app/league-gate.tsx'))};
import {select,finishSignOut} from './firebase';
function Controls(){const {user,leagueAccess,authLoading,authBusy}=useGame();return <aside aria-label="Test controls"><output id="state">{authLoading?'auth-loading':(user?.uid??'signed-out')+':'+leagueAccess+':'+authBusy}</output>{['signed-out','active','commissioner','legacy','unlinked','commissioner-unlinked','wrong-uid','inactive','error'].map(role=><button key={role} data-role={role} onClick={()=>select(role)}>{role}</button>)}<button id="finish-sign-out" onClick={finishSignOut}>Finish sign out</button></aside>;}
createRoot(document.getElementById('root')).render(<GameProvider><Controls/><LeagueGate><Home/></LeagueGate></GameProvider>);
`);
const webpack=require('next/dist/compiled/webpack/webpack').webpack;
const compiler=webpack({mode:'development',devtool:false,target:'web',entry:path.join(dir,'entry.tsx'),output:{path:dir,filename:'browser.js'},resolve:{extensions:['.ts','.tsx','.js'],alias:{'@/lib/firebase':path.join(dir,'firebase.ts'),'firebase/auth':path.join(dir,'auth.ts'),'@':root},modules:[path.join(root,'node_modules'),'node_modules']},module:{rules:[{test:/\.tsx?$/,use:path.join(dir,'loader.cjs')},{test:/\.module\.css$/,use:path.join(dir,'css.cjs')}]},plugins:[new webpack.DefinePlugin({'process.env.NODE_ENV':JSON.stringify('production')}),new webpack.NormalModuleReplacementPlugin(/^next\/(link|image|navigation)$/,resource=>{const part=resource.request.split('/')[1];resource.request=path.join(dir,part+'.tsx');}),new webpack.NormalModuleReplacementPlugin(/(?:community-polls|discussion-provider|discussion-content)(?:\.tsx)?$/,path.join(dir,'hooks.tsx'))],stats:'errors-only'});
for(const [name,exportName] of [['link','Link'],['image','Image'],['navigation',null]])await generated(name+'.tsx',exportName?`export {${exportName} as default} from './next';`:`export {usePathname} from './next';`);
try{await new Promise((resolve,reject)=>compiler.run((error,stats)=>error?reject(error):stats.hasErrors()?reject(Error(stats.toString('errors-only'))):resolve()));}finally{await new Promise((resolve,reject)=>compiler.close(error=>error?reject(error):resolve()));}

const game=acceptanceGame();
game.players.forEach(player=>{if(player.uid)player.uid=player.uid.replace('iphone-','discord-');});
game.players.push({...game.players[2],id:'synthetic-commissioner',name:'Synthetic Commissioner',uid:'discord-commissioner',email:'commissioner@jury.test'});
game.players.push({...game.players[2],id:'synthetic-wrong-uid',uid:'another-account',email:'wrong-uid@jury.test'});
game.players.push({...game.players[2],id:'synthetic-inactive',uid:'discord-inactive',email:'inactive@jury.test',active:false});
const holds=new Set(),pending=new Map(),holdNotices=new Map(),requests=[],errors=[],checks=[];
function holdProfile(role){holds.add(role);return new Promise(resolve=>holdNotices.set(role,resolve));}
const server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/browser.js'){res.setHeader('Content-Type','text/javascript');res.end(await readFile(path.join(dir,'browser.js')));return;}
  if(url.pathname==='/styles.css'){res.setHeader('Content-Type','text/css');res.end(await readFile('app/globals.css','utf8')+'\n'+(await readFile('app/discord-invite.module.css','utf8')).replaceAll('.invite','.discord-invite'));return;}
  if(url.pathname.startsWith('/branding/')){const file=path.join(root,'public',url.pathname);res.setHeader('Content-Type',file.endsWith('.svg')?'image/svg+xml':'image/jpeg');res.end(await readFile(file));return;}
  if(url.pathname.startsWith('/api/')){
    const role=req.headers.authorization?.slice(7);requests.push({path:url.pathname,method:req.method,role});res.setHeader('Content-Type','application/json');
    if(url.pathname==='/api/league'){
      const reply=()=>{res.statusCode=role==='unlinked'?403:role==='error'?500:200;res.end(JSON.stringify(res.statusCode!==200?{error:'Synthetic access failure'}:{game,commissioner:role?.startsWith('commissioner')}));};
      if(holds.has(role)){pending.set(role,reply);holdNotices.get(role)?.();holdNotices.delete(role);}else reply();return;
    }
    if(url.pathname==='/api/registration'){res.end(JSON.stringify(req.method==='GET'?{rows:[]}:{signup:{uid:'discord-'+role,name:'Synthetic '+role,email:role+'@jury.test',createdAt:'2026-10-21T12:00:00Z'}}));return;}
    res.statusCode=404;res.end('{}');return;
  }
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/browser.js"></script></body></html>');
}catch(error){res.statusCode=500;res.end(error.message);}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const playwrightPackage=process.env.PLAYWRIGHT_PACKAGE_PATH??path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const engines=createRequire(playwrightPackage)('playwright');let browser;
async function check(name,run){await run();checks.push(name);console.log('PASS '+name);}
try{
  browser=await engines[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  for(const viewport of [{width:320,height:844},{width:390,height:844},{width:1440,height:1000}]){
    const context=await browser.newContext({viewport}),page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base);const invite=page.getByRole('link',{name:'Join us on our Discord (opens in a new tab)',exact:true});
    const absent=async()=>assert.equal(await invite.count(),0);
    const choose=async(role,status='authorized')=>{await page.locator(`[data-role="${role}"]`).click();await page.locator('#state').filter({hasText:role==='signed-out'?'signed-out:signed-out:false':`discord-${role}:${status}:false`}).waitFor();};
    const size=viewport.width+'px';
    await check(size+' hides invite during authentication initialization',async()=>{await page.locator('#state').filter({hasText:'auth-loading'}).waitFor();await absent();});
    await check(size+' signed-out login screen has no invite',async()=>{await choose('signed-out');await page.getByRole('heading',{name:'Sign in to your league.'}).waitFor();await absent();});
    for(const role of ['active','commissioner']){
      await check(size+' '+role+' profile loading stays hidden',async()=>{const held=holdProfile(role);await choose(role,'loading');await held;await page.getByText('Loading your league…').waitFor();await absent();holds.delete(role);pending.get(role)();pending.delete(role);});
      await check(size+' '+role+' sees accessible official Discord button',async()=>{
        await invite.waitFor();assert.equal(await invite.getAttribute('href'),'https://discord.gg/PweZ7dNTYZ');assert.equal(await invite.getAttribute('target'),'_blank');assert.equal(await invite.getAttribute('rel'),'noopener noreferrer');assert.equal(await invite.innerText(),'Join us on our Discord');
        const image=invite.locator('img');assert.equal(await image.getAttribute('src'),'/branding/discord-clyde-white.svg');assert.equal(await image.getAttribute('alt'),'');assert(await image.evaluate(img=>img.complete&&img.naturalWidth>0));
        assert.equal(await invite.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(88, 101, 242)');assert.equal(await invite.evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)');
        const box=await invite.boundingBox();assert(box.height>=44&&box.x>=0&&box.x+box.width<=viewport.width);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await invite.locator('span').evaluate(el=>el.scrollWidth>el.clientWidth),false);
        await invite.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');assert.equal(await invite.evaluate(el=>el.matches(':focus-visible')),true);assert.equal(await invite.evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
        await page.screenshot({path:path.join(dir,`${role}-${size}.png`),fullPage:true});
      });
      await check(size+' '+role+' invite opens correct URL in a separate tab',async()=>{await context.route('https://discord.gg/**',route=>route.fulfill({body:'Synthetic Discord destination'}));const popupPromise=context.waitForEvent('page');await invite.click();const popup=await popupPromise;await popup.waitForLoadState();assert.equal(popup.url(),'https://discord.gg/PweZ7dNTYZ');assert.equal(await popup.evaluate(()=>window.opener===null),true);assert.equal(page.url(),base+'/');await popup.close();});
      await check(size+' '+role+' sign-out removes invite before auth completes',async()=>{await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.locator('#state').filter({hasText:`discord-${role}:authorized:true`}).waitFor();await absent();await page.locator('#finish-sign-out').click();await page.getByRole('heading',{name:'Sign in to your league.'}).waitFor();await absent();});
    }
    await check(size+' legacy email-linked player sees invite',async()=>{await choose('legacy');await invite.waitFor();});
    for(const [role,status] of [['unlinked','unlinked'],['commissioner-unlinked','authorized'],['wrong-uid','authorized'],['inactive','authorized'],['error','error']])await check(size+' '+role+' has no invite',async()=>{await choose(role,status);await absent();});
    await check(size+' late profile response after sign-out cannot restore invite',async()=>{const held=holdProfile('active');await choose('active','loading');await held;await choose('signed-out');holds.delete('active');pending.get('active')();pending.delete('active');await page.waitForLoadState('networkidle');await page.getByRole('heading',{name:'Sign in to your league.'}).waitFor();await absent();});
    await page.screenshot({path:path.join(dir,`signed-out-${size}.png`),fullPage:true});await context.close();
  }
  await check('no browser errors or game mutation requests',async()=>{assert.deepEqual(errors,[]);assert(requests.every(request=>request.method==='GET'||request.path==='/api/registration'&&request.method==='POST'));});
  await writeFile(path.join(dir,'results.json'),JSON.stringify({engine,checks,requests,errors},null,2));
  console.log(`${checks.length} checks passed (${engine}).`);
}finally{for(const reply of pending.values())reply();await browser?.close();await new Promise(resolve=>server.close(resolve));}
