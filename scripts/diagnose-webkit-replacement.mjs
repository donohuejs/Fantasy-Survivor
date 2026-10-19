// Data-free, loopback-only mechanism control. No app, Firebase, auth or routing.
import assert from 'node:assert/strict';import http from 'node:http';import {writeFile,readdir} from 'node:fs/promises';import {createRequire} from 'node:module';import path from 'node:path';
import {observeJuryBrowser} from './helpers/jury-browser-observer.mjs';
const engine=process.argv[2],trigger=process.argv[3]??'handle';assert(['webkit','chromium'].includes(engine));assert(['handle','stream','timer'].includes(trigger));const base='http://127.0.0.1:3120',directory='work/jury-final-polish',ledger=[];let hold=false,release=null,started=null,signal=null;
const server=http.createServer((request,response)=>{const pathname=new URL(request.url,base).pathname;ledger.push({path:pathname,event:'start',time:Date.now()});response.on('finish',()=>ledger.push({path:pathname,event:'finish',status:response.statusCode,time:Date.now()}));
  if(pathname==='/signal'){signal=response;response.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store'});response.write('data: ready\n\n');return;}
  const send=()=>{response.setHeader('Content-Type',pathname==='/api/check'?'text/plain':'text/html');response.end(pathname==='/api/check'?'ok':'<!doctype html><title>'+pathname+'</title><p>Data-free navigation control</p>');};
  if(pathname==='/replacement'&&hold){release=send;started();}else send();
});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(3120,'127.0.0.1',resolve);});
const {webkit,chromium}=createRequire('C:/Users/donoh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright'),folder=(await readdir('work/jury-navigation-diagnostics/browsers')).find(name=>/^webkit-\d+$/.test(name)),browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,executablePath:engine==='webkit'?path.resolve('work/jury-navigation-diagnostics/browsers',folder,'Playwright.exe'):'C:/Program Files/Google/Chrome/Application/chrome.exe'}),cells=[];let failure=null;
try{
  for(const navigation of [false,true]){
    const context=await browser.newContext(),page=await context.newPage(),observer=await observeJuryBrowser(page,{base,phase:()=> navigation?'replacement-held':'no-navigation-control'});await page.goto(base+'/initial');
    const handle=await page.evaluateHandle(()=>({async send(){try{const response=await fetch('/api/check');return {returned:true,caught:false,status:response.status,body:await response.text()};}catch(error){return {returned:true,caught:true,name:error.name,message:error.message};}}}));
    if(navigation&&trigger==='stream')await handle.evaluate(object=>new Promise(resolve=>{const channel=new EventSource('/signal');channel.onmessage=event=>{if(event.data==='ready')resolve();else if(event.data==='go')void object.send().then(result=>{console.debug('__FETCH_RECEIPT__'+JSON.stringify(result));channel.close();});};}));
    const start=ledger.length;let pending;
    let result;let timerReceipt;
    if(trigger==='timer'){
      timerReceipt=page.waitForEvent('console',{predicate:message=>message.text().startsWith('__FETCH_RECEIPT__'),timeout:3000});
      // The same page-owned timer in both engines avoids protocol evaluation in
      // an old execution context or engine-specific EventSource delivery.
      await handle.evaluate(object=>{setTimeout(()=>{console.debug('__FETCH_STARTED__');void object.send().then(result=>console.debug('__FETCH_RECEIPT__'+JSON.stringify(result)));},250);});
    }
    if(navigation){hold=true;const replacementStarted=new Promise(resolve=>{started=resolve;});pending=page.goto(base+'/replacement',{waitUntil:'domcontentloaded'}).then(()=>({ok:true}),error=>({error:error.message}));await replacementStarted;
      try{if(trigger==='handle')result=await handle.evaluate(object=>object.send());else if(trigger==='timer')result=JSON.parse((await timerReceipt).text().slice('__FETCH_RECEIPT__'.length));else{const receipt=page.waitForEvent('console',{predicate:message=>message.text().startsWith('__FETCH_RECEIPT__'),timeout:15000});signal.write('data: go\n\n');result=JSON.parse((await receipt).text().slice('__FETCH_RECEIPT__'.length));}}finally{release?.();release=null;}
    }else result=trigger==='timer'?JSON.parse((await timerReceipt).text().slice('__FETCH_RECEIPT__'.length)):await handle.evaluate(object=>object.send());
    if(pending)assert.equal((await pending).ok,true);await observer.mark('caught fetch result returned');
    const observation=observer.report(),cell={navigation,result,ledger:ledger.slice(start),observation};cells.push(cell);
    if(!navigation){assert.equal(result.status,200);assert.equal(result.caught,false);assert.equal(observation.errors.length,0);assert(cell.ledger.some(row=>row.path==='/api/check'&&row.status===200));}
    await context.close();hold=false;
  }
}catch(error){failure=error.message;}finally{
  release?.();const navigation=cells.find(cell=>cell.navigation),reproduced=Boolean(navigation?.result.caught&&navigation.observation.errors.some(error=>error.message.includes('due to access control checks.'))&&!navigation.ledger.some(row=>row.path==='/api/check'));
  const result={engine,trigger,failure,controlValid:!failure&&cells.length===2,mechanism:reproduced?'blocked-new-fetch-during-provisional-navigation':'not-reproduced',cells};await writeFile(directory+'/'+engine+'-data-free-'+trigger+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify({engine,trigger,failure,controlValid:result.controlValid,mechanism:result.mechanism,cells:cells.map(cell=>({navigation:cell.navigation,result:cell.result,pageErrors:cell.observation.errors.length,windowErrors:cell.observation.windowErrors.length,unhandledRejections:cell.observation.unhandledRejections.length,serverApiRequests:cell.ledger.filter(row=>row.path==='/api/check'&&row.event==='start').length}))}));if(failure)process.exitCode=1;await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}
