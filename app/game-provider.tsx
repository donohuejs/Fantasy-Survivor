'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { firebaseConfigured, getFirebase, authenticationError, type FirebaseUser } from '@/lib/firebase';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, runTransaction } from 'firebase/firestore';
import { buildDraftTurns, initialGame, type GameState, type Tribe, type Castaway } from '@/lib/game-data';
import { recordScoring,saveCustomAction,saveTribe,assignCastaway,type ScoringInput,type CustomActionInput } from '@/lib/scoring';
import {bindProfile,lockSeason,prepareNextSeason,seasonStandings,type PlayerSignup} from '@/lib/league';
import {combinedHistory} from '@/lib/history-data';
import {automaticRegistration,registrationForAccount,registrationErrorMessage,type RegistrationState} from '@/lib/registration';
import {executeDraft,type DraftCommand,type PrivateDeal} from '@/lib/draft';
export type {PlayerSignup} from '@/lib/league';

type GameContextValue = {
  game:GameState; loading:boolean; user:FirebaseUser|null; isAdmin:boolean; cloud:boolean; authLoading:boolean; authBusy:boolean;
  castawayScores:Record<string,number>; standings:Array<{id:string;name:string;score:number;picks:string;rank:number}>;
  login:()=>Promise<void>; logout:()=>Promise<void>; addScore:(data:ScoringInput)=>Promise<void>;
  addCustomAction:(input:CustomActionInput)=>Promise<string>; updateTribe:(tribe:Tribe)=>Promise<void>; updateCastaway:(id:string,tribeId:string,status:Castaway['status'])=>Promise<void>;
  addAdjustment:(playerId:string,points:number,note:string,episode?:number)=>Promise<void>;
  addPlayer:(name:string,email:string)=>Promise<void>; setPlayerEmail:(playerId:string,email:string)=>Promise<void>; startDraft:()=>Promise<void>; toggleDraft:()=>Promise<void>; undoDraftPick:()=>Promise<void>; submitPlayerPick:(castawayId:string,decision?:'select'|'keep'|'swap',onBehalf?:boolean)=>Promise<void>; resetSeason:()=>Promise<void>;
  signups:PlayerSignup[]; registrationStatus:'idle'|'registering'|'registered'|'error'; retryRegistration:()=>void; assignSignup:(signup:PlayerSignup,playerId:string)=>Promise<void>; setPlayerPaid:(playerId:string,paid:boolean)=>Promise<void>;
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
  const [registrationState,setRegistrationState]=useState<RegistrationState|null>(null);
  const [registrationAttempt,setRegistrationAttempt]=useState(0);
  const registration=registrationForAccount(registrationState,user?.uid);
  const registrationStatus=registration.status;
  function retryRegistration(){setRegistrationAttempt(attempt=>attempt+1);}
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

  // Runs after every Google sign-in AND when Firebase restores a saved session.
  // Creation is transactional and keyed by UID, so tabs/retries cannot duplicate players.
  useEffect(()=>{
    if(!firebaseConfigured||!user)return;
    let active=true;
    queueMicrotask(()=>{if(active)setRegistrationState({owner:user.uid,status:'registering',error:''});});
    const timeout=setTimeout(()=>{if(active)setRegistrationState({owner:user.uid,status:'error',error:'Registration is taking longer than expected. Check your connection and retry.'});},15000);
    const {auth,db}=getFirebase();
    void runTransaction(db,async transaction=>{
      if(auth.currentUser?.uid!==user.uid)throw new Error('Your signed-in account changed.');
      const ref=doc(db,'games','survivor-51','signups',user.uid);
      const snapshot=await transaction.get(ref);
      if(!active||auth.currentUser?.uid!==user.uid)throw new Error('Your signed-in account changed.');
      const signup=automaticRegistration(user,snapshot.exists()?snapshot.data() as PlayerSignup:null,new Date().toISOString());
      if(!snapshot.exists())transaction.set(ref,signup);
      return signup;
    }).then(signup=>{
      clearTimeout(timeout);
      if(active)setRegistrationState({owner:user.uid,status:'registered',signup,error:''});
    }).catch(error=>{
      clearTimeout(timeout);
      if(active)setRegistrationState({owner:user.uid,status:'error',error:registrationErrorMessage(error)});
    });
    return ()=>{active=false;clearTimeout(timeout);};
  },[user,registrationAttempt]);

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
    return {id:player.id,name:player.name,score:player.entryBonus + pickScore + direct,picks:picks.map((pick) => !pick.castawayId?'Blind pick locked':game.castaways.find((c) => c.id === pick.castawayId)?.shortName).filter(Boolean).join(' · ') || 'Draft pending',rank:0};
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
  async function addAdjustment(playerId:string,points:number,note:string,episode?:number) {
    await adminMutation(current=>{
      if(!current.players.some(p=>p.id===playerId)||!Number.isFinite(points))throw new Error('Choose a player and valid points.');
      if(episode!==undefined&&(!Number.isInteger(episode)||episode<1))throw new Error('Episode must be a positive whole number, or leave it blank.');
      return {...current,season:{...current.season,currentEpisode:Math.max(current.season.currentEpisode,episode??0)},scoreEvents:[...current.scoreEvents,{id:crypto.randomUUID(),playerId,points,note,...(episode!==undefined?{episode}:{}),createdAt:new Date().toISOString()}]};
    });
  }
  async function draftRequest(action:DraftCommand['action'],castawayId='',decision:DraftCommand['decision']='select',onBehalf=false) {
    const command:DraftCommand={action,season:game.season.number,runId:game.draft.runId??'',revision:game.draft.revision??0,currentPick:game.draft.currentPick,castawayId,decision,onBehalf};
    if(localSetup){
      const saved=window.localStorage.getItem(storageKey);
      const current=saved?withOfficialCastawayProfiles(JSON.parse(saved)):game;
      const secret=window.localStorage.getItem(storageKey+'-private-deal');
      const result=executeDraft(current,secret?JSON.parse(secret) as PrivateDeal:null,{uid:'local-owner',email:'donohue.js@gmail.com',verified:true},{...command,onBehalf:true});
      if(action==='start')window.localStorage.setItem(storageKey+'-private-deal',JSON.stringify(result.deal));
      await persist(result.game);return;
    }
    const account=getFirebase().auth.currentUser;
    if(!account)throw new Error('Sign in with Google before drafting.');
    const token=await account.getIdToken();
    let response:Response;
    try{response=await fetch('/api/draft',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(command)});}
    catch{throw new Error('Connection lost. Reload to check whether your pick saved before trying again.');}
    const result=await response.json().catch(()=>({error:'The draft server returned an unexpected response. Reload and check the draft before retrying.'}));
    if(!response.ok)throw new Error(result.error??'Unable to update the draft.');
  }
  async function addPlayer(name:string,email:string) { await adminMutation(current=>{if(current.draft.status!=='setup')throw new Error('Add profiles before starting the draft.');const clean=name.trim();if(!clean||clean.length>50)throw new Error('Enter a name between 1 and 50 characters.');if(current.players.some(p=>p.name.toLowerCase()===clean.toLowerCase()))throw new Error('That name already has a profile in this season.');const historical=combinedHistory(current.history).find(r=>r.name.toLowerCase()===clean.toLowerCase());if(historical&&current.players.some(p=>p.id===historical.profileId))throw new Error('That historical profile is already in this season.');const slot=Math.max(0,...current.players.map(p=>p.draftSlot))+1;return {...current,players:[...current.players,{id:historical?.profileId??crypto.randomUUID(),name:clean,email:email.trim().toLowerCase(),entryBonus:0,priorFinish:slot,draftSlot:slot}]};}); }
  async function setPlayerEmail(playerId:string,email:string) { await adminMutation(current=>{if(current.players.find(p=>p.id===playerId)?.uid)throw new Error('This permanent profile is locked to its Google account.');if(current.draft.status!=='setup')throw new Error('Change player access before starting the draft.');return {...current,players:current.players.map(player=>player.id===playerId?{...player,email:email.trim().toLowerCase()}:player)};}); }
  async function startDraft(){await draftRequest('start');}
  async function toggleDraft(){await draftRequest('toggle');}
  async function undoDraftPick(){await draftRequest('undo');}
  async function submitPlayerPick(castawayId:string,decision:'select'|'keep'|'swap'='select',onBehalf=false){await draftRequest('pick',castawayId,decision,onBehalf);}
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
  const assignedAccount=Boolean(user&&game.players.some(p=>p.uid?p.uid===user.uid:Boolean(p.email)&&p.email.toLowerCase()===user.email?.toLowerCase()));
  return <GameContext.Provider value={{game,loading,user,isAdmin,cloud:firebaseConfigured,authLoading,authBusy,castawayScores,standings,login,logout,addScore,addCustomAction,updateTribe,updateCastaway,addAdjustment,addPlayer,setPlayerEmail,startDraft,toggleDraft,undoDraftPick,submitPlayerPick,resetSeason,signups,registrationStatus,retryRegistration,assignSignup,setPlayerPaid,signupError,signupLoading,finalizeSeason,beginNextSeason,addCastaway}}>{authError&&<div role="alert" className="setup-notice">{authError}</div>}{user&&registration.status==='registering'&&<div className="registration-banner" role="status">Signed in. Completing your league registration…</div>}{user&&registration.status==='error'&&<div className="registration-banner registration-failed" role="alert"><span><strong>You’re signed in, but league registration has not been confirmed.</strong> {registration.error}</span><button type="button" onClick={retryRegistration}>Retry registration</button></div>}{user&&!isAdmin&&!loading&&!assignedAccount&&registration.status==='registered'&&<div className="registration-banner" role="status">You’re registered as <strong>{registration.signup?.name}</strong>. The game master will assign your league profile and draft slot—nothing else to submit.</div>}{children}</GameContext.Provider>;
}

export function useGame() { const value=useContext(GameContext); if (!value) throw new Error('GameProvider missing'); return value; }
