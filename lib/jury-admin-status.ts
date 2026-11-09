/** Read-only Game Master display state. The Jury API remains the authority for all writes. */
export type JuryAdminStatus='UNPREPARED'|'NEEDS_REVIEW'|'BLOCKED'|'OPEN'|'LOCKED'|'GRADED';

export type JuryAdminStatusInput={
  episode:number;
  activationEnabled:boolean;
  activationEpisode:number|null;
  snapshotAirtime?:string|null;
  hasSnapshot:boolean;
  graded:boolean;
  serverTime:string;
};

export function juryAdminStatus(input:JuryAdminStatusInput):JuryAdminStatus{
  if(!Number.isSafeInteger(input.episode)||input.episode<1)return 'BLOCKED';
  if(!input.activationEnabled||input.activationEpisode===null||input.episode<input.activationEpisode)return 'BLOCKED';
  if(!input.hasSnapshot)return 'NEEDS_REVIEW';
  if(!input.snapshotAirtime)return 'BLOCKED';
  const airtime=Date.parse(input.snapshotAirtime),now=Date.parse(input.serverTime);
  if(!Number.isFinite(airtime)||!Number.isFinite(now))return 'BLOCKED';
  if(input.graded)return 'GRADED';
  return now>=airtime?'LOCKED':'OPEN';
}

export const juryAdminStatusLabels:Record<JuryAdminStatus,string>={
  UNPREPARED:'Preparing status',
  NEEDS_REVIEW:'Needs review',
  BLOCKED:'Needs attention',
  OPEN:'Predictions open',
  LOCKED:'Predictions locked',
  GRADED:'Graded',
};
