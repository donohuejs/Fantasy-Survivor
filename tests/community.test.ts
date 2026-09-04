import assert from 'node:assert/strict';
import test from 'node:test';
import {initialGame} from '../lib/game-data.ts';
import {episodeActions,makeRecap,makePoll,changeVote,linkedAuthor,isCommunityOwner,requiredText,resourceId,wholeNumber} from '../lib/community.ts';

function game(){const g=structuredClone(initialGame);g.players[0].uid='account-one';g.players[0].email='';return g;}
const actor={uid:'account-one',email:'player@example.com',verified:true};
const now='2026-09-04T12:00:00.000Z';
function poll(){return makePoll(game(),{id:'poll-one',season:51,episode:0,question:'Award the bonus?',options:['Yes','No']},now);}
test('recap summary groups a tribe batch, not separate scoring awards',()=>{
  const g=game();g.scoreEvents=[{id:'a',batchId:'tribe1',castawayId:'one',recipientName:'Alex',actionLabel:'Immunity',points:2,episode:1,note:'Strong finish',tribeName:'Savu',createdAt:now},{id:'b',batchId:'tribe1',castawayId:'two',recipientName:'Sam',actionLabel:'Immunity',points:2,episode:1,note:'Strong finish',tribeName:'Savu',createdAt:now},{id:'c',actionLabel:'Find idol',castawayId:'one',recipientName:'Alex',points:5,episode:1,note:'',createdAt:now}];
  const before=structuredClone(g),actions=episodeActions(g,1);
  assert.equal(actions.length,2);assert.equal(actions[0].points,2);assert.deepEqual(actions[0].recipients,['Alex','Sam']);assert.equal(actions[0].tribeName,'Savu');assert.equal(actions[1].points,5);assert.deepEqual(g,before);
});
test('summary separates episodes, untagged adjustments, and different batch values',()=>{
  const g=game();g.scoreEvents=[{id:'a',batchId:'batch',points:1,episode:1,createdAt:now},{id:'b',batchId:'batch',points:-1,episode:1,createdAt:now},{id:'c',points:99,episode:2,createdAt:now},{id:'d',playerId:g.players[0].id,points:10,createdAt:now}];
  assert.deepEqual(episodeActions(g,1).map(a=>a.points),[1,-1]);assert.equal(episodeActions(g,2).length,1);
});
test('recap snapshot preserves recorded names and actions after membership or category changes',()=>{
  const g=game();g.scoreEvents=[{id:'a',recipientName:'Original name',actionLabel:'Original action',castawayId:g.castaways[0].id,points:5,episode:1,createdAt:now}];
  const recap=makeRecap(g,{season:51,episode:1,title:'Week one',body:'My take',status:'published',expectedUpdatedAt:''},null,now);
  g.castaways[0].name='Changed';g.scoreEvents[0].points=100;
  assert.equal(recap.actions[0].recipients[0],'Original name');assert.equal(recap.actions[0].label,'Original action');assert.equal(recap.actions[0].points,5);
});
test('draft and publication validate text and optimistic revision without touching game scores',()=>{
  const g=game(),input={season:51,episode:1,title:' Episode 1 ',body:'Commentary\n\nMore thoughts',status:'draft',expectedUpdatedAt:''};
  const before=structuredClone(g),draft=makeRecap(g,input,null,now);assert.equal(draft.title,'Episode 1');assert.equal(draft.publishedAt,'');
  const published=makeRecap(g,{...input,status:'published',expectedUpdatedAt:now},draft,'later');assert.equal(published.publishedAt,'later');
  assert.throws(()=>makeRecap(g,{...input,expectedUpdatedAt:''},published,'again'),/another window/);
  assert.throws(()=>makeRecap(g,{...input,season:50},null,now),/active season/);
  assert.throws(()=>makeRecap(g,{...input,body:'a'.repeat(12001)},null,now),/12,000/);
  assert.throws(()=>makeRecap(g,{...input,title:''},null,now),/Title/);assert.deepEqual(g,before);
});
test('unpublishing preserves original publication date and existing snapshot is refreshed explicitly',()=>{
  const g=game(),input={season:51,episode:1,title:'First',body:'',status:'published',expectedUpdatedAt:''};
  const first=makeRecap(g,input,null,now);
  g.scoreEvents.push({id:'a',points:5,episode:1,createdAt:now});
  assert.equal(first.actions.length,0);
  const updated=makeRecap(g,{...input,status:'draft',expectedUpdatedAt:now},first,'new-time');
  assert.equal(updated.status,'draft');assert.equal(updated.publishedAt,now);assert.equal(updated.actions.length,1);
});
test('only linked verified accounts can participate and UID takes priority over email',()=>{
  const g=game();assert.equal(linkedAuthor(g,actor).id,g.players[0].id);
  assert.throws(()=>linkedAuthor(g,{...actor,verified:false}),/verified/);
  assert.throws(()=>linkedAuthor(g,{...actor,uid:'stranger'}),/linked/);
  g.players[0].email=actor.email;assert.throws(()=>linkedAuthor(g,{...actor,uid:'stranger'}),/linked/);
});
test('legacy email profiles work, owner can comment but needs a player profile to vote',()=>{
  const g=game();delete g.players[0].uid;g.players[0].email='PLAYER@example.com';
  assert.equal(linkedAuthor(g,actor).id,g.players[0].id);
  const owner={uid:'owner',email:'donohue.js@gmail.com',verified:true};
  assert.equal(linkedAuthor(g,owner,true).id,'commissioner');assert.throws(()=>linkedAuthor(g,owner),/linked/);
  assert(isCommunityOwner(owner));assert(!isCommunityOwner({...owner,verified:false}));
});
test('poll accepts two to six unique options and snapshots the active season',()=>{
  assert.deepEqual(poll().counts,[0,0]);assert.equal(poll().status,'open');
  for(const options of [['Yes'],['Yes','yes'],Array.from({length:7},(_,i)=>String(i)),['','No']])assert.throws(()=>makePoll(game(),{id:'p',season:51,episode:0,question:'Question',options},now));
  assert.throws(()=>makePoll(game(),{id:'p',season:50,episode:0,question:'Question',options:['A','B']},now),/season changed/);
});
test('first vote increments once, repeated vote is idempotent and choice changes transfer count',()=>{
  const first=changeVote(poll(),null,0,51,now);assert.deepEqual(first.counts,[1,0]);
  assert.deepEqual(changeVote(first,0,0,51,'later'),first);
  assert.deepEqual(changeVote(first,0,1,51,'later').counts,[0,1]);assert.deepEqual(first.counts,[1,0]);
});
test('multiple profiles, vote switching and totals stay consistent',()=>{
  let p=poll();const choices=new Map<string,number>();
  for(let i=0;i<100;i++){const id='player-'+(i%13),choice=i%2;p=changeVote(p,choices.get(id)??null,choice,51,now);choices.set(id,choice);}
  assert.equal(p.counts.reduce((a,b)=>a+b,0),13);
  assert.equal(p.counts[0],[...choices.values()].filter(c=>c===0).length);
});
test('closed and past-season polls reject voting; invalid or corrupt choices cannot change totals',()=>{
  assert.throws(()=>changeVote({...poll(),status:'closed'},null,0,51,now),/closed/);
  assert.throws(()=>changeVote(poll(),null,0,52,now),/closed/);
  for(const choice of [-1,2,0.5,'0',null])assert.throws(()=>changeVote(poll(),null,choice,51,now),/options/);
  assert.throws(()=>changeVote(poll(),0,1,51,now),/review/);
});
test('IDs and comment text reject path traversal, blanks and overlong content',()=>{
  for(const id of ['../secret','poll/other','', 'x'.repeat(101)])assert.throws(()=>resourceId(id));
  assert.equal(resourceId('51-1'),'51-1');assert.equal(requiredText(' Hello ','Comment',2000),'Hello');
  assert.throws(()=>requiredText('a'.repeat(2001),'Comment',2000));assert.throws(()=>requiredText(' ','Comment',2000));
  for(const number of [0,-1,1.5,'1',Infinity])assert.throws(()=>wholeNumber(number,'episode'));
  assert.equal(wholeNumber(0,'episode',0),0);
});
