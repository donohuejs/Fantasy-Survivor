import test from 'node:test';import assert from 'node:assert/strict';
import {redactBrowserMessage,syntheticRequestClaims,observeJuryBrowser} from '../scripts/helpers/jury-browser-observer.mjs';
function token(aud='fantasy-survivor-jury-staging',sub='staging-active'){return 'eyJhbGciOiJub25lIn0.'+Buffer.from(JSON.stringify({aud,sub,email_verified:true,iat:123,auth_time:100})).toString('base64url')+'.synthetic-signature';}
test('browser diagnostics retain only bounded synthetic claims and redact credentials from errors',()=>{
  const value=token();assert.deepEqual(syntheticRequestClaims('Bearer '+value),{uid:'staging-active',emailVerified:true,issuedAt:123,authTime:100});assert.equal(syntheticRequestClaims('Bearer '+token('foreign-project')),null);assert.equal(syntheticRequestClaims('Bearer '+token(undefined,'other-user')),null);assert.equal(syntheticRequestClaims('Bearer invalid'),null);
  const text=redactBrowserMessage('Bearer '+value+' https://test.invalid/?token=private&password=secret&key=private');assert(!text.includes(value)&&!text.includes('secret')&&!text.includes('=private'));assert(redactBrowserMessage('x'.repeat(5000)).length<=4000);
});
async function observed(){
  const handlers=new Map<string,Array<(value:unknown)=>void>>(),page={on:(event:string,callback:(value:unknown)=>void)=>{handlers.set(event,[...(handlers.get(event)??[]),callback]);},addInitScript:async()=>{},url:()=> 'https://127.0.0.1:3119/admin',evaluate:async()=>({uid:'staging-active',isAdmin:'false'})};
  const observer=await observeJuryBrowser(page,{base:'https://127.0.0.1:3119',phase:()=> 'focused-test'});return {observer,emit:(event:string,value:unknown)=>handlers.get(event)?.forEach(callback=>callback(value))};
}
test('HTTP authorization denial is distinct from runtime exceptions; actual exceptions remain recorded',async()=>{
  const {observer,emit}=await observed(),request={url:()=> 'https://127.0.0.1:3119/api/admin',headers:()=>({authorization:'Bearer '+token()}),method:()=> 'GET',resourceType:()=> 'fetch',isNavigationRequest:()=> false};emit('request',request);emit('response',{request:()=>request,status:()=>403});
  assert.equal(observer.report().httpDenials.length,1);assert.equal(observer.report().errors.length,0);emit('pageerror',new Error('application exception'));assert.equal(observer.report().errors.length,1);assert.match(observer.report().errors[0].stack,/application exception/);assert(!JSON.stringify(observer.report()).includes(token()));
});
test('identity observations flag ordinary-account privileged DOM and keep unhandled rejection evidence',async()=>{
  const {observer,emit}=await observed();emit('console',{text:()=> '__JURY_BROWSER_OBSERVER__'+JSON.stringify({kind:'unhandled-rejection',message:'unexpected request failure',state:{uid:'staging-active',isAdmin:'false',adminLinks:1,privateCards:2}})});const report=observer.report();assert.equal(report.unhandledRejections.length,1);assert.equal(report.privacyViolations.length,1);
});
