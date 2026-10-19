// Local Chrome audit. No external network requests or production credentials.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {initialGame,historicalResults} from '../lib/private-league-seed.ts';
const base='http://127.0.0.1:3107',results=[];
const privateMarkers=[...new Set(historicalResults.map(r=>r.profileId)),'donohue.js@gmail.com','338.2083333333333','336.0833333333333','possession-final-five-idol-rob','possession-final-five-idol-jelly','PRIVATE_GM_EVIDENCE_MARKER'];
function assertPublic(text,path){for(const marker of privateMarkers)assert(!text.includes(marker),`${path}: private marker ${marker}`);}
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE??'C:/Users/donoh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
async function check(name,fn){try{const detail=await fn();results.push({name,passed:true,...detail});console.log('PASS '+name);}catch(e){results.push({name,passed:false,error:e.message});console.log('FAIL '+name+': '+e.message);}}
try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await context.newPage(),scripts=new Set();page.on('response',r=>{if(r.url().includes('/_next/static/')&&r.url().endsWith('.js'))scripts.add(r.url());});
  for(const path of ['/','/draft','/episodes','/chatter','/history','/jury'])await check(`anonymous production navigation ${path}`,async()=>{await page.goto(base+path);await page.getByRole('heading',{name:'Sign in to your league.'}).waitFor();assert.equal(await page.locator('#jury-q1').count(),0);});
  await check('public original cast and rules remain accessible',async()=>{await page.goto(base+'/castaways');await page.getByRole('heading',{name:'Meet the original cast.'}).waitFor();assert.equal(await page.locator('.castaway-card').count(),21);assert.equal(await page.locator('.castaway-leaderboard').count(),0);await page.goto(base+'/rules');await page.getByRole('heading',{name:'Every move has a price.'}).waitFor();});
  await check('public production JavaScript omits private historical scores and player order',async()=>{const leaked=[];for(const url of scripts){const body=await (await context.request.get(url)).text();if(body.includes('338.2083333333333')||body.includes('"Chad","Jennie","Joey","Ross"'))leaked.push(url.replace(base,''));}assert.deepEqual(leaked,[]);return {assetsInspected:scripts.size};});
  await page.evaluate(g=>{g.categories.push({id:'private-cache-marker',label:'PRIVATE_CACHE_LEAGUE_MARKER',points:777,group:'Private custom rules'});g.draft.status='live';localStorage.setItem('fantasy-survivor-51-game',JSON.stringify(g));},structuredClone(initialGame));
  await check('production missing-config public rules ignore old local league cache',async()=>{await page.reload();await page.getByRole('heading',{name:'Every move has a price.'}).waitFor();await page.waitForTimeout(500);assert(!(await page.locator('body').innerText()).includes('PRIVATE_CACHE_LEAGUE_MARKER'));});
  await check('no service worker caches private league responses',async()=>{const state=await page.evaluate(async()=>({workers:'serviceWorker' in navigator?(await navigator.serviceWorker.getRegistrations()).length:0,caches:'caches' in window?await caches.keys():[]}));assert.deepEqual(state,{workers:0,caches:[]});});
  // Inspect build assets too: route chunks need not be requested by this particular browser session.
  await check('all build assets omit private historical seed',async()=>{const {readdirSync}=await import('node:fs');const files=readdirSync('.next/static/chunks',{recursive:true}).filter(f=>f.endsWith('.js'));const leaked=files.filter(f=>{const text=readFileSync('.next/static/chunks/'+f,'utf8');return text.includes('338.2083333333333')||text.includes('"Chad","Jennie","Joey","Ross"');});assert.deepEqual(leaked,[]);});
  await check('anonymous downloads of every generated public text asset exclude private data',async()=>{
    const paths=readdirSync('.next/static',{recursive:true}).map(String).filter(p=>/\.(js|json|map|css|txt)$/.test(p)).map(p=>'/_next/static/'+p.replaceAll('\\','/'));
    for(const path of paths){const response=await context.request.get(base+path);assert.equal(response.status(),200,path);assertPublic(await response.text(),path);}return {assetsDownloaded:paths.length};
  });
  await check('public HTML, RSC, manifests and original assets contain no private seed',async()=>{
    for(const path of ['/','/rules','/castaways','/history','/admin','/jury','/manifest.webmanifest']){const response=await context.request.get(base+path);assert.equal(response.status(),200);assertPublic(await response.text(),path);if(!path.endsWith('webmanifest')){const rsc=await context.request.get(base+path+'?_rsc=audit',{headers:{RSC:'1'}});assertPublic(await rsc.text(),path+' RSC');}}
    for(const path of readdirSync('public',{recursive:true}).map(String).filter(p=>/\.(js|json|map|html|css|txt|csv|ts|svg)$/.test(p)))assertPublic(readFileSync('public/'+path,'utf8'),'public/'+path);
    for(const path of readdirSync('.next/server/app',{recursive:true}).map(String).filter(p=>/\.(html|rsc|meta)$/.test(p)))assertPublic(readFileSync('.next/server/app/'+path,'utf8'),path);
  });
  await check('browser source maps and server-only artifacts are not anonymously downloadable',async()=>{
    const maps=readdirSync('.next/static',{recursive:true}).filter(p=>String(p).endsWith('.map'));assert.deepEqual(maps,[]);
    for(const url of scripts)assert.equal((await context.request.get(url+'.map')).status(),404);
    for(const path of ['/lib/private-league-seed.ts','/_next/server/app/api/admin/route.js','/api/admin/route.js.map'])assert.equal((await context.request.get(base+path)).status(),404);
    assert.equal((await context.request.get(base+'/api/league?view=local-setup')).status(),401);
    assert.equal((await context.request.get(base+'/api/registration')).status(),401);
  });
}finally{mkdirSync('work/jury-audit',{recursive:true});const report={browser:'Chrome, mobile viewport; no physical iPhone',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};writeFileSync('work/jury-audit/browser-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed}));await browser.close();if(report.failed)process.exitCode=1;}
