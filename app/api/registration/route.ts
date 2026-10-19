import {NextRequest} from 'next/server';
import {authenticateCommunity,communityReply,communityFailure} from '@/lib/community-auth';
import {registerAccount,registrationRows} from '@/lib/registration-store';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){const auth=await authenticateCommunity(request);if(auth.error)return auth.error;try{return communityReply({rows:await registrationRows(auth.server.db,auth.actor)});}catch(error){return communityFailure(error);}}
export async function POST(request:NextRequest){const auth=await authenticateCommunity(request);if(auth.error)return auth.error;try{return communityReply({signup:await registerAccount(auth.server.db,auth.actor)});}catch(error){return communityFailure(error);}}
