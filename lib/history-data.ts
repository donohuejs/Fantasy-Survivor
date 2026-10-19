import type {SeasonArchive,Player} from './game-data.ts';
export type HistoricalResult={season:number;profileId:string;name:string;score:number;finish:number};
// Source: Fantasy Survivor 50.xlsx, Avg Finish!A3:G34 and K21:M94.
// The detailed season list includes Anna (46), omitted from the workbook's summary matrix.
export const historySource='Fantasy Survivor 50.xlsx · Avg Finish (season tables and detailed results)';
export function combinedHistory(archives:SeasonArchive[]=[]):HistoricalResult[]{
  const rows=new Map<string,HistoricalResult>();
  for(const archive of archives)for(const row of archive.results)rows.set(`${archive.season}:${row.profileId}`,{...row,season:archive.season});
  return [...rows.values()];
}
export function allTimeStandings(results:HistoricalResult[],players:Player[]=[]){
  return Object.values(results.reduce<Record<string,{profileId:string;name:string;total:number;seasons:number;wins:number;best:number;finishSum:number}>>((all,row)=>{
    const item=all[row.profileId]??{profileId:row.profileId,name:players.find(p=>p.id===row.profileId)?.name??row.name,total:0,seasons:0,wins:0,best:Infinity,finishSum:0};
    item.total+=row.score;item.seasons++;item.wins+=row.finish===1?1:0;item.best=Math.min(item.best,row.finish);item.finishSum+=row.finish;all[row.profileId]=item;return all;
  },{})).sort((a,b)=>b.total-a.total||a.profileId.localeCompare(b.profileId)).map(row=>({...row,averageFinish:row.finishSum/row.seasons}));
}
