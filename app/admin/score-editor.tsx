'use client';

import {useEffect,useRef,useState} from 'react';
import type {GameState,ScoreEvent} from '@/lib/game-data';
import {scoringActions,scoringVersion,effectiveScorePoints} from '@/lib/score-ledger';
import {correctionEntrySummary,type ScoreCorrection,type ScoreCorrectionCommand,type ScoreCorrectionPreview} from '@/lib/score-corrections';
import {useGame} from '../game-provider';
import {PlayerName} from '../player-name';

const points=(value:number)=>`${value>0?'+':''}${value}`;
type Selection={eventId:string;scope:'action'|'entry';kind:'edit'|'undo'};

export function ScoringHistory({game,episodeActivity=false}:{game:GameState;episodeActivity?:boolean}){
  const {loading}=useGame();
  const [episode,setEpisode]=useState(game.season.currentEpisode),[selection,setSelection]=useState<Selection|null>(null),[message,setMessage]=useState(''),[limit,setLimit]=useState(50);
  const episodes=[...new Set([game.season.currentEpisode,...game.scoreEvents.map(e=>e.episode).filter((e):e is number=>e!==undefined)])].sort((a,b)=>b-a);
  const actions=scoringActions(game,episode),events=game.scoreEvents.slice(-limit).reverse();
  const label=(event:ScoreEvent)=>event.actionLabel||game.categories.find(c=>c.id===event.categoryId)?.label||'Player adjustment';
  const controls=(event:ScoreEvent,scope:'action'|'entry',reversed:boolean)=><div className="score-history-controls"><button type="button" disabled={loading||game.season.finalized||reversed} onClick={()=>{setMessage('');setSelection({eventId:event.id,scope,kind:'edit'});}}>{scope==='action'?'Edit':'Correct entry'}</button><button type="button" disabled={loading||game.season.finalized||reversed} onClick={()=>{setMessage('');setSelection({eventId:event.id,scope,kind:'undo'});}}>{scope==='action'?'Undo':'Reverse entry'}</button>{event.correctionId&&<ScoreAudit key={event.correctionId} eventId={event.id}/>}</div>;
  return <section className={`setup-section ${episodeActivity?'episode-activity':''}`}>
    <p className="eyebrow dark">{episodeActivity?'Episode scoring':'Activity log'}</p><h2>{episodeActivity?'Episode Activity':'Scoring entries'}</h2>
    {episodeActivity?<label className="score-episode-select">Episode<select aria-label="Episode" value={episode} onChange={e=>setEpisode(Number(e.target.value))}>{episodes.map(value=><option key={value} value={value}>Episode {value}</option>)}</select></label>:<p>Showing the latest {Math.min(limit,game.scoreEvents.length)} of {game.scoreEvents.length} entries. Corrections retain the original award in the audit history.</p>}
    {message&&<p role="status" className="success-banner">{message}</p>}
    <article className="admin-panel"><div className="event-list score-history">
      {episodeActivity?actions.map(action=>{
        const first=action.events[0],reversed=!action.active.length,corrected=action.events.some(e=>e.correctionId);
        const values=[...new Set(action.active.map(e=>e.points))];
        return <div key={action.id} className="score-history-row"><div className="score-history-description"><strong>{first.tribeName?`${first.tribeName} · `:''}{label(first)}</strong><small>{action.active.length} recipient{action.active.length===1?'':'s'} · {values.length===1?points(values[0])+' each':reversed?'0 effective points':'Varied points'}{corrected?` · ${reversed?'Reversed':'Corrected'}`:''}</small><small>{(reversed?action.events:action.active).map((e,index)=><span key={e.id}>{index>0?', ':''}<ScoreRecipient game={game} event={e}/></span>)}</small>{first.note&&<small>{first.note}</small>}{controls(first,'action',reversed)}</div></div>;
      }):events.map(event=><div key={event.id} className="score-history-row"><div className="score-history-description"><strong><ScoreRecipient game={game} event={event}/></strong><small>{label(event)}{game.castaways.find(c=>c.id===event.castawayId)?.status==='voted-out'?' · Eliminated':''}{event.tribeName?' · '+event.tribeName:''}{event.episode?' · Episode '+event.episode:''}{event.note?' · '+event.note:''}</small>{event.correctionId&&<small className="score-correction-status">{event.scoringStatus==='reversed'?`Reversed · original award ${points(event.points)}`:'Corrected'} · {event.correctedAt&&new Date(event.correctedAt).toLocaleString()}</small>}{controls(event,'entry',event.scoringStatus==='reversed')}</div><b className={effectiveScorePoints(event)<0?'negative':''}>{points(effectiveScorePoints(event))}</b></div>)}
      {(episodeActivity?!actions.length:!events.length)&&<p className="admin-empty">No scoring activity recorded.</p>}
    </div>{!episodeActivity&&limit<game.scoreEvents.length&&<button type="button" className="secondary-button" onClick={()=>setLimit(current=>current+50)}>Show older entries</button>}</article>
    {selection&&<ScoreEditor key={`${selection.eventId}:${selection.scope}:${selection.kind}`} game={game} selection={selection} onClose={()=>setSelection(null)} onSaved={()=>{setSelection(null);setMessage(selection.kind==='undo'?'Scoring reversed. Totals and standings recalculated.':'Correction saved. Totals and standings recalculated.');}}/>}
  </section>;
}

function ScoreRecipient({game,event}:{game:GameState;event:ScoreEvent}){
  const player=game.players.find(p=>p.id===event.playerId),castaway=game.castaways.find(c=>c.id===event.castawayId);
  return <span className={castaway?.status==='voted-out'?'membership-row-eliminated':''}>{player?<PlayerName id={player.id} name={player.name} history={game.history}/>:event.recipientName||castaway?.name||'Unknown recipient'}</span>;
}

function ScoreAudit({eventId}:{eventId:string}){
  const {scoreHistory}=useGame();const [rows,setRows]=useState<ScoreCorrection[]|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function load(){setBusy(true);setError('');try{setRows(await scoreHistory(eventId));}catch(error){setError(error instanceof Error?error.message:'Unable to load history.');}finally{setBusy(false);}}
  return <details className="score-audit"><summary onClick={()=>{if(!rows&&!busy)void load();}}>Audit history</summary>{busy&&<p>Loading…</p>}{error&&<p role="alert">{error} <button type="button" onClick={load}>Retry</button></p>}{rows?.map(row=><div key={row.id}><strong>{row.kind==='undo'?'Reversed':'Corrected'} · {new Date(row.at).toLocaleString()}</strong><p>{row.reason}</p><p>Before: {correctionEntrySummary(row.before)}</p><p>After: {correctionEntrySummary(row.after)}</p><small>Commissioner correction · {row.id}</small></div>)}</details>;
}

function ScoreEditor({game,selection,onClose,onSaved}:{game:GameState;selection:Selection;onClose:()=>void;onSaved:()=>void}){
  const {correctScore}=useGame();
  // Freeze what was opened. Live updates must not replace the commissioner's selection.
  const [opened]=useState(game),event=opened.scoreEvents.find(e=>e.id===selection.eventId)!;
  const group=scoringActions(opened).find(action=>action.events.some(e=>e.id===event.id))!;
  const targets=selection.scope==='entry'?[event]:group.active,playerTarget=Boolean(event.playerId);
  const roster=playerTarget?opened.players:opened.castaways;
  const [recipientIds,setRecipientIds]=useState(targets.map(e=>(playerTarget?e.playerId:e.castawayId)!));
  const [pointValue,setPointValue]=useState(String(targets[0].points)),[reason,setReason]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[review,setReview]=useState<{command:ScoreCorrectionCommand;preview:ScoreCorrectionPreview}|null>(null);
  const dialog=useRef<HTMLDialogElement>(null),opId=useRef(crypto.randomUUID());
  useEffect(()=>{const node=dialog.current;node?.showModal();return()=>node?.close();},[]);
  const undo=selection.kind==='undo';
  async function preview(){
    setBusy(true);setError('');
    try{
      const command:ScoreCorrectionCommand={...selection,id:opId.current,season:opened.season.number,recipientIds,points:pointValue.trim()?Number(pointValue):NaN,reason,expectedVersion:await scoringVersion(opened)};
      const result=await correctScore(command,false);setReview({command,preview:result});
    }catch(error){setError(error instanceof Error?error.message:'Unable to review.');}finally{setBusy(false);}
  }
  async function save(){
    if(!review||busy)return;setBusy(true);setError('');
    try{await correctScore(review.command,true);onSaved();}catch(error){setError(error instanceof Error?error.message:'Unable to save.');}finally{setBusy(false);}
  }
  const change=()=>{setReview(null);opId.current=crypto.randomUUID();};
  return <dialog ref={dialog} className="score-editor" aria-labelledby="score-editor-title" onCancel={e=>{if(busy)e.preventDefault();else onClose();}}>
    <div className="score-editor-heading"><div><p className="eyebrow dark">{selection.scope==='entry'?'Individual entry':'Scoring action'} · {event.episode?'Episode '+event.episode:'Season adjustment'}</p><h2 id="score-editor-title">{undo?'Undo':'Edit'} {event.tribeName?event.tribeName+' · ':''}{event.actionLabel||opened.categories.find(c=>c.id===event.categoryId)?.label||'Adjustment'}</h2></div><button type="button" aria-label="Close scoring editor" disabled={busy} onClick={onClose}>×</button></div>
    <p>Corrections preserve the original award and recalculate totals with each fantasy pick’s multiplier.</p>
    {event.source&&event.source!=='standard'&&event.source!=='one-time-bonus'&&<p className="setup-notice">This changes scoring only. Recorded attendance, eliminations, possessions, and episode progress remain in place.</p>}
    {!review?<form className="admin-form" onSubmit={e=>{e.preventDefault();void preview();}}>
      {undo?<p className="score-preview wide">Undo will reverse {targets.length} award{targets.length===1?'':'s'}: {targets.map(e=>e.recipientName||e.castawayId||e.playerId).join(', ')}.</p>:<>
        <fieldset className="score-editor-recipients wide" disabled={busy}><legend>{recipientIds.length} selected recipient{recipientIds.length===1?'':'s'}</legend><p>Selection is based on the recorded award. Current tribe and eliminated status do not change historical eligibility.</p>
          {selection.scope==='entry'?<label>Recipient<select value={recipientIds[0]??''} onChange={e=>{setRecipientIds([e.target.value]);change();}}>{roster.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>:<div className="score-recipient-options">{[...roster].sort((a,b)=>Number(targets.some(e=>e.castawayId===b.id||e.playerId===b.id))-Number(targets.some(e=>e.castawayId===a.id||e.playerId===a.id))).map(item=><label key={item.id} className="recipient-option"><input type="checkbox" checked={recipientIds.includes(item.id)} onChange={()=>{setRecipientIds(current=>current.includes(item.id)?current.filter(id=>id!==item.id):[...current,item.id]);change();}}/><span>{item.name}{'status' in item&&item.status==='voted-out'?' · eliminated':''}</span></label>)}</div>}
        </fieldset>
        {new Set(targets.map(e=>e.points)).size>1&&<p className="setup-notice wide">This action has varied point awards. The value below will apply to every selected recipient.</p>}
        <label className="wide">Points per recipient<input type="number" step="any" min="-100000" max="100000" value={pointValue} required disabled={busy} onChange={e=>{setPointValue(e.target.value);change();}}/></label>
      </>}
      <label className="wide">Reason for {undo?'undo':'correction'}<textarea value={reason} maxLength={500} required disabled={busy} onChange={e=>{setReason(e.target.value);change();}}/></label>
      <button className="primary-button wide" disabled={busy}>{busy?'Reviewing…':'Review changes'}</button>
    </form>:<section aria-label="Correction review" className="score-correction-review"><h3>{undo?'Confirm undo':'Review correction'}</h3><p>{review.command.reason}</p>
      <div className="score-change-list">{review.preview.correction.after.filter(after=>{const before=review.preview.correction.before.find(e=>e.id===after.id);return !before||before.points!==after.points||(before.scoringStatus==='reversed')!==(after.scoringStatus==='reversed');}).map(after=>{const before=review.preview.correction.before.find(e=>e.id===after.id);return <p key={after.id}><strong>{after.recipientName||after.castawayId||after.playerId}</strong><span>{before?effectiveScorePoints(before):0} → {effectiveScorePoints(after)}{after.scoringStatus==='reversed'?' · Reverse award':!before||before.scoringStatus==='reversed'?' · Add recipient':' · Correct points'}</span></p>;})}</div>
      <p>{review.preview.correction.after.filter(e=>e.scoringStatus!=='reversed').length} recipients after saving.</p>
      {review.preview.recap&&<p className={review.preview.recap.scoringDiffersAfterSave?'setup-notice':undefined}>{review.preview.recap.exists?`The saved ${review.preview.recap.status} recap will remain unchanged.${review.preview.recap.scoringDiffersAfterSave?' Its scoring snapshot will differ from the corrected ledger. Review that snapshot separately before updating or publishing the recap.':''}`:'There is no saved episode snapshot to change.'}</p>}
      <h3>Castaway totals</h3><ImpactList rows={review.preview.correction.castaways}/><h3>Fantasy-team standings</h3><ImpactList rows={review.preview.correction.standings}/>
      <div className="episode-confirmation-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>{setReview(null);opId.current=crypto.randomUUID();}}>Back to edit</button><button type="button" className="primary-button" disabled={busy} onClick={save}>{busy?'Saving…':undo?`Confirm undo ${targets.length} award${targets.length===1?'':'s'}`:'Save correction'}</button></div>
    </section>}
    {error&&<p className="scoring-error" role="alert">{error}</p>}
  </dialog>;
}
function ImpactList({rows}:{rows:ScoreCorrection['standings']}){return rows.length?<ul className="score-impact-list">{rows.map(row=><li key={row.id}><strong>{row.name}</strong><span>{row.before} → {row.after} ({points(row.delta)})</span></li>)}</ul>:<p>No total changes.</p>;}
