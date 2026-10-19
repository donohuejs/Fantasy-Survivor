import {createHash} from 'node:crypto';
import type {Firestore} from 'firebase-admin/firestore';
import {CommunityError,resourceId,type CommunityActor} from './community.ts';
import {isCommunityOwner} from './community-authority.ts';
import {applyAdminCommand,type AdminCommand} from './admin-command.ts';
import {withOfficialCastawayProfiles} from './game-normalization.ts';
import {initialGame,historicalResults,migrateLegacyDraftOrder,seedCurrentSeasonPossessions} from './private-league-seed.ts';
import {canonicalJson} from './score-ledger.ts';
import type {GameState} from './game-data.ts';
import type {PlayerSignup} from './league.ts';
import {firestoreData} from './firestore-data.ts';

/** A fresh server transaction applies each explicit command to current stored state. */
export async function executeAdminCommand(db:Firestore,actor:CommunityActor,input:Record<string,unknown>,clock=()=>new Date().toISOString()){
  if(!isCommunityOwner(actor))throw new CommunityError('Only the verified game master can manage the league.',{status:403,code:'authorization'});
  const id=resourceId(input.id);
  if(typeof input.action!=='string'||!Number.isSafeInteger(input.season)||!input.input||typeof input.input!=='object'||Array.isArray(input.input))throw new CommunityError('Invalid commissioner command.',{status:400});
  const command=input as unknown as AdminCommand,hash=createHash('sha256').update(canonicalJson(command)).digest('hex');
  const root=db.doc('games/survivor-51'),receipt=root.collection('adminOperations').doc(id);
  return db.runTransaction(async tx=>{
    const [stored,prior]=await Promise.all([tx.get(root),tx.get(receipt)]);
    if(prior.exists){const r=prior.data()!;if(r.actorUid!==actor.uid||r.requestHash!==hash)throw new CommunityError('This request ID is already used.');return {ok:true,alreadyApplied:true};}
    const raw=stored.exists?stored.data() as GameState:structuredClone(initialGame);
    const current=migrateLegacyDraftOrder(withOfficialCastawayProfiles(raw,seedCurrentSeasonPossessions(raw.season.id,raw.season.number,raw.possessions),initialGame));
    let signup:PlayerSignup|undefined;
    const signupRef=command.action==='assignSignup'?root.collection('signups').doc(resourceId(command.input.uid)):null;
    if(signupRef){const record=await tx.get(signupRef);signup=record.exists?record.data() as PlayerSignup:undefined;}
    let next:GameState;const at=clock();
    try{next=applyAdminCommand(current,command,at,historicalResults,signup);}catch(error){throw new CommunityError(error instanceof Error?error.message:'Invalid commissioner operation.',{status:409,code:'conflict'});}
    // Domain computation above never reads or writes Firestore; all related documents commit together.
    if(command.action==='beginNextSeason'){if(!stored.exists)throw new CommunityError('No season to archive.');tx.set(root.collection('archives').doc(String(current.season.number)),current);}
    tx.set(root,firestoreData(next));
    if(signupRef&&command.action==='assignSignup')tx.update(signupRef,{assignedPlayerId:command.input.playerId});
    tx.create(receipt,{actorUid:actor.uid,season:command.season,action:command.action,requestHash:hash,at});
    return {ok:true};
  });
}
