import {NextRequest} from 'next/server';
import {authenticateCommunity,communityInput,communityReply} from '@/lib/community-auth';
import {CommunityError} from '@/lib/community';
import {JuryError} from '@/lib/jury';
import {JuryStore} from '@/lib/jury-store';

export const runtime='nodejs';
export const dynamic='force-dynamic';
function failure(error:unknown){
  if(error instanceof JuryError||error instanceof CommunityError)return communityReply({error:error.message},error.status);
  console.error('Jury request failed',{code:typeof error==='object'&&error!==null&&'code' in error?String(error.code):'unknown'});
  return communityReply({error:'Jury Mode could not save or load. Refresh to check saved answers before retrying.'},500);
}
export async function GET(request:NextRequest){
  const auth=await authenticateCommunity(request);if(auth.error)return auth.error;
  try{
    const store=new JuryStore(auth.server.db,auth.actor),view=request.nextUrl.searchParams.get('view');
    if(view==='suggestion')return communityReply({facts:await store.suggestion(Number(request.nextUrl.searchParams.get('episode')))});
    return communityReply(await store.catalog(view==='admin'));
  }catch(error){return failure(error);}
}
export async function POST(request:NextRequest){
  const auth=await authenticateCommunity(request);if(auth.error)return auth.error;
  try{return communityReply(await new JuryStore(auth.server.db,auth.actor).mutate(await communityInput(request)));}
  catch(error){return failure(error);}
}
