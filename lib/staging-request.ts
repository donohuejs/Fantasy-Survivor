import type {Firestore,Transaction} from 'firebase-admin/firestore';
import type {NextRequest} from 'next/server';
import {CommunityError} from './community.ts';
import {requireCloudStaging,assertStagingControl,assertStagingDatabase} from './staging-environment.ts';

export async function advanceStagingDeadline(db:Firestore){
  requireCloudStaging();assertStagingDatabase(db);
  const ref=db.doc('stagingControl/state'),saved=await ref.get();assertStagingControl(saved.data());const state=saved.data()!;
  if(state.phase!=='ready'||!state.advanceAtDeadline||state.advanced||!state.airtime||Date.now()<Date.parse(state.airtime))return;
  await db.runTransaction(async tx=>{const [control,game]=await Promise.all([tx.get(ref),tx.get(db.doc('games/survivor-51'))]);assertStagingControl(control.data());const current=control.data()!;
    if(current.phase==='ready'&&current.version===state.version&&current.advanceAtDeadline&&!current.advanced&&Date.now()>=Date.parse(current.airtime)&&game.exists){tx.update(game.ref,{'season.currentEpisode':current.episode});tx.update(ref,{advanced:true,updatedAt:new Date().toISOString()});}
  });
}
export async function stagingRequestDatabase(db:Firestore,request:NextRequest):Promise<Firestore>{
  requireCloudStaging();assertStagingDatabase(db);
  await advanceStagingDeadline(db);
  const controlRef=db.doc('stagingControl/state'),saved=await controlRef.get();assertStagingControl(saved.data());const state=saved.data()!;
  if(state.phase!=='ready')throw new CommunityError('Synthetic scenario preparation is in progress. Open /staging as commissioner to check or retry.',{status:503});
  const version=state.version;
  if(request.method!=='GET'&&request.headers.get('x-jury-staging-fixture')!==String(version))throw new CommunityError('The synthetic scenario changed. Reload before saving.',{status:409});
  return new Proxy(db,{get(target,key){
    if(key==='runTransaction')return (callback:(tx:Transaction)=>Promise<unknown>,options?:object)=>target.runTransaction(async tx=>{
      const control=await tx.get(controlRef);assertStagingControl(control.data());
      if(control.data()!.phase!=='ready'||control.data()!.version!==version)throw new CommunityError('The synthetic scenario changed. Reload before saving.',{status:409});
      return callback(tx);
    },options);
    const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});
}
