import {NextRequest,NextResponse} from 'next/server';
import {DraftServerSetupError,draftServerSetupMessage,getDraftServer} from './firebase-admin';
import {CommunityError,type CommunityActor} from './community';
import {classifyCommunityFailure} from './community-errors';

export function communityReply(body:object,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Authorization'}});}
export async function authenticateCommunity(request:NextRequest){
  const header=request.headers.get('authorization');
  if(!header?.startsWith('Bearer '))return {error:communityReply({error:'Sign in with Google to participate.',code:'authentication-required'},401)} as const;
  let server:Awaited<ReturnType<typeof getDraftServer>>;
  try{server=await getDraftServer();}catch(error){return {error:communityReply({error:draftServerSetupMessage(error),code:error instanceof DraftServerSetupError?'configuration-'+error.code:'configuration-unavailable'},503)} as const;}
  try{
    const token=await server.auth.verifyIdToken(header.slice(7),true);
    if(!token.email_verified)return {error:communityReply({error:'Use a verified Google account.',code:'authentication-unverified'},403)} as const;
    const actor:CommunityActor={uid:token.uid,email:token.email??'',verified:true};return {server,actor} as const;
  }catch{return {error:communityReply({error:'Your sign-in expired. Sign out and sign in again.',code:'authentication-invalid'},401)} as const;}
}
export function communityFailure(error:unknown){
  const failure=classifyCommunityFailure(error);
  if(!(error instanceof CommunityError))console.error('Community request failed',{code:failure.logCode,category:failure.code});
  return communityReply({error:failure.message,code:failure.code},failure.status);
}
export async function communityInput(request:NextRequest){
  if(Number(request.headers.get('content-length')??0)>40000)throw new CommunityError('Request too large.');
  const raw=await request.text();if(raw.length>40000)throw new CommunityError('Request too large.');
  try{const input=JSON.parse(raw);if(!input||typeof input!=='object'||Array.isArray(input))throw new Error();return input as Record<string,unknown>;}catch{throw new CommunityError('Invalid request.');}
}
