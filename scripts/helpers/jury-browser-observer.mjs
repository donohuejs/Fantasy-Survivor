// Test-only observation. Never logs tokens, passwords, cookies, bodies or answers,
// intercepts requests, or prevents browser error/rejection events.
export function redactBrowserMessage(value){return String(value??'').replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g,'[redacted JWT]').replace(/([?&](?:key|token|password)=)[^&\s]+/gi,'$1[redacted]').slice(0,4000);}
export function syntheticRequestClaims(header){
  try{const value=JSON.parse(Buffer.from(header?.replace(/^Bearer /,'').split('.')[1]??'','base64url').toString());
    if(value.aud!=='fantasy-survivor-jury-staging'||!/^staging-(commissioner|active|jury|complete|legacy|unlinked)$/.test(value.sub))return null;
    return {uid:value.sub,emailVerified:value.email_verified===true,issuedAt:value.iat,authTime:value.auth_time};
  }catch{return null;}
}
export async function observeJuryBrowser(page,{base,phase,onError=()=>{}}){
  const events=[],errors=[],origin=new URL(base).origin,requests=new WeakMap();let sequence=0,lastState=null;
  const add=(event,detail={})=>{const value={event,time:Date.now(),iso:new Date().toISOString(),phase:phase(),...detail};events.push(value);return value;};
  page.on('pageerror',error=>{const value=add('pageerror',{name:error.name,message:redactBrowserMessage(error.message),stack:redactBrowserMessage(error.stack),page:page.url(),lastState});errors.push(value);onError(value);});
  page.on('console',message=>{const text=message.text();if(text.startsWith('__JURY_BROWSER_OBSERVER__')){try{const observed=JSON.parse(text.slice('__JURY_BROWSER_OBSERVER__'.length));if(observed.message)observed.message=redactBrowserMessage(observed.message);if(observed.stack)observed.stack=redactBrowserMessage(observed.stack);lastState=observed.state??lastState;add('window-signal',observed);}catch{add('observer-message-unreadable');}}else if(message.type()==='error')add('console-error',{message:redactBrowserMessage(text),location:message.location()});});
  page.on('request',request=>{const url=new URL(request.url());if(url.origin!==origin)return;const id=++sequence,headers=request.headers(),entry=add('request',{id,path:url.pathname,view:['admin','suggestion'].includes(url.searchParams.get('view'))?url.searchParams.get('view'):null,rsc:url.searchParams.has('_rsc')||headers.rsc==='1',method:request.method(),resource:request.resourceType(),navigation:request.isNavigationRequest(),claimedActor:syntheticRequestClaims(headers.authorization)});requests.set(request,entry);});
  page.on('response',response=>{const request=requests.get(response.request());if(request)add('response',{id:request.id,path:request.path,status:response.status(),elapsed:Date.now()-request.time,claimedActor:request.claimedActor});});
  page.on('requestfailed',request=>{const start=requests.get(request);if(start)add('requestfailed',{id:start.id,path:start.path,error:redactBrowserMessage(request.failure()?.errorText),elapsed:Date.now()-start.time,claimedActor:start.claimedActor});});
  page.on('requestfinished',request=>{const start=requests.get(request);if(start)add('requestfinished',{id:start.id,path:start.path,elapsed:Date.now()-start.time});});
  page.on('framenavigated',frame=>{if(frame===page.mainFrame())add('navigation',{path:frame.url()});});
  await page.addInitScript(()=>{
    const state=()=>{const provider=document.querySelector('[data-staging-provider-diagnostics]');return {uid:provider?.getAttribute('data-user-uid')??null,isAdmin:provider?.getAttribute('data-is-admin')??null,accessUid:provider?.getAttribute('data-access-uid')??null,serverCommissioner:provider?.getAttribute('data-server-commissioner')??null,adminLinks:document.querySelectorAll('nav a[href="/admin"]').length,privateCards:document.querySelectorAll('.jury-prediction-card').length,adminWorkspace:document.querySelectorAll('.admin-workspace').length,operatorLink:document.querySelectorAll('.staging-operator-bar a[href="/staging"]').length};};
    const emit=(kind,detail={})=>console.debug('__JURY_BROWSER_OBSERVER__'+JSON.stringify({kind,clientTime:Date.now(),path:location.pathname,state:state(),...detail}));
    window.addEventListener('error',event=>emit('window-error',{name:event.error?.name??null,message:String(event.message),stack:String(event.error?.stack??''),filename:event.filename,line:event.lineno,column:event.colno}));
    window.addEventListener('unhandledrejection',event=>emit('unhandled-rejection',{name:event.reason?.name??null,message:String(event.reason?.message??event.reason),stack:String(event.reason?.stack??'')}));
    window.addEventListener('pageshow',event=>emit('pageshow',{persisted:event.persisted}));window.addEventListener('pagehide',event=>emit('pagehide',{persisted:event.persisted}));
    const observe=()=>new MutationObserver(()=>emit('identity-dom-change')).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['data-user-uid','data-is-admin','data-access-uid','data-access-status','data-server-commissioner','data-staging-is-admin']});
    if(document.documentElement)observe();else window.addEventListener('DOMContentLoaded',observe,{once:true});
  });
  async function mark(name){let state;try{state=await page.evaluate(()=>{const p=document.querySelector('[data-staging-provider-diagnostics]');return {uid:p?.getAttribute('data-user-uid')??null,isAdmin:p?.getAttribute('data-is-admin')??null,adminLinks:document.querySelectorAll('nav a[href="/admin"]').length,privateCards:document.querySelectorAll('.jury-prediction-card').length,adminWorkspace:document.querySelectorAll('.admin-workspace').length};});lastState=state;}catch{state={unavailable:'document replacement'};}add('mark',{name,state});}
  function report(){
    const signals=events.filter(event=>event.event==='window-signal'),privacyViolations=signals.filter(event=>event.state?.uid&&event.state.uid!=='staging-commissioner'&&(event.state.isAdmin==='true'||event.state.adminLinks||event.state.privateCards||event.state.adminWorkspace));
    return {events,errors,privacyViolations,windowErrors:signals.filter(event=>event.kind==='window-error'),unhandledRejections:signals.filter(event=>event.kind==='unhandled-rejection'),httpDenials:events.filter(event=>event.event==='response'&&[401,403].includes(event.status)),correlations:errors.map(error=>({time:error.time,message:error.message,name:error.name,stack:error.stack,nearby:events.filter(event=>['requestfailed','response','navigation'].includes(event.event)&&Math.abs(event.time-error.time)<250)}))};
  }
  return {mark,report,errors};
}
