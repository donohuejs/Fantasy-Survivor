import assert from 'node:assert/strict';
import test from 'node:test';
import {initialGame,type GameState} from '../lib/game-data.ts';
import {executeDraft,parseDraftCommand,availableCastaways,keepsUntilReveal,shuffle,type DraftCommand,type DraftActor,type PrivateDeal} from '../lib/draft.ts';
import {seasonStandings} from '../lib/league.ts';

const owner:DraftActor={uid:'owner',email:'donohue.js@gmail.com',verified:true};
type State={game:GameState;deal:PrivateDeal|null};
function setup(count=6,castCount=8):GameState{
  const game=structuredClone(initialGame);
  game.players=game.players.slice(0,count).map((p,i)=>({...p,uid:'account-'+i,email:'',draftSlot:i+1}));
  game.castaways=game.castaways.slice(0,castCount);
  game.draft={status:'setup',currentPick:0,turns:[]};
  return game;
}
function command(game:GameState,action:DraftCommand['action']='pick',extra:Partial<DraftCommand>={}):DraftCommand{
  return {action,season:game.season.number,runId:game.draft.runId??'',revision:game.draft.revision??0,currentPick:game.draft.currentPick,...extra};
}
function start(count=6,castCount=8):State{const game=setup(count,castCount);return executeDraft(game,null,owner,command(game,'start'),()=>0);}
function turnActor(game:GameState):DraftActor{return {uid:game.draft.turns[game.draft.currentPick].uid!,email:'player@example.com',verified:true};}
function play(state:State,decision:'select'|'keep'|'swap',castawayId=''):State{return executeDraft(state.game,state.deal,turnActor(state.game),command(state.game,'pick',{decision,castawayId}));}
function blind(count=6,castCount=8):State{
  let state=start(count,castCount);
  while(state.game.draft.turns[state.game.draft.currentPick].round<3){
    const playerId=state.game.draft.turns[state.game.draft.currentPick].playerId;
    const castawayId=state.game.castaways[state.game.players.findIndex(p=>p.id===playerId)].id;
    state=play(state,'select',castawayId);
  }
  return state;
}
test('independent order and card shuffles, full one-to-one deal, no public mapping',()=>{
  const state=start(),game=state.game,deal=state.deal!;
  const first=game.players.map(p=>p.id);
  assert.deepEqual(game.draft.turns.filter(t=>t.round===1).map(t=>t.playerId),first);
  assert.deepEqual(game.draft.turns.filter(t=>t.round===2).map(t=>t.playerId),[...first].reverse());
  assert.deepEqual(game.draft.turns.filter(t=>t.round===3).map(t=>t.playerId),[...first.slice(1),first[0]]);
  assert.equal(new Set([...Object.values(deal.dealt),...deal.initialDiscards]).size,8);
  assert.equal(Object.keys(deal.dealt).length,6);assert.equal(deal.initialDiscards.length,2);
  assert.equal(game.draft.blind,undefined);assert.equal('dealt' in game.draft,false);
  assert.equal(game.draftPicks.length,0);
});
test('shuffle does not mutate the source and uses bounds for every position',()=>{
  const source=[1,2,3,4],bounds:number[]=[];
  assert.deepEqual(shuffle(source,max=>{bounds.push(max);return max-1;}),source);
  assert.deepEqual(source,[1,2,3,4]);assert.deepEqual(bounds,[4,3,2]);
});
test('only verified owner starts or controls draft',()=>{
  const game=setup();
  assert.throws(()=>executeDraft(game,null,{...owner,email:'intruder@example.com'},command(game,'start')),/game master/);
  assert.throws(()=>executeDraft(game,null,{...owner,verified:false},command(game,'start')),/verified/);
  const state=start();
  for(const action of ['toggle','undo'] as const)assert.throws(()=>executeDraft(state.game,state.deal,turnActor(state.game),command(state.game,action)),/game master/);
});
test('start rejects incomplete, duplicate and undersized rosters without changing data',()=>{
  for(const change of [(g:GameState)=>{g.players[0].uid='';},(g:GameState)=>{g.players[0].uid=g.players[1].uid;},(g:GameState)=>{g.castaways=g.castaways.slice(0,2);},(g:GameState)=>{g.castaways[1].id=g.castaways[0].id;}]){
    const g=setup();change(g);assert.throws(()=>executeDraft(g,null,owner,command(g,'start')));
  }
  const state=start();assert.throws(()=>executeDraft(state.game,state.deal,owner,command(state.game,'start')),/already/);
});
test('only current account can select; explicit owner proxy still follows selection rules',()=>{
  const state=start(),id=state.game.castaways[0].id;
  assert.throws(()=>executeDraft(state.game,state.deal,owner,command(state.game,'pick',{decision:'select',castawayId:id})),/not your turn/);
  assert.throws(()=>executeDraft(state.game,state.deal,turnActor(state.game),command(state.game,'pick',{decision:'select',castawayId:id,onBehalf:true})),/game master/);
  const next=executeDraft(state.game,state.deal,owner,command(state.game,'pick',{decision:'select',castawayId:id,onBehalf:true}));
  assert.equal(next.game.draftPicks[0].playerId,state.game.draft.turns[0].playerId);
  assert.throws(()=>executeDraft(next.game,next.deal,owner,command(next.game,'pick',{decision:'select',castawayId:id,onBehalf:true})),/already picked/);
});
test('legacy email works, but matching email cannot override a linked UID',()=>{
  const state=start(),id=state.game.castaways[0].id,turn=state.game.draft.turns[0];
  turn.email='player@example.com';
  assert.throws(()=>executeDraft(state.game,state.deal,{uid:'wrong',email:turn.email,verified:true},command(state.game,'pick',{decision:'select',castawayId:id})),/not your turn/);
  delete turn.uid;
  assert.equal(executeDraft(state.game,state.deal,{uid:'legacy',email:'PLAYER@example.com',verified:true},command(state.game,'pick',{decision:'select',castawayId:id})).game.draft.currentPick,1);
});
test('castaways cannot repeat within a round, but pool resets for round two',()=>{
  let state=start();const id=state.game.castaways[0].id;
  state=play(state,'select',id);
  assert.throws(()=>play(state,'select',id),/already picked/);
  assert.throws(()=>play(state,'select','unknown'),/this season/);
  while(state.game.draft.currentPick<6)state=play(state,'select',availableCastaways(state.game)[0].id);
  assert.equal(availableCastaways(state.game).length,8);
  assert.doesNotThrow(()=>play(state,'select',id));
});
test('reversed identical pair is rejected, other pairs and own same-card pair are allowed',()=>{
  const state=start(),g=state.game,a=g.players[0],b=g.players[1],c=g.castaways;
  g.draft.currentPick=6;g.draft.turns[6]={...g.draft.turns[6],playerId:b.id,uid:b.uid};
  g.draftPicks=[
    {id:'a1',playerId:a.id,castawayId:c[0].id,round:1,pickNumber:1,multiplier:1},
    {id:'a2',playerId:a.id,castawayId:c[1].id,round:2,pickNumber:1,multiplier:1},
    {id:'b1',playerId:b.id,castawayId:c[1].id,round:1,pickNumber:2,multiplier:1},
  ];
  assert.throws(()=>play(state,'select',c[0].id),/pair/);
  assert(!availableCastaways(g).some(item=>item.id===c[0].id));
  assert.doesNotThrow(()=>play(state,'select',c[2].id));
  const all=blind();assert(all.game.draftPicks.every(p=>p.round!==2||all.game.draftPicks.some(q=>q.round===1&&q.playerId===p.playerId&&q.castawayId===p.castawayId)));
});
test('dealt cards stay hidden on keep; swaps release original into pile, later player can take it',()=>{
  let state=blind();const first=state.game.draft.turns[12].playerId,second=state.game.draft.turns[13].playerId;
  state=play(state,'keep');
  const hidden=state.game.draftPicks.at(-1)!;assert.equal(hidden.castawayId,'');assert.equal(hidden.multiplier,1.25);assert.equal(hidden.playerId,first);
  const discard=state.game.draft.blind!.discards[0],original=state.deal!.dealt[second];
  state=play(state,'swap',discard);
  assert(!state.game.draft.blind!.discards.includes(discard));assert(state.game.draft.blind!.discards.includes(original));
  assert.equal(state.game.draftPicks.at(-1)!.multiplier,1);
  state=play(state,'swap',original);
  assert.equal(state.game.draftPicks.at(-1)!.castawayId,original);assert.equal(state.game.draftPicks.at(-1)!.multiplier,1);
  assert.equal(state.game.draft.blind!.keptCount,1);assert.equal(keepsUntilReveal(state.game,hidden),2);
});
test('two additional keeps reveal first kept card, swaps do not; completion reveals final cards',()=>{
  let state=blind();state=play(state,'keep');const firstId=state.game.draftPicks.at(-1)!.id;
  state=play(state,'swap',state.game.draft.blind!.discards[0]);
  state=play(state,'keep');
  assert.equal(state.game.draftPicks.find(p=>p.id===firstId)!.castawayId,'');
  state=play(state,'keep');
  const first=state.game.draftPicks.find(p=>p.id===firstId)!;
  assert.equal(first.castawayId,state.deal!.dealt[first.playerId]);
  assert.equal(state.game.draftPicks.filter(p=>p.round===3&&!p.castawayId).length,2);
  state=play(state,'swap',state.game.draft.blind!.discards[0]);
  assert.equal(state.game.draftPicks.filter(p=>p.round===3&&!p.castawayId).length,2);
  state=play(state,'keep');
  assert.equal(state.game.draft.status,'complete');assert(state.game.draftPicks.every(p=>p.castawayId));
  assert.equal(new Set(state.game.draftPicks.filter(p=>p.round===3).map(p=>p.castawayId)).size,6);
});
test('cannot swap for hidden card, already taken discard, or select normally in blind round',()=>{
  let state=blind();const dealt=state.deal!.dealt[state.game.draft.turns[12].playerId],discard=state.game.draft.blind!.discards[0];
  assert.throws(()=>play(state,'swap',dealt),/discard pile/);
  assert.throws(()=>play(state,'select',discard),/Keep/);
  state=play(state,'swap',discard);assert.throws(()=>play(state,'swap',discard),/discard pile/);
});
test('round three permits player to repeat an earlier castaway, applies separate multiplier',()=>{
  let state=blind();const turn=state.game.draft.turns[12],dealt=state.deal!.dealt[turn.playerId];
  // Round-one ownership is irrelevant to the full round-three deck.
  state.game.draftPicks.find(p=>p.playerId===turn.playerId&&p.round===1)!.castawayId=dealt;
  state=play(state,'keep');
  while(state.game.draft.status!=='complete')state=play(state,'keep');
  state.game.scoreEvents=[{id:'score',castawayId:dealt,points:8,createdAt:''}];
  const score=seasonStandings(state.game).find(p=>p.profileId===turn.playerId)!.score;
  const ownPicks=state.game.draftPicks.filter(p=>p.playerId===turn.playerId&&p.castawayId===dealt);
  assert.equal(score,ownPicks.reduce((sum,p)=>sum+8*p.multiplier,0));assert(score>=18);
});
test('round-three swap may also repeat a prior pick',()=>{
  const state=blind(),turn=state.game.draft.turns[12],discard=state.game.draft.blind!.discards[0];
  state.game.draftPicks.find(p=>p.playerId===turn.playerId&&p.round===1)!.castawayId=discard;
  assert.equal(play(state,'swap',discard).game.draftPicks.at(-1)!.castawayId,discard);
});
test('one-player and no-discard rounds finish without stranded hidden cards',()=>{
  const state=blind(1,1);assert.equal(state.game.draft.blind!.discards.length,0);
  const next=play(state,'keep');assert.equal(next.game.draft.status,'complete');assert(next.game.draftPicks.at(-1)!.castawayId);
});
test('stale turn, season, run or revision cannot replay a request',()=>{
  const state=start(),request=command(state.game,'pick',{decision:'select',castawayId:state.game.castaways[0].id});
  const next=executeDraft(state.game,state.deal,turnActor(state.game),request);
  assert.throws(()=>executeDraft(next.game,next.deal,turnActor(state.game),request),/changed/);
  for(const extra of [{season:52},{runId:'other'},{revision:0},{currentPick:99}])assert.throws(()=>executeDraft(state.game,state.deal,turnActor(state.game),{...request,...extra}),/changed/);
});
test('paused, finalized, legacy and missing-private-deal states fail closed',()=>{
  const state=start(),id=state.game.castaways[0].id;
  const paused=executeDraft(state.game,state.deal,owner,command(state.game,'toggle'));
  assert.throws(()=>play(paused,'select',id),/not live/);
  assert.throws(()=>executeDraft(state.game,null,turnActor(state.game),command(state.game,'pick',{decision:'select',castawayId:id})),/unavailable/);
  state.game.season.finalized=true;assert.throws(()=>play(state,'select',id),/locked/);
  state.game.season.finalized=false;delete state.game.draft.version;assert.throws(()=>play(state,'select',id),/old format/);
});
test('undo pauses early draft, invalidates stale requests and is forbidden once blind pool opens',()=>{
  const state=play(start(),'select',initialGame.castaways[0].id),before=structuredClone(state.game);
  const undone=executeDraft(state.game,state.deal,owner,command(state.game,'undo'));
  assert.equal(undone.game.draft.currentPick,0);assert.equal(undone.game.draft.status,'paused');assert.equal(undone.game.draftPicks.length,0);
  assert.equal(undone.game.draft.revision,before.draft.revision!+1);assert.deepEqual(state.game,before);
  const later=blind();assert.throws(()=>executeDraft(later.game,later.deal,owner,command(later.game,'undo')),/exposed/);
});
test('request parser validates types and never accepts client-supplied bonus, deck or player identity',()=>{
  const c=command(setup(),'pick',{decision:'keep'});const parsed=parseDraftCommand({...c,multiplier:100,playerId:'other',dealt:{secret:'leak'}});
  assert(!('multiplier' in parsed));assert(!('dealt' in parsed));assert(!('playerId' in parsed));assert.equal(parsed.castawayId,'');
  for(const bad of [null,[],{...c,action:'delete'},{...c,revision:-1},{...c,season:'51'},{...c,onBehalf:'yes'},{...c,decision:'swap'}])assert.throws(()=>parseDraftCommand(bad));
});
test('many complete drafts preserve round uniqueness, deck conservation and private reveals',()=>{
  for(let run=0;run<30;run++){
    let state=blind();
    while(state.game.draft.status!=='complete'){
      const useSwap=(state.game.draft.currentPick+run)%3===0;
      state=play(state,useSwap?'swap':'keep',useSwap?state.game.draft.blind!.discards[0]:'');
      assert.equal(state.game.draft.blind!.discards.length,2);
    }
    for(const round of [1,2,3])assert.equal(new Set(state.game.draftPicks.filter(p=>p.round===round).map(p=>p.castawayId)).size,6);
    const third=state.game.draftPicks.filter(p=>p.round===3).map(p=>p.castawayId);
    assert.equal(new Set([...third,...state.game.draft.blind!.discards]).size,8);
  }
});
