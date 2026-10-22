// Pure configuration checks shared by packaging and its isolated rehearsal.
// The packaged caller fixes the target at build time; no runtime selector exists.
export const productionProject='fantasy-survivor-9da59';
export const productionApp='1:302469194118:web:d5a84123a898227805cc07';
export type ProductionTarget='production'|'rehearsal';
export function assertProductionConfiguration(env:Record<string,string|undefined>,target:ProductionTarget,runtime=false){
  const rehearsal=target==='rehearsal',project=rehearsal?'demo-fantasy-scoring':productionProject;
  for(const key of ['LOCAL_ACCEPTANCE','NEXT_PUBLIC_LOCAL_ACCEPTANCE','JURY_STAGING','NEXT_PUBLIC_JURY_STAGING','STAGING_OPERATOR_SECRET'])if(env[key])throw Error('Production package refuses acceptance/staging configuration.');
  if(env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!==project||env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!==project+'.firebaseapp.com'||env.NEXT_PUBLIC_FIREBASE_APP_ID!==(rehearsal?'demo-app-id':productionApp))throw Error('Production package Firebase target mismatch.');
  if(rehearsal?env.NEXT_PUBLIC_FIREBASE_API_KEY!=='demo-api-key':!/^AIza[A-Za-z0-9_-]{20,}$/.test(env.NEXT_PUBLIC_FIREBASE_API_KEY??''))throw Error('Production package requires valid public Firebase configuration.');
  if(!rehearsal&&(env.FIRESTORE_EMULATOR_HOST||env.FIREBASE_AUTH_EMULATOR_HOST||env.VERCEL_ENV&&env.VERCEL_ENV!=='production'))throw Error('Production package refuses emulator/Preview configuration.');
  if(!runtime)return;
  const service=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON??'{}');
  if(service.project_id!==project||typeof service.client_email!=='string'||!service.client_email.endsWith('@'+project+'.iam.gserviceaccount.com')||typeof service.private_key!=='string'||!service.private_key.includes('-----BEGIN PRIVATE KEY-----'))throw Error('Production package requires a matching private server credential.');
  if(rehearsal&&(env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8185'||env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9198'))throw Error('Rehearsal requires fixed loopback emulators.');
}
