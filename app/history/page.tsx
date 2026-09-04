'use client';
import {useState} from 'react';
import {allTimeStandings,combinedHistory,historySource} from '@/lib/history-data';
import {useGame} from '../game-provider';
import {SiteHeader} from '../site-header';

export default function History(){
  const {game,loading}=useGame();const [selected,setSelected]=useState('all');
  const results=combinedHistory(game.history),seasons=[...new Set(results.map(r=>r.season))].sort((a,b)=>b-a);
  const board=allTimeStandings(selected==='all'?results:results.filter(r=>r.season===Number(selected)),game.players);
  if(selected!=='all')board.sort((a,b)=>a.averageFinish-b.averageFinish);
  return <main className="inner-page"><SiteHeader active="/history" subtitle="League history"/>
    <section className="inner-hero"><p className="eyebrow"><span/> League record book</p><h1>Every season counts.</h1><p>Permanent player profiles, lifetime points, titles, and final standings. Only completed seasons count toward career totals.</p></section>
    <section className="history-content">
      <div className="history-toolbar"><div><h2>{selected==='all'?'All-time leaderboard':`Season ${selected}`}</h2><p>{loading?'Loading saved results…':`${board.length} players · ${selected==='all'?seasons.length:1} completed seasons`}</p></div><label>Show results<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="all">All seasons</option>{seasons.map(season=><option key={season} value={season}>Season {season}</option>)}</select></label></div>
      <div className="history-scroll"><table className="history-table"><caption>{selected==='all'?'Career totals, ranked by points':`Final results for Season ${selected}`}</caption><thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Seasons</th><th scope="col">Wins</th><th scope="col">Average finish</th><th scope="col">Total points</th></tr></thead><tbody>{board.map((player,index)=><tr key={player.profileId}><td>{selected==='all'?1+board.slice(0,index).filter(p=>p.total>player.total).length:player.averageFinish}</td><th scope="row">{player.name}</th><td>{player.seasons}</td><td>{player.wins}</td><td>{player.averageFinish.toFixed(1)}</td><td><strong>{player.total.toFixed(2)}</strong></td></tr>)}</tbody></table></div>
      <p className="history-source">Imported Seasons 45–50: {historySource}. Includes one-season and inactive players. Missing seasons are excluded, not counted as zero. Tied historical scores share a finish. Points reflect each season’s original scoring rules.</p>
      <p className="history-source">Live Season {game.season.number} is {game.season.finalized?'included as a finalized season.':'excluded until the game master locks its final results.'} Names may change; league profile IDs keep the history connected.</p>
    </section>
  </main>;
}
