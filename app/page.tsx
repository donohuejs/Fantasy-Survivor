'use client';
import Image from 'next/image';
import Link from 'next/link';
import {SiteHeader} from './site-header';
import {useGame} from './game-provider';
import {useCurrentSeasonOpenPolls} from './community-polls';
import {PlayerName} from './player-name';
import {CampfireCommentary} from './discussion-content';
import {pollVoteTotal} from '@/lib/community';
import {activeLeaderRosterCount,leaderPicks,leaderRoster,liveDraftTurn,pointsLead} from '@/lib/homepage';

const initials=(name:string)=>name.split(/\s+/).map((part)=>part[0]).join('').slice(0,2).toUpperCase();

function HomepageActions({game,openPolls}:{game:ReturnType<typeof useGame>['game'];openPolls:ReturnType<typeof useCurrentSeasonOpenPolls>['rows']}){
  const turn=liveDraftTurn(game),poll=openPolls[0];
  if(!turn&&!poll)return null;
  return <section className="homepage-actions" aria-label="League actions">
    {turn&&<Link className="homepage-action homepage-action-draft" href="/draft">
      <div className="homepage-action-heading"><span><i className="homepage-action-live-dot" aria-hidden="true"/>Live Draft</span><span className="homepage-action-arrow">→</span></div>
      <strong>{turn.playerName} is on the clock</strong>
      <p>Round {turn.round} · Pick {turn.pickNumber} · Overall #{game.draft.currentPick+1} of {game.draft.turns.length}</p>
      <span className="homepage-action-cta">Enter Draft <b>→</b></span>
    </Link>}
    {poll&&<Link className="homepage-action homepage-action-poll" href={`/episodes?poll=${encodeURIComponent(poll.id)}`}>
      <div className="homepage-action-heading"><span><i className="homepage-action-poll-icon" aria-hidden="true">◉</i>Voting Open{poll.episode?` · Episode ${poll.episode}`:''}</span><span className="homepage-action-arrow">→</span></div>
      <strong>{poll.question}</strong>
      <p>{pollVoteTotal(poll)} vote{pollVoteTotal(poll)===1?'':'s'} cast</p>
      {openPolls.length>1&&<small>+ {openPolls.length-1} more open poll{openPolls.length===2?'':'s'}</small>}
      <span className="homepage-action-cta">Vote Now <b>→</b></span>
    </Link>}
  </section>;
}

export default function Home(){
  const {game,standings,loading}=useGame();
  const {rows:openPolls}=useCurrentSeasonOpenPolls();
  const hasScores=standings.some((player)=>player.score!==0);
  const leader=hasScores?standings[0]:undefined;
  const roster=leader?leaderRoster(game,leader.id):[];
  const activeRosterCount=leader?activeLeaderRosterCount(game,leader.id):0;
  const lead=pointsLead(standings);
  if(loading)return <main className="loading-screen">Loading season…</main>;
  return <main><SiteHeader active="/" subtitle="Outwit. Outdraft. Outscore."/>
    <section className="hero"><div className="hero-intro"><Image className="hero-logo" src="/branding/survivor-51-main.jpg" width={420} height={420} alt="Survivor 51" priority/><p className="eyebrow"><span/> Survivor {game.season.number} · Episode {game.season.currentEpisode}</p><h1>The tribe has <em>spoken.</em></h1><p className="hero-copy">Every vote, challenge win, idol play, and perfectly timed blindside—scored in one place.</p></div><article className="torch-card"><span className="torch-kicker">{leader?'Current fantasy leader':`Season ${game.season.number} setup`}</span><div className="champion-row"><span className="champion-avatar">{leader?initials(leader.name):String(game.season.number)}</span><div><strong>{leader?<PlayerName id={leader.id} name={leader.name} history={game.history}/>: 'Fresh slate'}</strong><small>{leader?`${leader.score.toFixed(1)} points`:'No scores entered yet'}</small></div></div>{leader?<div className="leader-card-roster"><div className="leader-roster-heading"><span>Roster</span>{lead&&<span className="leader-card-lead"><small>{lead.kind==='tied'?'Status':'Lead'}</small><strong>{lead.kind==='tied'?'TIED':`+${lead.points.toFixed(1)} pts`}</strong></span>}</div>{roster.length?<ul>{roster.map(({pick,castaway,tribe})=>{const eliminated=castaway.status==='voted-out';return <li key={pick.id} className={eliminated?'leader-roster-eliminated':''}><span className="leader-roster-name"><i aria-hidden="true" style={!eliminated&&tribe?{backgroundColor:tribe.color}:undefined}/><span>{castaway.shortName||castaway.name}</span></span></li>;})}</ul>:<p className="leader-roster-empty">No drafted castaways recorded yet.</p>}<div className="leader-card-footer"><span>{activeRosterCount} castaway{activeRosterCount===1?'':'s'} remaining</span></div></div>:<p className="champion-setup-note">Draft rosters and fantasy points will appear here once the season gets underway.</p>}</article></section>
    <HomepageActions game={game} openPolls={openPolls}/>
    <section className="content-grid" id="standings"><div className="panel leaderboard-panel"><div className="panel-heading"><div><p className="eyebrow dark">{hasScores?'Live leaderboard':'Player roster'}</p><h2>{hasScores?'Top of the tribe':'Everyone starts at zero'}</h2></div><span className="season-button">Survivor {game.season.number}</span></div><p className="honor-legend"><span role="img" aria-label="Reigning champion">🏆</span> Reigning champion · <span role="img" aria-label="Fantasy win">★</span> each previous win</p><div className="leader-list">{standings.map((player)=>{const picks=leaderPicks(game,player.id);const pickLabels=picks.flatMap(({pick,castaway})=>{const label=castaway?.shortName??(pick.castawayId?'':'Blind pick locked');return label?[{id:pick.id,label,eliminated:castaway?.status==='voted-out'}]:[];});return <div className={`leader-row ${hasScores&&player.rank===1?'winner':''}`} key={player.id}><span className="rank">{hasScores?player.rank:'—'}</span><span className="avatar">{initials(player.name)}</span><span className="leader-name"><strong><PlayerName id={player.id} name={player.name} history={game.history}/></strong><small>{pickLabels.length?pickLabels.map((pick,index)=><span key={pick.id}>{index>0&&' · '}<span className={pick.eliminated?'leader-pick-eliminated':''}>{pick.label}</span></span>):player.picks}</small></span><span className="change">{hasScores&&player.rank<=3?'TOP':'—'}</span><strong className="score">{player.score.toFixed(1)}</strong></div>})}</div><Link className="text-link" href="/draft">See every team and draft pick <span>→</span></Link></div><aside className="side-stack"><article className="rule-callout"><span className="rule-number">1.25×</span><div><strong>Blind-pick bonus</strong><p>Keep your round-three blind castaway and their points get a 25% boost.</p></div></article></aside></section>
    <CampfireCommentary/>
    <footer><span>Fantasy Survivor</span><p>{standings.length} players · {game.castaways.length} castaways · one Sole Survivor</p></footer></main>;
}
