'use client';

import {useState,type FormEvent} from 'react';
import type {Possession,PossessionStatus} from '@/lib/game-data';
import {useGame} from '../game-provider';

const messageOf=(error:unknown)=>error instanceof Error?error.message:'Unable to save. Please try again.';
const statusLabel=(status:PossessionStatus)=>status==='active'?'Active':status==='played'?'Played / used':status==='expired'?'Expired':status==='lost'?'Lost':'Transferred';

export function PossessionManager(){
  const {game,createPossession}=useGame();
  const records=game.possessions??[];
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  async function create(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;const form=event.currentTarget,data=new FormData(form);setBusy(true);setMessage('');setError('');
    try{await createPossession({castawayId:String(data.get('castawayId')),category:String(data.get('category')) as 'idol'|'advantage',itemName:String(data.get('itemName')),acquiredEpisode:data.get('acquiredEpisode')?Number(data.get('acquiredEpisode')):undefined,notes:String(data.get('notes')??'')});form.reset();setMessage('Possession added to the live inventory.');}
    catch(error){setError(messageOf(error));}finally{setBusy(false);}
  }
  return <details className="admin-panel possession-manager" open><summary>Manage Idols &amp; Advantages</summary><p>Give, edit, transfer, or close out a possession. Closed records stay in the history but disappear from Who Has What.</p>
    <form className="admin-form possession-create-form" onSubmit={create}><fieldset disabled={busy}><label>Castaway<select name="castawayId" required><option value="">Choose a castaway…</option>{game.castaways.filter(castaway=>castaway.status==='active').map(castaway=><option key={castaway.id} value={castaway.id}>{castaway.name}</option>)}</select></label><label>Category<select name="category" defaultValue="idol" required><option value="idol">Idol</option><option value="advantage">Advantage</option></select></label><label className="wide">Item name<input name="itemName" maxLength={120} required placeholder="Final 5 Immunity Idol" spellCheck autoCorrect="on" autoCapitalize="words" lang="en"/></label><label>Acquired episode<input name="acquiredEpisode" type="number" min={1} step={1} placeholder="Optional"/></label><label className="wide">Notes<input name="notes" maxLength={500} placeholder="Optional context" spellCheck autoCorrect="on" autoCapitalize="sentences" lang="en"/></label><button className="primary-button wide">{busy?'Saving…':'Give possession'}</button></fieldset></form>
    {message&&<p className="success-banner" role="status">{message}</p>}{error&&<p className="scoring-error" role="alert">{error}</p>}
    <div className="possession-records">{records.map(record=><PossessionRow key={record.id} record={record}/>)}</div>
    {!records.length&&<p className="admin-empty">No possession records yet.</p>}
  </details>;
}

function PossessionRow({record}:{record:Possession}){
  const {game,updatePossession,transferPossession,setPossessionStatus}=useGame();
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  async function edit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);setMessage('');setError('');
    try{await updatePossession({id:record.id,castawayId:String(data.get('castawayId')),category:String(data.get('category')) as 'idol'|'advantage',itemName:String(data.get('itemName')),acquiredEpisode:data.get('acquiredEpisode')?Number(data.get('acquiredEpisode')):undefined,notes:String(data.get('notes')??'')});setMessage('Possession details saved.');}catch(error){setError(messageOf(error));}finally{setBusy(false);}
  }
  async function transfer(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const data=new FormData(event.currentTarget),target=String(data.get('targetCastawayId'));if(!target)return;setBusy(true);setMessage('');setError('');
    try{await transferPossession(record.id,target,game.season.currentEpisode,String(data.get('transferNotes')??''));setMessage('Possession transferred.');}catch(error){setError(messageOf(error));}finally{setBusy(false);}
  }
  async function status(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const data=new FormData(event.currentTarget),next=String(data.get('status')) as PossessionStatus;setBusy(true);setMessage('');setError('');
    try{await setPossessionStatus(record.id,next,game.season.currentEpisode,String(data.get('statusNotes')??''));setMessage(`Marked ${statusLabel(next).toLowerCase()}.`);}catch(error){setError(messageOf(error));}finally{setBusy(false);}
  }
  const currentOwner=game.castaways.find(castaway=>castaway.id===record.castawayId)?.name??'Unknown castaway';
  return <article className={`possession-record ${record.status!=='active'?'possession-record-closed':''}`}><header><div><strong>{currentOwner}</strong><span>{record.itemName}</span></div><b>{statusLabel(record.status)}</b></header>
    <form className="possession-edit-form" onSubmit={edit}><input type="hidden" name="castawayId" value={record.castawayId}/><label>Owner<select defaultValue={record.castawayId} disabled>{game.castaways.map(castaway=><option key={castaway.id} value={castaway.id}>{castaway.name}{castaway.status==='voted-out'?' · eliminated':''}</option>)}</select></label><label>Category<select name="category" defaultValue={record.category} disabled={busy}><option value="idol">Idol</option><option value="advantage">Advantage</option></select></label><label className="wide">Item name<input name="itemName" defaultValue={record.itemName} maxLength={120} required disabled={busy} spellCheck autoCorrect="on" autoCapitalize="words" lang="en"/></label><label>Acquired episode<input name="acquiredEpisode" type="number" min={1} step={1} defaultValue={record.acquiredEpisode??''} disabled={busy}/></label><label className="wide">Notes<input name="notes" defaultValue={record.notes??''} maxLength={500} disabled={busy} spellCheck autoCorrect="on" autoCapitalize="sentences" lang="en"/></label><button className="secondary-button wide" disabled={busy}>Save corrected details</button></form>
    {record.status==='active'&&<form className="possession-transfer-form" onSubmit={transfer}><label>Transfer to<select name="targetCastawayId" required disabled={busy}><option value="">Choose an active castaway…</option>{game.castaways.filter(castaway=>castaway.status==='active'&&castaway.id!==record.castawayId).map(castaway=><option key={castaway.id} value={castaway.id}>{castaway.name}</option>)}</select></label><label>Transfer note<input name="transferNotes" maxLength={500} disabled={busy} placeholder="Optional" spellCheck autoCorrect="on" autoCapitalize="sentences" lang="en"/></label><button className="secondary-button" disabled={busy}>Transfer</button></form>}
    <form className="possession-status-form" onSubmit={status}><label>Set status<select name="status" defaultValue={record.status==='transferred'?'active':record.status} disabled={busy||record.status==='transferred'}><option value="active">Active</option><option value="played">Played / used</option><option value="expired">Expired</option><option value="lost">Lost / remove from active view</option></select></label><label>Status note<input name="statusNotes" maxLength={500} disabled={busy} placeholder="Reason for the change" spellCheck autoCorrect="on" autoCapitalize="sentences" lang="en"/></label><button className="secondary-button" disabled={busy||record.status==='transferred'}>Save status</button></form>
    {record.history.length>0&&<details className="possession-history"><summary>History ({record.history.length})</summary><ul>{record.history.map((entry,index)=><li key={index}><strong>{entry.action.replace('-', ' ')}</strong>{entry.episode?` · Episode ${entry.episode}`:''}{entry.notes?` · ${entry.notes}`:''}</li>)}</ul></details>}
    {message&&<p className="admin-feedback" role="status">{message}</p>}{error&&<p className="scoring-error" role="alert">{error}</p>}
  </article>;
}
