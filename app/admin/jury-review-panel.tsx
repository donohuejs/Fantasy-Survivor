'use client';

import {useState} from 'react';
import type {JuryPreparedDraft} from '@/lib/jury-preparation';
import {describeJuryDraft,makeJuryReviewSubmission,reviewCanBeSubmitted,type JuryReviewSubmission} from '@/lib/jury-review';
import styles from './jury-review-panel.module.css';

type Props={
  draft:JuryPreparedDraft;
  /** An authoritative server timestamp in the future integration. */
  asOf:string;
  onConfirm?:(request:JuryReviewSubmission)=>void|Promise<void>;
  disabled?:boolean;
};

/** Isolated presentation component. It is intentionally not mounted or wired to an API. */
export function JuryReviewPanel({draft,asOf,onConfirm,disabled=false}:Props){
  const [acknowledgedId,setAcknowledgedId]=useState<string|null>(null);
  const [savedNote,setSavedNote]=useState<{draftId:string;value:string}|null>(null);
  const [pending,setPending]=useState(false);
  const [error,setError]=useState('');
  const [submittedId,setSubmittedId]=useState<string|null>(null);
  const summary=describeJuryDraft(draft);
  const acknowledged=acknowledgedId===draft.id;
  const note=savedNote?.draftId===draft.id?savedNote.value:'';
  const canSubmit=reviewCanBeSubmitted(draft,asOf,acknowledged)&&!disabled&&!pending&&
    submittedId!==draft.id&&Boolean(onConfirm);
  const expired=summary.status==='READY_FOR_REVIEW'&&Number.isFinite(Date.parse(draft.proposal.airtime??''))&&
    Date.parse(draft.proposal.airtime??'')<=Date.parse(asOf);

  async function confirm(){
    const request=makeJuryReviewSubmission(draft,{asOf,acknowledged,note});
    if(!request||!onConfirm||disabled||pending||submittedId===draft.id)return;
    setPending(true);setError('');
    try{await onConfirm(request);setSubmittedId(draft.id);}
    catch(reason){setError(reason instanceof Error?reason.message:'Approval could not be requested. Please try again.');}
    finally{setPending(false);}
  }

  return <section className={styles.panel} aria-labelledby="jury-review-heading">
    <header className={styles.heading}>
      <div><p className={styles.kicker}>Game Master · Prepared episode</p><h2 id="jury-review-heading">Review Episode {draft.episode}</h2></div>
      <span className={styles.pill} data-state={summary.status}>{summary.status==='READY_FOR_REVIEW'?'Ready for review':'Needs corrections'}</span>
    </header>

    <p className={styles.intro}>The proposed setup is prepared for you. Review these details, then confirm once to open Jury Mode.</p>
    <dl className={styles.grid}>
      <div><dt>Prediction deadline · Eastern</dt><dd>{summary.deadline}</dd></div>
      <div><dt>Eligible jury members</dt><dd>{summary.eligiblePlayers}</dd></div>
      <div><dt>Questions</dt><dd>{summary.formatLabel}</dd></div>
      <div><dt>Current castaways / tribes</dt><dd>{summary.castaways} / {summary.tribes}</dd></div>
    </dl>
    <p className={styles.provenance}>Schedule source: {summary.broadcastSource}</p>

    {summary.blockers.length>0&&<div role="alert" className={styles.blockers}>
      <strong>Resolve these items before approval</strong>
      <ul>{summary.blockers.map((message,index)=><li key={`${index}-${message}`}>{message}</li>)}</ul>
    </div>}
    {expired&&<p className={styles.blockers} role="alert">The broadcast deadline has passed. This proposal cannot be approved.</p>}

    <label className={styles.attestation}>
      <input type="checkbox" checked={acknowledged} disabled={disabled||summary.status==='BLOCKED'||expired||pending} onChange={event=>setAcknowledgedId(event.target.checked?draft.id:null)}/>
      <span>I checked the broadcast time, player eligibility, roster, and question format above.</span>
    </label>

    <details className={styles.notes}>
      <summary>Add an optional Game Master note</summary>
      <label htmlFor="jury-review-note">Note for the approval audit</label>
      <textarea id="jury-review-note" value={note} maxLength={800} rows={3} onChange={event=>setSavedNote({draftId:draft.id,value:event.target.value})} disabled={disabled||pending}/>
    </details>

    <button type="button" className={styles.confirm} disabled={!canSubmit} onClick={()=>void confirm()}>
      {pending?'Submitting for verification…':submittedId===draft.id?'Confirmation submitted':`Confirm and open Episode ${draft.episode}`}
    </button>
    {submittedId===draft.id&&<p role="status" className={styles.preview}>Confirmation submitted. Wait for the server&apos;s updated episode status; do not submit twice.</p>}
    {!onConfirm&&<p className={styles.preview} role="status">Isolated interface preview. Confirmation is not connected, and this screen cannot open a live episode.</p>}
    {error&&<p role="alert" className={styles.blockers}>{error}</p>}
    <p className={styles.disclaimer}>A server-side Game Master authorization, current-record check, and immutable snapshot transaction are required before predictions can open.</p>
  </section>;
}
