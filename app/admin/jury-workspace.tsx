'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {useGame} from '../game-provider';
import {juryRequest,type AdminJuryCatalog} from '../jury/client';
import {juryAdminStatus,juryAdminStatusLabels,type JuryAdminStatus} from '@/lib/jury-admin-status';
import {JuryManager} from './jury-manager';
import styles from './jury-workspace.module.css';

function easternTime(value:string){
  const timestamp=Date.parse(value);
  if(!Number.isFinite(timestamp))return 'Broadcast time needs verification';
  return new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(timestamp);
}

export function JuryWorkspace({seasonLocked}:{seasonLocked:boolean}){
  const {game,cloud,isAdmin,user}=useGame();
  const [catalog,setCatalog]=useState<AdminJuryCatalog|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const advanced=useRef<HTMLDetailsElement|null>(null);
  const refresh=useCallback(async()=>{
    if(!cloud||!isAdmin||!user){setLoading(false);return;}
    setLoading(true);setError('');
    try{setCatalog(await juryRequest<AdminJuryCatalog>({view:'admin'},true));}
    catch(reason){setError(reason instanceof Error?reason.message:'Could not load Jury Mode status.');}
    finally{setLoading(false);}
  },[cloud,isAdmin,user]);
  useEffect(()=>{queueMicrotask(()=>{void refresh();});},[refresh]);
  useEffect(()=>{
    const listener=()=>{void refresh();};
    window.addEventListener('league-refresh',listener);
    return()=>window.removeEventListener('league-refresh',listener);
  },[refresh]);

  const episode=game.season.currentEpisode+1;
  const record=catalog?.episodes.find(row=>row.snapshot.episode===episode);
  const status:JuryAdminStatus=loading||!catalog?'UNPREPARED':juryAdminStatus({
    episode,
    activationEnabled:Boolean(catalog.config?.enabled),
    activationEpisode:catalog.config?.activationEpisode??null,
    hasSnapshot:Boolean(record),
    snapshotAirtime:record?.snapshot.airtime,
    graded:Boolean(record?.gradedAt),
    serverTime:catalog.serverTime,
  });
  const eligible=catalog?.preview.players.filter(row=>row.fromEpisode!==null&&row.fromEpisode<=episode).length??0;
  const needsEligibilityReview=catalog?.preview.players.filter(row=>row.issues.length>0).length??0;

  function revealAdvanced(){
    if(!advanced.current)return;
    advanced.current.open=true;
    advanced.current.scrollIntoView({behavior:'smooth',block:'start'});
  }

  return <div className={styles.workspace}>
    <section className={styles.dashboard} aria-labelledby="jury-dashboard-heading">
      <div className={styles.header}>
        <div><p className="eyebrow dark">Game Master · Jury Mode</p><h2 id="jury-dashboard-heading">Episode {episode}</h2></div>
        <span className={styles.status} data-status={status} role="status">{juryAdminStatusLabels[status]}</span>
      </div>
      {error&&<p role="alert" className="setup-notice">{error}</p>}
      {!cloud&&<p>Jury Mode needs the connected league database. No changes were made.</p>}
      {cloud&&<>
        <p className={styles.explanation}>
          {status==='NEEDS_REVIEW'?'Predictions are not open for this episode. A verified snapshot and your explicit approval are still required.':
           status==='BLOCKED'?'Jury Mode needs an activation or source review before this episode can open.':
           status==='OPEN'?'The approved prediction window is open. Entries lock automatically at the verified airtime.':
           status==='LOCKED'?'The verified airtime has passed. Predictions can no longer be changed.':
           status==='GRADED'?'The episode answer key and awards have been confirmed.':
           'Checking the latest episode and eligibility records…'}
        </p>
        <div className={styles.facts}>
          <div><span>Potentially eligible players</span><strong>{loading?'—':eligible}</strong></div>
          <div><span>Verified deadline</span><strong className={styles.deadline}>{record?.snapshot.airtime?easternTime(record.snapshot.airtime):'Not yet confirmed'}</strong></div>
          <div><span>Eligibility flags</span><strong>{loading?'—':needsEligibilityReview}</strong></div>
        </div>
        {needsEligibilityReview>0&&<p className={styles.warning}>{needsEligibilityReview} player eligibility record{needsEligibilityReview===1?' needs':'s need'} review. Do not invent elimination history.</p>}
        <div className={styles.actions}>
          <button type="button" onClick={revealAdvanced} disabled={loading||seasonLocked}>
            {status==='NEEDS_REVIEW'?'Review episode setup':status==='BLOCKED'?'Resolve setup issues':'View Jury Mode controls'}
          </button>
          <button type="button" className="secondary-button" onClick={()=>void refresh()} disabled={loading}>Refresh status</button>
        </div>
      </>}
    </section>
    <details className={styles.advanced} ref={advanced}>
      <summary>Advanced · existing Jury Mode setup and grading</summary>
      <p className={styles.advancedHelp}>Until the new approval workflow is connected, the existing verification and snapshot forms remain the authorized way to open predictions. Expand “Verify and open an immutable episode snapshot” below.</p>
      {!seasonLocked?<JuryManager/>:<p>This season is finalized. Jury administration is locked.</p>}
    </details>
  </div>;
}
