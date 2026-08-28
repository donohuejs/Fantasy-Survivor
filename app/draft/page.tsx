'use client';
import Link from 'next/link';
import { useGame } from '../game-provider';

export default function Draft() {
  const { game, standings } = useGame();
  return <main className="inner-page">
    <header className="site-header"><Link className="brand" href="/"><span className="brand-mark">51</span><span><strong>Fantasy Survivor</strong><small>Draft board</small></span></Link><nav><Link href="/">Standings</Link><Link className="active" href="/draft">Draft board</Link><Link href="/castaways">Castaways</Link><Link href="/rules">Rules</Link><Link className="admin-link" href="/admin">Game master</Link></nav></header>
    <section className="inner-hero"><p className="eyebrow"><span/> Survivor 51</p><h1>Three rounds. No safe picks.</h1><p>Round one follows last season’s finish, round two snakes back, and round three puts 25% upside behind a blind choice.</p></section>
    <section className="draft-rounds">{[1,2,3].map((round) => <article className="draft-round" key={round}><header><span>Round {round}</span><strong>{round === 1 ? 'Reverse finish order' : round === 2 ? 'Snake draft' : 'Blindfold round'}</strong></header><div>{game.draftPicks.filter((pick) => pick.round === round).sort((a,b) => a.pickNumber-b.pickNumber).map((pick) => <div className="draft-pick" key={pick.id}><span>{pick.pickNumber}</span><div><strong>{game.castaways.find((castaway) => castaway.id === pick.castawayId)?.shortName}</strong><small>{game.players.find((player) => player.id === pick.playerId)?.name}</small></div>{pick.multiplier > 1 && <b>1.25×</b>}</div>)}{!game.draftPicks.some((pick) => pick.round === round) && <p className="draft-empty">Waiting for Season 51 picks.</p>}</div></article>)}</section>
    <section className="team-board"><div className="section-title"><div><p className="eyebrow dark">Team check</p><h2>Every player’s three</h2></div></div><div className="team-grid">{standings.map((player) => <article key={player.id}><span>{player.score ? player.rank : '—'}</span><div><strong>{player.name}</strong><p>{player.picks}</p></div><b>{player.score.toFixed(1)}</b></article>)}</div></section>
  </main>;
}
