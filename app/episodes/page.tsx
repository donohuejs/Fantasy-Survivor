'use client';
import {useState} from 'react';
import {SiteHeader} from '../site-header';
import {useGame} from '../game-provider';
import {usePolls,useRecaps} from './community-client';
import {CommentThread,PollCard,ScoringSummary} from './episode-content';

export default function Episodes(){
  const {game,user}=useGame(),recaps=useRecaps(),polls=usePolls();
  const [seasonChoice,setSeason]=useState<number|null>(null),[selected,setSelected]=useState('');
  const season=seasonChoice??game.season.number;
  const seasons=[...new Set([game.season.number,...recaps.rows.map(r=>r.season),...polls.rows.map(p=>p.season)])].sort((a,b)=>b-a);
  const episodes=recaps.rows.filter(r=>r.season===season).sort((a,b)=>b.episode-a.episode);
  const recap=episodes.find(r=>r.id===selected)??episodes[0];
  const generalPolls=polls.rows.filter(p=>p.season===season&&!p.episode).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  return <main className="inner-page"><SiteHeader active="/episodes" subtitle="Recaps, comments & league votes"/>
    <section className="community-heading"><p className="eyebrow dark">Around the campfire</p><h1>Episodes & league votes</h1><p>Official scoring, the game master’s take, and your side of the story. Recaps contain episode spoilers.</p><label>Season<select value={season} onChange={e=>{setSeason(Number(e.target.value));setSelected('');}}>{seasons.map(n=><option key={n} value={n}>Survivor {n}</option>)}</select></label></section>
    <div className="community-shell">{recaps.error&&<p role="alert" className="setup-notice">{recaps.error}</p>}{polls.error&&<p role="alert" className="setup-notice">{polls.error}</p>}
      {generalPolls.length>0&&<section><h2>League votes</h2><div className="community-polls">{generalPolls.map(p=><PollCard poll={p} key={p.id+':'+user?.uid}/>)}</div></section>}
      {recaps.loading&&<p role="status">Loading episode recaps…</p>}
      {!recaps.loading&&!recaps.error&&!episodes.length&&<section className="recap-empty"><h2>No published recaps yet</h2><p>The game master can publish Episode 1 after entering its scoring actions.</p></section>}
      {recap&&<><nav className="episode-picker" aria-label="Choose an episode">{episodes.map(r=><button key={r.id} aria-pressed={r.id===recap.id} onClick={()=>setSelected(r.id)}>Episode {r.episode}</button>)}</nav>
        <article className="episode-recap"><header><p className="eyebrow dark">Season {recap.season} · Episode {recap.episode}</p><h2>{recap.title}</h2><p className="community-note">Updated {new Date(recap.updatedAt).toLocaleString()}</p></header>{recap.body&&<section><h3>Game master’s commentary</h3><p className="community-prose">{recap.body}</p></section>}<ScoringSummary recap={recap}/></article>
        <div className="community-polls">{polls.rows.filter(p=>p.season===recap.season&&p.episode===recap.episode).map(p=><PollCard key={p.id+':'+user?.uid} poll={p}/>)}</div>
        <CommentThread recap={recap} key={recap.id+':'+user?.uid}/>
      </>}
    </div>
  </main>;
}
