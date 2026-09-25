'use client';
/* eslint-disable @next/next/no-img-element */
import {SiteHeader} from '../site-header';
import { useGame } from '../game-provider';
import {tribeForCastaway} from '@/lib/game-data';
import {castawayLeaderboard} from '@/lib/castaway-leaderboard';

const scoreText=(score:number)=>Number.isInteger(score)?String(score):score.toFixed(1);

export default function CastawaysPage() {
  const { game, loading } = useGame();
  if (loading) return <main className="loading-screen">Loading season…</main>;
  const leaderboard=castawayLeaderboard(game);
  const allRows=[...leaderboard.active,...leaderboard.eliminated];
  const rowById=new Map(allRows.map(row=>[row.castawayId,row]));
  const cards=(rows:typeof leaderboard.active)=>rows.map((castawayRow)=>{
    const castaway=game.castaways.find(item=>item.id===castawayRow.castawayId)!;
    const tribe=tribeForCastaway(game,castaway.id);
    const drafted=game.draftPicks.some((pick)=>pick.castawayId===castaway.id);
    return <article className={`castaway-card ${castaway.status==='voted-out'?'castaway-card-eliminated':''}`} key={castaway.id}>
      <img src={castaway.imageUrl} alt={`${castaway.name}, Survivor castaway`} loading="lazy"/>
      <div className="castaway-body"><div className="castaway-status"><span className={`status-dot ${castaway.status === 'active' ? 'active' : ''}`}/>{castaway.status === 'active' ? 'Still alive' : 'Voted out'}</div><div className="castaway-tribe"><span aria-hidden="true" style={tribe?{backgroundColor:tribe.color}:undefined}/>{tribe?.name??'Tribe not assigned'}</div><h3>{castaway.name}</h3><p className="castaway-meta">Age {castaway.age} · {castaway.occupation}</p><p className="castaway-bio">{castaway.bio}</p><div className="castaway-score"><span>{castaway.status==='voted-out'?'Not draftable':drafted?'Drafted':'Undrafted'}</span><strong>{scoreText(rowById.get(castaway.id)?.total??0)} <small>pts</small></strong></div></div>
    </article>;
  });
  return <main className="inner-page">
    <SiteHeader active="/castaways" subtitle="Castaway profiles"/>
    <section className="inner-hero castaways-hero"><p className="eyebrow"><span/> Survivor {game.season.number} cast</p><h1>Meet the castaways.</h1><p>Get to know every player before draft night and track who owns them once the game begins.</p></section>
    <section className="castaway-leaderboard" aria-labelledby="castaway-leaderboard-heading"><div className="section-title"><div><p className="eyebrow dark">Episode scoreboard</p><h2 id="castaway-leaderboard-heading">Castaway leaderboard</h2><p className="castaway-leaderboard-intro">Episode-by-episode scoring and running totals, with active castaways ranked above the eliminated roster.</p></div></div><div className="castaway-table-wrap"><table className="castaway-table"><caption className="sr-only">Castaway points by episode and total</caption><thead><tr><th scope="col">Castaway</th>{leaderboard.episodes.map(episode=><th scope="col" key={episode}>Ep. {episode}</th>)}<th scope="col">Total</th></tr></thead><tbody><tr className="castaway-table-section"><th scope="colgroup" colSpan={leaderboard.episodes.length+2}>Active castaways</th></tr>{leaderboard.active.map(row=><CastawayLeaderboardRow key={row.castawayId} row={row} episodes={leaderboard.episodes}/>)}{leaderboard.eliminated.length>0&&<><tr className="castaway-table-section eliminated-section"><th scope="colgroup" colSpan={leaderboard.episodes.length+2}>Eliminated</th></tr>{leaderboard.eliminated.map(row=><CastawayLeaderboardRow key={row.castawayId} row={row} episodes={leaderboard.episodes}/>)}</>}</tbody></table></div></section>
    <section className="castaway-section">
      <div className="section-title"><div><p className="eyebrow dark">Active roster</p><h2>Still in the game</h2></div></div><div className="castaway-grid">{cards(leaderboard.active)}</div>
      {leaderboard.eliminated.length>0&&<div className="eliminated-castaways"><div className="section-title"><div><p className="eyebrow dark">Season history</p><h2>Eliminated</h2></div></div><div className="castaway-grid">{cards(leaderboard.eliminated)}</div></div>}
    </section>
  </main>;
}

function CastawayLeaderboardRow({row,episodes}:{row:ReturnType<typeof castawayLeaderboard>['active'][number];episodes:number[]}){
  return <tr className={row.status==='voted-out'?'castaway-table-eliminated':''}><th scope="row"><span className="castaway-table-name">{row.name}</span>{row.status==='voted-out'&&<small>Voted out</small>}</th>{episodes.map(episode=><td key={episode}>{scoreText(row.byEpisode[episode]??0)}</td>)}<td><strong>{scoreText(row.total)}</strong></td></tr>;
}
