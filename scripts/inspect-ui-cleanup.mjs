// Production READ ONLY: GETs using the existing commissioner CLI session.
// No token minting, identity changes, database writes, deployment, or publishing.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {migrateComments} from '../lib/discussions.ts';
import {canonicalJson} from '../lib/score-ledger.ts';

const project='fantasy-survivor-9da59',root='games/survivor-51';
const require=createRequire(process.env.FIREBASE_CLI_PACKAGE??'C:/Users/donoh/AppData/Roaming/npm/node_modules/firebase-tools/package.json');
const auth=require('./lib/auth.js');
function decode(value){
  if('mapValue' in value)return Object.fromEntries(Object.entries(value.mapValue.fields??{}).map(([key,item])=>[key,decode(item)]));
  if('arrayValue' in value)return (value.arrayValue.values??[]).map(decode);
  if('integerValue' in value)return Number(value.integerValue);
  for(const key of ['doubleValue','stringValue','booleanValue','nullValue','timestampValue'])if(key in value)return value[key];
  throw Error('Unsupported Firestore value.');
}
async function main(){
  const account=auth.getGlobalDefaultAccount();
  if(account?.user?.email!=='donohue.js@gmail.com'||!account.tokens.refresh_token)throw Error('An existing commissioner Firebase CLI session is required.');
  const credential=await auth.getAccessToken(account.tokens.refresh_token,[]);
  async function get(path){
    const response=await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${path}`,{method:'GET',headers:{Authorization:'Bearer '+credential.access_token}});
    if(!response.ok)throw Error('Read-only inspection failed: HTTP '+response.status);
    return response.json();
  }
  async function list(path){
    const rows=[];let pageToken='';
    do{const result=await get(path+'?pageSize=300'+(pageToken?'&pageToken='+encodeURIComponent(pageToken):''));rows.push(...(result.documents??[]));pageToken=result.nextPageToken??'';}while(pageToken);
    return rows;
  }
  const [gameDoc,episodes,signups,comments,threads]=await Promise.all([get(root),list(root+'/episodes'),list(root+'/signups'),list(root+'/episodes/51-4/comments'),list(root+'/discussionThreads')]);
  const data=document=>({...decode({mapValue:{fields:document.fields}}),id:document.name.split('/').at(-1)});
  const game=decode({mapValue:{fields:gameDoc.fields}}),episode=episodes.map(data).find(row=>row.id==='51-4');
  if(!episode)throw Error('Episode 51-4 not found.');
  let plan=null,issues=[];
  try{plan=migrateComments(episode,comments.map(data));}catch(error){issues=[error.message];}
  const matches=signups.map(data).filter(row=>/stanzi/i.test(row.name)||game.players.some(player=>/stanzi/i.test(player.name)&&(player.uid===row.uid||player.email&&player.email.toLowerCase()===row.email.toLowerCase())));
  const identities=matches.map(signup=>({signup,profiles:game.players.filter(player=>/stanzi/i.test(player.name)||player.uid===signup.uid||player.id===signup.assignedPlayerId||player.email&&player.email.toLowerCase()===signup.email.toLowerCase()).map(player=>({...player,draftPicks:game.draftPicks.filter(pick=>pick.playerId===player.id)}))}));
  const possessionIds=new Set((game.possessions??[]).filter(row=>row.castawayId==='cast-rob'||row.castawayId==='cast-carter'||row.originalCastawayId==='cast-rob').map(row=>row.lineageId));
  const report={checkedAt:new Date().toISOString(),project,productionWrites:0,gameUpdateTime:gameDoc.updateTime,season:game.season,draftStatus:game.draft.status,
    episode4:{updateTime:episodes.find(row=>row.name.endsWith('/51-4')).updateTime,schemaVersion:episode.discussionSchemaVersion??null,commentCount:comments.length,threadCount:threads.map(data).filter(row=>row.episodeId==='51-4').length,issues,plannedThreadCount:plan?.threads.length??0,plannedCommentCount:plan?.comments.length??0,sourceSha256:createHash('sha256').update(canonicalJson({episode,comments:comments.map(data).sort((a,b)=>a.id.localeCompare(b.id))})).digest('hex')},
    episodes:episodes.map(data).map(row=>({id:row.id,status:row.status,updatedAt:row.updatedAt,bodyLength:row.body?.length??0,title:row.title,discussionOpensAt:row.discussionOpensAt,schemaVersion:row.discussionSchemaVersion})),
    identities,possessions:(game.possessions??[]).filter(row=>possessionIds.has(row.lineageId)),castaways:game.castaways.filter(row=>['cast-rob','cast-carter'].includes(row.id))};
  mkdirSync('work/ui-cleanup',{recursive:true});
  writeFileSync('work/ui-cleanup/readonly-snapshot.json',JSON.stringify({gameDoc,episodes,signups,comments,threads},null,2));
  writeFileSync('work/ui-cleanup/inspection.json',JSON.stringify(report,null,2));
  writeFileSync('work/ui-cleanup/episode4-migration-dry-run.json',JSON.stringify({productionWrites:0,inspection:report.episode4,proposedEpisodeFields:episode.discussionSchemaVersion===2?{}:{discussionSchemaVersion:2,migrationToken:'',migrationUntil:''},plan},null,2));
  console.log(JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
