import {NextRequest,NextResponse} from 'next/server';
import {draftServerSetupMessage,getDraftServer} from './firebase-admin';
import {CommunityError,type CommunityActor} from './community';

export function communityReply(body:object,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Authorization'}});}
export async function authenticateCommunity(request:NextRequest){
  const header=request.headers.get('authorization');
  if(!header?.startsWith('Bearer '))return {error:communityReply({error:'Sign in with Google to participate.'},401)} as const;
  let server:Awaited<ReturnType<typeof getDraftServer>>;
  try{server=await getDraftServer();}catch(error){return {error:communityReply({error:draftServerSetupMessage(error)},503)} as const;}
  try{
    const token=await server.auth.verifyIdToken(header.slice(7),true);
    if(!token.email_verified)return {error:communityReply({error:'Use a verified Google account.'},403)} as const;
    const actor:CommunityActor={uid:token.uid,email:token.email??'',verified:true};return {server,actor} as const;
  }catch{return {error:communityReply({error:'Your sign-in expired. Sign out and sign in again.'},401)} as const;}
}
export function communityFailure(error:unknown){
  if(error instanceof CommunityError)return communityReply({error:error.message},409);
  console.error('Community request failed',{code:typeof error==='object'&&error!==null&&'code' in error?String(error.code):'unknown'});
  return communityReply({error:'Unable to load or save discussions. Check your connection and retry.'},500);
}
export async function communityInput(request:NextRequest){
  if(Number(request.headers.get('content-length')??0)>40000)throw new CommunityError('Request too large.');
  const raw=await request.text();if(raw.length>40000)throw new CommunityError('Request too large.');
  try{const input=JSON.parse(raw);if(!input||typeof input!=='object'||Array.isArray(input))throw new Error();return input as Record<string,unknown>;}catch{throw new CommunityError('Invalid request.');}
}
