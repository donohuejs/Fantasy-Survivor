import {NextRequest,NextResponse} from 'next/server';
import {getDraftServer} from '@/lib/firebase-admin';
import {DraftError,executeDraft,parseDraftCommand,type PrivateDeal} from '@/lib/draft';
import type {GameState} from '@/lib/game-data';

export const runtime='nodejs';
export const dynamic='force-dynamic';
function reply(body:object,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});}
export async function POST(request:NextRequest){
  // No cookies or user-supplied account IDs are accepted as authentication.
  const authorization=request.headers.get('authorization');
  if(!authorization?.startsWith('Bearer '))return reply({error:'Sign in with Google before drafting.'},401);
  let server:ReturnType<typeof getDraftServer>;
  try{server=getDraftServer();}catch{return reply({error:'The private draft server needs setup. Ask the game master to add FIREBASE_SERVICE_ACCOUNT_JSON in Vercel and redeploy.'},503);}
  let actor;
  try{const token=await server.auth.verifyIdToken(authorization.slice(7),true);actor={uid:token.uid,email:token.email??'',verified:token.email_verified===true};}catch{return reply({error:'Your sign-in expired or is invalid. Sign out and sign in again.'},401);}
  if(!actor.verified)return reply({error:'Use a verified Google account to draft.'},403);
  try{
    const body=await request.text();if(body.length>4096)return reply({error:'Draft request is too large.'},413);
    let parsed:unknown;try{parsed=JSON.parse(body);}catch{throw new DraftError('Invalid draft request.');}
    const command=parseDraftCommand(parsed);
    const ref=server.db.doc('games/survivor-51'),privateRef=ref.collection('draftPrivate').doc('active');
    await server.db.runTransaction(async transaction=>{
      const [snapshot,privateSnapshot]=await Promise.all([transaction.get(ref),transaction.get(privateRef)]);
      if(!snapshot.exists)throw new DraftError('The game is not initialized. Ask the game master to finish league setup.');
      const current=snapshot.data() as GameState;
      const result=executeDraft(current,privateSnapshot.exists?privateSnapshot.data() as PrivateDeal:null,actor,command);
      // Only draft fields are changed. The transaction retries if scores/profiles change concurrently.
      transaction.update(ref,{draft:result.game.draft,draftPicks:result.game.draftPicks});
      if(command.action==='start')transaction.set(privateRef,result.deal!);
    });
    // Do not return the transaction result: it contains the hidden deck.
    return reply({ok:true});
  }catch(error){
    if(error instanceof DraftError)return reply({error:error.message},409);
    // Keep credentials, tokens, card mappings and raw error messages out of logs.
    const code=typeof error==='object'&&error!==null&&'code' in error?String(error.code):'unknown';
    console.error('Draft transaction failed', {code});
    return reply({error:'The draft could not be saved. Reload to check whether it advanced, then try again. If it persists, ask the game master to check the private Firebase credential and Vercel logs.'},500);
  }
}
