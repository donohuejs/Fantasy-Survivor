'use client';
import {startVisiblePolling,readIntervals} from '@/lib/visible-polling';
import {useEffect,useState} from 'react';
import {leagueRequest} from '../league-client';
import {getFirebase} from '@/lib/firebase';
import type {EpisodeRecap,LeaguePoll} from '@/lib/community';
import {useGame} from '../game-provider';
export {usePolls} from '../community-polls';

type Result<T>={key:string;rows:T[];error:string;loaded:boolean};
function useList<T extends EpisodeRecap|LeaguePoll>(name:'episodes'|'polls',drafts=false,enabled=true){
  const {cloud,isAdmin,user,leagueAccess}=useGame();
  const privateView=drafts&&isAdmin;
  const authorized=leagueAccess==='authorized';
  const scope=name+':'+(user?.uid??'')+':'+privateView;
  const [state,setState]=useState<Result<T>>({key:'',rows:[],error:'',loaded:false});
  useEffect(()=>{
    if(!cloud||!enabled||!authorized)return;let active=true;
    async function refresh(signal:AbortSignal){try{const result=await leagueRequest<{rows:T[]}>(name==='episodes'?'recaps':'polls',signal);if(active&&!signal.aborted)setState({key:scope,rows:result.rows.filter(row=>privateView||name!=='episodes'||(row as EpisodeRecap).status==='published'),error:'',loaded:true});}catch(error){if(active&&!signal.aborted)setState({key:scope,rows:[],error:'Could not load '+name+'. Check your connection.',loaded:true});throw error;}}
    const poll=startVisiblePolling(refresh,readIntervals.recaps,['league-refresh']);
    return()=>{active=false;poll.stop();};
  },[cloud,name,privateView,scope,enabled,authorized]);
  return {rows:enabled&&authorized&&state.key===scope?state.rows:[],loading:enabled&&cloud&&authorized&&(state.key!==scope||!state.loaded),error:!cloud?'Connect Firebase to use recaps, comments, and polls.':enabled&&authorized&&state.key===scope?state.error:''};
}
export function useRecaps(drafts=false,enabled=true){return useList<EpisodeRecap>('episodes',drafts,enabled);}
export async function communityRequest(input:Record<string,unknown>,pollId?:string):Promise<{ok?:boolean;updatedAt?:string;choice?:number|null}>{
  const user=getFirebase().auth.currentUser;
  if(!user)throw new Error('Sign in with Google first.');
  const token=await user.getIdToken();
  const response=await fetch('/api/community'+(pollId?'?pollId='+encodeURIComponent(pollId):''),{method:pollId?'GET':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(pollId?{}:{body:JSON.stringify(input)}),cache:'no-store'});
  const body=await response.text();
  let result:{error?:string;ok?:boolean;updatedAt?:string;choice?:number|null};
  try{result=JSON.parse(body) as typeof result;}catch{throw new Error(`The server returned an unexpected response (HTTP ${response.status}). Reload before trying again.`);}
  if(!response.ok)throw new Error(result.error??'Unable to complete the request.');
  if(!pollId)window.dispatchEvent(new Event('league-refresh'));
  return result;
}
