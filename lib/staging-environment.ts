// Only the separately packaged staging server imports this guard.
export const STAGING_PROJECT='fantasy-survivor-jury-staging';
export const STAGING_APP_ID='1:343309828044:web:903b6d73ca9d7f6f4c2769';
export const STAGING_SERVICE_ACCOUNT=`jury-staging-runtime@${STAGING_PROJECT}.iam.gserviceaccount.com`;
export const STAGING_SCHEMA='jury-staging-a-1';
export const STAGING_COMMISSIONER_UID='staging-commissioner';
export function assertStagingDatabase(db:unknown){if((db as {projectId?:string})?.projectId!==STAGING_PROJECT)throw new Error('Staging database mismatch.');}
export function requireCloudStaging(env:Record<string,string|undefined>=process.env){
  let credential:{project_id?:string;client_email?:string}={};
  try{credential=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON??'{}');}catch{throw new Error('Invalid staging credential.');}
  if(env.JURY_STAGING!=='1'||env.NEXT_PUBLIC_JURY_STAGING!=='1'||env.NODE_ENV!=='production'||env.VERCEL_ENV!=='preview'||env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!==STAGING_PROJECT||env.NEXT_PUBLIC_FIREBASE_APP_ID!==STAGING_APP_ID||env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!==STAGING_PROJECT+'.firebaseapp.com'||credential.project_id!==STAGING_PROJECT||credential.client_email!==STAGING_SERVICE_ACCOUNT||env.FIRESTORE_EMULATOR_HOST||env.FIREBASE_AUTH_EMULATOR_HOST||env.LOCAL_ACCEPTANCE||env.NEXT_PUBLIC_LOCAL_ACCEPTANCE)throw new Error('Cloud staging requires the fixed isolated Preview environment.');
  return true;
}
export function stagingCommissioner(actor:{uid:string;email:string;verified:boolean}){return actor.verified&&actor.uid===STAGING_COMMISSIONER_UID&&actor.email.toLowerCase()==='commissioner@jury.test';}
export function assertStagingControl(value:unknown):asserts value is StagingControl {
  const data=value as Partial<StagingControl>|undefined;
  if(!data||data.projectId!==STAGING_PROJECT||data.schema!==STAGING_SCHEMA||!Number.isSafeInteger(data.version)||Number(data.version)<1)throw new Error('The isolated staging fixture is not initialized.');
}
export type StagingControl={projectId:typeof STAGING_PROJECT;schema:typeof STAGING_SCHEMA;version:number;phase:'ready'|'preparing'|'failed';scenario:string;episode?:number;airtime?:string;advanceAtDeadline?:boolean;advanced?:boolean;operationId?:string;leaseUntil?:string;error?:string;updatedAt:string};
