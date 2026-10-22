// Server-only callers. Refuse partial configuration instead of falling back to cloud services.
export function localAcceptance(env:Record<string,string|undefined>=process.env){
  if(env.LOCAL_ACCEPTANCE!=='1')return false;
  let credential:{project_id?:string;client_email?:string}={};
  try{credential=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON??'{}');}catch{throw new Error('Invalid local acceptance credential.');}
  if(env.NODE_ENV==='production'||env.NEXT_PUBLIC_LOCAL_ACCEPTANCE!=='1'||env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!=='demo-fantasy-scoring'||env.NEXT_PUBLIC_FIREBASE_API_KEY!=='demo-api-key'||env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085'||env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9098'||credential.project_id!=='demo-fantasy-scoring'||!['emulator@demo-fantasy-scoring.iam.gserviceaccount.com','synthetic-server@demo-fantasy-scoring.iam.gserviceaccount.com'].includes(credential.client_email??''))throw new Error('Local acceptance requires the fixed loopback demo environment.');
  return true;
}
