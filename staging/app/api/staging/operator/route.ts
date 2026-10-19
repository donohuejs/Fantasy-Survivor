import {NextRequest} from 'next/server';
import {getDraftServer} from '@/lib/firebase-admin';
import {communityReply,communityInput,communityFailure} from '@/lib/community-auth';
import {CommunityError} from '@/lib/community';
import {requireCloudStaging,stagingCommissioner,assertStagingDatabase,assertStagingControl} from '@/lib/staging-environment';
import {OPERATOR_COOKIE,OPERATOR_SECONDS,authorizeOperator,signOperatorProof,sameOriginOperatorRequest,recentOperatorAuthentication} from '@/lib/staging-operator';
import {stagingCredentials} from '@/lib/staging-store';
import {acceptanceAccounts} from '@/lib/staging-fixture';
export const runtime='nodejs';export const dynamic='force-dynamic';
async function server(){requireCloudStaging();const value=await getDraftServer();assertStagingDatabase(value.db);return value;}
const secret=()=>process.env.STAGING_OPERATOR_SECRET??'';
const cookieOptions={httpOnly:true,secure:true,sameSite:'strict' as const,path:'/'};
export async function GET(request:NextRequest){
  try{const {auth,db}=await server(),operator=await authorizeOperator(request.cookies.get(OPERATOR_COOKIE)?.value,secret(),auth);if(!operator)return communityReply({operator:false});const state=(await db.doc('stagingControl/state').get()).data();assertStagingControl(state);return communityReply({operator:true,version:state.version});}catch(error){return communityFailure(error);}
}
export async function POST(request:NextRequest){
  try{
    const {auth}=await server();
    // Next can normalize its internal URL to localhost; compare against the actual request host.
    const protocol=request.headers.get('x-forwarded-proto')==='https'?'https':request.nextUrl.protocol.slice(0,-1);
    const origin=request.headers.get('host')?new URL(protocol+'://'+request.headers.get('host')).origin:request.nextUrl.origin;
    if(!sameOriginOperatorRequest(request.headers.get('origin'),origin,request.headers.get('content-type')))throw new CommunityError('Use the same-origin staging controls.',{status:403});
    const input=await communityInput(request);
    if(input.action==='authorize'){
      const header=request.headers.get('authorization');if(!header?.startsWith('Bearer '))throw new CommunityError('Sign in as commissioner to enable operator switching.',{status:401});
      let token;try{token=await auth.verifyIdToken(header.slice(7),true);}catch{throw new CommunityError('Commissioner sign-in expired.',{status:401});}
      if(!stagingCommissioner({uid:token.uid,email:token.email??'',verified:token.email_verified===true}))throw new CommunityError('Only the verified staging commissioner may authorize an operator session.',{status:403});
      if(!recentOperatorAuthentication(token.auth_time))throw new CommunityError('Sign in as commissioner again to enable operator switching on this device.',{status:401});
      const response=communityReply({operator:true});response.cookies.set(OPERATOR_COOKIE,signOperatorProof(token.auth_time,secret()),{...cookieOptions,maxAge:OPERATOR_SECONDS});return response;
    }
    if(!await authorizeOperator(request.cookies.get(OPERATOR_COOKIE)?.value,secret(),auth))throw new CommunityError('Enable a staging operator session as commissioner first.',{status:403});
    if(input.action==='end'){const response=communityReply({operator:false});response.cookies.set(OPERATOR_COOKIE,'',{...cookieOptions,maxAge:0});return response;}
    if(input.action==='switch-account'){
      if(!acceptanceAccounts.includes(input.role as typeof acceptanceAccounts[number]))throw new CommunityError('Choose a listed synthetic account.',{status:400});
      return communityReply({account:stagingCredentials()[String(input.role)]});
    }
    throw new CommunityError('Unknown staging operator action.',{status:400});
  }catch(error){return communityFailure(error);}
}
