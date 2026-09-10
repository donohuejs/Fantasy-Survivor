import type {SeasonArchive} from './game-data.ts';
import {combinedHistory} from './history-data.ts';

export type PlayerHonors={wins:number;reigning:boolean};

const honorMarks=/[🏆★⭐]/gu;
const normalizeName=(name:string)=>name.replace(honorMarks,'').replace(/\s+/g,' ').trim().toLocaleLowerCase();

export function getPlayerHonors(profileId:string|undefined,name:string,archives:SeasonArchive[]=[]):PlayerHonors{
  const rows=combinedHistory(archives);
  const byProfile=profileId?rows.filter(row=>row.profileId===profileId):[];
  const matches=byProfile.length?byProfile:rows.filter(row=>normalizeName(row.name)===normalizeName(name));
  const latestSeason=rows.reduce((latest,row)=>Math.max(latest,row.season),0);
  const reigning=matches.some(row=>row.season===latestSeason&&row.finish===1);
  const totalWins=matches.filter(row=>row.finish===1).length;
  return {wins:Math.max(0,totalWins-(reigning?1:0)),reigning};
}

export function playerDisplayName(profileId:string|undefined,name:string,archives:SeasonArchive[]=[]):string{
  const honors=getPlayerHonors(profileId,name,archives),cleanName=name.replace(honorMarks,'').replace(/\s+/g,' ').trim();
  return `${cleanName}${honors.reigning?' 🏆':''}${honors.wins?' '+ '★'.repeat(honors.wins):''}`;
}
