// Private compatibility data: server stores and test fixtures only. Never import from client modules.
import {initialGame as publicGame,buildDraftTurns,DRAFT_ORDER_VERSION,movePlayerToDraftFront,type GameState,type SeasonArchive,type Possession} from './game-data.ts';
import {combinedHistory,type HistoricalResult} from './history-data.ts';
const priorFinish = ['Chad','Jennie','Joey','Ross','Josh','Dunna','Katie','Jackie','Steph','Hilary','Dustin','Zoda','Stanzi'];
const players = priorFinish.map((name,index) => ({id:`player-${name.toLowerCase()}`,name,email:'',entryBonus:0,priorFinish:index+1,draftSlot:priorFinish.length-index}));

export const initialGame:GameState={...publicGame,tribes:[{id:'savu',name:'Savu',color:'#7030A0'},{id:'toka',name:'Toka',color:'#F2CC24'}],players,draft:{status:'setup',currentPick:0,turns:buildDraftTurns(players)}};
// Original workbook values retained exactly, without public client imports.
const seasons:Record<number,Array<[string,number]>>={
  45:[['Ross',143],['Hilary',142],['Steph',141],['Becky',133],['Josh',120],['Dustin',118],['Zoda',102],['Stanzi',93],['Chad',91],['Joey',68],['Dunna',55]],
  46:[['Josh',208],['Anna',165],['Zoda',145],['Stanzi',141],['Steph',138],['Becky',131],['Dustin',102],['Hilary',101],['Chad',88],['Dunna',51],['Joey',49],['Ross',48]],
  47:[['Zoda',208],['Dustin',189],['Stanzi',178],['Joey',173],['Hilary',167],['Steph',88],['Ross',72],['Dunna',71],['Becky',67],['Josh',49],['Chad',43]],
  48:[['Chad',208],['Joey',207],['Zoda',186],['Ross',177],['Josh',168],['Hilary',152],['Dunna',142],['Steph',123],['Dustin',113],['Jennie',101],['Stanzi',74],['Becky',54]],
  49:[['Zoda',286],['Josh',242],['Ross',213],['Stanzi',208],['Becky',198],['Joey',197],['Chad',163],['Steph',158],['Jackie',130],['Katie',118],['Dunna',113],['Hilary',100],['Jennie',93],['Dustin',93]],
  50:[['Chad',338.2083333333333],['Jennie',336.0833333333333],['Joey',278.375],['Ross',233.83333333333334],['Josh',219.70833333333334],['Dunna',207.95833333333334],['Katie',202],['Jackie',195.58333333333334],['Steph',182.33333333333334],['Hilary',178.91666666666666],['Dustin',162.83333333333334],['Zoda',137.75],['Stanzi',131]],
};
export const historicalResults:HistoricalResult[]=Object.entries(seasons).flatMap(([season,rows])=>rows.map(([name,score])=>({season:Number(season),profileId:`player-${name.toLowerCase()}`,name,score,finish:1+rows.filter(([,otherScore])=>otherScore>score).length})));

export const historicalArchives:SeasonArchive[]=Object.keys(seasons).map(Number).map(season=>({season,finalizedAt:'',results:historicalResults.filter(r=>r.season===season).map(({season:_season,...row})=>{void _season;return row;})}));
/** Read-only compatibility view; never persist imported rows over the stored game. */
export function withHistoricalSeed(game:GameState):GameState {
 const rows=combinedHistory([...historicalArchives,...(game.history??[])]);
 const history=[...new Set(rows.map(r=>r.season))].map(season=>({season,finalizedAt:game.history?.find(a=>a.season===season)?.finalizedAt??'',results:rows.filter(r=>r.season===season).map(({season:_season,...row})=>{void _season;return row;})}));
 return {...game,history};
}

export function migrateLegacyDraftOrder(game:GameState):GameState{
  if(game.draftOrderVersion===DRAFT_ORDER_VERSION)return game;
  const canReorder=game.draft.status==='setup'&&game.draftPicks.length===0;
  const adam=game.players.find(player=>player.active!==false&&player.name.trim().toLowerCase()==='adam');
  const previousWinner=adam&&((adam.priorFinish===1)||game.history?.some(archive=>archive.season===game.season.number-1&&archive.results.some(result=>result.profileId===adam.id&&result.finish===1)));
  const legacyNewPlayer=Boolean(adam&&!previousWinner&&adam.priorFinish===adam.draftSlot);
  const players=canReorder&&adam&&!previousWinner?movePlayerToDraftFront(game.players,adam.id).map(player=>legacyNewPlayer&&player.id===adam.id?{...player,priorFinish:0}:player):game.players;
  return {...game,draftOrderVersion:DRAFT_ORDER_VERSION,players,draft:canReorder?{...game.draft,turns:buildDraftTurns(players)}:game.draft};
}

const currentSeasonPossessions:Possession[] = [
  {id:'possession-final-five-idol-rob',seasonId:'season-51',lineageId:'possession-final-five-idol-rob',castawayId:'cast-rob',originalCastawayId:'cast-rob',itemName:'Final 5 Immunity Idol',category:'idol',status:'active',history:[{action:'acquired',at:''}]},
  {id:'possession-final-five-idol-jelly',seasonId:'season-51',lineageId:'possession-final-five-idol-jelly',castawayId:'cast-jelly',originalCastawayId:'cast-jelly',itemName:'Final 5 Immunity Idol',category:'idol',status:'active',history:[{action:'acquired',at:''}]},
];
export function seedCurrentSeasonPossessions(seasonId:string,seasonNumber:number,existing:Possession[]|undefined):Possession[]{
  if(existing?.length||seasonNumber!==51)return existing??[];
  return currentSeasonPossessions.map(possession=>({...possession,seasonId}));
}
