'use client';
import {useState,type FormEvent} from 'react';
import {useGame} from '../game-provider';
import {seasonStandings,nextSeasonRoster} from '@/lib/league';

export function SeasonManager(){
  const {game,finalizeSeason,beginNextSeason,addCastaway}=useGame();
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[tieRanks,setTieRanks]=useState<Record<string,string>>({});
  const standings=seasonStandings(game),locked=Boolean(game.season.finalized);
  const next=locked?nextSeasonRoster(game).sort((a,b)=>a.draftSlot-b.draftSlot):[];
  async function finalize(){
    try{
      const ranked=standings.map(row=>{const tied=standings.filter(r=>r.score===row.score);const rank=tied.length>1?Number(tieRanks[row.profileId]):row.finish;if(!rank||!tied.some(r=>r.finish===rank))throw new Error('Assign each tied player a distinct final position before locking results.');return {...row,finish:rank};}).sort((a,b)=>a.finish-b.finish);
      if(new Set(ranked.map(r=>r.finish)).size!==ranked.length)throw new Error('Each tied player needs a different position.');
      if(!confirm(`Lock Season ${game.season.number} results? This freezes scoring, adds final results to the all-time leaderboard, and determines next season’s draft order. Review all totals first.`))return;
      setBusy(true);await finalizeSeason(ranked.map(r=>r.profileId));setMessage('Final results locked. Next season’s draft order is ready.');
    }catch(error){setMessage(error instanceof Error?error.message:'Could not lock the results.');}finally{setBusy(false);}
  }
  async function rollover(){if(!confirm(`Open Season ${game.season.number+1}? The current season will be backed up. Profiles and history are kept; new scores, castaways, tribes, picks, bonuses, and payment checkmarks start empty.`))return;setBusy(true);try{await beginNextSeason();setTieRanks({});setMessage('New season opened. Returning players are already linked. Add the new castaways and tribes before the draft.');}catch(error){setMessage(error instanceof Error?error.message:'Could not open the next season.');}finally{setBusy(false);}}
  async function castaway(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget,data=new FormData(form);setBusy(true);try{const name=String(data.get('name')??'').trim();await addCastaway({name,shortName:name,age:Number(data.get('age')),occupation:String(data.get('occupation')??''),bio:String(data.get('bio')??''),imageUrl:String(data.get('imageUrl')??'')});form.reset();setMessage(`${name} added to this season.`);}catch(error){setMessage(error instanceof Error?error.message:'Could not add castaway.');}finally{setBusy(false);}}
  return <section className="season-admin signup-admin"><p className="eyebrow dark">Year after year</p><h2>Season {game.season.number} · {locked?'Results locked':'In progress'}</h2><p>Lock final results only after the finale. The next draft reverses this finish order. Player profiles stay linked; paid checkmarks and bonus points reset each season.</p>
    {message&&<p role="status">{message}</p>}
    {!locked?<details><summary>Review and lock final standings</summary><p>Tied scores need an explicit final order from the game master—no automatic alphabetical tiebreaker.</p><ol className="final-result-list">{standings.map(row=>{const tied=standings.filter(r=>r.score===row.score);return <li key={row.profileId}><span>{row.name} · {row.score.toFixed(2)} pts</span>{tied.length>1&&<label>Final position for {row.name}<select value={tieRanks[row.profileId]??''} onChange={e=>setTieRanks({...tieRanks,[row.profileId]:e.target.value})}><option value="">Resolve tie…</option>{tied.map(r=><option key={r.finish} value={r.finish}>{r.finish}</option>)}</select></label>}</li>;})}</ol><button disabled={busy||game.draft.status!=='complete'||!game.scoreEvents.length} onClick={finalize}>Lock final results</button></details>:<><h3>Season {game.season.number+1} draft order</h3><ol>{next.map(player=><li key={player.id}>{player.name} · prior finish {player.priorFinish}</li>)}</ol><button disabled={busy} onClick={rollover}>Open Season {game.season.number+1}</button></>}
    {game.draft.status==='setup'&&!locked&&<details><summary>Add a castaway for this season</summary><form className="mini-form" onSubmit={castaway}><label>Name<input name="name" required maxLength={80}/></label><label>Age<input name="age" type="number" min="18" max="120" required/></label><label>Occupation<input name="occupation" required maxLength={100}/></label><label>Brief bio<input name="bio" required maxLength={400}/></label><label>Original photo URL<input name="imageUrl" type="url" required placeholder="https://…"/></label><button disabled={busy}>Add castaway</button></form></details>}
  </section>;
}
