'use client';
import {startVisiblePolling,readIntervals} from '@/lib/visible-polling';

import {createContext,useContext,useEffect,useState} from 'react';
import {leagueRequest} from './league-client';
import {currentSeasonOpenPolls,type LeaguePoll} from '@/lib/community';
import {useGame} from './game-provider';

type PollResult={rows:LeaguePoll[];loading:boolean;error:string};
const PollContext=createContext<PollResult|null>(null);

export function CommunityPollProvider({children}:{children:React.ReactNode}){
  const {cloud,user,leagueAccess}=useGame();
  const key=leagueAccess==='authorized'?user?.uid??'':'';
  const [state,setState]=useState<{key:string;rows:LeaguePoll[];loaded:boolean;error:string}>({key:'',rows:[],loaded:false,error:''});
  useEffect(()=>{
    if(!cloud||!key)return;let active=true;
    async function refresh(signal:AbortSignal){try{const result=await leagueRequest<{rows:LeaguePoll[]}>('polls',signal);if(active&&!signal.aborted)setState({key,rows:result.rows,loaded:true,error:''});}catch(error){if(active&&!signal.aborted)setState({key,rows:[],loaded:true,error:'Could not load polls. Check your connection.'});throw error;}}
    const poll=startVisiblePolling(refresh,readIntervals.polls,['league-refresh']);
    return()=>{active=false;poll.stop();};
  },[cloud,key]);
  return <PollContext.Provider value={{rows:key&&state.key===key?state.rows:[],loading:Boolean(key&&state.key!==key),error:key&&state.key===key?state.error:''}}>{children}</PollContext.Provider>;
}

export function usePolls(){
  const value=useContext(PollContext);
  if(!value)throw new Error('CommunityPollProvider missing');
  return value;
}

export function useCurrentSeasonOpenPolls(){
  const {game}=useGame();
  const polls=usePolls();
  return {...polls,rows:currentSeasonOpenPolls(polls.rows,game.season.number)};
}
