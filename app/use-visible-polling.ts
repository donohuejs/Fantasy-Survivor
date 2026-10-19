'use client';
import {useCallback,useEffect,useRef} from 'react';
import {startVisiblePolling} from '@/lib/visible-polling';
// The caller memoizes task by identity. Cleanup aborts the obsolete identity's GET.
export function useVisiblePolling(task:(signal:AbortSignal)=>Promise<void>,interval:number,enabled:boolean){
  const current=useRef<ReturnType<typeof startVisiblePolling>|null>(null);
  useEffect(()=>{
    if(!enabled)return;
    const poll=startVisiblePolling(task,interval);current.current=poll;
    return()=>{current.current=null;poll.stop();};
  },[task,interval,enabled]);
  return useCallback(async()=>{await current.current?.refresh();},[]);
}
