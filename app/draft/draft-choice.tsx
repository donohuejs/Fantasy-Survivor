'use client';
import {useState,type FormEvent} from 'react';
import {useGame} from '../game-provider';
import {availableCastaways} from '@/lib/draft';

export function DraftChoice({onBehalf=false}:{onBehalf?:boolean}){
  const {game,submitPlayerPick}=useGame();
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const turn=game.draft.turns[game.draft.currentPick];
  const choices=availableCastaways(game);
  async function submit(decision:'select'|'keep'|'swap',castawayId=''){
    if(busy)return;
    const name=game.castaways.find(c=>c.id===castawayId)?.name;
    const text=decision==='keep'?'Keep the face-down card for 1.25× points? You cannot change this decision.':decision==='swap'?'Swap for '+name+' at 1×? Your dealt card will become a face-up discard.':'Draft '+name+'?';
    if(!confirm(text))return;
    setBusy(true);setMessage('');
    try{await submitPlayerPick(castawayId,decision,onBehalf);setMessage('Decision saved. Waiting for the board to update.');}
    catch(error){setMessage(error instanceof Error?error.message:'Unable to save your decision.');}
    finally{setBusy(false);}
  }
  function choose(event:FormEvent<HTMLFormElement>){event.preventDefault();void submit(turn?.round===3?'swap':'select',String(new FormData(event.currentTarget).get('castawayId')??''));}
  if(!turn||game.draft.status!=='live'||game.season.finalized)return null;
  if(game.draft.version!==2)return <p role="alert">This draft uses the old format. Ask the game master to review it before continuing.</p>;
  return <div className="draft-choice">
    {onBehalf&&<p><strong>Acting for {turn.playerName}</strong> · Round {turn.round}, pick {turn.pickNumber}. The same draft rules apply.</p>}
    {turn.round===3&&<div className="blind-choice"><div className="face-down-card" aria-label="Your dealt castaway is face down">?</div><div><h3>Keep it blind, or trade it in.</h3><p>Your card stays face down until two more players keep theirs. Swaps do not count toward reveals.</p><button className="primary-button" disabled={busy} onClick={()=>submit('keep')}>Keep my blind card · 1.25×</button></div></div>}
    <form className="live-pick-form" onSubmit={choose}>
      <label>{turn.round===3?'Or choose a face-up discard · 1×':'Choose an available castaway'}
        <select name="castawayId" required disabled={busy||!choices.length} defaultValue="" key={game.draft.currentPick}>
          <option value="" disabled>Select a castaway</option>
          {choices.map(c=><option key={c.id} value={c.id}>{c.name} · {c.occupation}</option>)}
        </select>
      </label>
      <button disabled={busy||!choices.length}>{busy?'Saving…':turn.round===3?'Swap and forfeit bonus':'Lock in pick'}</button>
    </form>
    {!choices.length&&<p>{turn.round===3?'There are no face-up discards. Keep your dealt card.':'No legal picks remain. Ask the game master to review the last pick.'}</p>}
    {turn.round===2&&<p className="draft-hint">Already-picked castaways and pairs owned by another player are excluded.</p>}
    {message&&<p role="status">{message}</p>}
  </div>;
}
