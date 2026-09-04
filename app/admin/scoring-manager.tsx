'use client';

import {useRef,useState,type FormEvent} from 'react';
import type {Castaway,Category,Tribe} from '@/lib/game-data';
import {recipients} from '@/lib/scoring';
import {useGame} from '../game-provider';

const messageOf=(error:unknown)=>error instanceof Error?error.message:'Unable to save. Please try again.';
const pointsText=(points:number)=>`${points>0?'+':''}${points}`;

export function ScoringManager(){
  const {game,loading,addScore,addCustomAction}=useGame();
  const [actionId,setActionId]=useState('tribe-first');
  const [recipientId,setRecipientId]=useState('');
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const [customBusy,setCustomBusy]=useState(false);
  const [customError,setCustomError]=useState('');
  const batchId=useRef<string|null>(null);
  const action=game.categories.find(c=>c.id===actionId);
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
            <label className="wide">Action / milestone<select value={actionId} onChange={e=>{setActionId(e.target.value);setRecipientId('');}} required>{game.categories.map(c=><option key={c.id} value={c.id}>{pointsText(c.points)} · {c.label} · {c.target==='tribe'?'Tribe':'Individual'}</option>)}</select></label>
            <label className="wide">{action?.target==='tribe'?'Tribe':'Castaway'}<select value={recipientId} onChange={e=>setRecipientId(e.target.value)} required><option value="">Choose {action?.target==='tribe'?'a tribe':'a castaway'}…</option>{action?.target==='tribe'?game.tribes.map(t=><option value={t.id} key={t.id}>{t.name} ({game.castaways.filter(c=>c.tribeId===t.id&&c.status==='active').length} active)</option>):game.castaways.map(c=><option value={c.id} key={c.id}>{c.name}{c.status==='voted-out'?' · voted out':''}</option>)}</select></label>
            <div className="score-preview wide" aria-live="polite">
              {action?.target==='tribe'&&<p>Tribe points go to current active members only. For a past episode, verify the membership and status before recording.</p>}
              {selected.length>0?<><strong>{pointsText(action?.points??0)} per castaway · {selected.length} recipient{selected.length===1?'':'s'}</strong><p>{selected.map(c=>c.name).join(', ')}</p></>:<p>{recipientId?'No active members. Assign castaways below before scoring.':'Choose a recipient to preview the award.'}</p>}
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
        <p>Save a new action once. It stays in the scoring list for this season and appears on the Rules page. Saving alone does not award points.</p>
        <form className="admin-form" onSubmit={custom}><fieldset disabled={customBusy||loading} className="scoring-fields">
          <label className="wide">Action name<input name="label" required maxLength={100} placeholder="Win a surprise fire-making challenge"/></label>
          <label>Points per castaway<input name="points" type="number" step="0.01" required placeholder="5 or -3"/></label>
          <label>Applies to<select name="target"><option value="individual">Individual castaway</option><option value="tribe">Whole active tribe</option></select></label>
          <button className="secondary-button wide">{customBusy?'Saving…':'Save action & select it'}</button>
        </fieldset></form>
        {customError&&<p role="alert" className="scoring-error">{customError}</p>}
      </article>
    </div>
    <TribeManagement/>
  </section>;
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

function TribeManagement(){
  const {game}=useGame();
  return <section className="setup-section"><h2>Tribes & castaway membership</h2><p>{game.season.number===51?'Savu is purple and Toka is yellow. Starting memberships are unconfirmed; assign them here when known.':'Add this season’s tribes and assign their members.'} Update these after swaps and eliminations. Existing points never move with a castaway.</p>
    <div className="tribe-summaries">{game.tribes.map(t=><div key={t.id} className="tribe-summary" style={{borderLeftColor:t.color}}><strong>{t.name}</strong><span>{game.castaways.filter(c=>c.tribeId===t.id&&c.status==='active').length} active members</span></div>)}</div>
    <details><summary>Edit tribe names, colors, or add a tribe</summary><div className="setup-grid">{game.tribes.map(t=><TribeEditor key={t.id} tribe={t}/>)}<TribeEditor/></div></details>
    <div className="membership-list">{game.castaways.map(c=><MembershipRow key={c.id} castaway={c}/>)}</div>
  </section>;
}
