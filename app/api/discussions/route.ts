import {NextRequest} from 'next/server';
import {authenticateCommunity,communityFailure,communityInput,communityReply} from '@/lib/community-auth';
import {DiscussionStore} from '@/lib/discussion-store';
import {CommunityError,wholeNumber} from '@/lib/community';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
  const auth=await authenticateCommunity(request);if(auth.error)return auth.error;
  try{
    const store=new DiscussionStore(auth.server.db,auth.actor),params=request.nextUrl.searchParams;
    switch(params.get('view')??'catalog'){
      case 'catalog':return communityReply(await store.catalog());
      case 'schedule':return communityReply({schedule:await store.adminSchedule(wholeNumber(Number(params.get('season')),'season'))});
      case 'threads':return communityReply(await store.threads({episodeId:params.get('episodeId')??undefined,season:params.has('season')?wholeNumber(Number(params.get('season')),'season'):undefined,unread:params.get('unread')==='true',sort:params.get('sort')??undefined,cursor:params.get('cursor')??undefined,pageSize:params.has('pageSize')?wholeNumber(Number(params.get('pageSize')),'page size'):undefined}));
      case 'conversation':return communityReply(await store.conversation(params.get('threadId')??'',Number(params.get('after')??0),params.get('reveal')==='true'));
      case 'recap':return communityReply(await store.recap(params.get('episodeId')??'',params.get('reveal')==='true'));
      default:throw new CommunityError('Unknown discussion view.');
    }
  }catch(error){return communityFailure(error);}
}
export async function POST(request:NextRequest){
  const auth=await authenticateCommunity(request);if(auth.error)return auth.error;
  try{
    const input=await communityInput(request),store=new DiscussionStore(auth.server.db,auth.actor);let result:object|void;
    switch(input.action){
      case 'post':result=await store.post(input);break;
      case 'edit':result=await store.changeComment(input);break;
      case 'delete':result=await store.changeComment(input,true);break;
      case 'read':result=await store.markRead(input);break;
      case 'preferences':result=await store.preferences(input);break;
      case 'watched':result=await store.watched(input);break;
      case 'save-schedule':result=await store.saveSchedule(input);break;
      case 'override':result=await store.override(input);break;
      default:throw new CommunityError('Unknown discussion action.');
    }
    return communityReply({ok:true,...result});
  }catch(error){return communityFailure(error);}
}
