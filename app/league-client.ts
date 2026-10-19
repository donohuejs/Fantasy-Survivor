'use client';
import {getFirebase} from '@/lib/firebase';

export async function leagueRequest<T>(view?:string,signal?:AbortSignal):Promise<T>{
  const user=getFirebase().auth.currentUser;if(!user)throw new Error('Sign in with Google first.');
  const token=await user.getIdToken();signal?.throwIfAborted();
  if(getFirebase().auth.currentUser?.uid!==user.uid)throw new Error('Your signed-in account changed.');
  const response=await fetch('/api/league'+(view?'?view='+view:''),{headers:{Authorization:'Bearer '+token},cache:'no-store',signal});
  const body=await response.json();
  if(!response.ok)throw Object.assign(new Error(body.error??'Could not load league information.'),{status:response.status});
  return body as T;
}
