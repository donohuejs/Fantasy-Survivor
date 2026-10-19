import 'server-only';
import {NextRequest} from 'next/server';
import {authenticateCommunity,communityReply,communityInput,communityFailure} from '@/lib/community-auth';
import {executeAdminCommand} from '@/lib/admin-store';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest){
  const auth=await authenticateCommunity(request);if(auth.error)return auth.error;
  try{return communityReply(await executeAdminCommand(auth.server.db,auth.actor,await communityInput(request)));}catch(error){return communityFailure(error);}
}
