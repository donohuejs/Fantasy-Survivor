import {randomUUID,createHash} from 'node:crypto';
import type {Auth} from 'firebase-admin/auth';
import type {Firestore} from 'firebase-admin/firestore';
import {CommunityError,type CommunityActor} from './community.ts';
import {JuryStore} from './jury-store.ts';
import {executeAdminCommand} from './admin-store.ts';
import {canonicalJson} from './score-ledger.ts';
import {requireCloudStaging,stagingCommissioner,assertStagingControl,assertStagingDatabase,STAGING_PROJECT,STAGING_SCHEMA,type StagingControl} from './staging-environment.ts';
import {stagingGame,stagingParameters,acceptanceAccounts,acceptanceSnapshot,acceptanceFacts} from './staging-fixture.ts';

export function stagingCredentials(){
  requireCloudStaging();const data=JSON.parse(process.env.STAGING_FIXTURE_PASSWORDS_JSON??'{}') as Record<string,{uid:string;email:string;password:string}>;
  if(Object.keys(data).length!==acceptanceAccounts.length||!acceptanceAccounts.every(role=>data[role]?.uid==='staging-'+role&&data[role]?.email===role+'@jury.test'&&data[role]?.password?.length>=20))throw new Error('Staging account configuration is unavailable.');
  return data;
}
function owner(actor:CommunityActor){if(!stagingCommissioner(actor))throw new CommunityError('Only the synthetic commissioner can control scenarios.',{status:403});}
async function fixtureActor(auth:Auth,role:'jury'|'complete'){
  const credential=stagingCredentials()[role],key=process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+encodeURIComponent(key??''),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:credential.email,password:credential.password,returnSecureToken:true}),cache:'no-store'});
  const body=await response.json();if(!response.ok||typeof body.idToken!=='string')throw new Error('Synthetic fixture sign-in failed.');
  const token=await auth.verifyIdToken(body.idToken,true);
  if(token.uid!==credential.uid||token.email!==credential.email||token.email_verified!==true)throw new Error('Synthetic fixture identity mismatch.');
  return {uid:token.uid,email:token.email,verified:true};
}
export async function prepareStagingScenario(db:Firestore,auth:Auth,actor:CommunityActor,input:Record<string,unknown>){
  requireCloudStaging();owner(actor);assertStagingDatabase(db);
  let params:ReturnType<typeof stagingParameters>;try{params=stagingParameters(input);}catch(error){throw new CommunityError(error instanceof Error?error.message:'Invalid scenario.',{status:400});}
  const controlRef=db.doc('stagingControl/state'),operation=db.doc('stagingOperations/'+params.requestId),hash=createHash('sha256').update(canonicalJson(params)).digest('hex');
  const acquired=await db.runTransaction(async tx=>{
    const [control,prior,game]=await Promise.all([tx.get(controlRef),tx.get(operation),tx.get(db.doc('games/survivor-51'))]);assertStagingControl(control.data());const current=control.data()!;
    if(prior.exists){if(prior.data()!.actorUid!==actor.uid||prior.data()!.hash!==hash)throw new CommunityError('This scenario request ID is already used.',{status:409});return {run:false,version:current.version};}
    if(current.version!==params.expectedVersion)throw new CommunityError('The fixture changed. Refresh the controls.',{status:409});
    if(current.phase==='preparing'&&Date.parse(current.leaseUntil??'')>Date.now())throw new CommunityError('Another scenario is being prepared. Wait for its status.',{status:409});
    const marker=game.data()?.stagingFixture;
    const priorPreparation=current.operationId?await tx.get(db.doc('stagingOperations/'+current.operationId)):null;
    const recovering=(current.phase==='failed'||current.phase==='preparing')&&priorPreparation?.data()?.projectId===STAGING_PROJECT;
    if((!game.exists||marker?.projectId!==STAGING_PROJECT||marker?.schema!==STAGING_SCHEMA)&&!recovering)throw new CommunityError('Unknown fixture; refusing to reset it.',{status:409});
    const at=new Date().toISOString(),version=current.version+1;
    tx.update(controlRef,{phase:'preparing',scenario:params.scenario,version,operationId:params.requestId,leaseUntil:new Date(Date.now()+180000).toISOString(),error:'',updatedAt:at});
    tx.create(operation,{projectId:STAGING_PROJECT,schema:STAGING_SCHEMA,actorUid:actor.uid,hash,version,scenario:params.scenario,seconds:params.seconds,at});return {run:true,version};
  });
  if(!acquired.run)return {alreadyApplied:true,state:(await controlRef.get()).data()};
  try{
    const game=stagingGame(acquired.version,params.scenario==='postmerge'),root=db.doc('games/survivor-51');
    // Only this fixed, marked synthetic root is replaced; identities and operational receipts survive.
    await db.recursiveDelete(root);await root.set(game);
    const at=new Date().toISOString(),batch=db.batch();
    batch.set(root.collection('episodes').doc('51-4'),{id:'51-4',season:51,episode:4,status:'published',title:'Synthetic Episode 4',body:'Invented acceptance recap.',actions:[],createdAt:at,updatedAt:at,publishedAt:at,discussionOpensAt:new Date(Date.now()-86400000).toISOString(),discussionSchemaVersion:2});
    batch.set(root.collection('polls').doc('synthetic-poll'),{id:'synthetic-poll',season:51,episode:0,question:'Synthetic acceptance poll',options:['Amber','Violet'],counts:[0,0],status:'open',createdAt:at,updatedAt:at});await batch.commit();
    const snapshot=acceptanceSnapshot(game,new Date(Date.now()+params.seconds*1000).toISOString()),episode=snapshot.episode,store=new JuryStore(db,actor);
    const mutate=(input:Record<string,unknown>)=>store.mutate({...input,season:51,requestId:randomUUID()});
    await mutate({action:'snapshot',episode,snapshot});await mutate({action:'configure',enabled:true,activationEpisode:episode,expectedRevision:0,reconciliations:[],approval:'Synthetic remote staging activation only.'});
    const prefilled=['lock','grading','wrong-merge','merge'].includes(params.scenario);
    if(prefilled)for(const role of ['jury','complete'] as const){
      const playerStore=new JuryStore(db,await fixtureActor(auth,role)),values={q1:params.scenario==='wrong-merge'||params.scenario==='merge'?'merge':'amber',q2:'nothing',...(role==='complete'?{q3:'2',q4:'synthetic-fern'}:{}),q5:'synthetic-dusk'};let revision=0;
      for(const [question,value] of Object.entries(values))await playerStore.mutate({action:'save-answer',season:51,episode,question,value,expectedRevision:revision++,requestId:randomUUID()});
    }
    const facts=acceptanceFacts(params.scenario==='merge');
    if(params.scenario==='merge'||params.scenario==='postmerge'){
      if(params.scenario==='merge')await executeAdminCommand(db,actor,{id:randomUUID(),season:51,action:'setMergeEpisode',input:{episode:5}});
      await root.update({tribalCouncils:[{id:'synthetic-council',episode,number:1,attendeeMode:'all-active',attendeeIds:snapshot.castaways.map(c=>c.id),status:'resolved',eliminatedCastawayId:'synthetic-dusk',eliminationReason:'voted-out'}],tribalVotes:facts.councils[0].rounds[0].votes.map((vote,i)=>({...vote,id:'synthetic-vote-'+i,episode,tribalCouncilId:'synthetic-council',round:1,revote:false,recordedAt:at}))});
    }
    await mutate({action:'evidence',episode,expectedRevision:1,facts});
    const ready:StagingControl={projectId:STAGING_PROJECT,schema:STAGING_SCHEMA,version:acquired.version,phase:'ready',scenario:params.scenario,episode,airtime:snapshot.airtime,advanceAtDeadline:true,advanced:false,operationId:params.requestId,updatedAt:new Date().toISOString()};
    await db.runTransaction(async tx=>{const current=await tx.get(controlRef);if(current.data()?.operationId!==params.requestId||current.data()?.phase!=='preparing')throw new Error('Scenario preparation lease changed.');tx.set(controlRef,ready);tx.create(db.doc('stagingOperations/'+params.requestId+'-ready'),{projectId:STAGING_PROJECT,version:acquired.version,at:ready.updatedAt,episode,airtime:snapshot.airtime});});
    return {state:ready};
  }catch(error){
    await db.runTransaction(async tx=>{const current=await tx.get(controlRef);if(current.data()?.operationId===params.requestId){tx.update(controlRef,{phase:'failed',error:'Preparation failed; confirm another reset to retry.',updatedAt:new Date().toISOString()});tx.create(db.doc('stagingOperations/'+params.requestId+'-failed'),{projectId:STAGING_PROJECT,at:new Date().toISOString(),version:acquired.version});}});
    throw error;
  }
}
