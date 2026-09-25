import 'server-only';

// Import only from server routes. Never use NEXT_PUBLIC_ for this credential.
export async function getDraftServer(){
  const projectId=process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if(!raw||!projectId)throw new Error('DRAFT_SERVER_NOT_CONFIGURED');
  const service=JSON.parse(raw);
  if(service.project_id!==projectId||!service.client_email||!service.private_key)throw new Error('DRAFT_SERVER_NOT_CONFIGURED');
  // Keep the Admin SDK out of the route module's startup path so load and
  // configuration failures can be returned as controlled JSON responses.
  const [{cert,getApps,initializeApp},{getAuth},{getFirestore}]=await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/auth'),
    import('firebase-admin/firestore'),
  ]);
  const app=getApps().find(a=>a.name==='draft-server')??initializeApp({credential:cert(service),projectId},'draft-server');
  return {auth:getAuth(app),db:getFirestore(app)};
}
