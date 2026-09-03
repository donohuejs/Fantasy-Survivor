'use client';
import Link from 'next/link';
import { useGame } from '../game-provider';

export default function Rules() {
  const {game}=useGame();
  const groups = Object.groupBy(game.categories,(category) => category.group);
  return <main className="inner-page">
    <header className="site-header"><Link className="brand" href="/"><span className="brand-mark">51</span><span><strong>Fantasy Survivor</strong><small>League rulebook</small></span></Link><nav><Link href="/">Standings</Link><Link href="/draft">Draft board</Link><Link href="/castaways">Castaways</Link><Link className="active" href="/rules">Rules</Link><Link className="admin-link" href="/admin">Game master</Link></nav></header>
    <section className="inner-hero rules-hero"><p className="eyebrow"><span/> Official scoring</p><h1>Every move has a price.</h1><p>The same scoring system as the workbook, including the round-three blind-pick multiplier.</p></section>
    <section className="rules-layout"><aside><div className="rule-summary"><span>$10</span><strong>Entry fee</strong><p>League entry for the new season.</p></div><div className="rule-summary"><span>3</span><strong>Castaways drafted</strong><p>Three rounds, with round three eligible for the blind-pick bonus.</p></div><div className="rule-summary"><span>1.25×</span><strong>Blind-pick bonus</strong><p>Keep the blind pick and that castaway’s score receives a 25% boost.</p></div></aside><div className="rules-groups">{Object.entries(groups).map(([group,items]) => <article key={group}><h2>{group}</h2><div>{items?.map((category) => <div className="scoring-rule" key={category.id}><span className={category.points < 0 ? 'negative' : ''}>{category.points > 0 ? '+' : ''}{category.points}</span><p><strong>{category.label}</strong></p></div>)}</div></article>)}</div></section>
  </main>;
}
