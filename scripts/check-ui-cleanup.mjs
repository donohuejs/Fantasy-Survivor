// Isolated regression rehearsal. All database/auth traffic is restricted to loopback emulators.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {initializeApp,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {initialGame,normalizeCategories,migrateLegacyTribalState} from '../lib/game-data.ts';
import {ensureEliminationScoringBoundary} from '../lib/scoring.ts';

const project='demo-fantasy-scoring',base=process.env.UI_CLEANUP_TEST_URL??'http://127.0.0.1:3104';
assert.equal(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,project);
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8085');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:9098');
assert.equal(new URL(base).hostname,'127.0.0.1');
assert.equal(await readFile('work/firebase-rehearsal/firestore.rules','utf8'),await readFile('firestore.rules','utf8'));
const service=JSON.parse(await readFile('work/firebase-rehearsal/server-service-account.json','utf8'));
assert.equal(service.project_id,project);
const app=initializeApp({projectId:project,credential:cert({projectId:project,clientEmail:service.client_email,privateKey:service.private_key})},'ui-cleanup');
const auth=getAuth(app),db=getFirestore(app),root=db.doc('games/survivor-51'),results=[];
const past=new Date(Date.now()-86400000).toISOString(),future=new Date(Date.now()+86400000).toISOString();
let debugPage=null;
async function check(name,run){try{await run();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.message});if(debugPage){await debugPage.screenshot({path:'work/ui-cleanup/browser/failure.png',fullPage:true});await writeFile('work/ui-cleanup/browser/failure.txt',await debugPage.locator('body').innerText());}throw error;}}
async function account(uid,email){
  try{await auth.getUser(uid);}catch(error){if(error.code!=='auth/user-not-found')throw error;await auth.createUser({uid,email,password:'Synthetic-password-42!',emailVerified:true,displayName:uid});}
  const response=await fetch('http://127.0.0.1:9098/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'Synthetic-password-42!',returnSecureToken:true})});
  assert.equal(response.status,200);return {...await response.json(),uid,email};
}
const owner=await account('cleanup-owner','donohue.js@gmail.com'),member=await account('cleanup-member','stanzi@example.com'),stranger=await account('cleanup-stranger','stranger@example.com');
async function api(actor,input,endpoint='discussions'){
  const response=await fetch(base+'/api/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(actor?{Authorization:'Bearer '+actor.idToken}:{})},body:JSON.stringify(input)});
  return {status:response.status,body:await response.json()};
}
async function seed(){
  await db.recursiveDelete(root); // Fixed emulator-only project above, synthetic test records only.
  const game=structuredClone(initialGame);
  game.season={...game.season,currentEpisode:4,episodeStarted:true,episodeStatus:'in-progress'};game.draft.status='complete';
  game.players=game.players.filter(player=>['player-stanzi','player-zoda','player-katie'].includes(player.id));
  const stanzi=game.players.find(player=>player.id==='player-stanzi');stanzi.email=member.email;stanzi.paid=true;stanzi.draftSlot=2;delete stanzi.uid;
  game.history=[];game.categories=normalizeCategories(game.categories);game.tribalVotes=[];
  game.possessions=game.possessions.map(row=>row.castawayId==='cast-rob'?{...row,status:'lost',history:[...row.history,{action:'lost',at:past,episode:3}]}:row);
  game.possessions.push({id:'synthetic-carter-idol',lineageId:'synthetic-carter-idol',seasonId:'season-51',castawayId:'cast-carter',originalCastawayId:'cast-carter',itemName:'Final 5 Immunity Idol',category:'idol',status:'active',notes:'Given to him from Rob',history:[{action:'acquired',at:past,episode:3}]});
  game.castaways.find(row=>row.id==='cast-rob').status='voted-out';
  game.draftPicks=['cast-kristin','cast-jelly','cast-brady'].map((castawayId,index)=>({id:`synthetic-pick-${index}`,playerId:stanzi.id,castawayId,round:index+1,pickNumber:2,multiplier:index===2?1.25:1}));
  await root.set(migrateLegacyTribalState(ensureEliminationScoringBoundary(game)));
  await root.collection('signups').doc(member.uid).set({uid:member.uid,name:'Stanzi Lowe',email:member.email,createdAt:past});
  await root.collection('signups').doc(owner.uid).set({uid:owner.uid,name:'Game master',email:owner.email,createdAt:past});
  for(let episode=1;episode<=13;episode++)await root.collection('episodes').doc(`51-${episode}`).set({id:`51-${episode}`,season:51,episode,title:`Episode ${episode}`,body:episode<=4?'Synthetic published commentary':episode===7?'Saved future commentary':'',actions:[],status:episode<=4?'published':'draft',createdAt:past,updatedAt:episode<=4||episode===7?past:'',publishedAt:episode<=4?past:'',discussionOpensAt:episode<=4?past:future,...(episode!==4?{discussionSchemaVersion:2}:{})});
  return (await root.get()).data();
}
await mkdir('work/ui-cleanup/browser',{recursive:true});
let baseline=await seed();
await check('anonymous/unlinked accounts cannot post or migrate; ordinary members cannot migrate',async()=>{
  for(const [actor,status] of [[null,401],[stranger,403]])assert.equal((await api(actor,{action:'post',episodeId:'51-4',id:'no',text:'No'})).status,status);
  assert.equal((await api(member,{action:'migrate',episodeId:'51-4',dryRun:false})).status,403);
  assert.equal((await api(member,{action:'save-recap',season:51,episode:4,title:'No',body:'No',status:'published',expectedUpdatedAt:past},'community')).status,403);
});
await check('Episode 4 owner dry-run is read-only and repeatable; owner migration is idempotent',async()=>{
  const before=(await root.collection('episodes').doc('51-4').get()).data();
  const first=await api(owner,{action:'migrate',episodeId:'51-4',dryRun:true}),second=await api(owner,{action:'migrate',episodeId:'51-4',dryRun:true});
  assert.equal(first.status,200);assert.deepEqual(first.body,second.body);assert.deepEqual((await root.collection('episodes').doc('51-4').get()).data(),before);
  assert.equal((await api(member,{action:'post',episodeId:'51-4',id:'blocked',text:'Kept'})).status,409);
  assert.equal((await api(owner,{action:'migrate',episodeId:'51-4',dryRun:false})).body.status,'ready');
  assert.equal((await api(owner,{action:'migrate',episodeId:'51-4',dryRun:false})).body.changed,false);
});
await check('newly created recaps support member posts and owner replies; historical originals survive migration',async()=>{
  const original={id:'historic',authorId:'player-stanzi',authorName:'Historical name',text:'Historical text',createdAt:past};
  await root.collection('episodes').doc('51-3').update({discussionSchemaVersion:1});await root.collection('episodes').doc('51-3').collection('comments').doc('historic').set(original);
  assert.equal((await api(owner,{action:'migrate',episodeId:'51-3',dryRun:false})).status,200);
  const preserved=(await root.collection('episodes').doc('51-3').collection('comments').doc('historic').get()).data();for(const [key,value] of Object.entries(original))assert.equal(preserved[key],value);
  assert.equal((await api(owner,{action:'save-recap',season:51,episode:14,title:'Synthetic new recap',body:'New',status:'published',expectedUpdatedAt:''},'community')).status,200);
  assert.equal((await api(member,{action:'post',episodeId:'51-14',id:'fresh',text:'Fresh conversation'})).status,200);
  assert.equal((await api(owner,{action:'post',episodeId:'51-14',id:'reply',text:'Fresh reply',replyToCommentId:'fresh'})).status,200);
  assert.equal((await root.collection('episodes').doc('51-14').collection('comments').doc('reply').get()).data().replyToCommentId,'fresh');
  assert.deepEqual((await root.get()).data(),baseline);
});
await check('Firestore rules still deny direct discussion writes, reads and member identity assignments',async()=>{
  const endpoint='http://127.0.0.1:8085/v1/projects/'+project+'/databases/(default)/documents/games/survivor-51';
  for(const actor of [owner,member])for(const method of ['GET','PATCH']){
    const response=await fetch(endpoint+'/episodes/51-4/comments/forged',{method,headers:{Authorization:'Bearer '+actor.idToken,'Content-Type':'application/json'},...(method==='PATCH'?{body:JSON.stringify({fields:{text:{stringValue:'forged'}}})}:{})});assert.equal(response.status,403);
  }
  assert.equal((await fetch(endpoint+'/signups/'+member.uid+'?updateMask.fieldPaths=assignedPlayerId',{method:'PATCH',headers:{Authorization:'Bearer '+member.idToken,'Content-Type':'application/json'},body:JSON.stringify({fields:{assignedPlayerId:{stringValue:'player-stanzi'}}})})).status,403);
});
const {chromium}=process.env.PLAYWRIGHT_PACKAGE?createRequire(process.env.PLAYWRIGHT_PACKAGE)('playwright'):await import('playwright');
const browser=await chromium.launch({headless:true,...(process.env.UI_CLEANUP_BROWSER_EXECUTABLE?{executablePath:process.env.UI_CLEANUP_BROWSER_EXECUTABLE}:{})});
const errors=[];
async function contextFor(actor,viewport){
  const context=await browser.newContext({viewport,isMobile:viewport.width<600,hasTouch:viewport.width<600});
  // Rewrite SDK transports before they open. Browser APIs keep real streaming and CORS behavior.
  await context.addInitScript(()=>{
    function redirect(value){const url=new URL(String(value),location.href);if(url.hostname==='firestore.googleapis.com')url.host='127.0.0.1:8085';else if(['identitytoolkit.googleapis.com','securetoken.googleapis.com'].includes(url.hostname)){url.pathname='/'+url.hostname+url.pathname;url.host='127.0.0.1:9098';}else return value;url.protocol='http:';return url.href;}
    const open=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url,...rest){return open.call(this,method,redirect(url),...rest);};
    const originalFetch=window.fetch;window.fetch=async function(input,init){
      if(input instanceof Request){
        const target=redirect(input.url);
        // Buffer the original request body; copying its ReadableStream requires HTTP/2 upload.
        if(target!==input.url)return originalFetch.call(this,target,{method:input.method,headers:input.headers,mode:input.mode,credentials:input.credentials,cache:input.cache,redirect:input.redirect,signal:input.signal,...(!['GET','HEAD'].includes(input.method)?{body:await input.clone().arrayBuffer()}:{}),...init});
        return originalFetch.call(this,input,init);
      }
      return originalFetch.call(this,redirect(input),init);
    };
  });
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  if(process.env.UI_CLEANUP_DEBUG){page.on('console',message=>{if(message.type()==='error')console.log('BROWSER '+message.text().slice(0,240));});page.on('requestfailed',request=>{const url=new URL(request.url());console.log('FAILED '+url.origin+url.pathname+' '+request.failure()?.errorText);});}
  await page.route(base+'/__qa-seed',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Local QA</title>'}));await page.goto(base+'/__qa-seed');
  await page.evaluate(async actor=>{
    const value={uid:actor.uid,email:actor.email,emailVerified:true,displayName:actor.uid,isAnonymous:false,providerData:[{providerId:'password',uid:actor.email,displayName:actor.uid,email:actor.email,photoURL:null}],stsTokenManager:{refreshToken:actor.refreshToken,accessToken:actor.idToken,expirationTime:Date.now()+3500000},apiKey:'demo-api-key',appName:'[DEFAULT]'};
    localStorage.setItem('firebase:authUser:demo-api-key:[DEFAULT]',JSON.stringify(value));
    await new Promise((resolve,reject)=>{const request=indexedDB.open('firebaseLocalStorageDb',1);request.onupgradeneeded=()=>request.result.createObjectStore('firebaseLocalStorage',{keyPath:'fbase_key'});request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('firebaseLocalStorage','readwrite');tx.objectStore('firebaseLocalStorage').put({fbase_key:'firebase:authUser:demo-api-key:[DEFAULT]',value});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
  },actor);
  return {context,page};
}
try{
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
    const name=viewport.width<600?'iphone':'desktop';baseline=await seed();
    const {context,page}=await contextFor(owner,viewport);debugPage=page;page.on('dialog',dialog=>dialog.accept());
    await check(`${name}: recap selectors, collapsed schedule, active inventory and saved future draft`,async()=>{
      await page.goto(base+'/admin#recaps-polls');const panel=page.locator('#panel-recaps-polls');
      await panel.getByRole('navigation',{name:'Available recap episodes',exact:true}).getByRole('button',{name:'Episode 4 · Published',exact:true}).waitFor();
      assert.equal(await panel.getByRole('navigation',{name:'Available recap episodes',exact:true}).getByRole('button').count(),4);
      assert.equal(await panel.locator('.who-has-what').count(),0);
      const calendar=panel.locator('.discussion-calendar');assert.equal(await calendar.getAttribute('open'),null);
      assert.equal(await calendar.evaluate(node=>node.parentElement.lastElementChild===node),true);
      const records=panel.locator('.possession-manager > .possession-records');assert.equal(await records.locator('header').getByText('Rob Antonson',{exact:true}).count(),0);assert.equal(await records.locator('header').getByText('Carter Krull',{exact:true}).count(),1);
      const history=panel.locator('.closed-possession-history');assert.equal(await history.getAttribute('open'),null);await history.locator(':scope > summary').click();await history.locator('header').getByText('Rob Antonson',{exact:true}).waitFor();await history.locator(':scope > summary').click();
      const drafts=panel.locator('.future-recap-drafts');assert.equal(await drafts.getAttribute('open'),null);await drafts.locator('summary').click();assert.equal(await drafts.getByRole('button').count(),1);await drafts.getByRole('button',{name:'Episode 7 · Saved draft'}).click();await panel.getByLabel('Your color commentary').waitFor();assert.equal(await panel.getByLabel('Your color commentary').inputValue(),'Saved future commentary');
      await calendar.locator(':scope > summary').click();await calendar.getByRole('button',{name:'Review calendar',exact:true}).waitFor();await calendar.getByRole('button',{name:'Hold discussion',exact:true}).waitFor();await calendar.locator(':scope > summary').click();
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`work/ui-cleanup/browser/${name}-recaps.png`,fullPage:true});
    });
    await check(`${name}: Stanzi legacy email association replaces awaiting assignment without identity writes`,async()=>{
      await page.getByRole('tab',{name:'Player check-in',exact:true}).click();const row=page.locator('#panel-player-check-in .signup-list article').filter({hasText:'Stanzi Lowe'});
      await row.getByText('Email access · Slot 2',{exact:true}).waitFor();assert((await row.innerText()).includes('3 draft picks'));assert(!(await row.innerText()).includes('Awaiting assignment'));assert.equal(await row.locator('select').count(),0);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await row.screenshot({path:`work/ui-cleanup/browser/${name}-checkin.png`});assert.deepEqual((await root.get()).data(),baseline);
    });
    debugPage=null;await context.close();const player=await contextFor(member,viewport),playerPage=player.page;debugPage=playerPage;
    await check(`${name}: player sees Episodes 1–4 and automatically sees newly opened Episode 5`,async()=>{
      await playerPage.goto(base+'/episodes');const picker=playerPage.getByRole('navigation',{name:'Choose an episode',exact:true});await playerPage.locator('.spoiler-settings input:enabled').waitFor();assert.equal(await picker.getByRole('button').count(),4);
      assert.equal(await playerPage.locator('.who-has-what').getByText('Carter Krull',{exact:true}).count(),1);
      await api(owner,{action:'override',episodeId:'51-5',expectedVersion:'',mode:'open'});await playerPage.reload();await picker.getByRole('button',{name:/Episode 5/}).waitFor();assert.equal(await picker.getByRole('button').count(),5);
      assert(await playerPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await playerPage.evaluate(()=>window.scrollTo(0,0));await playerPage.screenshot({path:`work/ui-cleanup/browser/${name}-episodes.png`,fullPage:true});
    });
    await check(`${name}: Chatter keeps failed text, then posts and replies after reviewed Episode 4 migration`,async()=>{
      await playerPage.goto(base+'/chatter?episode=51-4');const composer=playerPage.locator('.chatter-composer').first(),text=`Synthetic ${name} conversation`;
      await composer.getByRole('textbox').fill(text);await composer.getByRole('button',{name:'Start conversation',exact:true}).click();await composer.getByRole('alert').filter({hasText:'must migrate'}).waitFor();assert.equal(await composer.getByRole('textbox').inputValue(),text);
      assert.equal((await api(owner,{action:'migrate',episodeId:'51-4',dryRun:true})).body.commentCount,0);assert.equal((await api(owner,{action:'migrate',episodeId:'51-4',dryRun:false})).body.status,'ready');
      await composer.getByRole('button',{name:'Start conversation',exact:true}).click();await playerPage.getByText(text,{exact:true}).first().waitFor();
      await playerPage.getByRole('button',{name:'Reply',exact:true}).first().click();const reply=playerPage.locator('.comment-reply-composer');await reply.getByRole('textbox').fill(`Synthetic ${name} reply`);
      await root.collection('communityPrivate').doc(member.uid).set({lastCommentAt:past}); // Avoid waiting for the real cooldown in a synthetic UI test.
      await reply.getByRole('button',{name:'Post reply',exact:true}).click();await playerPage.locator('.episode-comment .community-prose').filter({hasText:`Synthetic ${name} reply`}).waitFor();
      assert.equal((await root.collection('episodes').doc('51-4').collection('comments').where('text','==',`Synthetic ${name} reply`).get()).size,1);
      assert(await playerPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await playerPage.evaluate(()=>window.scrollTo(0,0));await playerPage.screenshot({path:`work/ui-cleanup/browser/${name}-chatter.png`,fullPage:true});assert.deepEqual((await root.get()).data(),baseline);
    });
    await player.context.close();
  }
  assert.deepEqual(errors,[],'no browser exceptions');
}finally{await browser.close();await writeFile('work/ui-cleanup/browser/results.json',JSON.stringify({productionWrites:0,results,errors},null,2));}
