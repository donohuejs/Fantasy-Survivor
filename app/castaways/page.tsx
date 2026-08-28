'use client';
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useGame } from '../game-provider';

export default function CastawaysPage() {
  const { game, castawayScores, loading } = useGame();
  if (loading) return <main className="loading-screen">Loading Season 51…</main>;
  return <main className="inner-page">
    <header className="site-header">
      <Link className="brand" href="/"><span className="brand-mark">51</span><span><strong>Fantasy Survivor</strong><small>Castaway profiles</small></span></Link>
      <nav><Link href="/">Standings</Link><Link href="/draft">Draft board</Link><Link className="active" href="/castaways">Castaways</Link><Link href="/rules">Rules</Link><Link className="admin-link" href="/admin">Game master</Link></nav>
    </header>
    <section className="inner-hero castaways-hero"><p className="eyebrow"><span/> Survivor 51 cast</p><h1>Meet the castaways.</h1><p>Get to know every player before draft night and track who owns them once the game begins.</p></section>
    <section className="castaway-section">
      <div className="castaway-grid">{game.castaways.map((castaway) => <article className="castaway-card" key={castaway.id}>
        <img src={castaway.imageUrl} alt={`${castaway.name}, Survivor 51 castaway`} loading="lazy"/>
        <div className="castaway-body"><div className="castaway-status"><span className={`status-dot ${castaway.status === 'active' ? 'active' : ''}`}/>{castaway.status === 'active' ? 'Still alive' : 'Voted out'}</div><h3>{castaway.name}</h3><p className="castaway-meta">Age {castaway.age} · {castaway.occupation}</p><p className="castaway-bio">{castaway.bio}</p><div className="castaway-score"><span>{game.draftPicks.some((pick) => pick.castawayId === castaway.id) ? 'Drafted' : 'Undrafted'}</span><strong>{castawayScores[castaway.id] ?? 0} <small>pts</small></strong></div></div>
      </article>)}</div>
    </section>
  </main>;
}
