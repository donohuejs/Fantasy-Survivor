'use client';
import {useEffect,useState} from 'react';
import {collection,onSnapshot,query,where,orderBy,limit} from 'firebase/firestore';
import {getFirebase} from '@/lib/firebase';
import type {EpisodeRecap,LeaguePoll,EpisodeComment} from '@/lib/community';
import {useGame} from '../game-provider';

type Result<T>={key:string;rows:T[];error:string;loaded:boolean};
function useList<T extends EpisodeRecap|LeaguePoll>(name:'episodes'|'polls',drafts=false){
  const {cloud,isAdmin,user}=useGame();
  const privateView=drafts&&isAdmin;
  const scope=name+':'+(privateView?user?.uid??'local':'public');
  const [state,setState]=useState<Result<T>>({key:'',rows:[],error:'',loaded:false});
  useEffect(()=>{
    if(!cloud)return;
    const ref=collection(getFirebase().db,'games','survivor-51',name);
    const source=name==='episodes'&&!privateView?query(ref,where('status','==','published')):ref;
    return onSnapshot(source,snapshot=>setState({key:scope,rows:snapshot.docs.map(d=>d.data() as T),error:'',loaded:true}),()=>setState({key:scope,rows:[],error:'Could not load '+name+'. Check your connection and make sure the updated Firebase rules are published.',loaded:true}));
  },[cloud,name,privateView,scope]);
  return {rows:state.key===scope?state.rows:[],loading:cloud&&(state.key!==scope||!state.loaded),error:!cloud?'Connect Firebase to use recaps, comments, and polls.':state.key===scope?state.error:''};
}
export function useRecaps(drafts=false){return useList<EpisodeRecap>('episodes',drafts);}
export function usePolls(){return useList<LeaguePoll>('polls');}
export function useComments(episodeId:string,count:number){
  const {cloud,user,isAdmin}=useGame();
  const scope=episodeId+':'+count+':'+(isAdmin?user?.uid??'local':'public');
  const [state,setState]=useState<Result<EpisodeComment>>({key:'',rows:[],error:'',loaded:false});
  useEffect(()=>{
    if(!cloud)return;
    const source=query(collection(getFirebase().db,'games','survivor-51','episodes',episodeId,'comments'),orderBy('createdAt','desc'),limit(count));
    return onSnapshot(source,snapshot=>setState({key:scope,rows:snapshot.docs.map(d=>d.data() as EpisodeComment).reverse(),error:'',loaded:true}),()=>setState({key:scope,rows:[],error:'Comments could not load. Check the connection and Firebase rules.',loaded:true}));
  },[cloud,episodeId,count,scope]);
  return {rows:state.key===scope?state.rows:[],loading:cloud&&(state.key!==scope||!state.loaded),error:state.key===scope?state.error:''};
}
export async function communityRequest(input:Record<string,unknown>,pollId?:string):Promise<{ok?:boolean;updatedAt?:string;choice?:number|null}>{
  const user=getFirebase().auth.currentUser;
  if(!user)throw new Error('Sign in with Google first.');
  const token=await user.getIdToken();
  const response=await fetch('/api/community'+(pollId?'?pollId='+encodeURIComponent(pollId):''),{method:pollId?'GET':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(pollId?{}:{body:JSON.stringify(input)}),cache:'no-store'});
  const result=await response.json().catch(()=>({error:'Unexpected server response. Reload before trying again.'}));
  if(!response.ok)throw new Error(result.error??'Unable to complete the request.');
  return result;
}
