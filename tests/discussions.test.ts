import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {initialGame,type GameState} from '../lib/game-data.ts';
import {linkedAuthor,makeRecap,type EpisodeComment} from '../lib/community.ts';
import {calendarEpisodes,discussionAvailable,localOpening,makeSchedule,migrateComments,parseEpisodeIdentity,type DiscussionComment,type DiscussionThread,type EpisodeRecord,type ReadState} from '../lib/discussions.ts';
import {DiscussionStore} from '../lib/discussion-store.ts';
import {finishEpisode,startEpisode} from '../lib/scoring.ts';
import {seasonStandings} from '../lib/league.ts';
import {MemoryFirestore} from './helpers/memory-firestore.ts';

const root='games/survivor-51',owner={uid:'owner',email:'donohue.js@gmail.com',verified:true},alice={uid:'alice',email:'alice@example.com',verified:true},bob={uid:'bob',email:'bob@example.com',verified:true};
const calendar={season:51,weekday:3,startDate:'2026-10-14',localTime:'20:00',timeZone:'America/New_York',firstEpisode:4,episodeCount:4,skippedDates:[],overrides:[],expectedUpdatedAt:''};
function fixture(){
  const db=new MemoryFirestore(),game=structuredClone(initialGame);game.players[0].uid=alice.uid;game.players[0].email='';game.players[1].uid=bob.uid;game.players[1].email='';
  db.seed(root,game);let now='2026-10-08T12:00:00.000Z';
  const clock=()=>now,admin=new DiscussionStore(db.firestore,owner,clock),a=new DiscussionStore(db.firestore,alice,clock),b=new DiscussionStore(db.firestore,bob,clock);
  return {db,game,admin,a,b,clock,setNow:(value:string)=>{now=value;}};
}
async function opened(){const f=fixture();await f.admin.saveSchedule(calendar);f.setNow('2026-10-15T00:00:00.000Z');return f;}
const post=(id:string,text=id,replyToCommentId='')=>({episodeId:'51-4',id,text,replyToCommentId});
const getThread=(f:ReturnType<typeof fixture>,id:string)=>f.db.read<DiscussionThread>(`${root}/discussionThreads/51-4__${id}`);
const state=(f:ReturnType<typeof fixture>,uid:string,id:string)=>f.db.read<ReadState>(`${root}/discussionUsers/${uid}/threads/51-4__${id}`);

test('scheduled discussion is closed before and open exactly at server time, without a status write',async()=>{
  const f=fixture();await f.admin.saveSchedule(calendar);const episode=f.db.read<EpisodeRecord>(root+'/episodes/51-4');
  assert(!discussionAvailable(episode,'2026-10-14T23:59:59.999Z'));assert(discussionAvailable(episode,'2026-10-15T00:00:00.000Z'));
  await assert.rejects(f.a.post(post('early')),/not opened/);f.setNow('2026-10-15T00:00:00.000Z');
  assert((await f.a.catalog()).episodes.find(row=>row.id==='51-4')!.available);assert.deepEqual(f.db.read(root+'/episodes/51-4'),episode);
});
test('IANA local time uses daylight saving offsets rather than adding 168 UTC hours',()=>{
  const schedule=makeSchedule({...calendar,startDate:'2026-10-28'},51,'now'),rows=calendarEpisodes(schedule);
  assert.equal(rows[0].discussionOpensAt,'2026-10-29T00:00:00.000Z');assert.equal(rows[1].discussionOpensAt,'2026-11-05T01:00:00.000Z');
  assert.equal(localOpening('2026-03-04','20:00','America/New_York'),'2026-03-05T01:00:00.000Z');assert.equal(localOpening('2026-03-11','20:00','America/New_York'),'2026-03-12T00:00:00.000Z');
});
test('nonexistent spring time is rejected and repeated autumn time picks first occurrence',()=>{
  assert.throws(()=>localOpening('2026-03-08','02:30','America/New_York'),/does not exist/);
  assert.equal(localOpening('2026-11-01','01:30','America/New_York'),'2026-11-01T05:30:00.000Z');
  assert.equal(localOpening('2026-10-14','20:00','Asia/Kathmandu'),'2026-10-14T14:15:00.000Z');
});
test('skipped weeks shift numbering, individual overrides reschedule or hold an episode',()=>{
  const rows=calendarEpisodes(makeSchedule({...calendar,skippedDates:['2026-10-21'],overrides:[{episode:6,date:'2026-11-05'},{episode:7,date:null}]},51,'now'));
  assert.deepEqual(rows.map(row=>row.broadcastDate),['2026-10-14','2026-10-28','2026-11-05','']);assert.equal(rows[3].discussionOpensAt,null);
});
test('calendar validates dates, weekday, time zones, ranges and duplicate overrides',()=>{
  for(const input of [{startDate:'2026-02-30'},{weekday:2},{timeZone:'Wrong/Zone'},{localTime:'25:00'},{episodeCount:61},{overrides:[{episode:5,date:null},{episode:5,date:null}]},{season:52}])assert.throws(()=>makeSchedule({...calendar,...input},51,'now'));
  for(const id of ['51-04','../51-4','52-4/secret','other-league','51-0'])assert.throws(()=>parseEpisodeIdentity(id));
});
test('two weeks of absent Game Master open Episodes 4 and 5, then normal sequential scoring preserves threads and ledger',async()=>{
  const f=fixture();let scoring=structuredClone(f.game);
  for(let episode=1;episode<=3;episode++){scoring=startEpisode(scoring,{episode,expectedActiveCastawayIds:scoring.castaways.filter(row=>row.status==='active').map(row=>row.id)});scoring=finishEpisode(scoring,{episode});}
  f.db.seed(root,scoring);const before=structuredClone(scoring),standings=seasonStandings(scoring);await f.admin.saveSchedule(calendar);
  f.setNow('2026-10-15T00:00:00.000Z');await f.a.post(post('week-four'));
  f.setNow('2026-10-22T00:00:00.000Z');await f.b.post({...post('week-five'),episodeId:'51-5'});
  const catalog=await f.a.catalog();assert(catalog.episodes.find(row=>row.id==='51-4')!.available);assert(catalog.episodes.find(row=>row.id==='51-5')!.available);
  assert.deepEqual(f.db.read(root),before);assert.deepEqual(seasonStandings(f.db.read<GameState>(root)),standings);
  for(let episode=4;episode<=5;episode++){scoring=startEpisode(scoring,{episode,expectedActiveCastawayIds:scoring.castaways.filter(row=>row.status==='active').map(row=>row.id)});scoring=finishEpisode(scoring,{episode});}
  f.db.seed(root,scoring);assert.equal(scoring.season.currentEpisode,5);assert.equal(scoring.season.episodeStatus,'complete');
  assert.deepEqual(scoring.scoreEvents.filter(row=>(row.episode??0)<=3),before.scoreEvents);
  assert.equal((await f.a.conversation('51-4__week-four')).comments[0].text,'week-four');assert.equal((await f.b.conversation('51-5__week-five')).comments[0].text,'week-five');
});
test('concurrent calendar saves reserve one stable record per season and episode',async()=>{
  const f=fixture(),results=await Promise.allSettled([f.admin.saveSchedule(calendar),f.admin.saveSchedule(calendar)]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal([...f.db.data.keys()].filter(path=>/^games\/survivor-51\/episodes\/[^/]+$/.test(path)).length,4);assert(f.db.retries>0);assert.deepEqual(f.db.read(root),f.game);
});
test('manual open, hold and corrected opening leave scoring untouched and use revision checks',async()=>{
  const f=fixture();await f.admin.override({episodeId:'51-4',expectedVersion:'',mode:'open'});let row=f.db.read<EpisodeRecord>(root+'/episodes/51-4');assert(discussionAvailable(row,f.clock()));
  await f.admin.override({episodeId:'51-4',expectedVersion:row.discussionVersion,mode:'hold'});row=f.db.read(root+'/episodes/51-4');assert(!discussionAvailable(row,'2030-01-01T00:00:00Z'));
  await f.admin.override({episodeId:'51-4',expectedVersion:row.discussionVersion,mode:'schedule',date:'2026-10-15',localTime:'21:00',timeZone:'America/New_York'});
  assert.equal(f.db.read<EpisodeRecord>(root+'/episodes/51-4').discussionOpensAt,'2026-10-16T01:00:00.000Z');assert.deepEqual(f.db.read(root),f.game);
  await assert.rejects(f.admin.override({episodeId:'51-4',expectedVersion:'',mode:'open'}),/changed/);await assert.rejects(f.a.override({episodeId:'51-4',expectedVersion:'',mode:'open'}),/game master/);
});
test('reconfirming calendar preserves open discussions and explicit administrator holds',async()=>{
  const f=await opened();await f.admin.override({episodeId:'51-5',mode:'hold',expectedVersion:f.db.read<EpisodeRecord>(root+'/episodes/51-5').discussionVersion});
  const before=f.db.read<EpisodeRecord>(root+'/episodes/51-4'),schedule=await f.admin.adminSchedule(51);
  await f.admin.saveSchedule({...calendar,startDate:'2026-10-28',expectedUpdatedAt:schedule!.updatedAt});assert.deepEqual(f.db.read(root+'/episodes/51-4'),before);assert.equal(f.db.read<EpisodeRecord>(root+'/episodes/51-5').discussionOpensAt,null);
});
test('members start threads and reply to replies in the same two-level conversation',async()=>{
  const f=await opened(),first=await f.a.post(post('root','A take'));await f.b.post(post('reply','A reply','root'));f.setNow('2026-10-15T00:00:04.000Z');await f.a.post(post('reply-again','Another reply','reply'));
  assert.equal(first.threadId,'51-4__root');const page=await f.a.conversation(first.threadId);assert.deepEqual(page.comments.map(row=>row.rootId),['root','root','root']);assert.deepEqual(page.comments.map(row=>row.sequence),[1,2,3]);assert.equal(page.comments[2].replyToId,f.game.players[1].id);assert.equal(page.thread.replyCount,2);
});
test('a reply resurfaces an older episode thread; newest-parent sorting stays independent',async()=>{
  const f=await opened();await f.a.post(post('older'));f.setNow('2026-10-15T00:00:04.000Z');await f.a.post(post('newer'));f.setNow('2026-10-15T00:00:08.000Z');await f.b.post(post('resurface','Hello','older'));
  assert.deepEqual((await f.a.threads({})).rows.map(row=>row.rootId),['older','newer']);assert.deepEqual((await f.a.threads({sort:'newest'})).rows.map(row=>row.rootId),['newer','older']);
});
test('Home feed returns three parent threads even when one has fifteen replies',async()=>{
  const f=await opened();for(let index=0;index<4;index++){f.setNow(new Date(Date.parse('2026-10-15T00:00:00Z')+index*4000).toISOString());await f.a.post(post('thread'+index));}
  for(let index=0;index<15;index++){f.setNow(new Date(Date.parse('2026-10-15T01:00:00Z')+index*4000).toISOString());await f.b.post(post('reply'+index,'Reply','thread0'));}
  const rows=(await f.a.threads({pageSize:3})).rows;assert.equal(rows.length,3);assert.equal(rows[0].rootId,'thread0');assert.equal(rows[0].replyCount,15);assert.equal(new Set(rows.map(row=>row.id)).size,3);
});
test('thread pagination uses stable activity and ID cursors, with no duplicate parents',async()=>{
  const f=await opened();for(let index=0;index<31;index++){f.setNow(new Date(Date.parse('2026-10-15T00:00:00Z')+index*4000).toISOString());await f.a.post(post('p'+index));}
  const first=await f.a.threads({}),next=await f.a.threads({cursor:first.cursor!});assert.equal(first.rows.length,25);assert.equal(next.rows.length,6);assert.equal(next.cursor,null);assert.equal(new Set([...first.rows,...next.rows].map(row=>row.id)).size,31);
});
test('replies paginate chronologically and an acknowledgement cannot clear later replies',async()=>{
  const f=await opened();await f.a.post(post('root'));for(let index=0;index<54;index++){f.setNow(new Date(Date.parse('2026-10-15T00:00:04Z')+index*4000).toISOString());await f.b.post(post('r'+index,'Reply','root'));}
  const first=await f.a.conversation('51-4__root'),next=await f.a.conversation('51-4__root',first.through);assert.equal(first.comments.length,50);assert(first.hasMore);assert.equal(next.comments.length,5);assert.equal(next.through,55);
  await f.a.markRead({threadId:'51-4__root',through:50});assert.equal(state(f,'alice','root').unreadCount,5);
});
test('recap and Chatter share canonical comment documents and recap publication preserves them',async()=>{
  const f=await opened();const {threadId}=await f.a.post(post('recap-post','Below recap'));await f.b.post(post('chatter-post','From Chatter','recap-post'));
  const existing=f.db.read<EpisodeRecord>(root+'/episodes/51-4'),recap=makeRecap(f.game,{season:51,episode:4,title:'Episode recap',body:'The episode story',status:'published',expectedUpdatedAt:''},existing as never,f.clock());
  await f.db.doc(root+'/episodes/51-4').set(recap,{merge:true});assert.equal((await f.a.threads({episodeId:'51-4'})).rows[0].text,'Below recap');assert.equal((await f.a.conversation(threadId)).comments[1].text,'From Chatter');assert.equal((await f.a.catalog()).episodes.find(row=>row.id==='51-4')!.recap!.body,'The episode story');assert.deepEqual(f.db.read(root),f.game);assert.equal(f.db.read<EpisodeRecord>(root+'/episodes/51-4').discussionOpensAt,existing.discussionOpensAt);
});
test('catalog leaves legacy Episode 51-3 untouched and dry-run reports a controlled migration',async()=>{
  const f=fixture(),recap=makeRecap(f.game,{season:51,episode:3,title:'Episode three',body:'Historical recap',status:'published',expectedUpdatedAt:''},null,'2026-10-01T00:00:00.000Z');f.db.seed(root+'/episodes/51-3',recap);
  f.db.seed(root+'/episodes/51-3/comments/root',{id:'root',authorId:f.game.players[0].id,authorName:'Original name',text:'Original text',createdAt:'2026-10-01T04:00:00.000Z'});
  f.db.seed(root+'/episodes/51-3/comments/reply',{id:'reply',authorId:f.game.players[1].id,authorName:'Reply name',text:'Reply text',createdAt:'2026-10-01T05:00:00.000Z',parentId:'root'});
  const before=structuredClone(f.db.data),catalog=await f.a.catalog();assert.equal(catalog.episodes.find(row=>row.id==='51-3')!.discussionReady,false);assert.deepEqual(f.db.data,before);assert.deepEqual((await f.a.threads({episodeId:'51-3'})).rows,[]);
  const dry=await f.admin.migrateEpisode('51-3',{dryRun:true});assert.equal(dry.status,'pending');assert.equal(dry.dryRun,true);assert.equal(dry.plannedCommentCount,2);assert.equal(dry.plannedThreadCount,1);assert.deepEqual(f.db.data,before);
  await assert.rejects(f.a.migrateEpisode('51-3'),/game master/);
});
test('flat migration retains authors, content, IDs, times and episode associations',async()=>{
  const f=fixture(),recap=makeRecap(f.game,{season:51,episode:1,title:'Original recap',body:'Original body',status:'published',expectedUpdatedAt:''},null,'2026-10-01T00:00:00.000Z');f.db.seed(root+'/episodes/51-1',recap);
  const original:EpisodeComment={id:'historic',authorId:f.game.players[0].id,authorName:'Original name',text:'Original text',createdAt:'2026-10-01T04:00:00.000Z'};f.db.seed(root+'/episodes/51-1/comments/historic',original);await f.admin.migrateEpisode('51-1');
  const migrated=f.db.read<DiscussionComment>(root+'/episodes/51-1/comments/historic');for(const key of Object.keys(original) as Array<keyof EpisodeComment>)assert.equal(migrated[key],original[key]);assert.equal(migrated.rootId,'historic');assert.equal((await f.a.conversation('51-1__historic')).comments[0].text,original.text);assert.deepEqual(f.db.read(root),f.game);
});
test('migration preserves existing nested reply relationships without visual nesting',()=>{
  const rows=[{id:'root',authorId:'a',authorName:'A',text:'Root',createdAt:'2026-10-01T00:00:00Z'},{id:'reply',parentId:'root',authorId:'b',authorName:'B',text:'Reply',createdAt:'2026-10-01T01:00:00Z'},{id:'third',parentId:'reply',authorId:'c',authorName:'C',text:'Third',createdAt:'2026-10-01T02:00:00Z'}];
  const plan=migrateComments({id:'51-1',season:51,episode:1},rows);assert.equal(plan.threads.length,1);assert.deepEqual(plan.comments.map(row=>row.rootId),['root','root','root']);assert.equal(plan.comments[2].replyToId,'b');assert.equal(plan.comments[2].text,'Third');
  assert.throws(()=>migrateComments({id:'51-1',season:51,episode:1},[{...rows[0],parentId:'missing'}]),/missing/);
});
test('large historical migration batches safely and repeated migration is idempotent',async()=>{
  const f=fixture();f.db.seed(root+'/episodes/51-1',{id:'51-1',season:51,episode:1,status:'published',publishedAt:'2026-10-01T00:00:00Z'});
  for(let index=0;index<350;index++)f.db.seed(`${root}/episodes/51-1/comments/old${index}`,{id:'old'+index,authorId:'a',authorName:'A',text:'Old '+index,createdAt:'2026-10-01T00:00:00Z'});
  await f.admin.migrateEpisode('51-1');const before=structuredClone(f.db.data);await f.admin.migrateEpisode('51-1');assert.deepEqual(f.db.data,before);assert.equal([...f.db.data.keys()].filter(path=>path.includes('/discussionThreads/')).length,350);
});
test('partial migration recovery preserves legacy data and supports replies after completion',async()=>{
  const f=fixture();f.db.seed(root+'/episodes/51-3',{id:'51-3',season:51,episode:3,status:'published',publishedAt:'2026-10-01T00:00:00Z'});
  const original:EpisodeComment={id:'historic',authorId:f.game.players[0].id,authorName:'Original name',text:'Original text',createdAt:'2026-10-01T04:00:00.000Z'};f.db.seed(root+'/episodes/51-3/comments/historic',original);
  for(let index=0;index<349;index++)f.db.seed(`${root}/episodes/51-3/comments/old${index}`,{id:'old'+index,authorId:f.game.players[1].id,authorName:'B',text:'Old '+index,createdAt:'2026-10-01T05:00:00.000Z'});
  f.db.failOnTransactionCall=f.db.transactionCalls+3;await assert.rejects(f.admin.migrateEpisode('51-3'),/Simulated transaction failure/);assert.equal(f.db.read<EpisodeRecord>(root+'/episodes/51-3').discussionSchemaVersion,undefined);for(const key of Object.keys(original) as Array<keyof EpisodeComment>)assert.equal(f.db.read<DiscussionComment>(root+'/episodes/51-3/comments/historic')[key],original[key]);
  const result=await f.admin.migrateEpisode('51-3');assert.equal(result.status,'ready');assert.equal(result.commentCount,350);assert.equal(result.threadCount,350);assert.equal(f.db.read<EpisodeRecord>(root+'/episodes/51-3').discussionSchemaVersion,2);for(const key of Object.keys(original) as Array<keyof EpisodeComment>)assert.equal(f.db.read<DiscussionComment>(root+'/episodes/51-3/comments/historic')[key],original[key]);
  const posted=await f.a.post({episodeId:'51-3',id:'new-reply',text:'New reply',replyToCommentId:'historic'});assert.equal(posted.threadId,'51-3__historic');assert.deepEqual((await f.a.conversation(posted.threadId)).comments.map(comment=>comment.id),['historic','new-reply']);assert.equal((await f.a.recap('51-3',false)).recap?.id,'51-3');
});
test('migration does not finalize when a legacy comment arrives during finalization',async()=>{
  const f=fixture();f.db.seed(root+'/episodes/51-3',{id:'51-3',season:51,episode:3,status:'published',publishedAt:'2026-10-01T00:00:00Z'});f.db.seed(root+'/episodes/51-3/comments/first',{id:'first',authorId:f.game.players[0].id,authorName:'A',text:'First',createdAt:'2026-10-01T04:00:00.000Z'});
  const finalCall=f.db.transactionCalls+3;f.db.beforeTransactionCall=call=>{if(call===finalCall){f.db.seed(root+'/episodes/51-3/comments/late',{id:'late',authorId:f.game.players[1].id,authorName:'B',text:'Late',createdAt:'2026-10-01T05:00:00.000Z'});f.db.beforeTransactionCall=null;}};
  await assert.rejects(f.admin.migrateEpisode('51-3'),/New historical comments/);assert.equal(f.db.read<EpisodeRecord>(root+'/episodes/51-3').discussionSchemaVersion,undefined);await f.admin.migrateEpisode('51-3');assert.equal(f.db.read<EpisodeRecord>(root+'/episodes/51-3').discussionSchemaVersion,2);const status=await f.admin.migrationStatus('51-3');assert(!Array.isArray(status));assert.equal(status.status,'ready');
});
test('ownership, edit revisions, moderation and tombstones preserve surviving replies',async()=>{
  const f=await opened();await f.a.post(post('root','Original'));await f.b.post(post('reply','Reply','root'));const comment=f.db.read<DiscussionComment>(root+'/episodes/51-4/comments/root');
  await assert.rejects(f.b.changeComment({...post('root','Hijack'),expectedUpdatedAt:comment.createdAt}),/own comments/);await assert.rejects(f.b.changeComment(post('root'),true),/own comments/);
  f.setNow('2026-10-15T00:00:04.000Z');await f.a.changeComment({...post('root','Updated'),expectedUpdatedAt:comment.createdAt});await assert.rejects(f.a.changeComment({...post('root','Stale'),expectedUpdatedAt:comment.createdAt}),/changed/);
  await f.admin.changeComment(post('root'),true);const page=await f.b.conversation('51-4__root');assert.equal(page.comments[0].text,'');assert(page.comments[0].deletedAt);assert.equal(page.comments[1].text,'Reply');assert.equal(page.thread.replyCount,1);
});
test('retrying a concurrent post creates exactly one thread and one unread increment',async()=>{
  const f=await opened(),results=await Promise.all([f.a.post(post('same')),f.a.post(post('same'))]);assert.equal(results[0].threadId,results[1].threadId);assert.equal(getThread(f,'same').sequence,1);assert.equal(state(f,'bob','same').unreadCount,1);await assert.rejects(f.a.post(post('same','Different')),/already used/);
});
test('new posts increment other members, own posts do not and replies to you are distinguished',async()=>{
  const f=await opened();await f.a.post(post('root'));assert.equal(state(f,'alice','root').unreadCount,0);assert.equal(state(f,'bob','root').unreadCount,1);
  await f.b.post(post('reply','Reply','root'));assert.equal(state(f,'alice','root').unreadCount,1);assert.equal(state(f,'alice','root').personalCount,1);assert.equal(state(f,'bob','root').unreadCount,1);
  f.setNow('2026-10-15T00:00:04.000Z');await f.a.post(post('direct','Direct reply','reply'));assert.equal(state(f,'bob','root').personalCount,1);
});
test('opening feeds leaves unread intact; reading only changes the caller and captured sequence',async()=>{
  const f=await opened();await f.a.post(post('root'));await f.b.catalog();await f.b.threads({});const displayed=await f.b.conversation('51-4__root');assert.equal(state(f,'bob','root').unreadCount,1);
  f.setNow('2026-10-15T00:00:04.000Z');await f.a.post(post('arrival','New arrival','root'));await f.b.markRead({threadId:'51-4__root',through:displayed.through,uid:'alice'});
  assert.equal(state(f,'bob','root').unreadCount,1);assert.equal(state(f,'bob','root').readSequence,1);assert.equal(state(f,'alice','root').readSequence,0);await f.b.markRead({threadId:'51-4__root',through:1});assert.equal(state(f,'bob','root').unreadCount,1);
});
test('read state and unread filters persist across fresh sessions/devices',async()=>{
  const f=await opened();await f.a.post(post('root'));const otherDevice=new DiscussionStore(f.db.firestore,bob,f.clock);assert.equal((await otherDevice.threads({unread:true})).rows.length,1);await f.b.markRead({threadId:'51-4__root',through:1});assert.equal((await otherDevice.threads({unread:true})).rows.length,0);assert.equal((await otherDevice.catalog()).episodes.find(row=>row.id==='51-4')!.unreadCount,0);
});
test('historical baseline does not subtract old unread from new activity',async()=>{
  const f=fixture();f.db.seed(root+'/episodes/51-4',{id:'51-4',season:51,episode:4,status:'published',publishedAt:'2026-10-01T00:00:00Z'});f.db.seed(root+'/episodes/51-4/comments/old',{id:'old',authorId:f.game.players[0].id,authorName:'Alice',text:'Old',createdAt:'2026-10-01T00:00:00Z'});
  await f.admin.migrateEpisode('51-4');await f.a.catalog();await f.a.post(post('new','New reply','old'));assert.equal(state(f,'bob','old').readSequence,1);await f.b.markRead({threadId:'51-4__old',through:1});assert.equal(state(f,'bob','old').unreadCount,1);
});
test('deleting unread replies reduces counts and preserves sequence integrity',async()=>{
  const f=await opened();await f.a.post(post('root'));await f.b.post(post('reply','Hi','root'));await f.b.changeComment(post('reply'),true);assert.equal(state(f,'alice','root').unreadCount,0);assert.equal(getThread(f,'root').replyCount,0);assert.equal(getThread(f,'root').sequence,2);assert.equal((await f.a.conversation('51-4__root')).comments.length,2);
});
test('spoiler setting is off by default and redacts server previews, author context and recap',async()=>{
  const f=await opened();await f.a.post(post('root','SECRET ELIMINATION'));const record=f.db.read<EpisodeRecord>(root+'/episodes/51-4');f.db.seed(root+'/episodes/51-4',{...record,status:'published',title:'SECRET TITLE',body:'SECRET RECAP',publishedAt:f.clock()});
  assert.equal((await f.b.catalog()).hideSpoilers,false);await f.b.preferences({hideSpoilers:true,uid:'alice'});
  const catalog=await f.b.catalog(),threads=await f.b.threads({}),conversation=await f.b.conversation('51-4__root');assert.equal(catalog.episodes.find(row=>row.id==='51-4')!.recap,null);assert.equal(threads.rows[0].text,'');assert.equal(threads.rows[0].authorName,'');assert.equal(threads.rows[0].unreadCount,1);assert.deepEqual(conversation.comments,[]);assert(!JSON.stringify({catalog,threads,conversation}).includes('SECRET'));
  assert.equal((await f.a.catalog()).hideSpoilers,false);assert.equal((await f.a.threads({})).rows[0].text,'SECRET ELIMINATION');
});
test('intentional reveal is per episode and does not globally disable protection',async()=>{
  const f=await opened();await f.a.post(post('four','SECRET FOUR'));f.setNow('2026-10-22T00:00:00Z');await f.a.post({...post('five','SECRET FIVE'),episodeId:'51-5'});await f.b.preferences({hideSpoilers:true});
  assert.equal((await f.b.conversation('51-4__four',0,true)).comments[0].text,'SECRET FOUR');assert.deepEqual((await f.b.conversation('51-5__five')).comments,[]);assert((await f.b.catalog()).hideSpoilers);
});
test('watched status belongs to one account and never follows scoring completion',async()=>{
  const f=await opened();await f.a.post(post('root','Visible after watching'));await f.b.preferences({hideSpoilers:true});await f.b.watched({episodeId:'51-4',watched:true,uid:'alice'});assert.equal((await f.b.threads({})).rows[0].text,'Visible after watching');assert.equal((await f.a.catalog()).episodes.find(row=>row.id==='51-4')!.watched,false);
  const scoring={...f.game,season:{...f.game.season,currentEpisode:4,episodeStatus:'complete' as const}};f.db.seed(root,scoring);await f.b.watched({episodeId:'51-4',watched:false});assert((await f.b.catalog()).episodes.find(row=>row.id==='51-4')!.spoilerHidden);
});
test('unlinked, unverified and cross-league identities cannot read or post; closed posts reject',async()=>{
  const f=await opened(),stranger=new DiscussionStore(f.db.firestore,{uid:'stranger',email:'stranger@example.com',verified:true},f.clock),unverified=new DiscussionStore(f.db.firestore,{...bob,verified:false},f.clock);
  await assert.rejects(stranger.catalog(),/linked/);await assert.rejects(stranger.post(post('x')),/linked/);await assert.rejects(unverified.threads({}),/verified/);await assert.rejects(f.a.post({...post('x'),episodeId:'another-league/51-4'}),/Invalid|valid/);
  await assert.rejects(f.a.post({...post('x'),episodeId:'51-5'}),/not opened/);await assert.rejects(f.a.post(post('blank',' ')),/characters/);await assert.rejects(f.a.post(post('long','a'.repeat(2001))),/characters/);
  assert.throws(()=>linkedAuthor(f.game,{...alice,uid:'other',email:'alice@example.com'}),/linked/);
});
test('reply targets cannot cross episodes, held conversations stop reads and edits',async()=>{
  const f=await opened();await f.a.post(post('root'));f.setNow('2026-10-22T00:00:00Z');await assert.rejects(f.b.post({...post('reply','No','root'),episodeId:'51-5'}),/target/);
  await f.admin.override({episodeId:'51-4',mode:'hold',expectedVersion:f.db.read<EpisodeRecord>(root+'/episodes/51-4').discussionVersion});await assert.rejects(f.a.conversation('51-4__root'),/not opened/);await assert.rejects(f.a.changeComment(post('root'),true),/not opened/);assert.equal((await f.a.threads({})).rows.length,0);
});
test('plain text is stored literally and React content rendering never uses HTML injection',async()=>{
  const f=await opened(),text='<script>alert(1)</script><img onerror=evil()>';await f.a.post(post('safe',text));assert.equal((await f.a.conversation('51-4__safe')).comments[0].text,text);
  const source=readFileSync(new URL('../app/discussion-content.tsx',import.meta.url),'utf8');assert.doesNotMatch(source,/dangerouslySetInnerHTML/);assert.match(source,/\{comment\.text\}/);
});
test('server-only Firestore paths and shared recap composer/navigation remain wired',()=>{
  const rules=readFileSync(new URL('../firestore.rules',import.meta.url),'utf8');for(const path of ['comments','discussionThreads','discussionUsers','discussionSchedules'])assert.match(rules,new RegExp('match /'+path+'/'));
  assert.match(rules,/match \/comments\/\{commentId\}[\s\S]*?allow read, write: if false/);
  const page=readFileSync(new URL('../app/episodes/page.tsx',import.meta.url),'utf8'),chatter=readFileSync(new URL('../app/chatter/page.tsx',import.meta.url),'utf8');assert.match(page,/EpisodeDiscussion/);assert.match(chatter,/CommentComposer/);assert.match(page,/SpoilerWarning/);
  const store=readFileSync(new URL('../lib/discussion-store.ts',import.meta.url),'utf8');assert.doesNotMatch(store,/tx\.(set|update|create)\(this\.root\(/);
});
