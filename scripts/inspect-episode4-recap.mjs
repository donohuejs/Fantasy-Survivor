// Authenticated production READ ONLY. Uses the existing commissioner CLI session.
// No custom-token minting, user creation, Firestore writes, or deployment commands.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';

const project='fantasy-survivor-9da59',document='games/survivor-51/episodes/51-4';
const require=process.env.FIREBASE_CLI_PACKAGE?createRequire(process.env.FIREBASE_CLI_PACKAGE):createRequire(import.meta.url);
const auth=process.env.FIREBASE_CLI_PACKAGE?require('./lib/auth.js'):require('firebase-tools/lib/auth.js');
function decode(value){
  if('mapValue'in value)return Object.fromEntries(Object.entries(value.mapValue.fields??{}).map(([key,item])=>[key,decode(item)]));
  if('arrayValue'in value)return(value.arrayValue.values??[]).map(decode);
  if('integerValue'in value)return Number(value.integerValue);
  for(const key of ['doubleValue','stringValue','booleanValue','nullValue','timestampValue'])if(key in value)return value[key];
  throw Error('Unsupported Firestore value.');
}
async function main(){
  const account=auth.getGlobalDefaultAccount();
  if(account?.user?.email!=='donohue.js@gmail.com'||!account.tokens.refresh_token)throw Error('An existing commissioner Firebase CLI session is required.');
  let credential;try{credential=await auth.getAccessToken(account.tokens.refresh_token,[]);}catch{throw Error('The existing CLI session could not refresh. Commissioner sign-in is required.');}
  const response=await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${document}`,{method:'GET',headers:{Authorization:'Bearer '+credential.access_token}});
  const raw=await response.json();
  if(response.status!==404&&!response.ok)throw Error('Authenticated recap read failed: HTTP '+response.status+'.');
  mkdirSync('work',{recursive:true});
  if(response.status===404){const report={authenticated:true,project,document,exists:false};writeFileSync('work/episode4-recap-inspection.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));return;}
  writeFileSync('work/production-episode4-authenticated-readonly.json',JSON.stringify(raw,null,2));
  const recap=decode({mapValue:{fields:raw.fields}});
  if(recap.season!==51||recap.episode!==4)throw Error('The recap identity does not match Season 51 Episode 4.');
  const erroneousActions=(recap.actions??[]).filter(action=>action.id==='e0c90d3b-786b-47bd-9fbc-261c5d65329b:cast-thien-an'&&action.label==='Win tribal immunity'&&action.tribeName==='Toka'&&action.points===2&&(action.recipients??[]).includes('Ori Jean-Charles'));
  const report={authenticated:true,project,document,exists:true,updateTime:raw.updateTime,season:recap.season,episode:recap.episode,status:recap.status,actionCount:recap.actions?.length??0,erroneousAwardPresent:erroneousActions.length>0,erroneousActions,oriNarrativeContext:(recap.body??'').split(/\n/).filter(line=>/\bOri\b/.test(line)),proposedSeparateCorrection:'Remove only Ori Jean-Charles from the existing Toka immunity snapshot recipients. Preserve all other actions, points, narrative, publication state, discussion metadata and timestamps unless separately approved.',productionWrites:0};
  writeFileSync('work/episode4-recap-inspection.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Read-only inspection failed.');process.exitCode=1;});
