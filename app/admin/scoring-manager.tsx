'use client';

import {useRef,useState,type FormEvent} from 'react';
import type {Castaway,Category,Tribe} from '@/lib/game-data';
import {episodeActions} from '@/lib/community';
import {previewTribalCouncil,recipients,tribalCouncilResolutionKey} from '@/lib/scoring';
import {useGame} from '../game-provider';

const messageOf=(error:unknown)=>error instanceof Error?error.message:'Unable to save. Please try again.';
const pointsText=(points:number)=>`${points>0?'+':''}${points}`;
const managedCategoryIds=new Set(['still-on-island','first-tribal-council','survive-tribal','voted-premerge']);

function phaseLabel(game:ReturnType<typeof useGame>['game']){
  return game.season.mergeEpisode!==undefined&&game.season.currentEpisode>=game.season.mergeEpisode?'Merged':'Pre-Merge';
}
function availableAction(game:ReturnType<typeof useGame>['game'],category:Category){
  if(category.retired||category.bulkOnly||managedCategoryIds.has(category.id))return false;
  if(category.phase==='pre-merge'&&game.season.mergeEpisode!==undefined&&game.season.currentEpisode>=game.season.mergeEpisode)return false;
  if(category.phase==='merge-only'&&(game.season.mergeEpisode===undefined||game.season.currentEpisode<game.season.mergeEpisode))return false;
  return true;
}

export function ScoringManager(){
  const {game,loading,startEpisode,addScore,resolveTribalCouncil,addCastawayBonus,addCustomAction}=useGame();
  const [startBusy,setStartBusy]=useState(false),[startMessage,setStartMessage]=useState(''),[startError,setStartError]=useState('');
  const [customBusy,setCustomBusy]=useState(false),[customError,setCustomError]=useState(''),[customMessage,setCustomMessage]=useState('');
  const active=game.castaways.filter(castaway=>castaway.status==='active');
  const nextEpisode=game.season.episodeStarted?game.season.currentEpisode+1:game.season.currentEpisode;
  const actions=game.categories.filter(category=>availableAction(game,category));
  async function beginEpisode(){
    if(startBusy||!active.length)return;
    setStartBusy(true);setStartMessage('');setStartError('');
    try{await startEpisode({episode:nextEpisode,expectedActiveCastawayIds:active.map(castaway=>castaway.id)});setStartMessage(`Episode ${nextEpisode} is in progress. ${active.length} active castaways received +1.`);}
    catch(error){setStartError(messageOf(error));}finally{setStartBusy(false);}
  }
  async function custom(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(customBusy)return;
    const form=event.currentTarget,data=new FormData(form);setCustomBusy(true);setCustomError('');setCustomMessage('');
    try{await addCustomAction({label:String(data.get('label')??''),points:Number(data.get('points')),target:String(data.get('target')) as Category['target']});form.reset();setCustomMessage('Reusable scoring rule saved. It is now available in the matching action bucket.');}
    catch(error){setCustomError(messageOf(error));}finally{setCustomBusy(false);}
  }
  return <section className="scoring-manager">
    <article className="admin-panel accent-panel episode-control">
      <div className="admin-panel-title"><span>{game.season.episodeStarted?'▶':'01'}</span><div><p>Episode workflow</p><h2>{game.season.episodeStarted?`Episode ${game.season.currentEpisode} · In Progress`:`Episode ${nextEpisode} has not started`}</h2></div></div>
      {game.season.episodeStarted?<p className="episode-status-line"><strong>{phaseLabel(game)}</strong>{game.season.mergeEpisode!==undefined&&<> · Merge begins at Episode {game.season.mergeEpisode}</>} · {active.length} active castaway{active.length===1?'':'s'}</p>:<><p>Start the episode once. Every active castaway will receive <strong>Still on the island · +1</strong> atomically, and ordinary scoring will use Episode {nextEpisode} automatically.</p><p className="score-preview"><strong>{active.length} active castaways will receive +1 for appearing.</strong>{active.length>0&&<span>{active.map(castaway=>castaway.name).join(', ')}</span>}</p><button type="button" className="primary-button" disabled={loading||startBusy||!active.length} onClick={beginEpisode}>{startBusy?'Starting…':`Start Episode ${nextEpisode}`}</button></>}
      {!active.length&&<p className="scoring-error">There are no active castaways available to start an episode.</p>}
      {startError&&<p role="alert" className="scoring-error">{startError}</p>}{startMessage&&<p role="status" className="success-banner">{startMessage}</p>}
    </article>
    {game.season.episodeStarted?<div className="admin-grid scoring-buckets">
      <ActionBucket title="Individual Actions" description="Choose what happened to one castaway, preview the points, and confirm." target="individual" actions={actions} onScore={addScore} game={game} loading={loading}/>
      <div className="scoring-tribal-column"><ActionBucket title="Tribal Actions" description="Award tribe-wide challenge and reward outcomes from current live membership." target="tribe" actions={actions} onScore={addScore} game={game} loading={loading}/><ResolveTribalCouncil game={game} loading={loading} onResolve={resolveTribalCouncil}/></div>
    </div>:<div className="admin-panel scoring-not-started"><h2>Scoring opens when the episode starts</h2><p>Start Episode {nextEpisode} to unlock Individual Actions, Tribal Actions, and the Tribal Council resolver.</p></div>}
    {game.season.episodeStarted&&<div className="admin-grid scoring-support"><CastawayBonus game={game} loading={loading} onSave={addCastawayBonus}/><details className="admin-panel"><summary>Manage scoring rules</summary><p>Create a reusable custom category for an event that may happen more than once. This does not award points until you use it from an action bucket.</p><form className="admin-form" onSubmit={custom}><label className="wide">Action name<input name="label" required maxLength={100} placeholder="Win a surprise fire-making challenge"/></label><label>Points per castaway<input name="points" type="number" step="0.01" required placeholder="5 or -3"/></label><label>Applies to<select name="target"><option value="individual">Individual castaway</option><option value="tribe">Whole active tribe</option></select></label><button className="secondary-button wide" disabled={customBusy}>{customBusy?'Saving…':'Save reusable action'}</button></form>{customError&&<p role="alert" className="scoring-error">{customError}</p>}{customMessage&&<p role="status" className="success-banner">{customMessage}</p>}</details></div>}
    <EpisodeActivity game={game}/>
  </section>;
}

function ActionBucket({title,description,target,actions,onScore,game,loading}:{title:string;description:string;target:Category['target'];actions:Category[];onScore:(input:Parameters<ReturnType<typeof useGame>['addScore']>[0])=>Promise<void>;game:ReturnType<typeof useGame>['game'];loading:boolean}){
  const matching=actions.filter(category=>category.target===target);
  const [actionId,setActionId]=useState(matching[0]?.id??''),[recipientId,setRecipientId]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
  const batchId=useRef<string|null>(null);
  const selectedActionId=matching.some(category=>category.id===actionId)?actionId:(matching[0]?.id??'');
  const action=matching.find(category=>category.id===selectedActionId);
  const choices=action?.target==='tribe'?game.tribes:game.castaways.filter(castaway=>action?.recipientStatus?castaway.status===action.recipientStatus:castaway.status==='active');
  let selected:Castaway[]=[];
  if(action&&recipientId){try{selected=recipients(game,action,recipientId);}catch{selected=[];}}
  async function record(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy||!action||!selected.length)return;
    const data=new FormData(event.currentTarget);setBusy(true);setNotice('');setError('');batchId.current??=crypto.randomUUID();
    try{await onScore({categoryId:action.id,recipientId,episode:game.season.currentEpisode,note:String(data.get('note')??''),expectedRecipientIds:selected.map(castaway=>castaway.id),batchId:batchId.current});setNotice(`${action.label}: ${pointsText(action.points)} saved for ${selected.length} castaway${selected.length===1?'':'s'}.`);setRecipientId('');batchId.current=null;}
    catch(error){setError(messageOf(error));}finally{setBusy(false);}
  }
  return <article className="admin-panel scoring-bucket"><div className="admin-panel-title"><span>{target==='individual'?'I':'T'}</span><div><p>{target==='individual'?'What happened to a castaway':'What happened to a tribe'}</p><h2>{title}</h2></div></div><p>{description}</p>{!matching.length?<p className="admin-feedback">No actions are available for the current {phaseLabel(game)} phase.</p>:<form onSubmit={record} onChange={()=>{batchId.current=null;}} className="admin-form"><fieldset disabled={busy||loading} className="scoring-fields"><label className="wide">Action<select value={selectedActionId} onChange={event=>{setActionId(event.target.value);setRecipientId('');}} required>{matching.map(category=><option key={category.id} value={category.id}>{pointsText(category.points)} · {category.label}</option>)}</select></label><label className="wide">{target==='tribe'?'Tribe':'Castaway'}<select value={recipientId} onChange={event=>setRecipientId(event.target.value)} required><option value="">Choose {target==='tribe'?'a tribe':'a castaway'}…</option>{choices.map(choice=><option value={choice.id} key={choice.id}>{target==='tribe'?`${choice.name} (${game.castaways.filter(castaway=>castaway.tribeId===choice.id&&castaway.status==='active').length} active)`:choice.name}</option>)}</select></label><div className="score-preview wide" aria-live="polite">{selected.length>0?<><strong>{pointsText(action?.points??0)} per castaway · {selected.length} recipient{selected.length===1?'':'s'}</strong><span>{selected.map(castaway=>castaway.name).join(', ')}</span></>:<p>{recipientId?'No eligible recipients. Review the current membership and action constraints.':'Choose an action and recipient to preview the award.'}</p>}</div><label className="wide">Note (optional)<input name="note" maxLength={500} placeholder="Challenge, reward, or explanation"/></label><button disabled={!selected.length||!action} className="primary-button wide">{busy?'Saving…':'Preview & confirm points'}</button></fieldset></form>}{error&&<p role="alert" className="scoring-error">{error}</p>}{notice&&<p role="status" className="success-banner">{notice}</p>}</article>;
}

function ResolveTribalCouncil({game,loading,onResolve}:{game:ReturnType<typeof useGame>['game'];loading:boolean;onResolve:(input:Parameters<ReturnType<typeof useGame>['resolveTribalCouncil']>[0])=>Promise<void>}){
  const [tribeId,setTribeId]=useState(''),[eliminatedId,setEliminatedId]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const tribe=game.tribes.find(item=>item.id===tribeId);
  const attendees=game.castaways.filter(castaway=>castaway.tribeId===tribeId&&castaway.status==='active');
  const resolved=Boolean(tribeId&&game.scoreEvents.some(event=>event.awardKey===tribalCouncilResolutionKey(game,tribeId,game.season.currentEpisode)||event.batchId===tribalCouncilResolutionKey(game,tribeId,game.season.currentEpisode)));
  let preview:ReturnType<typeof previewTribalCouncil>|undefined;
  let previewError='';
  if(tribe&&eliminatedId&&!resolved){try{preview=previewTribalCouncil(game,{tribeId,eliminatedCastawayId:eliminatedId,episode:game.season.currentEpisode,note:'',expectedAttendeeIds:attendees.map(castaway=>castaway.id)});}catch(error){previewError=messageOf(error);}}
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy||!preview)return;const data=new FormData(event.currentTarget);setBusy(true);setMessage('');setError('');
    try{await onResolve({tribeId,eliminatedCastawayId:eliminatedId,episode:game.season.currentEpisode,note:String(data.get('note')??''),expectedAttendeeIds:attendees.map(castaway=>castaway.id),expectedFirstTimeAttendeeIds:preview.firstTimeAttendees.map(castaway=>castaway.id),expectedPreMerge:preview.preMerge,expectedTribeName:preview.tribe.name});setMessage(`${tribe?.name} Tribal Council resolved transactionally.`);setTribeId('');setEliminatedId('');}
    catch(error){setError(messageOf(error));}finally{setBusy(false);}
  }
  return <article className="admin-panel accent-panel tribal-resolution"><div className="admin-panel-title"><span>TC</span><div><p>One confirmation</p><h2>Resolve Tribal Council</h2></div></div><p>Choose the attending tribe and who was eliminated. First attendance, elimination, status, and pre-merge survival are inferred from the live roster.</p>{resolved&&<p className="admin-feedback">This tribe’s Tribal Council is already resolved for Episode {game.season.currentEpisode}.</p>}<form className="admin-form" onSubmit={submit}><label>Tribe<select value={tribeId} onChange={event=>{setTribeId(event.target.value);setEliminatedId('');}} required><option value="">Choose a tribe…</option>{game.tribes.map(item=><option key={item.id} value={item.id}>{item.name} ({game.castaways.filter(castaway=>castaway.tribeId===item.id&&castaway.status==='active').length} active)</option>)}</select></label><label>Castaway eliminated<select value={eliminatedId} onChange={event=>setEliminatedId(event.target.value)} required><option value="">Choose a castaway…</option>{attendees.map(castaway=><option key={castaway.id} value={castaway.id}>{castaway.name}</option>)}</select></label>{preview&&<div className="score-preview wide" aria-live="polite"><strong>{preview.tribe.name} Tribal Council · Episode {preview.episode} · {preview.preMerge?'Pre-Merge':'Merged'}</strong><h3>First Tribal attendance · +{preview.episode}</h3><p>{preview.firstTimeAttendees.length?preview.firstTimeAttendees.map(castaway=>`${castaway.name} +${preview!.episode}`).join(' · '):'No first-time attendees.'}</p>{preview.preMerge&&<><h3>Survive Tribal · +1</h3><p>{preview.survivingAttendees.map(castaway=>`${castaway.name} +1`).join(' · ')||'No remaining active castaways.'}</p><h3>Eliminated{preview.eliminated?' · -1':''}</h3><p>{preview.eliminated.name} {preview.preMerge?'-1':''}</p></>}</div>}{previewError&&<p className="scoring-error wide" role="alert">{previewError}</p>}<label className="wide">Note (optional)<input name="note" maxLength={500} placeholder="What happened at Tribal Council?"/></label><button className="primary-button wide" disabled={loading||busy||!preview||resolved}>{busy?'Resolving…':resolved?'Already resolved':'Preview & resolve Tribal Council'}</button></form>{error&&<p className="scoring-error" role="alert">{error}</p>}{message&&<p className="success-banner" role="status">{message}</p>}</article>;
}

function CastawayBonus({game,loading,onSave}:{game:ReturnType<typeof useGame>['game'];loading:boolean;onSave:(input:Parameters<ReturnType<typeof useGame>['addCastawayBonus']>[0])=>Promise<void>}){
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');const batchId=useRef<string|null>(null);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;const form=event.currentTarget,data=new FormData(form);setBusy(true);setMessage('');setError('');batchId.current??=crypto.randomUUID();try{await onSave({castawayId:String(data.get('castawayId')),episode:game.season.currentEpisode,points:Number(data.get('points')),note:String(data.get('note')??''),batchId:batchId.current});setMessage('One-time castaway adjustment saved.');form.reset();batchId.current=null;}catch(error){setError(messageOf(error));}finally{setBusy(false);}}
  return <details className="admin-panel"><summary>One-time castaway adjustment</summary><p>Use this for a single positive or negative correction. It is not saved as a reusable scoring rule.</p><form className="admin-form" onSubmit={submit} onChange={()=>{batchId.current=null;}}><label className="wide">Castaway<select name="castawayId" required><option value="">Choose a castaway…</option>{game.castaways.map(castaway=><option key={castaway.id} value={castaway.id}>{castaway.name}{castaway.status==='voted-out'?' · voted out':''}</option>)}</select></label><label>Points<input name="points" type="number" step=".01" defaultValue="1" required/></label><label className="wide">Reason<input name="note" maxLength={500} required placeholder="Required reason"/></label><button className="secondary-button wide" disabled={loading||busy}>{busy?'Saving…':'Save adjustment for current episode'}</button></form>{error&&<p className="scoring-error" role="alert">{error}</p>}{message&&<p className="success-banner" role="status">{message}</p>}</details>;
}

function EpisodeActivity({game}:{game:ReturnType<typeof useGame>['game']}){
  const actions=game.season.episodeStarted?episodeActions(game,game.season.currentEpisode):[];
  return <section className="setup-section episode-activity"><p className="eyebrow dark">Current episode</p><h2>Episode Activity</h2><p>Only scoring recorded for Episode {game.season.currentEpisode} appears here. The complete Activity Log remains available in its own tab.</p><article className="admin-panel"><div className="event-list">{actions.map(action=><div key={action.id}><span><strong>{action.tribeName?`${action.tribeName} · `:''}{action.label}</strong><small>{pointsText(action.points)} · {action.recipients.length} castaway{action.recipients.length===1?'':'s'}{action.note?' · '+action.note:''}</small><small>{action.recipients.join(', ')}</small></span><b className={action.points<0?'negative':''}>{pointsText(action.points)}</b></div>)}{!actions.length&&<p className="admin-empty">No scoring activity has been recorded for this episode yet.</p>}</div></article></section>;
}

function TribeEditor({tribe}:{tribe?:Tribe}){
  const {updateTribe}=useGame();const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;const form=event.currentTarget;const data=new FormData(form);setBusy(true);setMessage('');try{await updateTribe({id:tribe?.id??crypto.randomUUID(),name:String(data.get('name')),color:String(data.get('color'))});setMessage('Tribe saved.');if(!tribe)form.reset();}catch(error){setMessage(messageOf(error));}finally{setBusy(false);}}
  return <form className="mini-form" onSubmit={submit}><h3>{tribe?'Edit '+tribe.name:'Add a tribe'}</h3><label>Tribe name<input name="name" defaultValue={tribe?.name??''} required maxLength={60}/></label><label>Color<input type="color" name="color" defaultValue={tribe?.color??'#267464'}/></label><button disabled={busy}>{busy?'Saving…':'Save tribe'}</button><p role="status">{message}</p></form>;
}

function MembershipRow({castaway}:{castaway:Castaway}){
  const {game,updateCastaway}=useGame();const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;const data=new FormData(event.currentTarget);setBusy(true);setMessage('');try{await updateCastaway(castaway.id,String(data.get('tribeId')),String(data.get('status')) as Castaway['status']);setMessage('Saved.');}catch(error){setMessage(messageOf(error));}finally{setBusy(false);}}
  return <form className="membership-row" onSubmit={submit}><strong>{castaway.name}</strong><label>Tribe<select name="tribeId" defaultValue={castaway.tribeId??''}><option value="">Unassigned</option>{game.tribes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Status<select name="status" defaultValue={castaway.status}><option value="active">Active</option><option value="voted-out">Voted out / eliminated</option></select></label><button disabled={busy}>{busy?'Saving…':'Save member'}</button><small role="status">{message}</small></form>;
}

export function TribeManagement(){
  const {game}=useGame();
  return <section className="setup-section"><h2>Tribes & castaway membership</h2><p>{game.season.number===51?'Savu is purple and Toka is yellow. Starting memberships are unconfirmed; assign them here when known.':'Add this season’s tribes and assign their members.'} Update these after swaps and eliminations. Existing points never move with a castaway.</p><div className="tribe-summaries">{game.tribes.map(t=><div key={t.id} className="tribe-summary" style={{borderLeftColor:t.color}}><strong>{t.name}</strong><span>{game.castaways.filter(c=>c.tribeId===t.id&&c.status==='active').length} active members</span></div>)}</div><details><summary>Edit tribe names, colors, or add a tribe</summary><div className="setup-grid">{game.tribes.map(t=><TribeEditor key={t.id} tribe={t}/>)}<TribeEditor/></div></details><div className="membership-list">{game.castaways.map(c=><MembershipRow key={c.id} castaway={c}/>)}</div></section>;
}
