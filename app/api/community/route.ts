import {NextRequest,NextResponse} from 'next/server';
import {getDraftServer} from '@/lib/firebase-admin';
import {CommunityError,linkedAuthor,isCommunityOwner,makeRecap,makePoll,changeVote,requiredText,resourceId,wholeNumber,type EpisodeRecap,type EpisodeComment,type LeaguePoll,type CommunityActor} from '@/lib/community';
import type {GameState} from '@/lib/game-data';

export const runtime='nodejs';
export const dynamic='force-dynamic';
function reply(body:object,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});}
async function authenticate(request:NextRequest){
  const header=request.headers.get('authorization');
  if(!header?.startsWith('Bearer '))return {error:reply({error:'Sign in with Google to participate.'},401)} as const;
  let server:ReturnType<typeof getDraftServer>;
  try{server=getDraftServer();}catch{return {error:reply({error:'Server setup is incomplete. The game master needs to configure the private Firebase credential in Vercel.'},503)} as const;}
  try{
    const token=await server.auth.verifyIdToken(header.slice(7),true);
    if(!token.email_verified)return {error:reply({error:'Use a verified Google account.'},403)} as const;
    const actor:CommunityActor={uid:token.uid,email:token.email??'',verified:true};
    return {server,actor} as const;
  }catch{return {error:reply({error:'Your sign-in expired. Sign out and sign in again.'},401)} as const;}
}
function failure(error:unknown){
  if(error instanceof CommunityError)return reply({error:error.message},409);
  console.error('Community request failed',{code:typeof error==='object'&&error!==null&&'code' in error?String(error.code):'unknown'});
  return reply({error:'Unable to save. Check your connection and reload before trying again.'},500);
}
export async function GET(request:NextRequest){
  const auth=await authenticate(request);if(auth.error)return auth.error;
  try{
    const id=resourceId(request.nextUrl.searchParams.get('pollId'));
    const ref=auth.server.db.doc('games/survivor-51'),game=await ref.get();
    if(!game.exists)throw new CommunityError('The league is not ready.');
    const author=linkedAuthor(game.data() as GameState,auth.actor);
    const vote=await ref.collection('polls').doc(id).collection('votes').doc(author.id).get();
    return reply({choice:vote.exists?vote.data()!.choice:null});
  }catch(error){return failure(error);}
}
export async function POST(request:NextRequest){
  const auth=await authenticate(request);if(auth.error)return auth.error;
  try{
    if(Number(request.headers.get('content-length')??0)>40000)return reply({error:'Request too large.'},413);
    const raw=await request.text();if(raw.length>40000)return reply({error:'Request too large.'},413);
    let input:Record<string,unknown>;
    try{input=JSON.parse(raw);if(!input||typeof input!=='object'||Array.isArray(input))throw new Error();}catch{throw new CommunityError('Invalid request.');}
    const owner=isCommunityOwner(auth.actor);
    const ref=auth.server.db.doc('games/survivor-51');
    const result=await auth.server.db.runTransaction(async tx=>{
      const gameDoc=await tx.get(ref);if(!gameDoc.exists)throw new CommunityError('The league is not ready.');
      const game=gameDoc.data() as GameState,now=new Date().toISOString();
      if(input.action==='save-recap'){
        if(!owner)throw new CommunityError('Only the game master can publish recaps.');
        const id=wholeNumber(input.season,'season')+'-'+wholeNumber(input.episode,'episode');
        const recapRef=ref.collection('episodes').doc(id),old=await tx.get(recapRef);
        const recap=makeRecap(game,input,old.exists?old.data() as EpisodeRecap:null,now);
        tx.set(recapRef,recap);return {updatedAt:recap.updatedAt};
      }
      if(input.action==='create-poll'){
        if(!owner)throw new CommunityError('Only the game master can open polls.');
        const poll=makePoll(game,input,now),pollRef=ref.collection('polls').doc(poll.id);
        const old=await tx.get(pollRef);
        if(old.exists){const saved=old.data() as LeaguePoll;if(saved.question===poll.question&&saved.season===poll.season&&saved.episode===poll.episode&&JSON.stringify(saved.options)===JSON.stringify(poll.options))return;throw new CommunityError('A different poll already uses this ID. Reload and try again.');}
        if(poll.episode){const recap=await tx.get(ref.collection('episodes').doc(poll.season+'-'+poll.episode));if(!recap.exists||recap.data()!.status!=='published')throw new CommunityError('Publish the episode recap first, or choose a league-wide poll.');}
        tx.create(pollRef,poll);return;
      }
      if(input.action==='vote'||input.action==='close-poll'){
        const pollRef=ref.collection('polls').doc(resourceId(input.pollId)),snapshot=await tx.get(pollRef);
        if(!snapshot.exists)throw new CommunityError('That poll no longer exists.');
        const poll=snapshot.data() as LeaguePoll;
        if(input.action==='close-poll'){if(!owner)throw new CommunityError('Only the game master can close polls.');tx.update(pollRef,{status:'closed',updatedAt:now});return;}
        const author=linkedAuthor(game,auth.actor),voteRef=pollRef.collection('votes').doc(author.id),vote=await tx.get(voteRef);
        const updated=changeVote(poll,vote.exists?vote.data()!.choice:null,input.choice,game.season.number,now);
        tx.set(voteRef,{choice:input.choice,updatedAt:now});tx.set(pollRef,updated);return;
      }
      if(input.action==='comment'||input.action==='delete-comment'){
        const recapRef=ref.collection('episodes').doc(resourceId(input.episodeId)),recap=await tx.get(recapRef);
        if(!recap.exists||(!owner&&recap.data()!.status!=='published'))throw new CommunityError('This recap is not published.');
        const author=linkedAuthor(game,auth.actor,true),commentRef=recapRef.collection('comments').doc(resourceId(input.id)),existing=await tx.get(commentRef);
        if(input.action==='delete-comment'){
          if(!existing.exists)return;
          if(!owner&&existing.data()!.authorId!==author.id)throw new CommunityError('You can only remove your own comments.');
          tx.delete(commentRef);return;
        }
        if(recap.data()!.status!=='published')throw new CommunityError('Publish the recap before commenting.');
        const text=requiredText(input.text,'Comment',2000);
        if(existing.exists){if(existing.data()!.authorId===author.id&&existing.data()!.text===text)return;throw new CommunityError('That comment ID is already used. Reload before posting again.');}
        const rateRef=ref.collection('communityPrivate').doc(auth.actor.uid),rate=await tx.get(rateRef);
        if(rate.exists&&Date.now()-Date.parse(rate.data()!.lastCommentAt)<10000)throw new CommunityError('Please wait a few seconds before posting another comment.');
        const comment:EpisodeComment={id:String(input.id),authorId:author.id,authorName:author.name,text,createdAt:now};
        tx.create(commentRef,comment);tx.set(rateRef,{lastCommentAt:now});return;
      }
      throw new CommunityError('Unknown action.');
    });
    return reply({ok:true,...result});
  }catch(error){return failure(error);}
}
