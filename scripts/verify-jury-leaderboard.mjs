// Reproduce and verify presentation against the isolated, synthetic iPhone fixture only.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {initializeApp,cert} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {localAcceptance} from '../lib/acceptance-environment.ts';
import {seasonStandings} from '../lib/league.ts';
import {effectiveScorePoints} from '../lib/score-ledger.ts';
import {playerInJuryMode} from '../lib/jury-public.ts';
const dir='work/jury-leaderboard';mkdirSync(dir,{recursive:true});
const settings=JSON.parse(readFileSync('work/iphone-acceptance/settings.json','utf8')),service=JSON.parse(readFileSync('work/firebase-rehearsal/server-service-account.json','utf8'));
assert.equal(settings.project,'demo-fantasy-scoring');
Object.assign(process.env,{NODE_ENV:'development',LOCAL_ACCEPTANCE:'1',NEXT_PUBLIC_LOCAL_ACCEPTANCE:'1',NEXT_PUBLIC_FIREBASE_PROJECT_ID:settings.project,NEXT_PUBLIC_FIREBASE_API_KEY:'demo-api-key',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8085',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9098',FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify(service)});assert(localAcceptance());
const app=initializeApp({projectId:settings.project,credential:cert({projectId:service.project_id,clientEmail:service.client_email,privateKey:service.private_key})}),db=getFirestore(app),root=db.doc('games/survivor-51');
const mode=process.argv[2]??'verify',game=(await root.get()).data();assert(game&&game.players.every(p=>p.id.startsWith('synthetic-')&&p.email.endsWith('@jury.test'))&&game.castaways.every(c=>c.id.startsWith('synthetic-')),'Refusing non-synthetic data');
const base=`http://${settings.host}:3108`,url=base+'/__acceptance/start?key='+settings.accessKey;
const before=structuredClone(game),results=[],trace=[];
const breakdown=g=>seasonStandings(g).map(row=>{const events=g.scoreEvents.filter(e=>e.playerId===row.profileId),jury=events.filter(e=>e.source==='jury').reduce((s,e)=>s+effectiveScorePoints(e),0),other=events.filter(e=>e.source!=='jury').reduce((s,e)=>s+effectiveScorePoints(e),0),draft=g.draftPicks.filter(p=>p.playerId===row.profileId).reduce((s,p)=>s+p.multiplier*g.scoreEvents.filter(e=>e.castawayId===p.castawayId).reduce((v,e)=>v+effectiveScorePoints(e),0),0);assert.equal(row.score,draft+other+jury+g.players.find(p=>p.id===row.profileId).entryBonus);return {...row,draft,other,jury,entryBonus:g.players.find(p=>p.id===row.profileId).entryBonus,inJury:playerInJuryMode(g,row.profileId)};});
async function token(){const r=await fetch('http://127.0.0.1:9098/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'commissioner@jury.test',password:settings.password,returnSecureToken:true})});assert.equal(r.status,200);return (await r.json()).idToken;}
if(mode==='grade'){
  const jwt=await token(),record=(await root.collection('juryEpisodes').doc('51-5').get()).data();
  async function command(input){const r=await fetch('http://127.0.0.1:3106/api/jury',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+jwt},body:JSON.stringify({season:51,episode:5,expectedRevision:record.revision,requestId:randomUUID(),...input})});const body=await r.json();assert.equal(r.status,200,JSON.stringify(body));return body;}
  const preview=await command({action:'preview-grade'});await command({action:'confirm-grade',previewToken:preview.previewToken,confirmed:true});console.log('Synthetic grading confirmed.');await db.terminate();process.exit(0);
}
if(mode==='repair-fixture'){
  // Repair only a completed Episode 5 grading fixture accidentally left at Episode 4.
  await db.runTransaction(async tx=>{const [stored,episode]=await Promise.all([tx.get(root),tx.get(root.collection('juryEpisodes').doc('51-5'))]);const current=stored.data(),record=episode.data();assert.equal(current.season.currentEpisode,4);assert(record?.gradedAt&&Date.parse(record.snapshot.airtime)<Date.now());assert.equal(current.scoreEvents.filter(e=>e.source==='jury'&&e.episode===5).length,2);tx.update(root,{'season.currentEpisode':5});});
  const after=(await root.get()).data();assert.deepEqual(after,{...before,season:{...before.season,currentEpisode:5}});console.log('Repaired only the synthetic fixture episode 4 → 5; all scores, picks and other game fields preserved.');await db.terminate();process.exit(0);
}
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE??'C:/Users/donoh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
  for(const width of mode==='capture'?[393]:[393,520,1440]){
    const context=await browser.newContext({viewport:{width,height:852},isMobile:width<600,hasTouch:width<600});await context.route('**/*',r=>new URL(r.request().url()).hostname===settings.host?r.continue():r.abort());const page=await context.newPage();page.setDefaultTimeout(20000);
    page.on('pageerror',error=>trace.push({width,error:error.message}));
    page.on('response',async response=>{if(response.url().includes('/api/discussions'))try{trace.push({width,url:response.url(),status:response.status(),body:await response.json()});}catch{}});
    await page.goto(url);await page.locator('select[name=email]').selectOption('jury@jury.test');await page.locator('input[name=password]').fill(settings.password);await page.getByRole('button',{name:'Sign in to local demo'}).click();await page.waitForURL(base+'/');await page.locator('.leader-row').first().waitFor();
    const observed={width,episode:game.season.currentEpisode,featured:await page.locator('.torch-card').innerText(),rows:await page.locator('.leader-row').allTextContents(),juryRows:await page.locator('.jury-leader-row').count()};
    await page.screenshot({path:`${dir}/${mode}-home-${width}.png`,fullPage:true});
    if(mode!=='capture'){
      assert.equal(await page.locator('.leader-row').count(),4);assert.equal(await page.locator('.jury-leader-row').count(),2);
      const featured=page.locator('.torch-card');assert((await featured.innerText()).includes('Synthetic Clean Sweep Player'));assert((await featured.innerText()).includes('28.0 points'));assert.equal(await featured.locator('.jury-mode-label').innerText(),'Jury Mode');assert((await featured.getAttribute('class')).includes('jury-torch-card'));
      for(const [name,total] of [['Synthetic Clean Sweep Player','28.0'],['Synthetic Jury Player','24.0']]){const row=page.locator('.leader-row').filter({hasText:name});assert.equal(await row.locator('.jury-mode-label').isVisible(),true);assert.equal(await row.locator('.score').innerText(),total);assert.equal(await row.evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(241, 243, 242)');}
      assert.equal(await page.locator('.leader-row').first().locator('.rank').innerText(),'1');assert.equal(await page.locator('.leader-row').filter({hasText:'Synthetic Active Player'}).locator('.jury-mode-label').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);results.push({name:`${width}px: main rows and first-place featured card retain labels, totals, rank and subdued styling`,passed:true});
    }
    await page.goto(base+'/draft');await page.locator('.team-score-card').first().waitFor();observed.teams=await page.locator('.team-score-card').allTextContents();await page.screenshot({path:`${dir}/${mode}-teams-${width}.png`,fullPage:true});
    if(mode!=='capture'){
      assert.equal(await page.locator('.jury-team-card').count(),2);for(const name of ['Synthetic Clean Sweep Player','Synthetic Jury Player']){const card=page.locator('.team-score-card').filter({hasText:name});assert.equal(await card.locator('.jury-mode-label').isVisible(),true);assert((await card.locator('.team-score-summary').innerText()).includes('0 of 3 active'));assert.equal(await card.locator('header').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(231, 236, 234)');}assert.equal(await page.locator('.team-score-card').filter({hasText:'Synthetic Legacy Player'}).locator('.jury-mode-label').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);results.push({name:`${width}px: expanded team cards show Jury labels/subdued headers without overflow`,passed:true});
    }
    results.push({name:`${width}px observed fixture`,...observed});await context.close();
  }
  assert.deepEqual(trace.filter(r=>r.error),[],'Browser runtime errors');
  const after=(await root.get()).data();assert.deepEqual(after,before);writeFileSync(`${dir}/${mode}-results.json`,JSON.stringify({episode:game.season.currentEpisode,breakdown:breakdown(game),passed:results.filter(r=>r.passed).length,results},null,2));console.log(JSON.stringify({mode,episode:game.season.currentEpisode,passed:results.filter(r=>r.passed).length,breakdown:breakdown(game)},null,2));
}finally{writeFileSync(`${dir}/browser-trace.json`,JSON.stringify(trace,null,2));await browser.close();await db.terminate();}
