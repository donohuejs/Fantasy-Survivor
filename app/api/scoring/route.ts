import {NextRequest,NextResponse} from 'next/server';
import {getDraftServer,draftServerSetupMessage} from '@/lib/firebase-admin';
import {assertScoringCommissioner,ScoreCorrectionError,type ScoringActor} from '@/lib/score-corrections';
import {correctScoring,scoringCorrectionHistory} from '@/lib/score-correction-store';

export const runtime='nodejs';
export const dynamic='force-dynamic';
function reply(body:object,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Authorization'}});}
async function authenticate(request:NextRequest){
  const header=request.headers.get('authorization');
  if(!header?.startsWith('Bearer '))return {error:reply({error:'Sign in with Google first.'},401)} as const;
  let server:Awaited<ReturnType<typeof getDraftServer>>;
  try{server=await getDraftServer();}catch(error){return {error:reply({error:draftServerSetupMessage(error)},503)} as const;}
  try{
    const token=await server.auth.verifyIdToken(header.slice(7),true);
    const actor:ScoringActor={uid:token.uid,email:token.email??'',verified:token.email_verified===true};
    assertScoringCommissioner(actor);
    return {server,actor} as const;
  }catch(error){
    if(error instanceof ScoreCorrectionError)return {error:reply({error:error.message},403)} as const;
    return {error:reply({error:'Your sign-in expired. Sign out and sign in again.'},401)} as const;
  }
}
function failure(error:unknown){
  if(error instanceof ScoreCorrectionError)return reply({error:error.message},error.status);
  console.error('Scoring correction failed',{code:typeof error==='object'&&error!==null&&'code' in error?String(error.code):'unknown'});
  return reply({error:'Unable to save the correction. Retry the same review to safely check whether it saved.'},500);
}
export async function POST(request:NextRequest){
  const auth=await authenticate(request);if(auth.error)return auth.error;
  try{
    const raw=await request.text();if(raw.length>20000)return reply({error:'Request is too large.'},413);
    let input;try{input=JSON.parse(raw);}catch{throw new ScoreCorrectionError('Invalid request.',400);}
    if(input?.phase!=='preview'&&input?.phase!=='save')throw new ScoreCorrectionError('Review the correction before saving.',400);
    return reply(await correctScoring(auth.server.db,auth.actor,input,input.phase==='save'));
  }catch(error){return failure(error);}
}
export async function GET(request:NextRequest){
  const auth=await authenticate(request);if(auth.error)return auth.error;
  try{return reply({corrections:await scoringCorrectionHistory(auth.server.db,auth.actor,request.nextUrl.searchParams.get('eventId')??'')});}catch(error){return failure(error);}
}
