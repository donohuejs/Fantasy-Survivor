import {NextRequest} from 'next/server';
import {getDraftServer} from '@/lib/firebase-admin';
import {communityReply,communityFailure} from '@/lib/community-auth';
import {CommunityError} from '@/lib/community';
import {requireCloudStaging,assertStagingDatabase,stagingCommissioner} from '@/lib/staging-environment';
import {OPERATOR_COOKIE,authorizeOperator} from '@/lib/staging-operator';
import {stagingBuild} from '../../../staging/build-info';
export const runtime='nodejs';export const dynamic='force-dynamic';

/** Read-only diagnostic identity verification; never reads or writes fixture records. */
export async function GET(request:NextRequest){
  try{
    requireCloudStaging();const {auth,db}=await getDraftServer();assertStagingDatabase(db);
    if(!await authorizeOperator(request.cookies.get(OPERATOR_COOKIE)?.value,process.env.STAGING_OPERATOR_SECRET??'',auth))throw new CommunityError('An authorized staging operator session is required.',{status:403});
    let identity=null,tokenStatus='missing';const header=request.headers.get('authorization');
    if(header?.startsWith('Bearer '))try{
      const token=await auth.verifyIdToken(header.slice(7),true),actor={uid:token.uid,email:token.email??'',verified:token.email_verified===true};
      identity={...actor,commissioner:stagingCommissioner(actor)};tokenStatus='verified';
    }catch{tokenStatus='rejected';}
    return communityReply({build:stagingBuild,deploymentId:process.env.VERCEL_DEPLOYMENT_ID??null,deploymentHost:process.env.VERCEL_URL??null,serverTime:new Date().toISOString(),operator:true,tokenStatus,identity});
  }catch(error){return communityFailure(error);}
}
