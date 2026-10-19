'use client';
import {useVisiblePolling} from '@/app/use-visible-polling';
import {readIntervals} from '@/lib/visible-polling';
import {createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import './staging.css';
import {StagingDiagnostics} from './diagnostics';
const OperatorContext=createContext({operator:false,refresh:async()=>{}});
export function useStagingOperator(){return useContext(OperatorContext);}
export const fixtureStorageKey='jury-staging-fixture-version';
export function StagingOperatorProvider({children}:{children:React.ReactNode}){
  const [operator,setOperator]=useState(false),[stale,setStale]=useState(false);
  const bar=useRef<HTMLElement|null>(null);
  useEffect(()=>{
    const measure=()=>{if(bar.current)document.documentElement.style.setProperty('--staging-controls-height',Math.ceil(bar.current.getBoundingClientRect().height)+'px');};
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);if(bar.current)observer?.observe(bar.current);measure();window.addEventListener('resize',measure);
    return()=>{observer?.disconnect();window.removeEventListener('resize',measure);document.documentElement.style.removeProperty('--staging-controls-height');};
  },[]);
  const read=useCallback(async(signal:AbortSignal)=>{try{const response=await fetch('/api/staging/operator',{cache:'no-store',signal}),body=await response.json();signal.throwIfAborted();setOperator(response.ok&&body.operator===true);if(response.ok&&body.operator&&Number.isSafeInteger(body.version)){const current=window.sessionStorage.getItem(fixtureStorageKey);if(current&&current!==String(body.version))setStale(true);else window.sessionStorage.setItem(fixtureStorageKey,String(body.version));}}catch(error){if(!signal.aborted)setOperator(false);throw error;}},[]);
  const refresh=useVisiblePolling(read,readIntervals.operator,true);
  useEffect(()=>{const changed=()=>setStale(true),storage=(event:StorageEvent)=>{if(event.key===fixtureStorageKey)changed();};window.addEventListener('staging-operator-refresh',refresh);window.addEventListener('staging-stale',changed);window.addEventListener('storage',storage);return()=>{window.removeEventListener('staging-operator-refresh',refresh);window.removeEventListener('staging-stale',changed);window.removeEventListener('storage',storage);};},[refresh]);
  return <OperatorContext.Provider value={{operator,refresh}}>{children}<aside ref={bar} className="staging-operator-bar" aria-label="Staging operator">{operator&&<Link href="/staging">Staging Controls</Link>}<StagingDiagnostics operator={operator}/>{operator&&stale&&<><span>The synthetic scenario changed.</span><button onClick={()=>{window.sessionStorage.removeItem(fixtureStorageKey);window.location.reload();}}>Reload this view</button></>}</aside></OperatorContext.Provider>;
}
