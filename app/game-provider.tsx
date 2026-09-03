'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { firebaseConfigured, getFirebase, authenticationError, type FirebaseUser } from '@/lib/firebase';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc, runTransaction } from 'firebase/firestore';
import { buildDraftTurns, initialGame, type DraftPick, type GameState, type Tribe, type Castaway } from '@/lib/game-data';
import { recordScoring,saveCustomAction,saveTribe,assignCastaway,type ScoringInput,type CustomActionInput } from '@/lib/scoring';

type GameContextValue = {
  game:GameState; loading:boolean; user:FirebaseUser|null; isAdmin:boolean; cloud:boolean; authLoading:boolean; authBusy:boolean;
  castawayScores:Record<string,number>; standings:Array<{id:string;name:string;score:number;picks:string;rank:number}>;
  login:()=>Promise<void>; logout:()=>Promise<void>; addScore:(data:ScoringInput)=>Promise<void>;
  addCustomAction:(input:CustomActionInput)=>Promise<string>; updateTribe:(tribe:Tribe)=>Promise<void>; updateCastaway:(id:string,tribeId:string,status:Castaway['status'])=>Promise<void>;
  addAdjustment:(playerId:string,points:number,note:string)=>Promise<void>; savePick:(pick:Omit<DraftPick,'id'|'multiplier'> & {blind:boolean})=>Promise<void>;
  addPlayer:(name:string,email:string)=>Promise<void>; setPlayerEmail:(playerId:string,email:string)=>Promise<void>; startDraft:()=>Promise<void>; toggleDraft:()=>Promise<void>; undoDraftPick:()=>Promise<void>; submitPlayerPick:(castawayId:string)=>Promise<void>; resetSeason:()=>Promise<void>;
};

const GameContext = createContext<GameContextValue | null>(null);
const storageKey = 'fantasy-survivor-51-game';

function withOfficialCastawayProfiles(saved:GameState):GameState {
  return {
    ...saved,
    tribes:saved.tribes??initialGame.tribes,
    categories:saved.categories??initialGame.categories,
    season:{...saved.season,entryFee:initialGame.season.entryFee},
    castaways:saved.castaways.map((castaway) => {
      const official = initialGame.castaways.find((item) => item.id === castaway.id);
      return official ? {...castaway,name:official.name,shortName:official.shortName,age:official.age,occupation:official.occupation,bio:official.bio,imageUrl:official.imageUrl} : castaway;
    }),
  };
}

export function GameProvider({children}:{children:React.ReactNode}) {
  const [game,setGame] = useState<GameState>(initialGame);
  const [loading,setLoading] = useState(firebaseConfigured);
  const [user,setUser] = useState<FirebaseUser|null>(null);
  const [authLoading,setAuthLoading] = useState(firebaseConfigured);
  const [authBusy,setAuthBusy] = useState(false);
  const [authError,setAuthError] = useState('');
  const adminEmails = new Set([
    'donohue.js@gmail.com',
    process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase(),
  ].filter((email):email is string => Boolean(email)));
  const localSetup = !firebaseConfigured && process.env.NODE_ENV !== 'production';
  const isAdmin = localSetup || Boolean(user?.email && adminEmails.has(user.email.trim().toLowerCase()));

  useEffect(() => {
    if (!firebaseConfigured) {
      const saved = window.localStorage.getItem(storageKey);
      queueMicrotask(() => {
        if (saved) try { setGame(withOfficialCastawayProfiles(JSON.parse(saved))); } catch { /* use clean seed */ }
        setLoading(false);
      });
      return;
    }
    const stops:Array<()=>void>=[];
    let active=true;
    const timer=setTimeout(()=>{if(active){setAuthLoading(false);setAuthError('Authentication is taking too long to initialize. Check your connection or content blocker, then reload.')}},15000);
    try {
      const {auth,db}=getFirebase();
      stops.push(onAuthStateChanged(auth,(nextUser)=>{
        if(!active)return;
        clearTimeout(timer);setUser(nextUser);setAuthLoading(false);setAuthError('');
      },(error)=>{clearTimeout(timer);if(active){setAuthLoading(false);setAuthError(authenticationError(error));}}));
      stops.push(onSnapshot(doc(db,'games','survivor-51'),(snapshot)=>{
        if(!active)return;
        if(snapshot.exists()){
          const saved=snapshot.data() as GameState;
          setGame(withOfficialCastawayProfiles({...saved,draft:saved.draft??initialGame.draft,players:saved.players.map((player,index)=>({...player,email:player.email??'',priorFinish:player.priorFinish??index+1,draftSlot:player.draftSlot??saved.players.length-index}))}));
        }
        setLoading(false);
      },()=>{if(active)setLoading(false);}));
    } catch(error) {
      clearTimeout(timer);
      queueMicrotask(()=>{if(active){setAuthLoading(false);setLoading(false);setAuthError(authenticationError(error));}});
    }
    return () => {active=false;clearTimeout(timer);stops.forEach((stop)=>stop());};
  },[]);

  async function persist(next:GameState) {
    if (firebaseConfigured) { const {db}=getFirebase(); await setDoc(doc(db,'games','survivor-51'),next); }
    else window.localStorage.setItem(storageKey,JSON.stringify(next));
    setGame(next);
  }

  const castawayScores = useMemo(() => Object.fromEntries(game.castaways.map((castaway) => [castaway.id,game.scoreEvents.filter((event) => event.castawayId === castaway.id).reduce((sum,event) => sum + event.points,0)])),[game]);
  const standings = useMemo(() => game.players.map((player) => {
    const picks = game.draftPicks.filter((pick) => pick.playerId === player.id);
    const pickScore = picks.reduce((sum,pick) => sum + (castawayScores[pick.castawayId] ?? 0) * pick.multiplier,0);
    const direct = game.scoreEvents.filter((event) => event.playerId === player.id).reduce((sum,event) => sum + event.points,0);
    return {id:player.id,name:player.name,score:player.entryBonus + pickScore + direct,picks:picks.map((pick) => pick.round===3&&game.draft.status!=='complete'?'Blind pick locked':game.castaways.find((c) => c.id === pick.castawayId)?.shortName).filter(Boolean).join(' · ') || 'Draft pending',rank:0};
  }).sort((a,b) => b.score-a.score || a.name.localeCompare(b.name)).map((player,index) => ({...player,rank:index+1})),[game,castawayScores]);

  async function login() {
    if(authBusy)return;
    setAuthError('');setAuthBusy(true);
    try {
      const {auth}=getFirebase();
      const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
      const result=await signInWithPopup(auth,provider);
      setUser(result.user);setAuthLoading(false);
    } catch(error){setAuthError(authenticationError(error));}
    finally{setAuthBusy(false);}
  }
  async function logout() {
    if(authBusy)return;
    setAuthError('');setAuthBusy(true);
    try{await signOut(getFirebase().auth);setUser(null);}
    catch(error){setAuthError(authenticationError(error));}
    finally{setAuthBusy(false);}
  }
  async function adminMutation(change:(current:GameState)=>GameState) {
    if(!isAdmin)throw new Error('Only the game master can change scoring or tribes.');
    if(!firebaseConfigured){await persist(change(game));return;}
    const {db}=getFirebase();
    // Re-read inside a transaction so scoring from another tab is never overwritten.
    await runTransaction(db,async(transaction)=>{
      const ref=doc(db,'games','survivor-51');
      const snapshot=await transaction.get(ref);
      const current=snapshot.exists()?withOfficialCastawayProfiles(snapshot.data() as GameState):initialGame;
      transaction.set(ref,change(current));
    });
  }
  async function addScore(input:ScoringInput) {await adminMutation(current=>recordScoring(current,input));}
  async function addCustomAction(input:CustomActionInput) {const id=crypto.randomUUID();await adminMutation(current=>saveCustomAction(current,input,id));return id;}
  async function updateTribe(tribe:Tribe){await adminMutation(current=>saveTribe(current,tribe));}
  async function updateCastaway(id:string,tribeId:string,status:Castaway['status']){await adminMutation(current=>assignCastaway(current,id,tribeId,status));}
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
  return <GameContext.Provider value={{game,loading,user,isAdmin,cloud:firebaseConfigured,authLoading,authBusy,castawayScores,standings,login,logout,addScore,addCustomAction,updateTribe,updateCastaway,addAdjustment,savePick,addPlayer,setPlayerEmail,startDraft,toggleDraft,undoDraftPick,submitPlayerPick,resetSeason}}>{authError&&<div role="alert" className="setup-notice">{authError}</div>}{children}</GameContext.Provider>;
}

export function useGame() { const value=useContext(GameContext); if (!value) throw new Error('GameProvider missing'); return value; }
