import 'server-only';
import type {Firestore} from 'firebase-admin/firestore';
import {CommunityError,type CommunityActor} from './community.ts';
import {isCommunityOwner} from './community-authority.ts';
import {automaticRegistration} from './registration.ts';
import type {PlayerSignup} from './league.ts';
export async function registrationRows(db:Firestore,actor:CommunityActor){
  const collection=db.doc('games/survivor-51').collection('signups');
  if(isCommunityOwner(actor))return (await collection.get()).docs.map(d=>d.data() as PlayerSignup).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  const own=await collection.doc(actor.uid).get();return own.exists?[own.data() as PlayerSignup]:[];
}
export async function registerAccount(db:Firestore,actor:CommunityActor){
  if(!actor.verified||!actor.uid)throw new CommunityError('Use a verified Google account.',{status:403});
  const ref=db.doc('games/survivor-51').collection('signups').doc(actor.uid);
  return db.runTransaction(async tx=>{
    const stored=await tx.get(ref);
    const signup=automaticRegistration({uid:actor.uid,email:actor.email,emailVerified:actor.verified,displayName:actor.displayName??null},stored.exists?stored.data() as PlayerSignup:null,new Date().toISOString());
    if(!stored.exists)tx.create(ref,signup);return signup;
  });
}
