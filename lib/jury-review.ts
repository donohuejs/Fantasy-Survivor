import type {JuryPreparedDraft} from './jury-preparation';

/** Only an authenticated server adapter may convert this request into approval. */
export type JuryReviewSubmission={
  season:number;
  episode:number;
  expectedDraftId:string;
  expectedGameRevision:number;
  confirmedBroadcast:true;
  confirmedRoster:true;
  confirmedMerge:true;
  reason:string;
};

export type JuryReviewSummary={
  episode:number;
  season:number;
  status:'READY_FOR_REVIEW'|'BLOCKED';
  blockers:readonly string[];
  deadline:string;
  broadcastSource:string;
  formatLabel:'Before merge'|'After merge';
  eligiblePlayers:number;
  castaways:number;
  tribes:number;
};

export function reviewDeadline(airtime:string|null){
  if(!airtime||!Number.isFinite(Date.parse(airtime)))return 'Unverified';
  return new Intl.DateTimeFormat('en-US',{
    timeZone:'America/New_York',weekday:'short',month:'short',day:'numeric',year:'numeric',
    hour:'numeric',minute:'2-digit',timeZoneName:'short',
  }).format(Date.parse(airtime));
}

export function describeJuryDraft(draft:JuryPreparedDraft):JuryReviewSummary{
  return {
    episode:draft.episode,season:draft.season,status:draft.state,blockers:[...draft.blockers],
    deadline:reviewDeadline(draft.proposal.airtime),
    broadcastSource:draft.proposal.broadcastSource??'Not verified',
    formatLabel:draft.proposal.format==='post-merge'?'After merge':'Before merge',
    eligiblePlayers:draft.proposal.eligiblePlayerIds.length,
    castaways:draft.proposal.castaways.length,tribes:draft.proposal.tribes.length,
  };
}

/** The client controls display only; the server checks role, revision and airtime. */
export function reviewCanBeSubmitted(draft:JuryPreparedDraft,asOf:string,acknowledged:boolean){
  const remaining=Date.parse(draft.proposal.airtime??'')-Date.parse(asOf);
  return acknowledged&&draft.state==='READY_FOR_REVIEW'&&draft.blockers.length===0&&
    Number.isFinite(remaining)&&remaining>0;
}

export function makeJuryReviewSubmission(
  draft:JuryPreparedDraft,input:{asOf:string;acknowledged:boolean;note:string},
):JuryReviewSubmission|null{
  if(!reviewCanBeSubmitted(draft,input.asOf,input.acknowledged))return null;
  const note=input.note.trim();
  // A commissioner may add context, but need not type a reason every week.
  const reason=`Game Master reviewed the proposed Episode ${draft.episode} broadcast, roster, and merge details.${note?' Note: '+note:''}`;
  return {season:draft.season,episode:draft.episode,expectedDraftId:draft.id,
    expectedGameRevision:draft.gameRevision,confirmedBroadcast:true,confirmedRoster:true,confirmedMerge:true,reason};
}
