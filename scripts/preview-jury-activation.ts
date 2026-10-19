// Read-only. Uses the commissioner's existing CLI OAuth session; never mints a user token.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {activationPreview,eliminationSource} from '../lib/jury.ts';
import {canonicalJson} from '../lib/score-ledger.ts';
import type {GameState} from '../lib/game-data.ts';

const output='work/jury-release-a';
const args=process.argv.slice(2),value=(flag:string)=>args[args.indexOf(flag)+1];
function decode(value:Record<string,any>):any { // eslint-disable-line @typescript-eslint/no-explicit-any
  if('mapValue' in value)return Object.fromEntries(Object.entries(value.mapValue.fields??{}).map(([k,v])=>[k,decode(v as Record<string,unknown>)]));
  if('arrayValue' in value)return (value.arrayValue.values??[]).map(decode);
  if('integerValue' in value)return Number(value.integerValue);
  for(const k of ['doubleValue','stringValue','booleanValue','nullValue','timestampValue'])if(k in value)return value[k];
  throw Error('Unsupported Firestore value');
}
async function main(){
  const episode=args.includes('--episode')?Number(value('--episode')):null;
  let game:GameState,updateTime:string|null=null;
  if(args.includes('--fixture'))game=JSON.parse(readFileSync(value('--fixture'),'utf8'));
  else {
    const require=createRequire(process.env.FIREBASE_CLI_PACKAGE??'C:/Users/donoh/AppData/Roaming/npm/node_modules/firebase-tools/package.json');
    const auth=require('./lib/auth.js'),account=auth.getGlobalDefaultAccount();
    if(account?.user?.email!=='donohue.js@gmail.com'||!account.tokens.refresh_token)throw Error('Existing commissioner CLI session required.');
    const credential=await auth.getAccessToken(account.tokens.refresh_token,[]);
    const response=await fetch('https://firestore.googleapis.com/v1/projects/fantasy-survivor-9da59/databases/(default)/documents/games/survivor-51',{method:'GET',headers:{Authorization:'Bearer '+credential.access_token}});
    if(!response.ok)throw Error('Read-only inspection failed: HTTP '+response.status);
    const raw=await response.json();game=decode({mapValue:{fields:raw.fields}});updateTime=raw.updateTime;
  }
  const reviews=args.includes('--reviews')?JSON.parse(readFileSync(value('--reviews'),'utf8')):[];
  if(!Array.isArray(reviews))throw Error('Review file must contain an array.');
  const reconciliations=reviews.map(r=>{const cast=game.castaways.find(c=>c.id===r.castawayId);if(!cast||cast.status!=='voted-out'||cast.eliminationEpisode!==undefined||!Number.isSafeInteger(r.episode)||r.episode<1||r.episode>game.season.currentEpisode||typeof r.provenance!=='string'||r.provenance.length<10)throw Error('Invalid commissioner reconciliation.');return {castawayId:cast.id,episode:r.episode,provenance:r.provenance,source:eliminationSource(cast)};});
  const config=episode?{season:game.season.number,enabled:false,activationEpisode:episode,revision:0,approvedAt:'',approvedBy:'',approval:'Read-only planning target; production activation is not authorized.',reconciliations}:null;
  const report={...activationPreview(game,episode,config),commissionerReconciliations:reconciliations,canonicalAirtime:null,checkedAt:new Date().toISOString(),sourceUpdateTime:updateTime,sourceSHA256:createHash('sha256').update(canonicalJson(game)).digest('hex'),productionWrites:0};
  mkdirSync(output,{recursive:true});
  writeFileSync(output+'/activation-preview.json',JSON.stringify(report,null,2));
  writeFileSync(output+'/game-readonly.json',JSON.stringify(game,null,2));
  console.log(JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Inspection failed');process.exitCode=1;});
