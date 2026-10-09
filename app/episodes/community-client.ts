'use client';
import {useEffect,useState} from 'react';
import {collection,onSnapshot,query,where} from 'firebase/firestore';
import {getFirebase} from '@/lib/firebase';
import type {EpisodeRecap,LeaguePoll} from '@/lib/community';
import {useGame} from '../game-provider';
export {usePolls} from '../community-polls';

type Result<T>={key:string;rows:T[];error:string;loaded:boolean};
function useList<T extends EpisodeRecap|LeaguePoll>(name:'episodes'|'polls',drafts=false,enabled=true){
  const {cloud,isAdmin,user}=useGame();
  const privateView=drafts&&isAdmin;
  const scope=name+':'+(privateView?user?.uid??'local':'public');
  const [state,setState]=useState<Result<T>>({key:'',rows:[],error:'',loaded:false});
  useEffect(()=>{
    if(!cloud||!enabled)return;
    const ref=collection(getFirebase().db,'games','survivor-51',name);
    const source=name==='episodes'&&!privateView?query(ref,where('status','==','published')):ref;
    return onSnapshot(source,snapshot=>setState({key:scope,rows:snapshot.docs.map(d=>d.data() as T),error:'',loaded:true}),()=>setState({key:scope,rows:[],error:'Could not load '+name+'. Check your connection and make sure the updated Firebase rules are published.',loaded:true}));
  },[cloud,name,privateView,scope,enabled]);
  return {rows:enabled&&state.key===scope?state.rows:[],loading:enabled&&cloud&&(state.key!==scope||!state.loaded),error:!cloud?'Connect Firebase to use recaps, comments, and polls.':enabled&&state.key===scope?state.error:''};
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
  return result;
}
