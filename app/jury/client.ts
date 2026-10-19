'use client';
import {getFirebase} from '@/lib/firebase';
import type {JuryConfig,JuryEpisode,JuryGrade,JuryPrediction,PlayerJurySnapshot,JuryKey,activationPreview,juryEligibility} from '@/lib/jury';
import type {PlayerJuryResults} from '@/lib/jury-results';

export type PlayerJuryEpisode={snapshot:PlayerJurySnapshot;prediction:JuryPrediction|null;locked:boolean;canSave:boolean;status:string;grade:JuryGrade|null;results:PlayerJuryResults|null;eligibilityNeedsReview:boolean};
export type PlayerJuryCatalog={serverTime:string;enabled:boolean;eligibility:ReturnType<typeof juryEligibility>;episodes:PlayerJuryEpisode[]};
export type AdminJuryCatalog={serverTime:string;config:JuryConfig|null;preview:ReturnType<typeof activationPreview>;episodes:JuryEpisode[];predictions:JuryPrediction[];audits:Array<{at:string;action:string;actorUid:string;episode?:number}>};
export type GradePreview={key:JuryKey;keyRevision:number;previewToken:string;awards:Array<{playerId:string;eligible:boolean;answered:number;grade:JuryGrade;previousPoints:number}>};
export async function juryRequest<T>(input:Record<string,unknown>,get=false,signal?:AbortSignal):Promise<T>{
  const user=getFirebase().auth.currentUser;if(!user)throw new Error('Sign in with Google first.');
  const query=get?'?'+new URLSearchParams(Object.entries(input).map(([key,value])=>[key,String(value)])).toString():'';
  const token=await user.getIdToken();signal?.throwIfAborted();if(getFirebase().auth.currentUser?.uid!==user.uid)throw new Error('Your signed-in account changed.');
  const response=await fetch('/api/jury'+query,{signal,method:get?'GET':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},cache:'no-store',...(get?{}:{body:JSON.stringify(input)})});
  const result=await response.json().catch(error=>{if(signal?.aborted)throw error;return {error:'Unexpected server response. Refresh to check saved answers.'};});signal?.throwIfAborted();if(getFirebase().auth.currentUser?.uid!==user.uid)throw new Error('Your signed-in account changed.');
  if(!response.ok)throw new Error(result.error??'Jury Mode request failed.');if(!get)window.dispatchEvent(new Event('league-refresh'));return result as T;
}
export const juryQuestionLabels={q1:'Which tribe will attend Tribal Council, or will the tribes merge?',q2:'What will be played at Tribal Council?',q3:'How many castaways receive counted votes?',q4:'Besides the eliminated castaway, who else receives counted votes?',q5:'Who gets voted off?'};
