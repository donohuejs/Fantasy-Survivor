import 'server-only';
import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';

export type DraftServerSetupCode='missing-project-id'|'missing-credential'|'invalid-json'|'project-mismatch'|'missing-fields'|'sdk-init-failed';
type FirebaseServiceAccountJson={project_id:string;client_email:string;private_key:string};
export class DraftServerSetupError extends Error{
  constructor(public readonly code:DraftServerSetupCode){super(code);this.name='DraftServerSetupError';}
}

function errorCode(error:unknown){return typeof error==='object'&&error!==null&&'code' in error?String(error.code):'unknown';}

export function draftServerSetupMessage(error:unknown){
  if(!(error instanceof DraftServerSetupError))return 'The private Firebase server could not start. Check the Vercel function logs.';
  switch(error.code){
    case 'missing-project-id':return 'NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing from the Production environment in Vercel.';
    case 'missing-credential':return 'FIREBASE_SERVICE_ACCOUNT_JSON is missing from the Production environment in Vercel.';
    case 'invalid-json':return 'FIREBASE_SERVICE_ACCOUNT_JSON is present but is not valid JSON. Paste the complete downloaded service-account file, including its opening and closing braces.';
    case 'project-mismatch':return 'The service-account project_id does not match NEXT_PUBLIC_FIREBASE_PROJECT_ID.';
    case 'missing-fields':return 'The service-account JSON is missing project_id, client_email, or private_key.';
    case 'sdk-init-failed':return 'The Firebase Admin SDK found the credential but could not initialize. Re-enter the complete service-account JSON and confirm its private key is intact.';
  }
}

// Import only from server routes. Never use NEXT_PUBLIC_ for this credential.
export async function getDraftServer(){
  const projectId=process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if(!projectId)throw new DraftServerSetupError('missing-project-id');
  if(!raw)throw new DraftServerSetupError('missing-credential');
  let service:Partial<FirebaseServiceAccountJson>;
  try{
    const parsed=JSON.parse(raw.trim().replace(/^\uFEFF/,''));
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('not-an-object');
    service=parsed as typeof service;
  }catch{throw new DraftServerSetupError('invalid-json');}
  if(!service.project_id||!service.client_email||!service.private_key)throw new DraftServerSetupError('missing-fields');
  if(service.project_id!==projectId)throw new DraftServerSetupError('project-mismatch');
  // The downloaded credential uses snake_case JSON keys, while the Admin
  // SDK's cert() object form expects camelCase properties.
  const validService={projectId:service.project_id,clientEmail:service.client_email,privateKey:service.private_key};
  try{
    const app=getApps().find(a=>a.name==='draft-server')??initializeApp({credential:cert(validService),projectId},'draft-server');
    return {auth:getAuth(app),db:getFirestore(app)};
  }catch(error){
    console.error('Firebase Admin SDK initialization failed',{code:errorCode(error)});
    throw new DraftServerSetupError('sdk-init-failed');
  }
}
