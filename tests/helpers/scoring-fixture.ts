import {initialGame} from '../../lib/private-league-seed.ts';
import {type GameState} from '../../lib/game-data.ts';
import {scoringVersion} from '../../lib/score-ledger.ts';
import type {ScoreCorrectionCommand} from '../../lib/score-corrections.ts';

export const commissioner={uid:'test-owner',email:'donohue.js@gmail.com',verified:true,commissioner:true};
export const awardedIds=['cast-thien-an','cast-brady','cast-carter','cast-kristin','cast-maggie','cast-mike','cast-ori'];
export function correctionFixture(){
  const game=structuredClone(initialGame);
  game.season.currentEpisode=4;game.season.episodeStatus='in-progress';game.season.episodeStarted=true;
  game.castaways=game.castaways.map(c=>({...c,tribeId:c.id==='cast-ori'?'savu':awardedIds.includes(c.id)?'toka':c.tribeId??'savu'}));
  game.scoreEvents=awardedIds.map(id=>({id:`test-immunity:${id}`,batchId:'test-immunity',castawayId:id,recipientName:game.castaways.find(c=>c.id===id)!.name,categoryId:'tribal-immunity',actionLabel:'Win tribal immunity',points:2,episode:4,note:'',createdAt:'2026-10-14T20:00:00.000Z',tribeId:'toka',tribeName:'Toka',recipientIds:awardedIds,recipientMode:'tribe',resolved:true}));
  game.scoreEvents.push({id:'unrelated',castawayId:'cast-ori',points:11,episode:3,createdAt:'2026-10-13T20:00:00.000Z'});
  game.players=game.players.slice(0,4);
  game.draftPicks=[1,1,1.25].map((multiplier,index)=>({id:`test-pick-${index}`,playerId:game.players[index].id,castawayId:'cast-ori',round:index+1,pickNumber:1,multiplier}));
  return game;
}
export async function correctionCommand(game:GameState,override:Partial<ScoreCorrectionCommand>={}):Promise<ScoreCorrectionCommand>{
  return {id:'test-correction',season:51,kind:'edit',scope:'action',eventId:'test-immunity:cast-thien-an',recipientIds:awardedIds.filter(id=>id!=='cast-ori'),points:2,reason:'Ori was assigned to Savu when this immunity award was issued.',expectedVersion:await scoringVersion(game),...override};
}
