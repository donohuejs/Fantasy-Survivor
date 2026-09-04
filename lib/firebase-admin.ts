import 'server-only';
import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';

// Import only from server routes. Never use NEXT_PUBLIC_ for this credential.
export function getDraftServer(){
  const projectId=process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if(!raw||!projectId)throw new Error('DRAFT_SERVER_NOT_CONFIGURED');
  const service=JSON.parse(raw);
  if(service.project_id!==projectId||!service.client_email||!service.private_key)throw new Error('DRAFT_SERVER_NOT_CONFIGURED');
  const app=getApps().find(a=>a.name==='draft-server')??initializeApp({credential:cert(service),projectId},'draft-server');
  return {auth:getAuth(app),db:getFirestore(app)};
}
