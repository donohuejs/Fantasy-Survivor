'use client';
import {Suspense,useEffect,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {SiteHeader} from '../site-header';
import {useGame} from '../game-provider';
import {usePolls,useRecaps} from './community-client';
import {PollCard,PreviousPolls,ScoringSummary,WhoHasWhat} from './episode-content';
import {discussionRequest,useDiscussions} from '../discussion-provider';
import {DiscussionAccess,EpisodeDiscussion,SpoilerSettings,SpoilerWarning,UnreadBadge,WatchedControl} from '../discussion-content';
import type {EpisodeRecap} from '@/lib/community';
import {availableEpisodeNumbers,currentSeasonOpenPolls,episodeActions,episodePolls,pollDeepLinkTarget,type LeaguePoll} from '@/lib/community';
import {currentEpisodeStatus} from '@/lib/scoring';
import {pollElementId} from '@/lib/homepage';

export default function Episodes(){return <Suspense fallback={<main className="loading-screen">Loading episodes…</main>}><EpisodesContent/></Suspense>;}

function EpisodesContent(){
  const {game,user}=useGame(),discussions=useDiscussions(),recaps=useRecaps(false,!discussions.eligible),polls=usePolls();
  const searchParams=useSearchParams(),pollId=searchParams.get('poll')??'';
  const [seasonChoice,setSeason]=useState<number|null>(null),[selected,setSelected]=useState('');
  const deepLink=pollDeepLinkTarget(polls.rows,recaps.rows,pollId);
  const season=seasonChoice??deepLink?.poll.season??game.season.number;
  const catalog=discussions.catalog;
  const recapRows=discussions.eligible?(catalog?.episodes.flatMap(item=>item.recap?[item.recap]:[])??[]):recaps.rows;
  const requestedId=searchParams.get('episode')??'',requestedSeason=/^([1-9]\d*)-[1-9]\d*$/.test(requestedId)?Number(requestedId.split('-')[0]):null;
  const visibleSeason=seasonChoice??requestedSeason??season;
  const seasons=[...new Set([game.season.number,...recapRows.map(r=>r.season),...polls.rows.map(p=>p.season),...(catalog?.episodes.map(item=>item.season)??[])])].sort((a,b)=>b-a);
  const episodeNumbers=[...new Set([...availableEpisodeNumbers(game,recapRows,polls.rows,visibleSeason),...(catalog?.episodes.filter(item=>item.season===visibleSeason).map(item=>item.episode)??[])])].sort((a,b)=>b-a);
  const publishedRecaps=new Map(recapRows.filter(recap=>recap.season===visibleSeason).map(recap=>[recap.episode,recap] as const));
  const episodes=episodeNumbers.map(episode=>({episode,recap:publishedRecaps.get(episode)}));
  const requestedEpisode=selected?Number(selected):requestedId&&visibleSeason===requestedSeason?Number(requestedId.split('-')[1]):deepLink?.poll.episode||undefined;
  const latestAvailable=catalog?.episodes.find(item=>item.season===visibleSeason&&item.available)?.episode;
  const episode=episodes.find(item=>item.episode===requestedEpisode)??episodes.find(item=>item.episode===latestAvailable)??episodes.find(item=>item.episode===game.season.currentEpisode)??episodes[0];
  const episodeId=episode?`${visibleSeason}-${episode.episode}`:'',view=catalog?.episodes.find(item=>item.id===episodeId);
  const hidden=Boolean(view?.spoilerHidden&&!discussions.revealed.has(episodeId));
  const [revealedRecap,setRevealedRecap]=useState<{id:string;recap:EpisodeRecap|null}>({id:'',recap:null});
  const [revealError,setRevealError]=useState('');
  useEffect(()=>{
    if(!view?.spoilerHidden||hidden||!episodeId)return;
    const abort=new AbortController();
    discussionRequest<{recap:EpisodeRecap|null}>({view:'recap',episodeId,reveal:true},true,abort.signal).then(result=>{setRevealedRecap({id:episodeId,...result});setRevealError('');}).catch(error=>{if(!abort.signal.aborted)setRevealError(error instanceof Error?error.message:'Could not load recap.');});
    return()=>abort.abort();
  },[view?.spoilerHidden,hidden,episodeId,discussions.revision]);
  const recap=episode?.recap??(revealedRecap.id===episodeId?revealedRecap.recap:null);
  const livePolls=currentSeasonOpenPolls(polls.rows,game.season.number);
  const selectedPolls=episode?episodePolls(polls.rows,visibleSeason,episode.episode):{open:[],closed:[]};
  const liveActions=episode?episodeActions(game,episode.episode):[];
  const eliminatedRecipients=new Set(game.castaways.filter(castaway=>castaway.status==='voted-out').map(castaway=>castaway.name));
  const currentEpisode=visibleSeason===game.season.number&&episode?.episode===game.season.currentEpisode;
  const inProgress=currentEpisode&&currentEpisodeStatus(game)==='in-progress';
  const deepLinkPollId=deepLink?.poll.id??'',deepLinkSeason=deepLink?.poll.season??null,deepLinkRecapId=deepLink?.recapId??'';
  useEffect(()=>{
    if(!deepLinkPollId||season!==deepLinkSeason||deepLinkRecapId&&(recap?.id!==deepLinkRecapId))return;
    const target=document.getElementById(pollElementId(deepLinkPollId));
    if(!target)return;
    const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({behavior:reducedMotion?'auto':'smooth',block:'center'});
    target.focus({preventScroll:true});
    target.classList.add('league-poll-highlight');
    const timer=window.setTimeout(()=>{target.classList.remove('league-poll-highlight');if(document.activeElement===target)target.blur();},2400);
    return()=>{window.clearTimeout(timer);target.classList.remove('league-poll-highlight');if(document.activeElement===target)target.blur();};
  },[deepLinkPollId,deepLinkSeason,deepLinkRecapId,season,recap?.id]);
  return <main className="inner-page"><SiteHeader active="/episodes" subtitle="Recaps, comments & league votes"/>
    <section className="community-heading"><p className="eyebrow dark">Around the campfire</p><h1>Episodes & league votes</h1><p>Official scoring, the game master’s take, and your side of the story. Discussions open independently of scoring.</p><label>Season<select value={visibleSeason} onChange={e=>{setSeason(Number(e.target.value));setSelected('');}}>{seasons.map(n=><option key={n} value={n}>Survivor {n}</option>)}</select></label><SpoilerSettings/></section>
    <div className="community-shell">{catalog?.hideSpoilers&&catalog.episodes.some(item=>item.season===game.season.number&&item.episode===game.season.currentEpisode&&item.spoilerHidden)?<p className="community-note">Live inventory hidden while the current episode is unwatched.</p>:<WhoHasWhat/>}{recaps.error&&<p role="alert" className="setup-notice">{recaps.error}</p>}{polls.error&&<p role="alert" className="setup-notice">{polls.error}</p>}{discussions.error&&<p role="alert">{discussions.error} <button onClick={()=>void discussions.refresh()}>Retry</button></p>}{discussions.loading&&<p role="status">Loading discussions…</p>}
      {recaps.loading&&<p role="status">Loading episode recaps…</p>}
      {!recaps.loading&&!recaps.error&&!episodes.length&&<section className="recap-empty"><h2>No published recaps yet</h2><p>The game master can publish Episode 1 after entering its scoring actions.</p></section>}
      {episode&&<nav className="episode-picker" aria-label="Choose an episode">{episodes.map(item=><button key={`${visibleSeason}-${item.episode}`} aria-pressed={item.episode===episode.episode} onClick={()=>setSelected(String(item.episode))}>Episode {item.episode} <UnreadBadge count={catalog?.episodes.find(view=>view.id===`${visibleSeason}-${item.episode}`)?.unreadCount??0}/></button>)}</nav>}
      {livePolls.length>0&&<Link className="episodes-live-poll" href={`/episodes?poll=${encodeURIComponent(livePolls[0].id)}`} aria-label="Jump to the live poll"><span><i aria-hidden="true">●</i> Live poll</span><strong>Vote now <span aria-hidden="true">→</span></strong>{livePolls.length>1&&<small>{livePolls.length} live polls</small>}</Link>}
      {view&&<WatchedControl episode={view}/>}{hidden&&view&&<SpoilerWarning episode={view}/>}{revealError&&!hidden&&<p role="alert">{revealError}</p>}
      {!hidden&&(!discussions.eligible||catalog)&&recap&&<>
        <article className="episode-recap"><header><p className="eyebrow dark">Season {recap.season} · Episode {recap.episode}</p><h2>{recap.title}</h2><p className="community-note">Updated {new Date(recap.updatedAt).toLocaleString()}</p></header>{recap.body&&<section><h3>Game master’s commentary</h3><p className="community-prose">{recap.body}</p></section>}<ScoringSummary recap={recap.season===game.season.number?{...recap,actions:episodeActions(game,recap.episode)}:recap} eliminatedRecipients={recap.season===game.season.number?eliminatedRecipients:undefined}/></article>
        {view?<EpisodeDiscussion episode={view} initialThread={searchParams.get('thread')??''} key={view.id+':'+user?.uid}/>:<DiscussionAccess/>}
        <EpisodePolls polls={selectedPolls}/>
      </>}
      {!hidden&&(!discussions.eligible||catalog)&&episode&&!recap&&<>
        <section className="recap-empty"><p className="eyebrow dark">Season {season} · Episode {episode.episode}</p><h2>{inProgress?`Episode ${episode.episode} is in progress`:'Recap coming soon'}</h2><p>{inProgress?'This episode has started. Public scoring activity is shown below; the written recap will be posted later.':'This episode is available in the season timeline. The game master has not published its written recap yet.'}</p><ScoringSummary recap={{actions:liveActions}} live eliminatedRecipients={season===game.season.number?eliminatedRecipients:undefined}/></section>
        {view?<EpisodeDiscussion episode={view} initialThread={searchParams.get('thread')??''} key={view.id+':'+user?.uid}/>:<DiscussionAccess/>}
        <EpisodePolls polls={selectedPolls}/>
      </>}
      {!episode&&!recap&&livePolls.length>0&&<EpisodePolls polls={{open:livePolls,closed:[]}}/>}
    </div>
  </main>;
}

function EpisodePolls({polls}:{polls:{open:LeaguePoll[];closed:LeaguePoll[]}}){
  if(!polls.open.length&&!polls.closed.length)return null;
  return <section className="episode-polls" aria-labelledby="episode-polls-title"><div className="episode-polls-heading"><div><p className="eyebrow dark">Poll interaction & history</p><h3 id="episode-polls-title">Polls</h3></div>{polls.open.length>0&&<span>Live now</span>}</div>
    {polls.open.length>0&&<div className="community-polls">{polls.open.map(poll=><PollCard poll={poll} key={poll.id}/>)}</div>}
    <PreviousPolls key={polls.closed.map(poll=>poll.id).join('|')} polls={polls.closed}/>
  </section>;
}
