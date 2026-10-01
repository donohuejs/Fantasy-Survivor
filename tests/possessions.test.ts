import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {initialGame} from '../lib/game-data.ts';
import {activePossessions,assignCastaway,createPossessionRecord,recordTribalCouncilResolution,transferPossessionRecord} from '../lib/scoring.ts';

const rob='cast-rob',jelly='cast-jelly',sam='cast-aaliyah',other='cast-alexis';
function fixture(){
  let game=structuredClone(initialGame);
  game.season.episodeStarted=true;game.season.episodeStatus='in-progress';game.possessions=[];game.tribalCouncilResolutions=[];
  game=assignCastaway(game,rob,'savu','active');game=assignCastaway(game,jelly,'savu','active');game=assignCastaway(game,sam,'savu','active');game=assignCastaway(game,other,'toka','active');
  return game;
}
function give(game:ReturnType<typeof fixture>,castawayId:string,category:'idol'|'advantage',itemName:string,id:string){return createPossessionRecord(game,{id,castawayId,category,itemName,acquiredEpisode:1});}
function resolve(game:ReturnType<typeof fixture>,eliminatedCastawayId:string,input:Partial<Parameters<typeof recordTribalCouncilResolution>[1]>={}){
  const attendees=game.castaways.filter(castaway=>castaway.tribeId==='savu'&&castaway.status==='active').map(castaway=>castaway.id);
  return recordTribalCouncilResolution(game,{tribeId:'savu',eliminatedCastawayId,episode:1,note:'',expectedAttendeeIds:attendees,...input});
}
function points(game:ReturnType<typeof fixture>,castawayId:string,categoryId:string){return game.scoreEvents.filter(event=>event.castawayId===castawayId&&event.categoryId===categoryId).reduce((sum,event)=>sum+event.points,0);}

test('recap editor enables native English writing assistance',()=>{
  const source=readFileSync(new URL('../app/admin/recap-manager.tsx',import.meta.url),'utf8');
  assert.match(source,/spellCheck autoCorrect="on" autoCapitalize="sentences" lang="en"/);
});

test('active possession inventory shows a newly given idol',()=>{
  const game=give(fixture(),rob,'idol','Test Immunity Idol','idol-rob');
  assert.deepEqual(activePossessions(game).map(item=>[item.castawayId,item.itemName,item.category]),[[rob,'Test Immunity Idol','idol']]);
});

test('unplayed idol remains active when its owner survives Tribal Council',()=>{
  const game=give(fixture(),rob,'idol','Final 5 Immunity Idol','idol-rob');
  const next=resolve(game,sam);
  assert.equal(next.castaways.find(castaway=>castaway.id===rob)?.status,'active');
  assert.equal(next.possessions?.find(item=>item.id==='idol-rob')?.status,'active');
  assert.equal(next.scoreEvents.some(event=>event.categoryId==='idol-pocket'),false);
  assert.equal(next.scoreEvents.some(event=>event.categoryId==='use-idol'),false);
});

test('successful idol awards the player who played it, not the protected castaway',()=>{
  const game=give(fixture(),jelly,'idol','Final 5 Immunity Idol','idol-jelly');
  const next=resolve(game,sam,{itemPlays:[{possessionId:'idol-jelly',playedByCastawayId:jelly,playedForCastawayId:rob,successful:true}]});
  assert.equal(points(next,jelly,'use-idol'),5);
  assert.equal(points(next,rob,'use-idol'),0);
  assert.equal(next.possessions?.find(item=>item.id==='idol-jelly')?.status,'played');
  assert.equal(activePossessions(next).some(item=>item.id==='idol-jelly'),false);
});

test('unsuccessful idol is played without use points or a later pocket penalty',()=>{
  const game=give(fixture(),jelly,'idol','Final 5 Immunity Idol','idol-jelly');
  const next=resolve(game,jelly,{itemPlays:[{possessionId:'idol-jelly',playedByCastawayId:jelly,successful:false}]});
  assert.equal(points(next,jelly,'use-idol'),0);
  assert.equal(points(next,jelly,'idol-pocket'),0);
  assert.equal(next.possessions?.find(item=>item.id==='idol-jelly')?.status,'played');
  assert.match(next.scoreEvents.find(event=>event.id.endsWith(':item:idol-jelly'))?.actionLabel??'',/unsuccessfully/);
});

test('successful and unsuccessful advantages score two and zero respectively',()=>{
  let game=give(fixture(),jelly,'advantage','Extra Vote','adv-success');
  game=give(game,rob,'advantage','Steal-a-Vote','adv-fail');
  const next=resolve(game,sam,{itemPlays:[{possessionId:'adv-success',playedByCastawayId:jelly,successful:true},{possessionId:'adv-fail',playedByCastawayId:rob,successful:false}]});
  assert.equal(points(next,jelly,'use-advantage'),2);assert.equal(points(next,rob,'use-advantage'),0);
  assert.ok(next.possessions?.every(item=>item.status==='played'));
});

test('pocket penalties stack by active item and played items are excluded',()=>{
  let game=give(fixture(),rob,'idol','Idol One','idol-one');game=give(game,rob,'idol','Idol Two','idol-two');game=give(game,rob,'advantage','Extra Vote','adv-one');
  const next=resolve(game,rob);
  assert.equal(points(next,rob,'idol-pocket'),-20);assert.equal(points(next,rob,'advantage-pocket'),-4);
  assert.equal(next.scoreEvents.filter(event=>event.id.includes(':pocket:')).reduce((sum,event)=>sum+event.points,0),-24);
  assert.ok(next.possessions?.every(item=>item.status==='lost'));
});

test('one played idol and one unplayed idol produce only one pocket penalty',()=>{
  let game=give(fixture(),rob,'idol','Played Idol','idol-played');game=give(game,rob,'idol','Pocket Idol','idol-pocket');
  const next=resolve(game,rob,{itemPlays:[{possessionId:'idol-played',playedByCastawayId:rob,successful:false}]});
  assert.equal(points(next,rob,'idol-pocket'),-10);assert.equal(next.possessions?.find(item=>item.id==='idol-played')?.status,'played');assert.equal(next.possessions?.find(item=>item.id==='idol-pocket')?.status,'lost');
});

test('Shot in the Dark supports safe, unsafe, and multiple attendees atomically',()=>{
  const next=resolve(fixture(),sam,{shotsInTheDark:[{castawayId:sam,result:'safe'},{castawayId:jelly,result:'unsafe'}]});
  assert.equal(points(next,sam,'shot-safe'),5);assert.equal(points(next,jelly,'shot-unsafe'),-1);
  assert.equal(next.scoreEvents.filter(event=>event.actionLabel?.startsWith('Shot in the Dark')).length,2);
});

test('Tribal resolution is idempotent across a second submission',()=>{
  const game=give(fixture(),jelly,'idol','Final 5 Immunity Idol','idol-jelly');
  const input={itemPlays:[{possessionId:'idol-jelly',playedByCastawayId:jelly,playedForCastawayId:rob,successful:true}],shotsInTheDark:[{castawayId:sam,result:'safe' as const}]};
  const first=resolve(game,sam,input),second=resolve(first,sam,input);
  assert.deepEqual(second,first);
  assert.equal(points(second,jelly,'use-idol'),5);assert.equal(points(second,sam,'shot-safe'),5);assert.equal(second.tribalCouncilResolutions?.length,1);
});

test('transfers preserve history and move the active owner',()=>{
  const game=give(fixture(),rob,'idol','Transfer Idol','idol-rob');
  const next=transferPossessionRecord(game,{possessionId:'idol-rob',targetCastawayId:jelly,episode:1,notes:'Handed over at camp',newPossessionId:'idol-jelly'});
  assert.deepEqual(activePossessions(next).map(item=>item.castawayId),[jelly]);
  assert.equal(next.possessions?.find(item=>item.id==='idol-rob')?.status,'transferred');
  assert.equal(next.possessions?.find(item=>item.id==='idol-jelly')?.castawayId,jelly);
  assert.equal(next.possessions?.find(item=>item.id==='idol-rob')?.transferredToPossessionId,'idol-jelly');
});

test('automated rules remain historical but are unavailable to manual scoring',()=>{
  for(const id of ['use-idol','use-advantage','idol-pocket','advantage-pocket','shot-safe','shot-unsafe'])assert.equal(initialGame.categories.find(category=>category.id===id)?.systemManaged,true);
});
