import type {SeasonArchive,Player} from './game-data';
export type HistoricalResult={season:number;profileId:string;name:string;score:number;finish:number};
// Source: Fantasy Survivor 50.xlsx, Avg Finish!A3:G34 and K21:M94.
// The detailed season list includes Anna (46), omitted from the workbook's summary matrix.
export const historySource='Fantasy Survivor 50.xlsx · Avg Finish (season tables and detailed results)';
const seasons:Record<number,Array<[string,number]>>={
  45:[['Ross',143],['Hilary',142],['Steph',141],['Becky',133],['Josh',120],['Dustin',118],['Zoda',102],['Stanzi',93],['Chad',91],['Joey',68],['Dunna',55]],
  46:[['Josh',208],['Anna',165],['Zoda',145],['Stanzi',141],['Steph',138],['Becky',131],['Dustin',102],['Hilary',101],['Chad',88],['Dunna',51],['Joey',49],['Ross',48]],
  47:[['Zoda',208],['Dustin',189],['Stanzi',178],['Joey',173],['Hilary',167],['Steph',88],['Ross',72],['Dunna',71],['Becky',67],['Josh',49],['Chad',43]],
  48:[['Chad',208],['Joey',207],['Zoda',186],['Ross',177],['Josh',168],['Hilary',152],['Dunna',142],['Steph',123],['Dustin',113],['Jennie',101],['Stanzi',74],['Becky',54]],
  49:[['Zoda',286],['Josh',242],['Ross',213],['Stanzi',208],['Becky',198],['Joey',197],['Chad',163],['Steph',158],['Jackie',130],['Katie',118],['Dunna',113],['Hilary',100],['Jennie',93],['Dustin',93]],
  50:[['Chad',338.2083333333333],['Jennie',336.0833333333333],['Joey',278.375],['Ross',233.83333333333334],['Josh',219.70833333333334],['Dunna',207.95833333333334],['Katie',202],['Jackie',195.58333333333334],['Steph',182.33333333333334],['Hilary',178.91666666666666],['Dustin',162.83333333333334],['Zoda',137.75],['Stanzi',131]],
};
export const historicalResults:HistoricalResult[]=Object.entries(seasons).flatMap(([season,rows])=>rows.map(([name,score])=>({season:Number(season),profileId:`player-${name.toLowerCase()}`,name,score,finish:1+rows.filter(([,otherScore])=>otherScore>score).length})));
export function combinedHistory(archives:SeasonArchive[]=[]):HistoricalResult[]{
  const rows=new Map(historicalResults.map(row=>[`${row.season}:${row.profileId}`,row]));
  for(const archive of archives)for(const row of archive.results)rows.set(`${archive.season}:${row.profileId}`,{...row,season:archive.season});
  return [...rows.values()];
}
export function allTimeStandings(results:HistoricalResult[],players:Player[]=[]){
  return Object.values(results.reduce<Record<string,{profileId:string;name:string;total:number;seasons:number;wins:number;best:number;finishSum:number}>>((all,row)=>{
    const item=all[row.profileId]??{profileId:row.profileId,name:players.find(p=>p.id===row.profileId)?.name??row.name,total:0,seasons:0,wins:0,best:Infinity,finishSum:0};
    item.total+=row.score;item.seasons++;item.wins+=row.finish===1?1:0;item.best=Math.min(item.best,row.finish);item.finishSum+=row.finish;all[row.profileId]=item;return all;
  },{})).sort((a,b)=>b.total-a.total||a.profileId.localeCompare(b.profileId)).map(row=>({...row,averageFinish:row.finishSum/row.seasons}));
}
