'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
import {getFirebase} from '@/lib/firebase';
import type {ConversationPage,DiscussionCatalog,ReadState,ThreadPage,ThreadPreview} from '@/lib/discussions';
import {useGame} from './game-provider';

export async function discussionRequest<T>(input:Record<string,unknown>,get=false,signal?:AbortSignal):Promise<T>{
  const user=getFirebase().auth.currentUser;if(!user)throw new Error('Sign in with Google first.');
  const token=await user.getIdToken(),params=new URLSearchParams();
  if(get)for(const [key,value] of Object.entries(input))if(value!==undefined&&value!==null)params.set(key,String(value));
  const response=await fetch('/api/discussions'+(get?'?'+params.toString():''),{method:get?'GET':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(get?{}:{body:JSON.stringify(input)}),cache:'no-store',signal});
  const result=await response.json().catch(()=>({error:`The server returned HTTP ${response.status}. Retry after refreshing.`}));
  if(!response.ok)throw new Error(result.error??'Unable to load or save discussions.');return result as T;
}
type DiscussionContextValue={
  catalog:DiscussionCatalog|null;eligible:boolean;loading:boolean;error:string;revision:number;
  refresh:()=>Promise<void>;revealed:Set<string>;reveal:(episodeId:string)=>void;
  mutate:(input:Record<string,unknown>)=>Promise<void>;unreadCount:number;
};
const DiscussionContext=createContext<DiscussionContextValue|null>(null);
export function DiscussionProvider({children}:{children:React.ReactNode}){
  const {game,user,isAdmin,cloud,authLoading}=useGame();
  const member=Boolean(user&&game.players.some(player=>player.uid?player.uid===user.uid:Boolean(player.email)&&player.email.toLowerCase()===user.email?.toLowerCase()));
  const eligible=cloud&&Boolean(user)&&(member||isAdmin)&&!authLoading,key=eligible?user!.uid:'';
  const [state,setState]=useState<{key:string;catalog:DiscussionCatalog|null;error:string;revision:number}>({key:'',catalog:null,error:'',revision:0});
  const [revealState,setRevealed]=useState<{key:string;ids:Set<string>}>({key:'',ids:new Set()});
  const activeKey=useRef(key);activeKey.current=key;
  const generation=useRef(0);
  const refresh=useCallback(async()=>{
    if(!key)return;const request=++generation.current;
    try{const catalog=await discussionRequest<DiscussionCatalog>({view:'catalog'},true);if(activeKey.current===key&&request===generation.current)setState(old=>({key,catalog,error:'',revision:old.revision+1}));}
    catch(error){if(activeKey.current===key&&request===generation.current)setState(old=>({key,catalog:old.key===key?old.catalog:null,error:error instanceof Error?error.message:'Could not load discussions.',revision:old.revision}));}
  },[key]);
  useEffect(()=>{
    if(!key)return;void refresh();
    const update=()=>{if(document.visibilityState==='visible')void refresh();};
    const timer=window.setInterval(update,30000);window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);
    return()=>{window.clearInterval(timer);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);};
  },[key,refresh,game.season.number]);
  const catalog=eligible&&state.key===key?state.catalog:null;
  const reveal=useCallback((id:string)=>setRevealed(old=>({key,ids:new Set([...(old.key===key?old.ids:[]),id])})),[key]);
  const mutate=useCallback(async(input:Record<string,unknown>)=>{await discussionRequest(input);await refresh();},[refresh]);
  const value=useMemo(()=>({catalog,eligible,loading:eligible&&!catalog&&!state.error,error:eligible&&state.key===key?state.error:'',revision:state.key===key?state.revision:0,refresh,revealed:revealState.key===key?revealState.ids:new Set<string>(),reveal,mutate,unreadCount:catalog?.episodes.filter(episode=>episode.available).reduce((sum,episode)=>sum+episode.unreadCount,0)??0}),[catalog,eligible,state,key,refresh,revealState,reveal,mutate]);
  return <DiscussionContext.Provider value={value}>{children}</DiscussionContext.Provider>;
}
export function useDiscussions(){const value=useContext(DiscussionContext);if(!value)throw new Error('DiscussionProvider missing');return value;}

export function useThreads(filters:{episodeId?:string;season?:number;unread?:boolean;sort?:string;pageSize?:number}){
  const {eligible,revision}=useDiscussions(),{user}=useGame();
  const encoded=JSON.stringify(filters),key=user?.uid+':'+encoded;
  const [state,setState]=useState<{key:string;rows:ThreadPreview[];cursor:string|null;error:string;loading:boolean}>({key:'',rows:[],cursor:null,error:'',loading:false});
  useEffect(()=>{
    if(!eligible)return;const abort=new AbortController();
    discussionRequest<ThreadPage>({view:'threads',...JSON.parse(encoded)},true,abort.signal).then(result=>setState({key,...result,error:'',loading:false})).catch(error=>{if(!abort.signal.aborted)setState({key,rows:[],cursor:null,error:error instanceof Error?error.message:'Could not load conversations.',loading:false});});
    return()=>abort.abort();
  },[encoded,key,eligible,revision]);
  const busy=useRef(false);
  async function loadMore(){
    if(!eligible||busy.current)return;busy.current=true;setState(old=>({...old,loading:true,error:''}));
    try{const result=await discussionRequest<ThreadPage>({view:'threads',...filters,...(state.key===key?{cursor:state.cursor}:{})},true);setState(old=>({key,rows:[...new Map([...(old.key===key?old.rows:[]),...result.rows].map(row=>[row.id,row])).values()],cursor:result.cursor,error:'',loading:false}));}
    catch(error){setState(old=>({...old,key,error:error instanceof Error?error.message:'Could not load conversations.',loading:false}));}finally{busy.current=false;}
  }
  return {rows:eligible&&state.key===key?state.rows:[],cursor:state.key===key?state.cursor:null,error:state.key===key?state.error:'',loading:eligible&&(state.key!==key||state.loading),loadMore};
}
export function useConversation(threadId:string,reveal:boolean){
  const {eligible,revision}=useDiscussions(),{user}=useGame(),key=user?.uid+':'+threadId+':'+reveal;
  const [state,setState]=useState<{key:string;page:ConversationPage|null;error:string;loading:boolean}>({key:'',page:null,error:'',loading:false});
  const loadedCount=useRef(50),busy=useRef(false);
  useEffect(()=>{
    if(!eligible)return;const abort=new AbortController();
    async function load(){
      const first=await discussionRequest<ConversationPage>({view:'conversation',threadId,reveal},true,abort.signal);
      let page=first;
      while(page.hasMore&&page.comments.length<loadedCount.current){const next=await discussionRequest<ConversationPage>({view:'conversation',threadId,reveal,after:page.through},true,abort.signal);page={...next,comments:[...page.comments,...next.comments]};}
      if(!abort.signal.aborted)setState({key,page,error:'',loading:false});
    }
    void load().catch(error=>{if(!abort.signal.aborted)setState({key,page:null,error:error instanceof Error?error.message:'Could not load replies.',loading:false});});return()=>abort.abort();
  },[key,threadId,reveal,eligible,revision]);
  async function loadMore(){
    if(!state.page||busy.current)return;busy.current=true;setState(old=>({...old,loading:true,error:''}));
    try{const next=await discussionRequest<ConversationPage>({view:'conversation',threadId,reveal,after:state.page.through},true);loadedCount.current+=50;setState(old=>({key,page:{...next,comments:[...(old.page?.comments??[]),...next.comments]},error:'',loading:false}));}
    catch(error){setState(old=>({...old,error:error instanceof Error?error.message:'Could not load replies.',loading:false}));}finally{busy.current=false;}
  }
  return {page:eligible&&state.key===key?state.page:null,error:state.key===key?state.error:'',loading:eligible&&(state.key!==key||state.loading),loadMore};
}
export function unreadFor(states:Record<string,ReadState>,threadId:string){return states[threadId]?.unreadCount??0;}
