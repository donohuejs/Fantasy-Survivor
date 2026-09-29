'use client';

import {createContext,useContext,useEffect,useState} from 'react';
import {collection,onSnapshot} from 'firebase/firestore';
import {getFirebase} from '@/lib/firebase';
import {currentSeasonOpenPolls,type LeaguePoll} from '@/lib/community';
import {useGame} from './game-provider';

type PollResult={rows:LeaguePoll[];loading:boolean;error:string};
const PollContext=createContext<PollResult|null>(null);

export function CommunityPollProvider({children}:{children:React.ReactNode}){
  const {cloud}=useGame();
  const [state,setState]=useState<{rows:LeaguePoll[];loaded:boolean;error:string}>({rows:[],loaded:false,error:''});
  useEffect(()=>{
    if(!cloud){
      queueMicrotask(()=>setState({rows:[],loaded:true,error:''}));
      return;
    }
    const source=collection(getFirebase().db,'games','survivor-51','polls');
    return onSnapshot(source,snapshot=>setState({rows:snapshot.docs.map(doc=>doc.data() as LeaguePoll),loaded:true,error:''}),()=>setState({rows:[],loaded:true,error:'Could not load polls. Check your connection and make sure the updated Firebase rules are published.'}));
  },[cloud]);
  return <PollContext.Provider value={{rows:state.rows,loading:cloud&&!state.loaded,error:cloud?state.error:''}}>{children}</PollContext.Provider>;
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
