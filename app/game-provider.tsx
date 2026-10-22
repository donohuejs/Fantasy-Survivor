'use client';
import {startVisiblePolling,readIntervals} from '@/lib/visible-polling';
import {requestId} from '@/lib/request-id';
import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import {firebaseConfigured,getFirebase,authenticationError,type FirebaseUser} from '@/lib/firebase';
import {GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut} from 'firebase/auth';
import {activePlayers,initialGame,type GameState,type Tribe,type Castaway,type PossessionStatus} from '@/lib/game-data';
import type {ScoringInput,EpisodeWideAwardInput,EpisodeStartInput,EpisodeFinishInput,CastawayBonusInput,CastawayEliminationInput,EliminationReasonUpdateInput,FirstTribalCouncilInput,TribalCouncilSurvivalInput,TribalCouncilResolutionInput,CustomActionInput,PossessionInput} from '@/lib/scoring';
import {seasonStandings,type PlayerSignup} from '@/lib/league';
import {registrationForAccount,registrationErrorMessage,type RegistrationState} from '@/lib/registration';
import {executeDraft,type DraftCommand,type PrivateDeal} from '@/lib/draft';
import {assertGameMaster} from '@/lib/admin-auth';
import {withOfficialCastawayProfiles} from '@/lib/game-normalization';
import {applyAdminCommand,type AdminCommand,type AdminAction,type AdminInput} from '@/lib/admin-command';
import {leagueRequest} from './league-client';
import {commissionerAccessForAccount} from '@/lib/account-access';
import {castawayScoreTotals,effectiveScorePoints} from '@/lib/score-ledger';
import {planScoreCorrection,sameCorrection,type ScoreCorrection,type ScoreCorrectionCommand,type ScoreCorrectionPreview} from '@/lib/score-corrections';
export type {PlayerSignup} from '@/lib/league';
type GameContextValue = {
  leagueAccess:'loading'|'authorized'|'unlinked'|'signed-out'|'error'|'local';leagueError:string;
  correctScore:(command:ScoreCorrectionCommand,save:boolean)=>Promise<ScoreCorrectionPreview>; scoreHistory:(eventId:string)=>Promise<ScoreCorrection[]>;
  game:GameState; loading:boolean; user:FirebaseUser|null; isAdmin:boolean; cloud:boolean; authLoading:boolean; authBusy:boolean;
  castawayScores:Record<string,number>; standings:Array<{id:string;name:string;score:number;picks:string;rank:number}>;
  login:()=>Promise<void>; logout:()=>Promise<void>; startEpisode:(data:EpisodeStartInput)=>Promise<void>; finishEpisode:(data:EpisodeFinishInput)=>Promise<void>; addScore:(data:ScoringInput)=>Promise<void>; addStillOnIsland:(data:EpisodeWideAwardInput)=>Promise<void>; addFirstTribalCouncil:(data:FirstTribalCouncilInput)=>Promise<void>; addTribalCouncilSurvival:(data:TribalCouncilSurvivalInput)=>Promise<void>; addTribalCouncil:(episode:number,number?:number)=>Promise<void>; resolveTribalCouncil:(data:TribalCouncilResolutionInput)=>Promise<void>; eliminateCastaway:(data:CastawayEliminationInput)=>Promise<void>; updateEliminationReason:(data:EliminationReasonUpdateInput)=>Promise<void>; addCastawayBonus:(data:CastawayBonusInput)=>Promise<void>; setMergeEpisode:(episode:number|undefined)=>Promise<void>;
  addCustomAction:(input:CustomActionInput)=>Promise<string>; updateTribe:(tribe:Tribe)=>Promise<void>; updateCastaway:(id:string,tribeId:string,status:Castaway['status'])=>Promise<void>;
  createPossession:(input:Omit<PossessionInput,'id'>)=>Promise<void>; updatePossession:(input:PossessionInput&{id:string})=>Promise<void>; transferPossession:(possessionId:string,targetCastawayId:string,episode:number,notes:string)=>Promise<void>; setPossessionStatus:(possessionId:string,status:PossessionStatus,episode:number,notes:string)=>Promise<void>;
  addAdjustment:(playerId:string,points:number,note:string,episode?:number)=>Promise<void>;
  addPlayer:(name:string,email:string)=>Promise<void>; setPlayerEmail:(playerId:string,email:string)=>Promise<void>; setPlayerActive:(playerId:string,active:boolean)=>Promise<void>; startDraft:()=>Promise<void>; toggleDraft:()=>Promise<void>; undoDraftPick:()=>Promise<void>; submitPlayerPick:(castawayId:string,decision?:'select'|'keep'|'swap',onBehalf?:boolean)=>Promise<void>; resetSeason:()=>Promise<void>;
  signups:PlayerSignup[]; registrationStatus:'idle'|'registering'|'registered'|'error'; retryRegistration:()=>void; assignSignup:(signup:PlayerSignup,playerId:string)=>Promise<void>; setPlayerPaid:(playerId:string,paid:boolean)=>Promise<void>;
  signupError:string; signupLoading:boolean; finalizeSeason:(order:string[])=>Promise<void>; beginNextSeason:()=>Promise<void>; addCastaway:(input:Omit<Castaway,'id'|'status'>)=>Promise<void>;
};

const GameContext = createContext<GameContextValue | null>(null);
const storageKey = 'fantasy-survivor-51-game';
export function GameProvider({children}:{children:React.ReactNode}) {
  const [game,setGame] = useState<GameState>(initialGame);
  const [loading,setLoading] = useState(firebaseConfigured);
  const [user,setUser] = useState<FirebaseUser|null>(null);
  const [authLoading,setAuthLoading] = useState(firebaseConfigured);
  const [authBusy,setAuthBusy] = useState(false);
  const [authError,setAuthError] = useState('');
  const [accessState,setAccessState]=useState<{uid:string;status:'loading'|'authorized'|'unlinked'|'signed-out'|'error'|'local';error:string;commissioner?:boolean}>({uid:'',status:firebaseConfigured?'loading':'local',error:''});
  const leagueAccess=!firebaseConfigured?'local':!user?(authLoading?'loading':'signed-out'):accessState.uid===user.uid?accessState.status:'loading';
  const leagueError=accessState.uid===user?.uid?accessState.error:'';
  const [registrationState,setRegistrationState]=useState<RegistrationState|null>(null);
  const [registrationAttempt,setRegistrationAttempt]=useState(0);
  const registration=registrationForAccount(registrationState,user?.uid);
  const registrationStatus=registration.status;
  function retryRegistration(){setRegistrationAttempt(attempt=>attempt+1);}
  const [signupState,setSignupState] = useState<{owner:string;rows:PlayerSignup[];error:string;loaded:boolean}>({owner:'',rows:[],error:'',loaded:false});
  const signups=signupState.owner===user?.uid?signupState.rows:[];
  const signupError=signupState.owner===user?.uid?signupState.error:'';
  const signupLoading=Boolean(firebaseConfigured&&user&&(signupState.owner!==user.uid||!signupState.loaded));
  const localSetup = !firebaseConfigured && process.env.NODE_ENV !== 'production';
  const isAdmin = localSetup || commissionerAccessForAccount(user,accessState);
  const leagueRefreshInterval=game.draft.status==='live'?15000:readIntervals.league;

  useEffect(() => {
    if (!firebaseConfigured) {
      const saved = localSetup?window.localStorage.getItem(storageKey):null;
      queueMicrotask(() => {
        if(saved)try{const normalized=withOfficialCastawayProfiles(JSON.parse(saved));setGame(normalized);window.localStorage.setItem(storageKey,JSON.stringify(normalized));}catch{ /* use public seed */ }
        else if(localSetup)void fetch('/api/league?view=local-setup',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(({game:seed})=>setGame(seed)).catch(()=>{});
        setLoading(false);
      });
      return;
    }
    const stops:Array<()=>void>=[];
    let active=true;
    const timer=setTimeout(()=>{if(active){setAuthLoading(false);setAuthError('Authentication is taking too long to initialize. Check your connection or content blocker, then reload.')}},15000);
    try {
      const {auth}=getFirebase();
      stops.push(onAuthStateChanged(auth,(nextUser)=>{
        if(!active)return;
        clearTimeout(timer);setGame(initialGame);setAccessState({uid:nextUser?.uid??'',status:nextUser?'loading':'signed-out',error:''});setUser(nextUser);setAuthLoading(false);setAuthError('');
      },(error)=>{clearTimeout(timer);if(active){setAuthLoading(false);setAuthError(authenticationError(error));}}));
    } catch(error) {
      clearTimeout(timer);
      queueMicrotask(()=>{if(active){setAuthLoading(false);setLoading(false);setAuthError(authenticationError(error));}});
    }
    return () => {active=false;clearTimeout(timer);stops.forEach((stop)=>stop());};
  },[localSetup]);

  // Membership is checked on the server. Ordinary reads never create or migrate records.
  useEffect(()=>{
    if(!firebaseConfigured||authLoading)return;
    let active=true;
    if(!user){queueMicrotask(()=>{if(active){setGame(initialGame);setLoading(false);}});return()=>{active=false;};}
    const uid=user.uid;
    async function refresh(signal:AbortSignal){
      try{const result=await leagueRequest<{game:GameState;commissioner:boolean}>(undefined,signal);if(active&&!signal.aborted&&getFirebase().auth.currentUser?.uid===uid){setGame(withOfficialCastawayProfiles(result.game));setAccessState({uid,status:'authorized',error:'',commissioner:result.commissioner});setLoading(false);}}
      catch(error){if(active&&!signal.aborted){setGame(initialGame);setLoading(false);setAccessState({uid,status:typeof error==='object'&&error&&'status' in error&&error.status===403?'unlinked':'error',error:error instanceof Error?error.message:'League could not load.'});}throw error;}
    }
    const poll=startVisiblePolling(refresh,leagueRefreshInterval,['league-refresh']);
    return()=>{active=false;poll.stop();};
  },[user,authLoading,leagueRefreshInterval]);

  async function authenticatedRequest<T>(path:string,input?:object,signal?:AbortSignal):Promise<T>{
    const account=getFirebase().auth.currentUser;if(!account)throw new Error('Sign in with Google first.');
    const uid=account.uid,token=await account.getIdToken();signal?.throwIfAborted();if(getFirebase().auth.currentUser?.uid!==uid)throw new Error('Your signed-in account changed.');const response=await fetch('/api/'+path,{signal,method:input?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},cache:'no-store',...(input?{body:JSON.stringify(input)}:{})});
    const result=await response.json();if(getFirebase().auth.currentUser?.uid!==uid)throw new Error('Your signed-in account changed.');
    if(!response.ok)throw Object.assign(new Error(result.error??'Unable to load or save the league.'),{status:response.status});return result;
  }
  useEffect(()=>{
    // Ordinary accounts already receive their own signup from registration below.
    // The Commissioner alone needs the complete check-in catalog.
    if(!firebaseConfigured||!user||!isAdmin)return;let active=true;
    async function refresh(signal:AbortSignal){try{const {rows}=await authenticatedRequest<{rows:PlayerSignup[]}>('registration',undefined,signal);if(active&&!signal.aborted)setSignupState({owner:user!.uid,rows,error:'',loaded:true});}catch(error){if(active&&!signal.aborted)setSignupState({owner:user!.uid,rows:[],error:error instanceof Error?error.message:'Registrations could not load.',loaded:true});throw error;}}
    const poll=startVisiblePolling(refresh,readIntervals.registration,['league-refresh']);return()=>{active=false;poll.stop();};
  },[user,isAdmin]);
  // Signup association is server-side, UID-keyed, verified and revocation checked.
  useEffect(()=>{
    if(!firebaseConfigured||!user)return;let active=true;
    queueMicrotask(()=>{if(active)setRegistrationState({owner:user.uid,status:'registering',error:''});});
    const timeout=setTimeout(()=>{if(active)setRegistrationState({owner:user.uid,status:'error',error:'Registration is taking longer than expected. Check your connection and retry.'});},15000);
    void authenticatedRequest<{signup:PlayerSignup}>('registration',{}).then(({signup})=>{clearTimeout(timeout);if(active){setRegistrationState({owner:user.uid,status:'registered',signup,error:''});setSignupState(old=>old.owner===user.uid&&old.loaded?old:{owner:user.uid,rows:[signup],error:'',loaded:true});window.dispatchEvent(new Event('league-refresh'));}}).catch(error=>{clearTimeout(timeout);if(active)setRegistrationState({owner:user.uid,status:'error',error:registrationErrorMessage(error)});});
    return()=>{active=false;clearTimeout(timeout);};
  },[user,registrationAttempt]);
  async function persist(next:GameState){if(!localSetup)throw new Error('Cloud game changes require the authenticated server.');window.localStorage.setItem(storageKey,JSON.stringify(next));setGame(next);}

  const castawayScores = useMemo(() => castawayScoreTotals(game),[game]);
  const standings = useMemo(() => activePlayers(game.players).map((player) => {
    const picks = game.draftPicks.filter((pick) => pick.playerId === player.id);
    const pickScore = picks.reduce((sum,pick) => sum + (castawayScores[pick.castawayId] ?? 0) * pick.multiplier,0);
    const direct = game.scoreEvents.filter((event) => event.playerId === player.id).reduce((sum,event) => sum + effectiveScorePoints(event),0);
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
  async function adminCommand<K extends AdminAction>(action:K,input:AdminInput<K>):Promise<string>{
    assertGameMaster(isAdmin);const id=requestId(),command={id,season:game.season.number,action,input} as AdminCommand;
    if(localSetup){const saved=window.localStorage.getItem(storageKey),current=saved?withOfficialCastawayProfiles(JSON.parse(saved)):game;if(action==='beginNextSeason')window.localStorage.setItem(storageKey+'-archive-'+current.season.number,JSON.stringify(current));await persist(applyAdminCommand(current,command,new Date().toISOString()));}
    else{await authenticatedRequest('admin',command);window.dispatchEvent(new Event('league-refresh'));}return id;
  }
  async function correctScore(command:ScoreCorrectionCommand,save:boolean):Promise<ScoreCorrectionPreview>{
    assertGameMaster(isAdmin);
    if(!firebaseConfigured){
      const saved=window.localStorage.getItem(storageKey),current=saved?JSON.parse(saved) as GameState:game;
      const receipt=current.localScoreCorrections?.find(item=>item.id===command.id);
      if(receipt){if(!sameCorrection(receipt.command,command))throw new Error('Correction ID already used.');return {correction:receipt,expectedVersion:command.expectedVersion};}
      const result=await planScoreCorrection(current,{uid:'local-commissioner',email:'',verified:true,commissioner:true},command,new Date().toISOString());
      if(save){
        if(window.localStorage.getItem(storageKey)!==saved)throw new Error('Local scores changed. Close the editor and review again.');
        await persist({...result.game,localScoreCorrections:[...(current.localScoreCorrections??[]),result.preview.correction]});
      }
      return result.preview;
    }
    const account=getFirebase().auth.currentUser;
    if(!account)throw new Error('Sign in with Google first.');
    const response=await fetch('/api/scoring',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await account.getIdToken()},body:JSON.stringify({...command,phase:save?'save':'preview'})});
    const data=await response.json();if(!response.ok)throw new Error(data.error??'Unable to correct scoring.');if(save)window.dispatchEvent(new Event('league-refresh'));return data;
  }
  async function scoreHistory(eventId:string):Promise<ScoreCorrection[]>{
    assertGameMaster(isAdmin);
    if(!firebaseConfigured)return (game.localScoreCorrections??[]).filter(row=>row.before.some(e=>e.id===eventId)||row.after.some(e=>e.id===eventId)).reverse();
    const account=getFirebase().auth.currentUser;if(!account)throw new Error('Sign in with Google first.');
    const response=await fetch('/api/scoring?'+new URLSearchParams({eventId}),{headers:{Authorization:'Bearer '+await account.getIdToken()},cache:'no-store'});
    const data=await response.json();if(!response.ok)throw new Error(data.error??'Unable to load audit history.');return data.corrections;
  }
  async function startEpisodeAction(input:EpisodeStartInput){await adminCommand('startEpisode',input);}
  async function finishEpisodeAction(input:EpisodeFinishInput){await adminCommand('finishEpisode',input);}
  async function addScore(input:ScoringInput){await adminCommand('addScore',input);}
  async function addStillOnIsland(input:EpisodeWideAwardInput){await adminCommand('addStillOnIsland',input);}
  async function addFirstTribalCouncil(input:FirstTribalCouncilInput){await adminCommand('addFirstTribalCouncil',input);}
  async function addTribalCouncilSurvival(input:TribalCouncilSurvivalInput){await adminCommand('addTribalCouncilSurvival',input);}
  async function resolveTribalCouncil(input:TribalCouncilResolutionInput){await adminCommand('resolveTribalCouncil',input);}
  async function eliminateCastaway(input:CastawayEliminationInput){await adminCommand('eliminateCastaway',input);}
  async function changeEliminationReason(input:EliminationReasonUpdateInput){await adminCommand('updateEliminationReason',input);}
  async function addCastawayBonus(input:CastawayBonusInput){await adminCommand('addCastawayBonus',input);}
  async function createPossession(input:Omit<PossessionInput,'id'>){await adminCommand('createPossession',input);}
  async function updatePossession(input:PossessionInput&{id:string}){await adminCommand('updatePossession',input);}
  async function addTribalCouncilAction(episode:number,number?:number){await adminCommand('addTribalCouncil',{episode,...(number!==undefined?{number}:{})});}
  async function transferPossession(possessionId:string,targetCastawayId:string,episode:number,notes:string){await adminCommand('transferPossession',{possessionId,targetCastawayId,episode,notes});}
  async function setPossessionStatus(possessionId:string,status:PossessionStatus,episode:number,notes:string){await adminCommand('setPossessionStatus',{possessionId,status,episode,notes});}
  async function setMergeEpisode(episode:number|undefined){await adminCommand('setMergeEpisode',episode===undefined?{}:{episode});}
  async function addCustomAction(input:CustomActionInput){return adminCommand('addCustomAction',input);}
  async function updateTribe(tribe:Tribe){await adminCommand('updateTribe',tribe);}
  async function updateCastaway(id:string,tribeId:string,status:Castaway['status']){await adminCommand('updateCastaway',{id,tribeId,status});}
  async function addAdjustment(playerId:string,points:number,note:string,episode?:number){await adminCommand('addAdjustment',{playerId,points,note,...(episode!==undefined?{episode}:{})});}
  async function draftRequest(action:DraftCommand['action'],castawayId='',decision:DraftCommand['decision']='select',onBehalf=false) {
    const command:DraftCommand={action,season:game.season.number,runId:game.draft.runId??'',revision:game.draft.revision??0,currentPick:game.draft.currentPick,castawayId,decision,onBehalf};
    if(localSetup){
      const saved=window.localStorage.getItem(storageKey);
      const current=saved?withOfficialCastawayProfiles(JSON.parse(saved)):game;
      const secret=window.localStorage.getItem(storageKey+'-private-deal');
      const result=executeDraft(current,secret?JSON.parse(secret) as PrivateDeal:null,{uid:'local-owner',email:'',verified:true,commissioner:true},{...command,onBehalf:true});
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
    window.dispatchEvent(new Event('league-refresh'));
  }
  async function addPlayer(name:string,email:string){await adminCommand('addPlayer',{name,email});}
  async function setPlayerEmail(playerId:string,email:string){await adminCommand('setPlayerEmail',{playerId,email});}
  async function setPlayerActive(playerId:string,active:boolean){await adminCommand('setPlayerActive',{playerId,active});}
  async function startDraft(){await draftRequest('start');}
  async function toggleDraft(){await draftRequest('toggle');}
  async function undoDraftPick(){await draftRequest('undo');}
  async function submitPlayerPick(castawayId:string,decision:'select'|'keep'|'swap'='select',onBehalf=false){await draftRequest('pick',castawayId,decision,onBehalf);}
  async function assignSignup(signup:PlayerSignup,playerId:string){if(!firebaseConfigured)throw new Error('Connect Firebase to assign registered profiles.');await adminCommand('assignSignup',{uid:signup.uid,playerId});}
  async function setPlayerPaid(playerId:string,paid:boolean){await adminCommand('setPlayerPaid',{playerId,paid});}
  async function resetSeason(){await adminCommand('resetSeason',{});}
  async function finalizeSeason(order:string[]){await adminCommand('finalizeSeason',{order,expectedStandings:seasonStandings(game)});}
  async function beginNextSeason(){await adminCommand('beginNextSeason',{});}
  async function addCastaway(input:Omit<Castaway,'id'|'status'>){await adminCommand('addCastaway',input);}
  const assignedAccount=Boolean(user&&game.players.some(p=>p.uid?p.uid===user.uid:Boolean(p.email)&&p.email.toLowerCase()===user.email?.toLowerCase()));
  return <GameContext.Provider value={{leagueAccess,leagueError,correctScore,scoreHistory,game,loading,user,isAdmin,cloud:firebaseConfigured,authLoading,authBusy,castawayScores,standings,login,logout,startEpisode:startEpisodeAction,finishEpisode:finishEpisodeAction,addScore,addStillOnIsland,addFirstTribalCouncil,addTribalCouncilSurvival,addTribalCouncil:addTribalCouncilAction,resolveTribalCouncil,eliminateCastaway,updateEliminationReason:changeEliminationReason,addCastawayBonus,createPossession,updatePossession,transferPossession,setPossessionStatus,setMergeEpisode,addCustomAction,updateTribe,updateCastaway,addAdjustment,addPlayer,setPlayerEmail,setPlayerActive,startDraft,toggleDraft,undoDraftPick,submitPlayerPick,resetSeason,signups,registrationStatus,retryRegistration,assignSignup,setPlayerPaid,signupError,signupLoading,finalizeSeason,beginNextSeason,addCastaway}}>{authError&&<div role="alert" className="setup-notice">{authError}</div>}{user&&registration.status==='registering'&&<div className="registration-banner" role="status">Signed in. Completing your league registration…</div>}{user&&registration.status==='error'&&<div className="registration-banner registration-failed" role="alert"><span><strong>You’re signed in, but league registration has not been confirmed.</strong> {registration.error}</span><button type="button" onClick={retryRegistration}>Retry registration</button></div>}{user&&!isAdmin&&!loading&&!assignedAccount&&registration.status==='registered'&&<div className="registration-banner" role="status">You’re registered as <strong>{registration.signup?.name}</strong>. The game master will assign your league profile and draft slot—nothing else to submit.</div>}{children}</GameContext.Provider>;
}

export function useGame() { const value=useContext(GameContext); if (!value) throw new Error('GameProvider missing'); return value; }
