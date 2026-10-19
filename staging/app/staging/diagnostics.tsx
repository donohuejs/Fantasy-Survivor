'use client';
import {useEffect,useState} from 'react';
import {onAuthStateChanged} from 'firebase/auth';
import {getFirebase} from '@/lib/firebase';
import {useGame} from '@/app/game-provider';
import {stagingBuild} from './build-info';

const eventKey='jury-staging-navigation-events';
function record(type:string,detail:Record<string,unknown>={}){
  try{const old=JSON.parse(sessionStorage.getItem(eventKey)??'[]');const rows=Array.isArray(old)?old.slice(-24):[];rows.push({time:new Date().toISOString(),build:stagingBuild.id,type,path:location.pathname,...detail});sessionStorage.setItem(eventKey,JSON.stringify(rows));}catch{/* Diagnostics never affect authentication or navigation. */}
}
function renderedNavigation(){
  return [...document.querySelectorAll('a,button')].filter(node=>/game\s*master/i.test(node.textContent??'')||node instanceof HTMLAnchorElement&&/\/admin(?:[/?#]|$)/.test(node.getAttribute('href')??'')).map(node=>{
    const rect=node.getBoundingClientRect(),style=getComputedStyle(node),header=node.closest('[data-staging-component]');
    return {tag:node.tagName,text:node.textContent?.trim().slice(0,120),href:node instanceof HTMLAnchorElement?node.href:null,source:node.getAttribute('data-staging-nav-source')??header?.getAttribute('data-staging-component')??'unmarked',headerAdmin:header?.getAttribute('data-staging-is-admin')??null,headerUid:header?.getAttribute('data-staging-user-uid')??null,rendered:Boolean(node.getClientRects().length&&style.display!=='none'&&style.visibility!=='hidden'),inViewport:rect.right>0&&rect.left<innerWidth&&rect.bottom>0&&rect.top<innerHeight};
  });
}
export function StagingDiagnostics({operator}:{operator:boolean}){
  const {user,isAdmin,leagueAccess,authLoading}=useGame();
  const [captured,setCaptured]=useState<object|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{
    record('context',{uid:user?.uid??null,isAdmin,leagueAccess,authLoading});
  },[user?.uid,isAdmin,leagueAccess,authLoading]);
  useEffect(()=>{
    const page=(event:PageTransitionEvent)=>record(event.type,{persisted:event.persisted}),visibility=()=>record('visibility',{state:document.visibilityState}),history=()=>record('popstate');
    window.addEventListener('pageshow',page);window.addEventListener('pagehide',page);window.addEventListener('popstate',history);document.addEventListener('visibilitychange',visibility);
    let stop=()=>{};try{stop=onAuthStateChanged(getFirebase().auth,account=>record('firebase-auth',{uid:account?.uid??null}));}catch{record('firebase-unavailable');}
    return()=>{stop();window.removeEventListener('pageshow',page);window.removeEventListener('pagehide',page);window.removeEventListener('popstate',history);document.removeEventListener('visibilitychange',visibility);};
  },[]);
  async function capture(){
    setBusy(true);setMessage('');
    try{
      const account=getFirebase().auth.currentUser;
      const client={build:stagingBuild,url:location.href,userAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight},standalone:matchMedia('(display-mode:standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true,navigationType:(performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined)?.type??null,context:{uid:user?.uid??null,email:user?.email??null,isAdmin,leagueAccess,authLoading},firebase:{uid:account?.uid??null,email:account?.email??null,verified:account?.emailVerified??false},provider:document.querySelector('[data-staging-provider-diagnostics]') instanceof HTMLElement?{...(document.querySelector<HTMLElement>('[data-staging-provider-diagnostics]')!.dataset)}:null,headerCount:document.querySelectorAll('.site-header').length,navigation:renderedNavigation(),scripts:[...document.scripts].map(script=>script.src).filter(src=>src.startsWith(location.origin+'/_next/')),events:JSON.parse(sessionStorage.getItem(eventKey)??'[]')};
      const response=await fetch('/api/staging/diagnostics?probe='+Date.now(),{headers:account?{Authorization:'Bearer '+await account.getIdToken()}:{},cache:'no-store'}),server=await response.json();
      const probeUrl=new URL(location.href);probeUrl.searchParams.set('__staging_diagnostic_probe',String(Date.now()));
      const html=await fetch(probeUrl,{headers:{Accept:'text/html'},cache:'no-store'}),documentProbe={status:html.status,headers:Object.fromEntries(['cache-control','etag','vary','x-jury-staging-build','x-vercel-cache','x-vercel-id'].map(key=>[key,html.headers.get(key)]))};
      let serviceWorkers:unknown='unsupported',cacheNames:unknown='unsupported';
      try{if('serviceWorker' in navigator)serviceWorkers={controller:navigator.serviceWorker.controller?.scriptURL??null,registrations:(await navigator.serviceWorker.getRegistrations()).map(reg=>({scope:reg.scope,active:reg.active?.scriptURL??null,waiting:reg.waiting?.scriptURL??null,installing:reg.installing?.scriptURL??null}))};}catch{serviceWorkers='read unavailable';}
      try{if('caches' in window)cacheNames=await caches.keys();}catch{cacheNames='read unavailable';}
      const result={capturedAt:new Date().toISOString(),client,server:{status:response.status,buildHeader:response.headers.get('x-jury-staging-build'),...server},buildsMatch:response.ok&&server.build?.id===stagingBuild.id,documentProbe,serviceWorkers,cacheNames};
      setCaptured(result);record('captured',{buildsMatch:result.buildsMatch,uid:client.firebase.uid});
    }catch(error){setMessage(error instanceof Error?error.message:'Diagnostics unavailable.');}finally{setBusy(false);}
  }
  return <><span className="staging-build-id" data-testid="staging-build-id">Build {stagingBuild.id}</span>{operator&&<details className="staging-diagnostics" id="staging-diagnostics"><summary>Build &amp; navigation diagnostics</summary><div className="staging-diagnostics-panel"><strong>Loaded build: {stagingBuild.id}</strong><p>Capture while the unwanted button is visible. This does not reload, clear caches, switch identities or change league data.</p><button type="button" disabled={busy} onClick={()=>void capture()}>{busy?'Capturing…':'Capture without reloading'}</button>{captured&&<><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(JSON.stringify(captured,null,2));setMessage('Diagnostics copied. Contains synthetic identity/build information; no tokens or prediction answers.');}catch{setMessage('Copy unavailable. Select the diagnostic text below.');}}}>Copy diagnostics</button><pre aria-label="Staging navigation diagnostic report">{JSON.stringify(captured,null,2)}</pre></>}{message&&<p role="status">{message}</p>}</div></details>}</>;
}
