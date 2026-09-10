'use client';
import type {SeasonArchive} from '@/lib/game-data';
import {getPlayerHonors} from '@/lib/player-honors';

type PlayerNameProps={id?:string;name:string;history?:SeasonArchive[];className?:string};

export function PlayerName({id,name,history=[],className}:PlayerNameProps){
  const {wins,reigning}=getPlayerHonors(id,name,history);
  const classes=['player-name',className].filter(Boolean).join(' ');
  return <span className={classes}>
    <span>{name.replace(/[🏆★⭐]/gu,'').replace(/\s+/g,' ').trim()}</span>
    {reigning&&<span className="player-honor-trophy" role="img" aria-label="Reigning champion" title="Reigning champion">🏆</span>}
    {wins>0&&<span className="player-honor-stars" role="img" aria-label={`${wins} fantasy win${wins===1?'':'s'}`} title={`${wins} fantasy win${wins===1?'':'s'}`}>{'★'.repeat(wins)}</span>}
  </span>;
}
