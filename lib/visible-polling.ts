// Read refresh scheduling only. Writes and server authorization never use this timer.
export const readIntervals={league:30000,registration:120000,polls:60000,recaps:60000,discussions:60000,jury:30000,operator:60000,staging:60000} as const;
export type PollEnvironment={now:()=>number;visible:()=>boolean;later:(fn:()=>void,ms:number)=>unknown;cancel:(id:unknown)=>void;listen:(name:string,fn:()=>void)=>()=>void};
function browserEnvironment():PollEnvironment{return {
  now:()=>Date.now(),visible:()=>document.visibilityState!=='hidden',
  later:(fn,ms)=>window.setTimeout(fn,ms),cancel:id=>window.clearTimeout(id as number),
  listen:(name,fn)=>{const target=name==='visibilitychange'?document:window;target.addEventListener(name,fn);return()=>target.removeEventListener(name,fn);},
};}
export function startVisiblePolling(task:(signal:AbortSignal)=>Promise<void>,interval:number,events:readonly string[]=[],env:PollEnvironment=browserEnvironment()){
  let stopped=false,leaving=false,paused=false,timer:unknown,controller:AbortController|undefined,inflight:Promise<void>|undefined,failures=0,last=-Infinity,queued=false;
  const visible=()=>!stopped&&!leaving&&env.visible();
  const clear=()=>{if(timer!==undefined)env.cancel(timer);timer=undefined;};
  function schedule(){clear();if(visible())timer=env.later(()=>{void refresh();},Math.min(300000,interval*2**Math.min(failures,8)));}
  function refresh(force=false):Promise<void>{
    if(!visible())return Promise.resolve();
    if(inflight){if(force)queued=true;return inflight;}
    clear();last=env.now();const abort=new AbortController();controller=abort;
    let timedOut=false;const timeout=env.later(()=>{timedOut=true;abort.abort();},30000);
    inflight=(async()=>{
      try{await task(abort.signal);if(!abort.signal.aborted)failures=0;}
      catch{if(!abort.signal.aborted||timedOut)failures++;}
      finally{env.cancel(timeout);if(timedOut&&failures===0)failures=1;controller=undefined;}
    })().then(async()=>{
      inflight=undefined;
      if(queued&&visible()){queued=false;await refresh();}else{queued=false;schedule();}
    });
    return inflight;
  }
  const pause=()=>{paused=true;clear();queued=false;controller?.abort();};
  const resume=()=>{if(visible()&&(paused||env.now()-last>=1000)){paused=false;void refresh(true);}};
  const onVisibility=()=>{if(env.visible())resume();else pause();};
  const leave=()=>{leaving=true;pause();};
  const show=()=>{leaving=false;resume();};
  const stops=[env.listen('visibilitychange',onVisibility),env.listen('focus',resume),env.listen('beforeunload',leave),env.listen('pagehide',leave),env.listen('pageshow',show),...events.map(event=>env.listen(event,()=>{void refresh(true);}))];
  timer=env.later(()=>{void refresh();},0);
  return {refresh:()=>refresh(true),stop:()=>{stopped=true;pause();stops.forEach(stop=>stop());}};
}
