// Read-only controls against the built staging app. No request routing/mocking,
// fixture resets, response rewriting, credential rotation or error filtering.
import assert from 'node:assert/strict';import {readFile,writeFile,readdir} from 'node:fs/promises';import {createRequire} from 'node:module';import path from 'node:path';
import {observeJuryBrowser} from './helpers/jury-browser-observer.mjs';
const project='fantasy-survivor-jury-staging',base='https://127.0.0.1:3119',directory='work/jury-final-polish',engine=process.argv[3],tag=process.argv[4];assert.equal(process.argv[2],project);assert(['chromium','webkit'].includes(engine));assert(['accepted','final'].includes(tag));
const before=JSON.parse(await readFile(directory+'/staging-before.json','utf8'));for(const role of ['commissioner','active','jury'])assert(before.hashes['games/survivor-51/signups/staging-'+role],'Only already-registered synthetic identities may be used without routing.');
const accounts=JSON.parse(await readFile('work/jury-staging/deployment/synthetic-credentials.json','utf8'));
const {chromium,webkit,devices}=createRequire('C:/Users/donoh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright'),folder=(await readdir('work/jury-navigation-diagnostics/browsers')).find(name=>/^webkit-\d+$/.test(name));
const browser=await (engine==='webkit'?webkit:chromium).launch({headless:true,executablePath:engine==='webkit'?path.resolve('work/jury-navigation-diagnostics/browsers',folder,'Playwright.exe'):'C:/Program Files/Google/Chrome/Application/chrome.exe'}),context=await browser.newContext({...devices['iPhone 16 Pro'],ignoreHTTPSErrors:true}),page=await context.newPage();
let phase='initial-sign-in',failure=null;const observer=await observeJuryBrowser(page,{base,phase:()=>phase}),checks=[];
async function settled(role){await page.getByText('Signed in as '+role+'@jury.test',{exact:true}).waitFor();await page.getByRole('heading',{name:'Current synthetic scenario',exact:true}).waitFor();await page.waitForLoadState('networkidle');await observer.mark('settled '+role);}
async function switchRole(role,name){await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.getByRole('button',{name:'Switch to '+name,exact:true}).click()]);await settled(role);}
try{
  await page.goto(base+'/staging');await page.locator('select[name="email"]').selectOption('commissioner@jury.test');await page.getByLabel('Temporary password',{exact:true}).fill(accounts.commissioner.password);
  await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.getByRole('button',{name:'Sign in / change account',exact:true}).click()]);await settled('commissioner');checks.push('normal sign-in without any request interception');
  for(const [role,name] of [['active','Active Player'],['commissioner','Commissioner'],['jury','Jury Player'],['commissioner','Commissioner']]){
    phase='settled-switch-'+role;await switchRole(role,name);await page.getByRole('link',{name:'Standings',exact:true}).click();await page.locator('.leader-list').waitFor();await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('nav a[href="/admin"]').count(),role==='commissioner'?1:0);assert.equal(await page.locator('.jury-prediction-card').count(),0);await observer.mark('standings '+role);
    if(role!=='commissioner'){await page.goto(base+'/admin');await page.getByRole('heading',{name:'This account is not the game master.',exact:true}).waitFor();assert.equal(await page.locator('.admin-workspace').count(),0);await observer.mark('denied direct admin '+role);}
    await page.getByRole('link',{name:'Staging Controls',exact:true}).click();await settled(role);checks.push(role+' settled switching/nav/direct-route control');
  }
  phase='settled-idle';await page.waitForTimeout(16000);await observer.mark('idle after normal Commissioner return');checks.push('idle across polling boundary');
  // Deliberate cancellation control, with NO identity change: navigate exactly
  // when the existing background league poll starts. This is not normal pacing.
  for(let attempt=1;attempt<=2;attempt++){
    phase='same-identity-inflight-navigation-'+attempt;await page.goto(base+'/');await page.locator('.leader-list').waitFor();await page.waitForLoadState('networkidle');
    await page.waitForRequest(request=>new URL(request.url()).pathname==='/api/league',{timeout:25000});await observer.mark('background league poll began; same Commissioner identity');
    await page.goto(base+'/rules');await page.waitForLoadState('networkidle');await observer.mark('document replaced without changing identity');assert.equal(await page.locator('[data-staging-provider-diagnostics]').getAttribute('data-user-uid'),'staging-commissioner');checks.push('same-principal in-flight navigation '+attempt);
  }
  assert.deepEqual(observer.report().privacyViolations,[]);checks.push('no ordinary identity retained privileged DOM or admin grants');
}catch(error){failure=error.message;}finally{
  const observation=observer.report(),settledErrors=observation.errors.filter(error=>!error.phase.startsWith('same-identity-inflight-navigation')),result={projectId:project,engine,tag,routeInterception:false,checks,failure,strictRuntimePassed:!failure&&observation.errors.length===0,settledStrictPassed:!failure&&settledErrors.length===0,observation};
  await writeFile(directory+'/'+engine+'-'+tag+'-route-free.json',JSON.stringify(result,null,2));console.log(JSON.stringify({engine,tag,checks:checks.length,failure,strictRuntimePassed:result.strictRuntimePassed,settledStrictPassed:result.settledStrictPassed,pageErrors:observation.errors.length,windowErrors:observation.windowErrors.length,unhandledRejections:observation.unhandledRejections.length,httpDenials:observation.httpDenials.length,privacyViolations:observation.privacyViolations.length}));if(failure||observation.errors.length)process.exitCode=1;await browser.close();
}
