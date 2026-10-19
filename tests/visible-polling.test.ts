import test from 'node:test';import assert from 'node:assert/strict';
import {startVisiblePolling,readIntervals,type PollEnvironment} from '../lib/visible-polling.ts';
function clock(){
  let now=0,visible=true,id=0;const timers=new Map<number,{at:number;fn:()=>void}>(),events=new Map<string,Set<()=>void>>();
  const env:PollEnvironment={now:()=>now,visible:()=>visible,later:(fn,ms)=>{timers.set(++id,{at:now+ms,fn});return id;},cancel:key=>{timers.delete(key as number);},listen:(name,fn)=>{if(!events.has(name))events.set(name,new Set());events.get(name)!.add(fn);return()=>events.get(name)!.delete(fn);}};
  const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
  return {env,settle,emit:(name:string)=>events.get(name)?.forEach(fn=>fn()),hide(){visible=false;this.emit('visibilitychange');},show(){visible=true;this.emit('visibilitychange');},async advance(ms:number){const end=now+ms;for(;;){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;now=next[1].at;timers.delete(next[0]);next[1].fn();await settle();}now=end;await settle();},timers,events};
}
test('hidden views do no polling; foreground refresh is immediate and coalesces focus/visibility',async()=>{
  const c=clock();let count=0;const p=startVisiblePolling(async()=>{count++;},30000,[],c.env);await c.advance(0);assert.equal(count,1);
  c.hide();await c.advance(3600000);assert.equal(count,1);c.show();c.emit('focus');await c.settle();assert.equal(count,2);
  await c.advance(30000);assert.equal(count,3);p.stop();await c.advance(3600000);assert.equal(count,3);assert.equal(c.timers.size,0);assert([...c.events.values()].every(rows=>rows.size===0));
});
test('one in-flight GET; mutation refresh follows an already running stale read exactly once',async()=>{
  const c=clock();let count=0,finish=()=>{};const p=startVisiblePolling(async()=>{count++;if(count===1)await new Promise<void>(resolve=>{finish=resolve;});},30000,['league-refresh'],c.env);
  await c.advance(0);await c.advance(90000);assert.equal(count,1);c.emit('league-refresh');c.emit('league-refresh');finish();await c.settle();assert.equal(count,2);p.stop();
});
test('identity cleanup aborts an obsolete read, even while token acquisition is pending',async()=>{
  const c=clock();let signal:AbortSignal|undefined;const p=startVisiblePolling(async input=>{signal=input;await new Promise<void>(resolve=>input.addEventListener('abort',()=>resolve()));},30000,[],c.env);await c.advance(0);p.stop();assert.equal(signal?.aborted,true);await c.settle();assert.equal(c.timers.size,0);
});
test('navigation stops old-document reads; BFCache pageshow refreshes safely',async()=>{
  const c=clock();let count=0;const p=startVisiblePolling(async()=>{count++;},30000,[],c.env);await c.advance(0);c.emit('beforeunload');await c.advance(120000);assert.equal(count,1);c.emit('pageshow');await c.settle();assert.equal(count,2);p.stop();
});
test('read failures back off exponentially to five minutes; success restores normal interval',async()=>{
  const c=clock();const at:number[]=[];let failed=true;const p=startVisiblePolling(async()=>{at.push(c.env.now());if(failed)throw Error('service unavailable');},30000,[],c.env);await c.advance(900000);assert.deepEqual(at,[0,60000,180000,420000,720000]);failed=false;await c.advance(120000);assert.equal(at.at(-1),1020000);await c.advance(30000);assert.equal(at.at(-1),1050000);p.stop();
});
test('backgrounding cancels an outstanding read; immediate resume queues a fresh GET',async()=>{
  const c=clock();let count=0;const p=startVisiblePolling(async signal=>{if(++count===1)await new Promise<void>(resolve=>signal.addEventListener('abort',()=>resolve()));},30000,[],c.env);await c.advance(0);c.hide();c.show();await c.settle();assert.equal(count,2);p.stop();
});
test('accepted-fixture hourly request/read model is reproducible using actual scheduler intervals',async()=>{
  const costs={league:3,registration:3,polls:4,discussions:7,operator:1,jury:9},old={league:15000,registration:15000,polls:15000,discussions:30000,operator:15000,jury:15000};let before=0,after=0,requests=0;const c=clock();
  const polls=Object.entries(costs).map(([key,cost])=>{before+=3600000/old[key as keyof typeof old]*cost;return startVisiblePolling(async()=>{requests++;after+=cost;},readIntervals[key as keyof typeof costs],[],c.env);});
  await c.advance(3599999);assert.equal(before,5640);assert.equal(after,2250);assert.equal(requests,450);c.hide();await c.advance(3600000);assert.equal(after,2250);polls.forEach(p=>p.stop());
});
