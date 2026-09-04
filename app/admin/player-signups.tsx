'use client';
import {useState} from 'react';
import {useGame,type PlayerSignup} from '../game-provider';
import type {Player} from '@/lib/game-data';
export function PlayerSignups(){
  const {game,signups,assignSignup,setPlayerPaid,signupError,signupLoading}=useGame();
  const [message,setMessage]=useState(''),[busy,setBusy]=useState('');
  async function assign(signup:PlayerSignup,playerId:string){
    const profile=game.players.find(p=>p.id===playerId);if(!profile)return;
    if(!confirm(`Link ${signup.name} (${signup.email}) permanently to ${profile.name}'s league profile and history? This season: slot ${profile.draftSlot}. Future slots are based on final results.`))return;
    setBusy(signup.uid);try{await assignSignup(signup,playerId);setMessage(`${signup.name} is now linked to a permanent league profile.`);}catch(error){setMessage(error instanceof Error?error.message:'Unable to assign player.');}finally{setBusy('');}
  }
  async function paid(player:Player,value:boolean){setBusy(player.id);try{await setPlayerPaid(player.id,value);setMessage(`${player.name}: ${value?'paid':'unpaid'} for Season ${game.season.number}.`);}catch(error){setMessage(error instanceof Error?error.message:'Payment status was not saved.');}finally{setBusy('');}}
  const sorted=[...game.players].sort((a,b)=>a.draftSlot-b.draftSlot);
  return <section className="signup-admin"><div><p className="eyebrow dark">Player check-in</p><h2>Profiles, slots, and payments</h2><p>Players register on the Draft board. Link each account to the correct existing league profile once—this also links its historical results. Returning players keep that profile automatically. A profile is permanent; its draft slot changes each season.</p></div>
    {message&&<p role="status">{message}</p>}{signupError&&<p role="alert" className="scoring-error">{signupError}</p>}
    <div className="signup-list">{signupLoading&&<p role="status">Loading registrations…</p>}{signups.map(signup=>{const assigned=game.players.find(p=>p.uid===signup.uid||p.id===signup.assignedPlayerId);return <article key={signup.uid}><div><strong>{signup.name}</strong><small>{signup.email}</small></div>{assigned?<div><strong>Profile locked · Slot {assigned.draftSlot}</strong><small>{assigned.name} · stays linked in future seasons</small></div>:<label>Link league profile<select value="" disabled={Boolean(busy)||game.draft.status!=='setup'||game.season.finalized} onChange={e=>e.target.value&&assign(signup,e.target.value)}><option value="">Choose their existing profile…</option>{sorted.map(player=><option value={player.id} key={player.id} disabled={Boolean(player.uid||(player.email&&player.email.toLowerCase()!==signup.email.toLowerCase()))}>{player.name} · Slot {player.draftSlot}</option>)}</select></label>}<span className={assigned?.paid?'paid-badge paid':'paid-badge'}>{assigned?.paid?'Paid':assigned?'Unpaid':'Awaiting assignment'}</span></article>;})}{!signupLoading&&!signupError&&!signups.length&&<p>No players have signed up yet. Share the Draft board link.</p>}</div>
    <h3>Season {game.season.number} payments · ${game.season.entryFee} per player</h3><p>{game.players.filter(p=>p.paid).length} of {game.players.length} marked paid. This is a manual receipt tracker, not an online payment service. It does not award bonus points or block draft access.</p>
    <div className="payment-list">{sorted.map(player=><label key={player.id}><input type="checkbox" aria-label={`Paid: ${player.name}`} disabled={Boolean(busy)} checked={Boolean(player.paid)} onChange={e=>paid(player,e.target.checked)}/><span><strong>Slot {player.draftSlot} · {player.name}</strong><small>{signups.find(s=>s.uid===player.uid)?.email||player.email||(player.uid?'Linked Google account':'Awaiting account assignment')}</small></span><b>{player.paid?'Paid':'Unpaid'}</b></label>)}</div>
  </section>;
}
