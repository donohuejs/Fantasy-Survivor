'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { firebaseConfigured, getFirebase, authenticationError, type FirebaseUser } from '@/lib/firebase';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, runTransaction } from 'firebase/firestore';
import { buildDraftTurns, initialGame, type DraftPick, type GameState, type Tribe, type Castaway } from '@/lib/game-data';
import { recordScoring,saveCustomAction,saveTribe,assignCastaway,type ScoringInput,type CustomActionInput } from '@/lib/scoring';
import {bindProfile,lockSeason,prepareNextSeason,seasonStandings,type PlayerSignup} from '@/lib/league';
import {combinedHistory} from '@/lib/history-data';
export type {PlayerSignup} from '@/lib/league';

type GameContextValue = {
  game:GameState; loading:boolean; user:FirebaseUser|null; isAdmin:boolean; cloud:boolean; authLoading:boolean; authBusy:boolean;
  castawayScores:Record<string,number>; standings:Array<{id:string;name:string;score:number;picks:string;rank:number}>;
  login:()=>Promise<void>; logout:()=>Promise<void>; addScore:(data:ScoringInput)=>Promise<void>;
  addCustomAction:(input:CustomActionInput)=>Promise<string>; updateTribe:(tribe:Tribe)=>Promise<void>; updateCastaway:(id:string,tribeId:string,status:Castaway['status'])=>Promise<void>;
  addAdjustment:(playerId:string,points:number,note:string)=>Promise<void>; savePick:(pick:Omit<DraftPick,'id'|'multiplier'> & {blind:boolean})=>Promise<void>;
  addPlayer:(name:string,email:string)=>Promise<void>; setPlayerEmail:(playerId:string,email:string)=>Promise<void>; startDraft:()=>Promise<void>; toggleDraft:()=>Promise<void>; undoDraftPick:()=>Promise<void>; submitPlayerPick:(castawayId:string)=>Promise<void>; resetSeason:()=>Promise<void>;
  signups:PlayerSignup[]; registerPlayer:(name:string)=>Promise<void>; assignSignup:(signup:PlayerSignup,playerId:string)=>Promise<void>; setPlayerPaid:(playerId:string,paid:boolean)=>Promise<void>;
  signupError:string; signupLoading:boolean; finalizeSeason:(order:string[])=>Promise<void>; beginNextSeason:()=>Promise<void>; addCastaway:(input:Omit<Castaway,'id'|'status'>)=>Promise<void>;
};

const GameContext = createContext<GameContextValue | null>(null);
const storageKey = 'fantasy-survivor-51-game';

function withOfficialCastawayProfiles(saved:GameState):GameState {
  return {
    ...saved,
    tribes:saved.tribes??(saved.season.number===51?initialGame.tribes:[]),
    categories:saved.categories??initialGame.categories,
    history:saved.history??[],
    season:{...saved.season,entryFee:saved.season.entryFee??initialGame.season.entryFee},
    castaways:saved.castaways.map((castaway) => {
      const official = saved.season.number===51?initialGame.castaways.find((item) => item.id === castaway.id):undefined;
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
  const [signupState,setSignupState] = useState<{owner:string;rows:PlayerSignup[];error:string;loaded:boolean}>({owner:'',rows:[],error:'',loaded:false});
  const signups=signupState.owner===user?.uid?signupState.rows:[];
  const signupError=signupState.owner===user?.uid?signupState.error:'';
  const signupLoading=Boolean(firebaseConfigured&&user&&(signupState.owner!==user.uid||!signupState.loaded));
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

  useEffect(()=>{
    if(!firebaseConfigured||!user)return;
    const {db}=getFirebase();
    let active=true;
    const save=(rows:PlayerSignup[])=>{if(active)setSignupState({owner:user.uid,rows,error:'',loaded:true});};
    const fail=()=>{if(active)setSignupState({owner:user.uid,rows:[],error:'Player registrations could not load. Check the connection and deploy the updated Firebase security rules.',loaded:true});};
    const stop=isAdmin?onSnapshot(collection(db,'games','survivor-51','signups'),snapshot=>save(snapshot.docs.map(item=>item.data() as PlayerSignup).sort((a,b)=>a.createdAt.localeCompare(b.createdAt))),fail):onSnapshot(doc(db,'games','survivor-51','signups',user.uid),snapshot=>save(snapshot.exists()?[snapshot.data() as PlayerSignup]:[]),fail);
    return ()=>{active=false;stop();};
  },[user,isAdmin]);

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
  }).sort((a,b) => {
    const final=game.season.finalized?game.history?.find(s=>s.season===game.season.number):undefined;
    return final?(final.results.find(r=>r.profileId===a.id)?.finish??999)-(final.results.find(r=>r.profileId===b.id)?.finish??999):b.score-a.score||a.name.localeCompare(b.name);
  }).map((player,index) => ({...player,rank:index+1})),[game,castawayScores]);

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
  async function adminMutation(change:(current:GameState)=>GameState,allowFinalized=false) {
    if(!isAdmin)throw new Error('Only the game master can change scoring or tribes.');
    const apply=(current:GameState)=>{if(current.season.number!==game.season.number)throw new Error('The active season changed. Reload before saving.');if(current.season.finalized&&!allowFinalized)throw new Error('This season’s results are locked. Start the next season to make changes.');return change(current);};
    if(!firebaseConfigured){await persist(apply(game));return;}
    const {db}=getFirebase();
    // Re-read inside a transaction so scoring from another tab is never overwritten.
    await runTransaction(db,async(transaction)=>{
      const ref=doc(db,'games','survivor-51');
      const snapshot=await transaction.get(ref);
      const current=snapshot.exists()?withOfficialCastawayProfiles(snapshot.data() as GameState):initialGame;
      transaction.set(ref,apply(current));
    });
  }
  async function addScore(input:ScoringInput) {await adminMutation(current=>recordScoring(current,input));}
  async function addCustomAction(input:CustomActionInput) {const id=crypto.randomUUID();await adminMutation(current=>saveCustomAction(current,input,id));return id;}
  async function updateTribe(tribe:Tribe){await adminMutation(current=>saveTribe(current,tribe));}
  async function updateCastaway(id:string,tribeId:string,status:Castaway['status']){await adminMutation(current=>assignCastaway(current,id,tribeId,status));}
  async function addAdjustment(playerId:string,points:number,note:string) { await adminMutation(current=>({...current,scoreEvents:[...current.scoreEvents,{id:crypto.randomUUID(),playerId,points,note,createdAt:new Date().toISOString()}]})); }
  async function savePick(input:Omit<DraftPick,'id'|'multiplier'> & {blind:boolean}) {
    await adminMutation(game=>{
    const draftPicks = game.draftPicks.filter((pick) => !(pick.playerId===input.playerId && pick.round===input.round));
    draftPicks.push({id:crypto.randomUUID(),playerId:input.playerId,castawayId:input.castawayId,round:input.round,pickNumber:input.pickNumber,multiplier:input.round===3&&input.blind?1.25:1});
    const turn=game.draft.turns[game.draft.currentPick];
    const advances=game.draft.status==='live'&&turn?.playerId===input.playerId&&turn.round===input.round;
    const currentPick=advances?game.draft.currentPick+1:game.draft.currentPick;
    return {...game,draftPicks,draft:{...game.draft,currentPick,status:advances&&currentPick>=game.draft.turns.length?'complete':game.draft.status}};
    });
  }
  async function addPlayer(name:string,email:string) { await adminMutation(current=>{if(current.draft.status!=='setup')throw new Error('Add profiles before starting the draft.');const clean=name.trim();if(!clean||clean.length>50)throw new Error('Enter a name between 1 and 50 characters.');if(current.players.some(p=>p.name.toLowerCase()===clean.toLowerCase()))throw new Error('That name already has a profile in this season.');const historical=combinedHistory(current.history).find(r=>r.name.toLowerCase()===clean.toLowerCase());if(historical&&current.players.some(p=>p.id===historical.profileId))throw new Error('That historical profile is already in this season.');const slot=Math.max(0,...current.players.map(p=>p.draftSlot))+1;return {...current,players:[...current.players,{id:historical?.profileId??crypto.randomUUID(),name:clean,email:email.trim().toLowerCase(),entryBonus:0,priorFinish:slot,draftSlot:slot}]};}); }
  async function setPlayerEmail(playerId:string,email:string) { await adminMutation(current=>{if(current.players.find(p=>p.id===playerId)?.uid)throw new Error('This permanent profile is locked to its Google account.');if(current.draft.status!=='setup')throw new Error('Change player access before starting the draft.');return {...current,players:current.players.map(player=>player.id===playerId?{...player,email:email.trim().toLowerCase()}:player)};}); }
  async function startDraft() { await adminMutation(current=>{const turns=buildDraftTurns(current.players);if(current.draft.status!=='setup')throw new Error('This draft has already started.');if(!turns.length||turns.some(turn=>!turn.uid&&!turn.email))throw new Error('Assign every player to an account before starting the draft.');if(!current.castaways.length)throw new Error('Add this season’s castaways before starting the draft.');return {...current,draftPicks:[],draft:{status:'live',currentPick:0,turns}};}); }
  async function toggleDraft() { await adminMutation(current=>({...current,draft:{...current.draft,status:current.draft.status==='live'?'paused':current.draft.status==='paused'?'live':current.draft.status}})); }
  async function undoDraftPick() { await adminMutation(current=>{if(!current.draftPicks.length)return current;return {...current,draftPicks:current.draftPicks.slice(0,-1),draft:{...current.draft,currentPick:Math.max(0,current.draft.currentPick-1),status:'paused'}};}); }
  async function submitPlayerPick(castawayId:string) {
    if(!user||!firebaseConfigured)throw new Error('Sign in to draft.');
    await runTransaction(getFirebase().db,async transaction=>{
      const ref=doc(getFirebase().db,'games','survivor-51'),snapshot=await transaction.get(ref);
      if(!snapshot.exists())throw new Error('The draft is not ready.');
      const current=snapshot.data() as GameState,turn=current.draft.turns[current.draft.currentPick];
      if(current.season.finalized||current.draft.status!=='live'||!turn||(turn.uid?turn.uid!==user.uid:turn.email!==user.email?.toLowerCase()))throw new Error('It is not your turn.');
      if(!current.castaways.some(c=>c.id===castawayId))throw new Error('Choose a valid castaway.');
      const nextPick=current.draft.currentPick+1,pick:DraftPick={id:crypto.randomUUID(),playerId:turn.playerId,castawayId,round:turn.round,pickNumber:turn.pickNumber,multiplier:turn.round===3?1.25:1};
      transaction.update(ref,{draftPicks:[...current.draftPicks,pick],draft:{...current.draft,currentPick:nextPick,status:nextPick>=current.draft.turns.length?'complete':'live'}});
    });
  }
  async function registerPlayer(name:string){
    if(!firebaseConfigured||!user?.uid||!user.email)throw new Error('Sign in with Google before registering.');
    const clean=name.trim();if(clean.length<1||clean.length>50)throw new Error('Enter a name between 1 and 50 characters.');
    const signup:PlayerSignup={uid:user.uid,name:clean,email:user.email.toLowerCase(),createdAt:new Date().toISOString()};
    await runTransaction(getFirebase().db,async transaction=>{const ref=doc(getFirebase().db,'games','survivor-51','signups',user.uid);const existing=await transaction.get(ref);if(!existing.exists())transaction.set(ref,signup);});
  }
  async function assignSignup(signup:PlayerSignup,playerId:string){
    if(!isAdmin||!firebaseConfigured)throw new Error('Connect Firebase and sign in as game master to assign registered profiles.');
    const {db}=getFirebase();
    await runTransaction(db,async transaction=>{
      const ref=doc(db,'games','survivor-51'),signupRef=doc(db,'games','survivor-51','signups',signup.uid);
      const [snapshot,registration]=await Promise.all([transaction.get(ref),transaction.get(signupRef)]);
      if(!registration.exists())throw new Error('That registration no longer exists.');
      const registered=registration.data() as PlayerSignup;
      const current=snapshot.exists()?withOfficialCastawayProfiles(snapshot.data() as GameState):initialGame;
      if(current.season.number!==game.season.number)throw new Error('The season changed. Review the profile before assigning it.');
      transaction.set(ref,bindProfile(current,registered,playerId));
      transaction.update(signupRef,{assignedPlayerId:playerId});
    });
  }
  async function setPlayerPaid(playerId:string,paid:boolean){await adminMutation(current=>({...current,players:current.players.map(player=>player.id===playerId?{...player,paid}:player)}),true);}
  async function resetSeason() {await adminMutation(current=>({...current,scoreEvents:[],draftPicks:[],players:current.players.map(p=>({...p,entryBonus:0})),draft:{status:'setup',currentPick:0,turns:buildDraftTurns(current.players)}}));}
  async function finalizeSeason(order:string[]){await adminMutation(current=>{if(JSON.stringify(seasonStandings(current))!==JSON.stringify(seasonStandings(game)))throw new Error('Scores changed during your review. Review the updated standings before locking.');return lockSeason(current,order,new Date().toISOString());},true);}
  async function beginNextSeason(){
    if(!isAdmin)throw new Error('Only the game master can open a season.');
    if(!firebaseConfigured){const next=prepareNextSeason(game);window.localStorage.setItem(`${storageKey}-archive-${game.season.number}`,JSON.stringify(game));await persist(next);return;}
    const {db}=getFirebase();await runTransaction(db,async transaction=>{
      const ref=doc(db,'games','survivor-51'),snapshot=await transaction.get(ref);if(!snapshot.exists())throw new Error('No season to archive.');
      const current=withOfficialCastawayProfiles(snapshot.data() as GameState);if(current.season.number!==game.season.number)throw new Error('The active season already changed. Reload to see it.');const next=prepareNextSeason(current);
      transaction.set(doc(db,'games','survivor-51','archives',String(current.season.number)),current);
      transaction.set(ref,next);
    });
  }
  async function addCastaway(input:Omit<Castaway,'id'|'status'>){await adminMutation(current=>{if(current.draft.status!=='setup')throw new Error('Add castaways before the draft.');if(!input.name.trim()||!Number.isInteger(input.age)||input.age<18)throw new Error('Enter a name and an adult age.');if(input.imageUrl&&!/^https:\/\//i.test(input.imageUrl))throw new Error('Use an HTTPS photo URL.');return {...current,castaways:[...current.castaways,{...input,id:crypto.randomUUID(),status:'active'}]};});}
  return <GameContext.Provider value={{game,loading,user,isAdmin,cloud:firebaseConfigured,authLoading,authBusy,castawayScores,standings,login,logout,addScore,addCustomAction,updateTribe,updateCastaway,addAdjustment,savePick,addPlayer,setPlayerEmail,startDraft,toggleDraft,undoDraftPick,submitPlayerPick,resetSeason,signups,registerPlayer,assignSignup,setPlayerPaid,signupError,signupLoading,finalizeSeason,beginNextSeason,addCastaway}}>{authError&&<div role="alert" className="setup-notice">{authError}</div>}{children}</GameContext.Provider>;
}

export function useGame() { const value=useContext(GameContext); if (!value) throw new Error('GameProvider missing'); return value; }
