'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { firebaseConfigured, getFirebase, type FirebaseUser } from '@/lib/firebase';
import { buildDraftTurns, categories, initialGame, type DraftPick, type GameState, type ScoreEvent } from '@/lib/game-data';

type GameContextValue = {
  game:GameState; loading:boolean; user:FirebaseUser|null; isAdmin:boolean; cloud:boolean;
  castawayScores:Record<string,number>; standings:Array<{id:string;name:string;score:number;picks:string;rank:number}>;
  login:()=>Promise<void>; logout:()=>Promise<void>; addScore:(data:Omit<ScoreEvent,'id'|'createdAt'|'points'> & {categoryId:string})=>Promise<void>;
  addAdjustment:(playerId:string,points:number,note:string)=>Promise<void>; savePick:(pick:Omit<DraftPick,'id'|'multiplier'> & {blind:boolean})=>Promise<void>;
  addPlayer:(name:string,email:string)=>Promise<void>; setPlayerEmail:(playerId:string,email:string)=>Promise<void>; startDraft:()=>Promise<void>; toggleDraft:()=>Promise<void>; undoDraftPick:()=>Promise<void>; submitPlayerPick:(castawayId:string)=>Promise<void>; resetSeason:()=>Promise<void>;
};

const GameContext = createContext<GameContextValue | null>(null);
const storageKey = 'fantasy-survivor-51-game';

export function GameProvider({children}:{children:React.ReactNode}) {
  const [game,setGame] = useState<GameState>(initialGame);
  const [loading,setLoading] = useState(firebaseConfigured);
  const [user,setUser] = useState<FirebaseUser|null>(null);
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.toLowerCase();
  const localSetup = !firebaseConfigured && process.env.NODE_ENV !== 'production';
  const isAdmin = localSetup || Boolean(user?.email && user.email.toLowerCase() === adminEmail);

  useEffect(() => {
    if (!firebaseConfigured) {
      const saved = window.localStorage.getItem(storageKey);
      queueMicrotask(() => {
        if (saved) try { setGame(JSON.parse(saved)); } catch { /* use clean seed */ }
        setLoading(false);
      });
      return;
    }
    let stops:Array<()=>void>=[]; let active=true;
    getFirebase().then((firebase)=>{if(!active||!firebase){setLoading(false);return}const auth=firebase.auth();const ref=firebase.firestore().collection('games').doc('survivor-51');stops=[auth.onAuthStateChanged(setUser),ref.onSnapshot((snapshot)=>{if(snapshot.exists){const saved=snapshot.data() as GameState;setGame({...saved,draft:saved.draft??initialGame.draft,players:saved.players.map((player,index)=>({...player,email:player.email??'',priorFinish:player.priorFinish??index+1,draftSlot:player.draftSlot??saved.players.length-index}))})}setLoading(false)},()=>setLoading(false))]});
    return () => { active=false; stops.forEach((stop)=>stop()); };
  },[]);

  async function persist(next:GameState) {
    setGame(next);
    if (firebaseConfigured) { const firebase=await getFirebase(); if(!firebase) throw new Error('Firebase did not load'); await firebase.firestore().collection('games').doc('survivor-51').set(next); }
    else window.localStorage.setItem(storageKey,JSON.stringify(next));
  }

  const castawayScores = useMemo(() => Object.fromEntries(game.castaways.map((castaway) => [castaway.id,game.scoreEvents.filter((event) => event.castawayId === castaway.id).reduce((sum,event) => sum + event.points,0)])),[game]);
  const standings = useMemo(() => game.players.map((player) => {
    const picks = game.draftPicks.filter((pick) => pick.playerId === player.id);
    const pickScore = picks.reduce((sum,pick) => sum + (castawayScores[pick.castawayId] ?? 0) * pick.multiplier,0);
    const direct = game.scoreEvents.filter((event) => event.playerId === player.id).reduce((sum,event) => sum + event.points,0);
    return {id:player.id,name:player.name,score:player.entryBonus + pickScore + direct,picks:picks.map((pick) => pick.round===3&&game.draft.status!=='complete'?'Blind pick locked':game.castaways.find((c) => c.id === pick.castawayId)?.shortName).filter(Boolean).join(' · ') || 'Draft pending',rank:0};
  }).sort((a,b) => b.score-a.score || a.name.localeCompare(b.name)).map((player,index) => ({...player,rank:index+1})),[game,castawayScores]);

  async function login() { const firebase=await getFirebase(); if(firebase) await firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
  async function logout() { const firebase=await getFirebase(); if(firebase) await firebase.auth().signOut(); }
  async function addScore(input:Omit<ScoreEvent,'id'|'createdAt'|'points'> & {categoryId:string}) {
    const category = categories.find((item) => item.id === input.categoryId); if (!category) return;
    await persist({...game,season:{...game.season,currentEpisode:Math.max(game.season.currentEpisode,input.episode ?? 1)},scoreEvents:[...game.scoreEvents,{...input,id:crypto.randomUUID(),points:category.points,createdAt:new Date().toISOString()}]});
  }
  async function addAdjustment(playerId:string,points:number,note:string) { await persist({...game,scoreEvents:[...game.scoreEvents,{id:crypto.randomUUID(),playerId,points,note,createdAt:new Date().toISOString()}]}); }
  async function savePick(input:Omit<DraftPick,'id'|'multiplier'> & {blind:boolean}) {
    const draftPicks = game.draftPicks.filter((pick) => !(pick.playerId===input.playerId && pick.round===input.round));
    draftPicks.push({id:crypto.randomUUID(),playerId:input.playerId,castawayId:input.castawayId,round:input.round,pickNumber:input.pickNumber,multiplier:input.round===3&&input.blind?1.25:1});
    const turn=game.draft.turns[game.draft.currentPick];
    const advances=game.draft.status==='live'&&turn?.playerId===input.playerId&&turn.round===input.round;
    const currentPick=advances?game.draft.currentPick+1:game.draft.currentPick;
    await persist({...game,draftPicks,draft:{...game.draft,currentPick,status:advances&&currentPick>=game.draft.turns.length?'complete':game.draft.status}});
  }
  async function addPlayer(name:string,email:string) { const priorFinish=game.players.length+1; await persist({...game,players:[...game.players,{id:crypto.randomUUID(),name,email:email.toLowerCase(),entryBonus:0,priorFinish,draftSlot:1}]}); }
  async function setPlayerEmail(playerId:string,email:string) { await persist({...game,players:game.players.map((player)=>player.id===playerId?{...player,email:email.trim().toLowerCase()}:player)}); }
  async function startDraft() { const turns=buildDraftTurns(game.players); if(turns.some((turn)=>!turn.email)) throw new Error('Every player needs an email before the draft can start.'); await persist({...game,draftPicks:[],draft:{status:'live',currentPick:0,turns}}); }
  async function toggleDraft() { if(game.draft.status==='complete'||game.draft.status==='setup') return; await persist({...game,draft:{...game.draft,status:game.draft.status==='live'?'paused':'live'}}); }
  async function undoDraftPick() { if(!game.draftPicks.length) return; const currentPick=Math.max(0,game.draft.currentPick-1); await persist({...game,draftPicks:game.draftPicks.slice(0,-1),draft:{...game.draft,currentPick,status:'paused'}}); }
  async function submitPlayerPick(castawayId:string) { const turn=game.draft.turns[game.draft.currentPick]; if(!turn||game.draft.status!=='live'||user?.email?.toLowerCase()!==turn.email) throw new Error('It is not your turn.'); const nextPick=game.draft.currentPick+1; const pick:DraftPick={id:crypto.randomUUID(),playerId:turn.playerId,castawayId,round:turn.round,pickNumber:turn.pickNumber,multiplier:turn.round===3?1.25:1}; await persist({...game,draftPicks:[...game.draftPicks,pick],draft:{...game.draft,currentPick:nextPick,status:nextPick>=game.draft.turns.length?'complete':'live'}}); }
  async function resetSeason() { const players=game.players.map((player)=>({...player})); await persist({...initialGame,players,draft:{status:'setup',currentPick:0,turns:buildDraftTurns(players)}}); }
  return <GameContext.Provider value={{game,loading,user,isAdmin,cloud:firebaseConfigured,castawayScores,standings,login,logout,addScore,addAdjustment,savePick,addPlayer,setPlayerEmail,startDraft,toggleDraft,undoDraftPick,submitPlayerPick,resetSeason}}>{children}</GameContext.Provider>;
}

export function useGame() { const value=useContext(GameContext); if (!value) throw new Error('GameProvider missing'); return value; }
