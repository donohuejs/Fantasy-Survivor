import {CommunityError} from './community.ts';

export type CommunityFailure={status:number;code:string;message:string;logCode:string};
function backendCode(error:unknown){return typeof error==='object'&&error!==null&&'code' in error?String(error.code).toLowerCase():'';}
function backendMessage(error:unknown){return error instanceof Error?error.message.toLowerCase():'';}

/** Classifies backend failures without returning provider details to a caller. */
export function classifyCommunityFailure(error:unknown):CommunityFailure{
  if(error instanceof CommunityError)return {status:error.status,code:error.code,message:error.message,logCode:error.code};
  const code=backendCode(error),message=backendMessage(error);
  if(code==='failed-precondition'||code==='9'||message.includes('requires an index')||message.includes('create index'))return {status:503,code:'storage-index-missing',message:'Discussion storage indexes are not ready. Try again later.',logCode:code||'failed-precondition'};
  if(code==='permission-denied'||code==='7')return {status:503,code:'storage-permission-denied',message:'Discussion storage authorization is not configured.',logCode:code};
  if(code==='unauthenticated'||code==='16')return {status:401,code:'authentication-failed',message:'Your sign-in could not be verified. Sign in again.',logCode:code};
  if(code==='unavailable'||code==='14'||code==='deadline-exceeded')return {status:503,code:'storage-unavailable',message:'Discussion storage is temporarily unavailable. Try again later.',logCode:code};
  return {status:500,code:'internal-error',message:'Unable to load or save discussions. Check your connection and retry.',logCode:code||'unknown'};
}
