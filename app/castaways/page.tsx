'use client';
/* eslint-disable @next/next/no-img-element */
import {SiteHeader} from '../site-header';
import { useGame } from '../game-provider';

export default function CastawaysPage() {
  const { game, castawayScores, loading } = useGame();
  if (loading) return <main className="loading-screen">Loading season…</main>;
  return <main className="inner-page">
    <SiteHeader active="/castaways" subtitle="Castaway profiles"/>
    <section className="inner-hero castaways-hero"><p className="eyebrow"><span/> Survivor {game.season.number} cast</p><h1>Meet the castaways.</h1><p>Get to know every player before draft night and track who owns them once the game begins.</p></section>
    <section className="castaway-section">
      <div className="castaway-grid">{game.castaways.map((castaway) => <article className="castaway-card" key={castaway.id}>
        <img src={castaway.imageUrl} alt={`${castaway.name}, Survivor castaway`} loading="lazy"/>
        <div className="castaway-body"><div className="castaway-status"><span className={`status-dot ${castaway.status === 'active' ? 'active' : ''}`}/>{castaway.status === 'active' ? 'Still alive' : 'Voted out'}</div><h3>{castaway.name}</h3><p className="castaway-meta">Age {castaway.age} · {castaway.occupation}</p><p className="castaway-bio">{castaway.bio}</p><div className="castaway-score"><span>{game.draftPicks.some((pick) => pick.castawayId === castaway.id) ? 'Drafted' : 'Undrafted'}</span><strong>{castawayScores[castaway.id] ?? 0} <small>pts</small></strong></div></div>
      </article>)}</div>
    </section>
  </main>;
}
