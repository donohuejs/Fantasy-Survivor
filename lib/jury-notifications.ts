import type {JuryNoticeIntent,JuryPreparedDraft} from './jury-preparation';
import {reviewDeadline} from './jury-review.ts';

export type JuryRenderedNotice={
  inApp:{deliveryKey:string;title:string;body:string;actionLabel:string;actionUrl:string};
  email:{deliveryKey:string;subject:string;text:string;html:string};
};

function escapeHtml(value:string){
  return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]??char));
}

/**
 * Pure content rendering. No recipient, address, provider, outbox write or
 * notification dispatch is performed here. Never include private predictions.
 */
export function renderJuryApprovalNotice(
  draft:JuryPreparedDraft,intent:JuryNoticeIntent,
  options:{leagueName:string;reviewUrl:string;allowedOrigin:string},
):JuryRenderedNotice{
  const purpose=intent.purpose;
  if(!['approval-ready','approval-reminder-24h','approval-reminder-6h'].includes(purpose)){
    throw new Error('Unknown Jury Mode notice purpose.');
  }
  const expectedKey=`jury:${draft.season}:${draft.episode}:${draft.id}:${purpose}`;
  if(draft.state!=='READY_FOR_REVIEW'||draft.blockers.length||!draft.proposal.airtime||
    intent.draftId!==draft.id||intent.episode!==draft.episode||intent.season!==draft.season||
    intent.key!==expectedKey||intent.channels[0]!=='in-app'||intent.channels[1]!=='email'){
    throw new Error('Notification requires the current, ready Jury Mode proposal and dual-channel intent.');
  }
  const league=options.leagueName.trim();
  if(!league||league.length>80||/[\x00-\x1f\x7f]/.test(league))throw new Error('A short league name is required.');
  const target=new URL(options.reviewUrl),origin=new URL(options.allowedOrigin);
  if(target.protocol!=='https:'||origin.protocol!=='https:'||
    target.username||target.password||origin.username||origin.password||
    origin.pathname!=='/'||origin.search||origin.hash||target.origin!==origin.origin||
    target.pathname!=='/admin'||target.search||target.hash!=='#jury-mode'){
    throw new Error('The review link must lead to the trusted Game Master Jury Mode tab.');
  }
  const url=target.toString();
  const deadline=reviewDeadline(draft.proposal.airtime);
  const headline=purpose==='approval-ready'?'Jury Mode is ready for review':
    purpose==='approval-reminder-24h'?'Jury Mode approval reminder':
    'Jury Mode approval is time-sensitive';
  const actionLabel=`Review Episode ${draft.episode}`;
  const body=`Episode ${draft.episode} is waiting for Game Master approval. Review the proposed roster, questions, and broadcast deadline (${deadline}) before opening predictions.`;
  const subject=`${league} · Episode ${draft.episode} Jury Mode needs approval`;
  const text=`${headline}\n\n${body}\n\n${actionLabel}: ${url}\n\nNo episode opens until the Game Master confirms. This notice contains no private jury predictions.`;
  const html=`<h1>${escapeHtml(league)}</h1><p>${escapeHtml(headline)}</p><p>${escapeHtml(body)}</p><p><a href="${escapeHtml(url)}">${escapeHtml(actionLabel)}</a></p><p>No episode opens until the Game Master confirms. This notice contains no private jury predictions.</p>`;
  return {
    inApp:{deliveryKey:`${intent.key}:in-app`,title:headline,body,actionLabel,actionUrl:url},
    email:{deliveryKey:`${intent.key}:email`,subject,text,html},
  };
}
