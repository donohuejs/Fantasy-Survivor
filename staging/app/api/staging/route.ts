import {OPERATOR_COOKIE,authorizeOperator} from '@/lib/staging-operator';
import {NextRequest} from 'next/server';
import {getDraftServer} from '@/lib/firebase-admin';
import {communityInput,communityReply,communityFailure} from '@/lib/community-auth';
import {CommunityError,type CommunityActor} from '@/lib/community';
import {assertLeagueAccess} from '@/lib/league-access';
import type {GameState} from '@/lib/game-data';
import {requireCloudStaging,stagingCommissioner,assertStagingControl,assertStagingDatabase} from '@/lib/staging-environment';
import {advanceStagingDeadline} from '@/lib/staging-request';
import {prepareStagingScenario} from '@/lib/staging-store';
import {acceptanceAccounts,stagingScenarios} from '@/lib/staging-fixture';

export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
async function authorize(request:NextRequest){
  if(process.env.JURY_STAGING!=='1')throw new CommunityError('Not found.',{status:404});requireCloudStaging();
  const header=request.headers.get('authorization');if(!header?.startsWith('Bearer '))throw new CommunityError('Sign in to staging.',{status:401});
  const server=await getDraftServer();assertStagingDatabase(server.db);
  let token;try{token=await server.auth.verifyIdToken(header.slice(7),true);}catch{throw new CommunityError('Sign-in expired. Sign out and sign in again.',{status:401});}
  if(!token.email_verified)throw new CommunityError('Use a verified synthetic account.',{status:403});
  const actor:CommunityActor={uid:token.uid,email:token.email??'',verified:true};return {server,actor};
}
export async function GET(request:NextRequest){
  try{
    const {server,actor}=await authorize(request),commissioner=stagingCommissioner(actor),operator=await authorizeOperator(request.cookies.get(OPERATOR_COOKIE)?.value,process.env.STAGING_OPERATOR_SECRET??'',server.auth);
    const saved=await server.db.doc('stagingControl/state').get();assertStagingControl(saved.data());
    if(!commissioner&&!operator){const game=await server.db.doc('games/survivor-51').get();if(!game.exists)throw new CommunityError('Scenario preparation in progress.',{status:503});assertLeagueAccess(game.data() as GameState,actor);}
    await advanceStagingDeadline(server.db);const current=await server.db.doc('stagingControl/state').get();assertStagingControl(current.data());
    return communityReply({state:current.data(),commissioner,serverTime:new Date().toISOString(),scenarios:commissioner?stagingScenarios:[],accounts:commissioner?acceptanceAccounts:[]});
  }catch(error){return communityFailure(error);}
}
export async function POST(request:NextRequest){
  try{
    const {server,actor}=await authorize(request);if(!stagingCommissioner(actor))throw new CommunityError('Only the synthetic commissioner can control scenarios.',{status:403});
    const input=await communityInput(request);
    if(!await authorizeOperator(request.cookies.get(OPERATOR_COOKIE)?.value,process.env.STAGING_OPERATOR_SECRET??'',server.auth))throw new CommunityError('Enable the staging operator session first.',{status:403});
    if(input.action==='prepare')return communityReply(await prepareStagingScenario(server.db,server.auth,actor,input));
    throw new CommunityError('Unknown staging operation.',{status:400});
  }catch(error){return communityFailure(error);}
}
