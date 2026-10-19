// Actual isolated staging identities on the built loopback app. No fixture resets,
// accepted game writes or registrations; normal registration POSTs are mocked only
// in these browser contexts so previously unused roles leave no signup documents.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {observeJuryBrowser} from './helpers/jury-browser-observer.mjs';
const project='fantasy-survivor-jury-staging',base=process.env.STAGING_BROWSER_URL??'http://127.0.0.1:3118',dir=process.env.STAGING_BROWSER_RESULT_DIR??'work/jury-navigation-fix',engine=process.env.STAGING_BROWSER_ENGINE??'chromium';
assert.equal(process.argv[2],project);
assert(['http://127.0.0.1:3118','https://127.0.0.1:3119'].includes(base),'Only the fixed loopback test app is allowed.');
assert(['chromium','webkit'].includes(engine));assert(path.resolve(dir).startsWith(path.resolve('work')+path.sep));
const expectedBuild=JSON.parse(await readFile('work/jury-staging/deployment/source-manifest.json','utf8')).build;
assert(expectedBuild?.id.startsWith('JURY-A-DIAG-'));
const credentials=JSON.parse(await readFile('work/jury-staging/deployment/synthetic-credentials.json','utf8'));
for(const [role,value] of Object.entries(credentials))assert.equal(value.uid,'staging-'+role);
const {chromium,webkit,devices}=createRequire('C:/Users/donoh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const browserRoot=path.resolve('work/jury-navigation-diagnostics/browsers'),webkitFolder=engine==='webkit'?(await readdir(browserRoot)).find(name=>/^webkit-\d+$/.test(name)):null;
if(engine==='webkit')assert(webkitFolder,'Install the official WebKit test browser first.');
const browser=await (engine==='webkit'?webkit:chromium).launch({headless:true,executablePath:engine==='webkit'?path.join(browserRoot,webkitFolder,'Playwright.exe'):'C:/Program Files/Google/Chrome/Application/chrome.exe'}),checks=[],errors=[],diagnostics=[],transport=[];let phase='initialization';
async function check(name,run){phase=name;await observer?.mark('before '+name);await run();await observer?.mark('after '+name);checks.push({name,passed:true});console.log('PASS '+name);}
let page,observer;
try{
  // Only the generated loopback TLS certificate is self-signed. No real browser
  // profile, remote deployment protection or machine certificate store is changed.
  const context=await browser.newContext({...devices['iPhone 16 Pro'],ignoreHTTPSErrors:base==='https://127.0.0.1:3119'});page=await context.newPage();observer=await observeJuryBrowser(page,{base,phase:()=>phase,onError:error=>errors.push(error)});
  page.on('requestfailed',request=>{const url=new URL(request.url());transport.push({time:new Date().toISOString(),phase,event:'requestfailed',path:url.origin+url.pathname,error:request.failure()?.errorText});});
  page.on('framenavigated',frame=>{if(frame===page.mainFrame())transport.push({time:new Date().toISOString(),phase,event:'navigation',path:frame.url()});});
  await page.route(base+'/api/registration',async route=>{if(route.request().method()!=='POST')return route.continue();const header=route.request().headers().authorization;assert(header?.startsWith('Bearer '));const payload=JSON.parse(Buffer.from(header.slice(7).split('.')[1],'base64url').toString());assert(payload.aud===project&&payload.sub.startsWith('staging-'));return route.fulfill({json:{signup:{uid:payload.sub,email:payload.email,name:payload.name??'Synthetic tester',createdAt:'2026-10-17T12:00:00Z'}}});});
  await page.goto(base+'/staging');await page.locator('select[name="email"]').selectOption('commissioner@jury.test');await page.getByLabel('Temporary password',{exact:true}).fill(credentials.commissioner.password);await page.getByRole('button',{name:'Sign in / change account',exact:true}).click();await page.getByRole('heading',{name:'Switch test account',exact:true}).waitFor();
  async function capture(role){
    await page.locator('.staging-diagnostics summary').click();await page.getByRole('button',{name:'Capture without reloading',exact:true}).click();await page.getByRole('button',{name:'Copy diagnostics',exact:true}).waitFor();
    const report=JSON.parse(await page.getByLabel('Staging navigation diagnostic report',{exact:true}).innerText());
    assert.equal(report.client.build.id,expectedBuild.id);assert.equal(report.server.build.id,expectedBuild.id);assert.equal(report.server.buildHeader,expectedBuild.id);assert.equal(report.buildsMatch,true);assert.equal(report.server.status,200);assert.equal(report.documentProbe.headers['x-jury-staging-build'],expectedBuild.id);
    assert.equal(report.client.firebase.uid,'staging-'+role);assert.equal(report.client.context.uid,'staging-'+role);assert.equal(report.server.identity.uid,'staging-'+role);assert.equal(report.server.identity.commissioner,role==='commissioner');assert.equal(report.client.context.isAdmin,role==='commissioner');
    assert.equal(report.client.provider.serverCommissioner,role==='commissioner'?'true':'false');
    const adminTargets=report.client.navigation.filter(row=>row.href&&new URL(row.href).pathname==='/admin');assert.equal(adminTargets.length,role==='commissioner'?1:0);
    if(role==='commissioner')assert.equal(adminTargets[0].source,'SiteHeader:GameMaster');
    assert(!JSON.stringify(report).includes('idToken')&&!JSON.stringify(report).includes('refreshToken'));
    for(const value of Object.values(credentials))assert(!JSON.stringify(report).includes(value.password));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    diagnostics.push({role,report});await page.locator('.staging-diagnostics summary').click();
  }
  await check('loaded client, response header and verified current-user diagnostics identify the same build',async()=>{await page.getByRole('link',{name:'Game Master grading',exact:true}).waitFor();await page.getByRole('link',{name:'Standings',exact:true}).click();await page.locator('[data-staging-nav-source="SiteHeader:GameMaster"]').waitFor();await capture('commissioner');await page.getByRole('link',{name:'Staging Controls',exact:true}).click();await page.getByRole('button',{name:'Switch to Active Player',exact:true}).waitFor();});
  const names={active:'Active Player',jury:'Jury Player',complete:'Clean Sweep Player',legacy:'Legacy Player',unlinked:'Unlinked test account'};
  for(const [role,name] of Object.entries(names)){
    await check('real '+role+' switch preserves operator controls and denies direct Game Master route',async()=>{
      await page.getByRole('button',{name:'Switch to '+name,exact:true}).click();await page.getByText('Signed in as '+role+'@jury.test',{exact:true}).waitFor();await page.getByRole('button',{name:'Switch to Commissioner',exact:true}).waitFor({state:'visible'});
      assert.equal(await page.getByRole('link',{name:'Game Master grading',exact:true}).count(),0);
      await page.goto(base+'/admin');await page.getByRole('heading',{name:'This account is not the game master.',exact:true}).waitFor();assert.equal(await page.locator('nav a[href="/admin"]').count(),0);await page.getByRole('link',{name:'Staging Controls',exact:true}).waitFor();
      assert.equal(await page.getByRole('link',{name:/^Game\s*master(?: grading)?$/i}).count(),0);assert.equal(await page.getByRole('button',{name:/^Game\s*master$/i}).count(),0);await capture(role);
      if(role==='active')await page.screenshot({path:dir+'/'+engine+'-active-denied-mobile.jpg',fullPage:true});
      await page.getByRole('link',{name:'Staging Controls',exact:true}).click();await page.getByRole('button',{name:'Switch to Commissioner',exact:true}).waitFor({state:'visible'});
    });
    await check('real '+role+' -> Commissioner restores navigation without a corrective reload',async()=>{
      await page.getByRole('button',{name:'Switch to Commissioner',exact:true}).click();await page.getByText('Signed in as commissioner@jury.test',{exact:true}).waitFor();await page.getByRole('link',{name:'Game Master grading',exact:true}).waitFor();await page.getByRole('link',{name:'Standings',exact:true}).click();await page.locator('nav a[href="/admin"]').waitFor();assert.equal(await page.getByRole('link',{name:'Staging Controls',exact:true}).count(),1);await page.getByRole('link',{name:'Staging Controls',exact:true}).click();await page.getByRole('button',{name:'Switch to '+name,exact:true}).waitFor();
    });
  }
  await check('history restores after Commissioner-to-Active switching never restore a Commissioner target',async()=>{
    await page.getByRole('button',{name:'Switch to Active Player',exact:true}).click();await page.getByText('Signed in as active@jury.test',{exact:true}).waitFor();await page.getByRole('link',{name:'Standings',exact:true}).click();await page.locator('.leader-list').waitFor();await page.getByRole('link',{name:'Draft',exact:true}).click();await page.getByRole('heading',{name:'Teams & Scores',exact:true}).waitFor();await page.goBack();await page.locator('.account-identity').filter({hasText:'Synthetic active'}).waitFor();assert.equal(await page.getByRole('link',{name:/^Game\s*master$/i}).count(),0);await capture('active');
    await page.getByRole('link',{name:'Staging Controls',exact:true}).click();await page.getByRole('button',{name:'Switch to Commissioner',exact:true}).click();await page.getByRole('link',{name:'Game Master grading',exact:true}).waitFor();
  });
  await check('actual Commissioner can still review Jury administration without applying changes',async()=>{await page.goto(base+'/admin');await page.getByRole('heading',{name:'Jury Mode',exact:true}).waitFor();await page.getByRole('heading',{name:/Episode 5 · (Initial grading|Correct Confirmed Results)/}).waitFor();await page.locator('.admin-workspace').waitFor();});
  await check('mobile corrected Commissioner workspace keeps all sections and private predictions readable',async()=>{
    const strip=page.getByRole('tablist',{name:'Game master sections',exact:true});await strip.waitFor();assert.equal(await strip.getByRole('tab').count(),7);assert.equal(await page.locator('.admin-mobile-navigation').count(),0);assert((await strip.boundingBox()).height>=50&&(await strip.boundingBox()).height<=60);
    await page.getByRole('heading',{name:'Episode 5 · Correct Confirmed Results',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Save verified correction',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Preview scoring changes',exact:true}).isDisabled(),true);
    await page.locator('.jury-prediction-card').first().waitFor();assert.equal(await page.locator('.jury-private-predictions table').count(),0);
    const source=page.getByLabel('Evidence sources (required)',{exact:true}),old=await source.inputValue();await source.fill(old+' Unsaved mobile layout check.');await source.evaluate(node=>node.scrollIntoView({block:'start',behavior:'instant'}));
    await page.waitForFunction(()=>{const bar=document.querySelector('.admin-tabs-bar').getBoundingClientRect(),field=document.querySelector('[id^="jury-evidence-source-"]').getBoundingClientRect();return Math.abs(bar.top)<1&&field.top>=bar.bottom;});
    const scrollY=await page.evaluate(()=>window.scrollY);await strip.evaluate(node=>{node.scrollLeft=node.scrollWidth;window.dispatchEvent(new Event('resize'));});await page.waitForFunction(()=>{const bar=document.querySelector('.admin-tabs-bar'),tab=bar.querySelector('[aria-selected="true"]'),r=bar.getBoundingClientRect(),t=tab.getBoundingClientRect();return t.left>=r.left&&t.right<=r.right;});assert(Math.abs((await page.evaluate(()=>window.scrollY))-scrollY)<2);
    for(const label of ['Recaps & polls','League setup','Tribe membership','Player check-in','Draft room','Activity log','Scoring']){await page.getByRole('tab',{name:label,exact:true}).click();await page.getByRole('tab',{name:label,exact:true,selected:true}).waitFor();}
    await page.getByRole('tab',{name:'Scoring',exact:true}).press('End');await page.getByRole('tab',{name:'Activity log',exact:true,selected:true}).waitFor();await page.getByRole('tab',{name:'Activity log',exact:true}).press('Home');await page.getByRole('tab',{name:'Scoring',exact:true,selected:true}).waitFor();
    await page.evaluate(()=>{location.hash='draft-room';});await page.getByRole('tab',{name:'Draft room',exact:true,selected:true}).waitFor();await page.waitForFunction(()=>{const bar=document.querySelector('.admin-tabs-bar').getBoundingClientRect(),tab=document.querySelector('[role="tab"][aria-selected="true"]').getBoundingClientRect();return tab.left>=bar.left&&tab.right<=bar.right;});await page.getByRole('tab',{name:'Scoring',exact:true}).click();assert.equal(await source.inputValue(),old+' Unsaved mobile layout check.');await source.fill(old);
    for(const width of [320,390,430]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.jury-prediction-card')].every(card=>card.scrollWidth<=card.clientWidth+1)),true);}
    await page.screenshot({path:dir+'/'+engine+'-mobile-private-predictions.jpg',fullPage:true});
  });
  await check('staging footer reserves its measured height with diagnostics closed and expanded',async()=>{
    async function clearance(){await page.waitForFunction(()=>parseFloat(getComputedStyle(document.body).paddingBottom)>=document.querySelector('.staging-operator-bar').getBoundingClientRect().height+15);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);}
    await clearance();await page.locator('.staging-diagnostics summary').click();await page.getByRole('button',{name:'Capture without reloading',exact:true}).click();await page.getByRole('button',{name:'Copy diagnostics',exact:true}).waitFor();await clearance();
    assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.staging-diagnostics-panel')).position==='static'),true);await page.locator('.staging-diagnostics summary').click();await clearance();
    await page.getByLabel('Evidence sources (required)',{exact:true}).evaluate(node=>node.scrollIntoView({block:'end'}));await page.waitForFunction(()=>{const field=document.querySelector('[id^="jury-evidence-source-"]').getBoundingClientRect();return field.top>=0&&field.bottom<=document.querySelector('.staging-operator-bar').getBoundingClientRect().top+1;});
  });
  await check('corrected 25 and 23 point fixture has compact Jury-only contributions and confirmed private results',async()=>{
    await page.goto(base+'/');await page.locator('.champion-score').waitFor();assert.match(await page.locator('.champion-score').innerText(),/25\.0/);assert.match(await page.locator('.leader-row').filter({hasText:'Synthetic Jury Player'}).locator('.score').innerText(),/23\.0/);assert.equal(await page.locator('.leader-row:not(.jury-leader-row) .score-contributions').count(),0);
    for(const width of [320,390,430,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&[...document.querySelectorAll('.score-contributions')].every(node=>getComputedStyle(node).gridTemplateColumns.split(' ').length===2)),true);}
    await page.setViewportSize({width:390,height:844});await page.goto(base+'/draft');await page.locator('.jury-team-card').first().waitFor();assert.equal(await page.locator('.jury-team-card .score-contributions').count(),2);assert.equal(await page.locator('.team-score-card:not(.jury-team-card) .score-contributions').count(),0);
    await page.goto(base+'/staging');await page.getByRole('button',{name:'Switch to Jury Player',exact:true}).click();await page.getByText('Signed in as jury@jury.test',{exact:true}).waitFor();await page.goto(base+'/jury');await page.getByRole('heading',{name:'Episode 5 Results',exact:true}).waitFor();assert.equal(await page.locator('.jury-result-row').count(),5);assert.equal(await page.locator('.jury-results select').count(),0);
    for(const width of [320,390,430]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.querySelector('.jury-results-total').getBoundingClientRect().height<80&&[...document.querySelectorAll('.jury-result-row')].every(row=>row.getBoundingClientRect().height<190)),true);}
    await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));await page.waitForFunction(()=>{const summary=document.querySelector('.jury-results-total').getBoundingClientRect();return summary.top>=0&&summary.bottom<=document.querySelector('.staging-operator-bar').getBoundingClientRect().top+1;});await page.screenshot({path:dir+'/'+engine+'-corrected-mobile-results.jpg',fullPage:true});
  });
  await check('ordinary identities never retain privileged DOM during observed auth transitions',async()=>assert.deepEqual(observer.report().privacyViolations,[]));
  await check('real browser has no uncaught runtime errors',async()=>assert.deepEqual(errors,[]));
  await writeFile(dir+'/'+engine+'-real-staging-browser.json',JSON.stringify({projectId:project,engine,build:expectedBuild,passed:checks.length,failed:0,checks,diagnostics,transport,errors,observation:observer?.report(),fixtureResets:0,cloudRegistrations:0,credentialsRotated:0},null,2));console.log(JSON.stringify({engine,buildId:expectedBuild.id,passed:checks.length,failed:0,fixtureResets:0,cloudRegistrations:0}));
}catch(error){await writeFile(dir+'/'+engine+'-real-staging-browser.json',JSON.stringify({projectId:project,engine,build:expectedBuild,passed:checks.length,failed:1,failure:{phase,message:error.message},checks,diagnostics,transport,errors,observation:observer?.report(),fixtureResets:0,cloudRegistrations:0},null,2));console.error({error:error.message,phase,errors});throw error;}finally{await browser.close();}
