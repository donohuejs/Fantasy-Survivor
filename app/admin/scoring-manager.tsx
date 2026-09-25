'use client';

import {useRef,useState,type FormEvent} from 'react';
import type {Castaway,Category,Tribe} from '@/lib/game-data';
import {recipients} from '@/lib/scoring';
import {useGame} from '../game-provider';

const messageOf=(error:unknown)=>error instanceof Error?error.message:'Unable to save. Please try again.';
const pointsText=(points:number)=>`${points>0?'+':''}${points}`;

export function ScoringManager(){
  const {game,loading,addScore,addCustomAction}=useGame();
  const [actionId,setActionId]=useState('tribal-immunity');
  const [recipientId,setRecipientId]=useState('');
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const [customBusy,setCustomBusy]=useState(false);
  const [customError,setCustomError]=useState('');
  const batchId=useRef<string|null>(null);
  const actions=game.categories.filter(c=>!c.retired&&!c.bulkOnly);
  const selectedActionId=actions.some(c=>c.id===actionId)?actionId:(actions[0]?.id??'');
  const action=game.categories.find(c=>c.id===selectedActionId);
  const selected=action&&recipientId?recipients(game,action,recipientId):[];

  async function record(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy||!action)return;
    const form=event.currentTarget;const data=new FormData(form);
    setBusy(true);setNotice('');setError('');
    batchId.current??=crypto.randomUUID();
    try{
      await addScore({categoryId:action.id,recipientId,episode:Number(data.get('episode')),note:String(data.get('note')??''),expectedRecipientIds:selected.map(c=>c.id),batchId:batchId.current});
      setNotice(`${action.label}: ${pointsText(action.points)} points each saved for ${selected.length} castaway${selected.length===1?'':'s'}.`);
      setRecipientId('');batchId.current=null;
    }catch(error){setError(messageOf(error));}finally{setBusy(false);}
  }
  async function custom(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(customBusy)return;
    const form=event.currentTarget;const data=new FormData(form);
    setCustomBusy(true);setCustomError('');setNotice('');
    try{
      const id=await addCustomAction({label:String(data.get('label')??''),points:Number(data.get('points')),target:String(data.get('target')) as Category['target']});
      setActionId(id);setRecipientId('');batchId.current=null;form.reset();
      setNotice('New action saved permanently and selected above. Choose a recipient to award it now.');
    }catch(error){setCustomError(messageOf(error));}finally{setCustomBusy(false);}
  }
  return <section className="scoring-manager">
    <div className="admin-grid">
      <article className="admin-panel accent-panel">
        <div className="admin-panel-title"><span>01</span><div><p>Weekly scoring</p><h2>Record a scoring action</h2></div></div>
        <form onSubmit={record} onChange={()=>{batchId.current=null;}} className="admin-form">
          <fieldset disabled={busy||loading} className="scoring-fields">
            <label>Episode<input name="episode" type="number" min="1" step="1" defaultValue={game.season.currentEpisode} required/></label>
            <label className="wide">Action / milestone<select value={selectedActionId} onChange={e=>{setActionId(e.target.value);setRecipientId('');}} required>{actions.map(c=><option key={c.id} value={c.id}>{pointsText(c.points)} · {c.label} · {c.target==='tribe'?'Tribe':'Individual'}</option>)}</select></label>
            <label className="wide">{action?.target==='tribe'?'Tribe':'Castaway'}<select value={recipientId} onChange={e=>setRecipientId(e.target.value)} required><option value="">Choose {action?.target==='tribe'?'a tribe':'a castaway'}…</option>{action?.target==='tribe'?game.tribes.map(t=><option value={t.id} key={t.id}>{t.name} ({game.castaways.filter(c=>c.tribeId===t.id&&c.status==='active').length} active)</option>):game.castaways.map(c=><option value={c.id} key={c.id}>{c.name}{c.status==='voted-out'?' · voted out':''}</option>)}</select></label>
            <div className="score-preview wide" aria-live="polite">
              {action?.target==='tribe'&&<p>Tribe points go to current active members only. For a past episode, verify the membership and status before recording.</p>}
              {selected.length>0?<><strong>{pointsText(action?.points??0)} per castaway · {selected.length} recipient{selected.length===1?'':'s'}</strong><p>{selected.map(c=>c.name).join(', ')}</p></>:<p>{recipientId?'No active members. Assign castaways in the Tribe membership tab before scoring.':'Choose a recipient to preview the award.'}</p>}
            </div>
            <label className="wide">Note (optional)<input name="note" maxLength={500} placeholder="Immunity challenge, episode recap, or explanation"/></label>
            <button disabled={!selected.length||!action} className="primary-button wide">{busy?'Saving…':'Confirm & award points'}</button>
          </fieldset>
        </form>
        {error&&<p role="alert" className="scoring-error">{error}</p>}
        {notice&&<p role="status" className="success-banner">{notice}</p>}
      </article>
      <article className="admin-panel">
        <div className="admin-panel-title"><span>+</span><div><p>Expect the unexpected</p><h2>Create a reusable action</h2></div></div>
        <p>Save a genuinely reusable rule once. Saving alone does not award points. For a one-time castaway bonus, use the direct bonus form below instead.</p>
        <form className="admin-form" onSubmit={custom}><fieldset disabled={customBusy||loading} className="scoring-fields">
          <label className="wide">Action name<input name="label" required maxLength={100} placeholder="Win a surprise fire-making challenge"/></label>
          <label>Points per castaway<input name="points" type="number" step="0.01" required placeholder="5 or -3"/></label>
          <label>Applies to<select name="target"><option value="individual">Individual castaway</option><option value="tribe">Whole active tribe</option></select></label>
          <button className="secondary-button wide">{customBusy?'Saving…':'Save action & select it'}</button>
        </fieldset></form>
        {customError&&<p role="alert" className="scoring-error">{customError}</p>}
      </article>
    </div>
    <div className="admin-grid scoring-specials">
      <MergeControl/>
      <EpisodeWideAward/>
      <FirstTribalCouncilAward/>
      <TribalSurvivalAward/>
      <CastawayBonus/>
    </div>
  </section>;
}

function MergeControl(){
  const {game,setMergeEpisode}=useGame();
  const [value,setValue]=useState(game.season.mergeEpisode?String(game.season.mergeEpisode):'');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;
    const raw=String(new FormData(event.currentTarget).get('mergeEpisode')??'').trim();
    const episode=raw?Number(raw):undefined;setBusy(true);setMessage('');
    try{await setMergeEpisode(episode);setValue(raw);setMessage(episode?`Merge starts at Episode ${episode}.`:'Merge episode cleared; merge-only voting points stay blocked until it is set.');}
    catch(error){setMessage(messageOf(error));}finally{setBusy(false);}
  }
  return <article className="admin-panel">
    <div className="admin-panel-title"><span>02</span><div><p>Phase control</p><h2>Set the merge episode</h2></div></div>
    <p>Majority-vote and blindside points are unavailable until this boundary is saved. Pre-merge immunity, Tribal survival, and elimination rules stop applying at the merge episode.</p>
    <form className="admin-form" onSubmit={submit}><label>Merge begins at Episode<input name="mergeEpisode" type="number" min="1" step="1" value={value} onChange={event=>setValue(event.target.value)} placeholder="Set before merge-only scoring"/></label><button className="secondary-button" disabled={busy}>{busy?'Saving…':'Save merge boundary'}</button></form>
    {message&&<p className="admin-feedback" role="status">{message}</p>}
  </article>;
}

function EpisodeWideAward(){
  const {game,loading,addStillOnIsland}=useGame();
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const [episode,setEpisode]=useState(String(game.season.currentEpisode));
  const active=game.castaways.filter(castaway=>castaway.status==='active');
  const selectedEpisode=Number(episode);
  const alreadyAwarded=game.scoreEvents.some(event=>(event.categoryId==='still-on-island'||event.categoryId==='alive')&&event.episode===selectedEpisode);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;
    const form=event.currentTarget,data=new FormData(form);const episode=Number(data.get('episode'));
    setBusy(true);setMessage('');setError('');
    try{await addStillOnIsland({episode,note:String(data.get('note')??''),expectedActiveCastawayIds:active.map(castaway=>castaway.id)});setMessage(`Still on the island: +1 saved for ${active.length} active castaways.`);}
    catch(error){setError(messageOf(error));}finally{setBusy(false);}
  }
  return <article className="admin-panel accent-panel episode-wide-award">
    <div className="admin-panel-title"><span>03</span><div><p>Episode-wide scoring</p><h2>Still on the island · +1</h2></div></div>
    <p>Issue this once per episode <strong>before changing any eliminated castaway to voted out</strong>. The complete active roster below is the confirmation list.</p>
    <ul className="active-roster-preview">{active.map(castaway=><li key={castaway.id}>{castaway.name}</li>)}</ul>
    {!active.length&&<p className="scoring-error">There are no active castaways to award.</p>}
    <form className="admin-form" onSubmit={submit}>
      <label>Episode<input name="episode" type="number" min="1" step="1" value={episode} onChange={event=>setEpisode(event.target.value)} required/></label>
      <label className="wide">Note (optional)<input name="note" maxLength={500} placeholder="Episode-wide survival award"/></label>
      <button className="primary-button wide" disabled={loading||busy||!active.length||alreadyAwarded}>{alreadyAwarded?'Episode already awarded':busy?'Saving…':'Confirm +1 for the active roster'}</button>
    </form>
    {alreadyAwarded&&<p className="admin-feedback" role="status">This episode’s award is already recorded. Duplicate submissions are blocked.</p>}
    {error&&<p className="scoring-error" role="alert">{error}</p>}{message&&<p className="success-banner" role="status">{message}</p>}
  </article>;
}

function CastawayBonus(){
  const {game,loading,addCastawayBonus}=useGame();
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const batchId=useRef<string|null>(null);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;
    const form=event.currentTarget,data=new FormData(form);setBusy(true);setMessage('');setError('');batchId.current??=crypto.randomUUID();
    try{await addCastawayBonus({castawayId:String(data.get('castawayId')),episode:Number(data.get('episode')),points:Number(data.get('points')),note:String(data.get('note')??''),batchId:batchId.current});setMessage('One-time castaway bonus saved.');form.reset();batchId.current=null;}
    catch(error){setError(messageOf(error));}finally{setBusy(false);}
  }
  return <article className="admin-panel">
    <div className="admin-panel-title"><span>06</span><div><p>Direct bonus</p><h2>One-time castaway bonus</h2></div></div>
    <p>This writes one direct score event and does not create a reusable scoring category. Use the reusable action form above only for rules that will be awarded repeatedly.</p>
    <form className="admin-form" onSubmit={submit} onChange={()=>{batchId.current=null;}}>
      <label className="wide">Castaway<select name="castawayId" required><option value="">Choose a castaway…</option>{game.castaways.map(castaway=><option key={castaway.id} value={castaway.id}>{castaway.name}{castaway.status==='voted-out'?' · voted out':''}</option>)}</select></label>
      <label>Episode<input name="episode" type="number" min="1" step="1" defaultValue={game.season.currentEpisode} required/></label>
      <label>Points<input name="points" type="number" step=".01" defaultValue="1" required/></label>
      <label className="wide">Reason / note<input name="note" maxLength={500} required placeholder="Required reason for this one-time bonus"/></label>
      <button className="secondary-button wide" disabled={loading||busy}>{busy?'Saving…':'Save one-time bonus'}</button>
    </form>
    {error&&<p className="scoring-error" role="alert">{error}</p>}{message&&<p className="success-banner" role="status">{message}</p>}
  </article>;
}

function TribalSurvivalAward(){
  const {game,loading,addTribalCouncilSurvival}=useGame();
  const [tribeId,setTribeId]=useState('');
  const [episode,setEpisode]=useState(String(game.season.currentEpisode));
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const tribe=game.tribes.find(item=>item.id===tribeId);
  const remaining=game.castaways.filter(castaway=>castaway.tribeId===tribeId&&castaway.status==='active');
  const selectedEpisode=Number(episode);
  const awardKey=tribe&&Number.isInteger(selectedEpisode)&&selectedEpisode>0?`${game.season.id}:survive-tribal:${selectedEpisode}:${tribe.id}`:'';
  const alreadyAwarded=Boolean(awardKey&&game.scoreEvents.some(event=>event.awardKey===awardKey||event.batchId===awardKey));
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy||!tribe)return;
    const data=new FormData(event.currentTarget);setBusy(true);setMessage('');setError('');
    try{await addTribalCouncilSurvival({tribeId:tribe.id,episode:Number(data.get('episode')),note:String(data.get('note')??''),expectedActiveCastawayIds:remaining.map(castaway=>castaway.id)});setMessage(`Pre-merge Tribal Council survival: +1 saved for ${remaining.length} remaining castaways.`);}
    catch(error){setError(messageOf(error));}finally{setBusy(false);}
  }
  return <article className="admin-panel accent-panel episode-wide-award">
    <div className="admin-panel-title"><span>05</span><div><p>Tribal Council scoring</p><h2>Survive pre-merge Tribal Council · +1</h2></div></div>
    <p>Use this once after a pre-merge Tribal Council. It awards +1 to every currently active member of the selected tribe, so eliminated castaways are excluded and do not need to be entered one at a time.</p>
    <form className="admin-form" onSubmit={submit}>
      <label>Episode<input name="episode" type="number" min="1" step="1" value={episode} onChange={event=>setEpisode(event.target.value)} required/></label>
      <label>Tribe<select value={tribeId} onChange={event=>setTribeId(event.target.value)} required><option value="">Choose a tribe…</option>{game.tribes.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <div className="score-preview wide" aria-live="polite">
        {tribe&&remaining.length>0?<><strong>+1 each · {remaining.length} remaining castaway{remaining.length===1?'':'s'}</strong><ul className="active-roster-preview">{remaining.map(castaway=><li key={castaway.id}>{castaway.name}</li>)}</ul></>:<p>Choose a tribe to preview every remaining active castaway.</p>}
      </div>
      <label className="wide">Note (optional)<input name="note" maxLength={500} placeholder="Toka survived Episode 1 Tribal Council"/></label>
      <button className="primary-button wide" disabled={loading||busy||!tribe||!remaining.length||alreadyAwarded}>{alreadyAwarded?'Survival already awarded':busy?'Saving…':'Confirm +1 for the remaining roster'}</button>
    </form>
    {!remaining.length&&tribe&&<p className="scoring-error" role="alert">This tribe has no active members to receive survival points.</p>}
    {alreadyAwarded&&<p className="admin-feedback" role="status">This tribe’s survival award is already recorded for this episode.</p>}
    {error&&<p className="scoring-error" role="alert">{error}</p>}{message&&<p className="success-banner" role="status">{message}</p>}
  </article>;
}

function FirstTribalCouncilAward(){
  const {game,loading,addFirstTribalCouncil}=useGame();
  const [tribeId,setTribeId]=useState('');
  const [episode,setEpisode]=useState(String(game.season.currentEpisode));
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const tribe=game.tribes.find(item=>item.id===tribeId);
  const roster=game.castaways.filter(castaway=>castaway.tribeId===tribeId);
  const selectedEpisode=Number(episode);
  const recordedIds=new Set(game.scoreEvents.filter(event=>event.categoryId==='first-tribal-council').map(event=>event.castawayId));
  const pending=roster.filter(castaway=>!recordedIds.has(castaway.id));
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy||!tribe)return;
    const data=new FormData(event.currentTarget);setBusy(true);setMessage('');setError('');
    try{await addFirstTribalCouncil({tribeId:tribe.id,episode:Number(data.get('episode')),note:String(data.get('note')??''),expectedCastawayIds:roster.map(castaway=>castaway.id)});setMessage(`First Tribal Council attendance: +${selectedEpisode} saved for ${roster.length} castaways.`);}
    catch(error){setError(messageOf(error));}finally{setBusy(false);}
  }
  return <article className="admin-panel accent-panel episode-wide-award">
    <div className="admin-panel-title"><span>04</span><div><p>Tribal Council milestone</p><h2>First Tribal Council attendance</h2></div></div>
    <p>Use this once for the first Tribal Council attended by a tribe. Every assigned member receives points equal to the episode number, including anyone eliminated at that Tribal Council. Review the complete roster before confirming.</p>
    <form className="admin-form" onSubmit={submit}>
      <label>Episode<input name="episode" type="number" min="1" step="1" value={episode} onChange={event=>setEpisode(event.target.value)} required/></label>
      <label>Tribe<select value={tribeId} onChange={event=>setTribeId(event.target.value)} required><option value="">Choose a tribe…</option>{game.tribes.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <div className="score-preview wide" aria-live="polite">
        {tribe&&roster.length>0?<><strong>+{Number.isInteger(selectedEpisode)&&selectedEpisode>0?selectedEpisode:'episode number'} each · {roster.length} castaway{roster.length===1?'':'s'}</strong><ul className="active-roster-preview">{roster.map(castaway=><li key={castaway.id}>{castaway.name}{castaway.status==='voted-out'?' · voted out':''}{recordedIds.has(castaway.id)?' · already recorded':''}</li>)}</ul></>:<p>Choose a tribe to preview every assigned castaway.</p>}
      </div>
      <label className="wide">Note (optional)<input name="note" maxLength={500} placeholder="Episode 1 Toka Tribal Council"/></label>
      <button className="primary-button wide" disabled={loading||busy||!tribe||!roster.length||!pending.length}>{!pending.length&&roster.length?'Attendance already recorded':busy?'Saving…':'Confirm first Tribal attendance'}</button>
    </form>
    {!roster.length&&tribe&&<p className="scoring-error" role="alert">This tribe has no assigned castaways.</p>}
    {error&&<p className="scoring-error" role="alert">{error}</p>}{message&&<p className="success-banner" role="status">{message}</p>}
  </article>;
}

function TribeEditor({tribe}:{tribe?:Tribe}){
  const {updateTribe}=useGame();const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;
    const form=event.currentTarget;const data=new FormData(form);setBusy(true);setMessage('');
    try{await updateTribe({id:tribe?.id??crypto.randomUUID(),name:String(data.get('name')),color:String(data.get('color'))});setMessage('Tribe saved.');if(!tribe)form.reset();}catch(error){setMessage(messageOf(error));}finally{setBusy(false);}
  }
  return <form className="mini-form" onSubmit={submit}><h3>{tribe?'Edit '+tribe.name:'Add a tribe'}</h3><label>Tribe name<input name="name" defaultValue={tribe?.name??''} required maxLength={60}/></label><label>Color<input type="color" name="color" defaultValue={tribe?.color??'#267464'}/></label><button disabled={busy}>{busy?'Saving…':'Save tribe'}</button><p role="status">{message}</p></form>;
}

function MembershipRow({castaway}:{castaway:Castaway}){
  const {game,updateCastaway}=useGame();const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;
    const data=new FormData(event.currentTarget);setBusy(true);setMessage('');
    try{await updateCastaway(castaway.id,String(data.get('tribeId')),String(data.get('status')) as Castaway['status']);setMessage('Saved.');}catch(error){setMessage(messageOf(error));}finally{setBusy(false);}
  }
  return <form className="membership-row" onSubmit={submit}>
    <strong>{castaway.name}</strong>
    <label>Tribe<select name="tribeId" defaultValue={castaway.tribeId??''}><option value="">Unassigned</option>{game.tribes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    <label>Status<select name="status" defaultValue={castaway.status}><option value="active">Active</option><option value="voted-out">Voted out / eliminated</option></select></label>
    <button disabled={busy}>{busy?'Saving…':'Save member'}</button><small role="status">{message}</small>
  </form>;
}

export function TribeManagement(){
  const {game}=useGame();
  return <section className="setup-section"><h2>Tribes & castaway membership</h2><p>{game.season.number===51?'Savu is purple and Toka is yellow. Starting memberships are unconfirmed; assign them here when known.':'Add this season’s tribes and assign their members.'} Update these after swaps and eliminations. Existing points never move with a castaway.</p>
    <div className="tribe-summaries">{game.tribes.map(t=><div key={t.id} className="tribe-summary" style={{borderLeftColor:t.color}}><strong>{t.name}</strong><span>{game.castaways.filter(c=>c.tribeId===t.id&&c.status==='active').length} active members</span></div>)}</div>
    <details><summary>Edit tribe names, colors, or add a tribe</summary><div className="setup-grid">{game.tribes.map(t=><TribeEditor key={t.id} tribe={t}/>)}<TribeEditor/></div></details>
    <div className="membership-list">{game.castaways.map(c=><MembershipRow key={c.id} castaway={c}/>)}</div>
  </section>;
}
