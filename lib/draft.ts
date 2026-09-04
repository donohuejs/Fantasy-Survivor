import {buildDraftTurns, type GameState, type DraftPick} from './game-data.ts';

// Never include this type in the public game document or an API response.
export type PrivateDeal = {runId:string;dealt:Record<string,string>;initialDiscards:string[]};
export type DraftActor = {uid:string;email:string;verified:boolean};
export type DraftCommand = {action:'start'|'pick'|'toggle'|'undo';season:number;runId:string;revision:number;currentPick:number;decision?:'select'|'keep'|'swap';castawayId?:string;onBehalf?:boolean};
export class DraftError extends Error {}
export const draftOwner = 'donohue.js@gmail.com';

// Rejection sampling avoids modulo bias; both the order and the deck get independent shuffles.
function randomBelow(upper:number):number {
  const limit=Math.floor(0x100000000/upper)*upper;
  const buffer=new Uint32Array(1);
  do {crypto.getRandomValues(buffer);} while(buffer[0]>=limit);
  return buffer[0]%upper;
}
export function shuffle<T>(items:T[],randomIndex:(upper:number)=>number=randomBelow):T[] {
  const copy=[...items];
  for(let i=copy.length-1;i>0;i--){const j=randomIndex(i+1);[copy[i],copy[j]]=[copy[j],copy[i]];}
  return copy;
}
export function parseDraftCommand(value:unknown):DraftCommand {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new DraftError('Invalid draft request.');
  const v=value as Record<string,unknown>;
  if(!['start','pick','toggle','undo'].includes(String(v.action))||!Number.isSafeInteger(v.season)||!Number.isSafeInteger(v.revision)||Number(v.revision)<0||!Number.isSafeInteger(v.currentPick)||Number(v.currentPick)<0||typeof v.runId!=='string'||v.runId.length>100)throw new DraftError('Invalid draft request. Reload and try again.');
  if(v.action==='pick'&&(!['select','keep','swap'].includes(String(v.decision))||(v.decision!=='keep'&&(typeof v.castawayId!=='string'||v.castawayId.length>150))))throw new DraftError('Choose a valid draft action.');
  if(v.onBehalf!==undefined&&typeof v.onBehalf!=='boolean')throw new DraftError('Invalid player authorization.');
  return {action:v.action as DraftCommand['action'],season:Number(v.season),revision:Number(v.revision),currentPick:Number(v.currentPick),runId:v.runId,...(v.action==='pick'?{decision:v.decision as DraftCommand['decision'],castawayId:v.decision==='keep'?'':String(v.castawayId),onBehalf:v.onBehalf===true}:{})};
}

export function pickProblem(game:GameState,castawayId:string):string|undefined {
  const turn=game.draft.turns[game.draft.currentPick];
  if(!turn)return 'The draft is not accepting picks.';
  if(!game.castaways.some(c=>c.id===castawayId))return 'Choose a castaway from this season.';
  if(turn.round===3)return game.draft.blind?.discards.includes(castawayId)?undefined:'That castaway is not in the face-up discard pile.';
  if(game.draftPicks.some(p=>p.round===turn.round&&p.castawayId===castawayId))return 'That castaway was already picked this round.';
  if(turn.round===2){
    const first=game.draftPicks.find(p=>p.round===1&&p.playerId===turn.playerId);
    if(!first)return 'This player is missing a round-one pick.';
    const pair=[first.castawayId,castawayId].sort().join('|');
    for(const player of game.players){
      if(player.id===turn.playerId)continue;
      const picks=game.draftPicks.filter(p=>p.playerId===player.id&&p.round<=2);
      if(picks.length===2&&picks.map(p=>p.castawayId).sort().join('|')===pair)return 'Another player already has that pair. Choose a different castaway.';
    }
  }
}
export function availableCastaways(game:GameState){return game.castaways.filter(c=>!pickProblem(game,c.id));}
export function keepsUntilReveal(game:GameState,pick:DraftPick):number {
  return Math.max(0,(pick.keptAt??0)+2-(game.draft.blind?.keptCount??0));
}

export function executeDraft(game:GameState,deal:PrivateDeal|null,actor:DraftActor,command:DraftCommand,randomIndex?: (upper:number)=>number):{game:GameState;deal:PrivateDeal|null} {
  const admin=actor.verified&&actor.email.toLowerCase()===draftOwner;
  if(!actor.uid||!actor.verified)throw new DraftError('Sign in with a verified Google account.');
  if(command.season!==game.season.number||command.runId!==(game.draft.runId??'')||command.revision!==(game.draft.revision??0)||command.currentPick!==game.draft.currentPick)throw new DraftError('The draft changed. Review the current turn and try again.');
  if(game.season.finalized)throw new DraftError('This season’s results are locked.');
  if(command.action!=='pick'&&!admin)throw new DraftError('Only the game master can control the draft.');
  if(command.action==='start'){
    if(game.draft.status!=='setup'||game.draftPicks.length)throw new DraftError('The draft has already started or contains picks. Do not start it again.');
    if(!game.players.length||game.players.some(p=>!p.uid&&!p.email))throw new DraftError('Assign every player to an account before starting the draft.');
    if(new Set(game.players.map(p=>p.id)).size!==game.players.length||new Set(game.players.map(p=>p.uid||p.email.toLowerCase())).size!==game.players.length)throw new DraftError('Each player needs a separate profile and account.');
    if(game.castaways.length<game.players.length||new Set(game.castaways.map(c=>c.id)).size!==game.castaways.length)throw new DraftError('Add at least one distinct castaway per player before starting.');
    const third=shuffle(game.players,randomIndex),deck=shuffle(game.castaways.map(c=>c.id),randomIndex),runId=crypto.randomUUID();
    return {game:{...game,draft:{version:2,runId,revision:1,status:'live',currentPick:0,turns:buildDraftTurns(game.players,third)}},deal:{runId,dealt:Object.fromEntries(third.map((p,i)=>[p.id,deck[i]])),initialDiscards:deck.slice(third.length)}};
  }
  if(game.draft.version!==2)throw new DraftError('This draft uses the old format. Ask the game master to review it before continuing.');
  if(!deal||deal.runId!==game.draft.runId)throw new DraftError('The private deal is unavailable. Contact the game master; do not reset the draft.');
  const next=structuredClone(game);
  next.draft.revision=(next.draft.revision??0)+1;
  if(command.action==='toggle'){
    if(!['live','paused'].includes(game.draft.status))throw new DraftError('Only an active draft can be paused or resumed.');
    next.draft.status=game.draft.status==='live'?'paused':'live';return {game:next,deal};
  }
  if(command.action==='undo'){
    if(game.draft.blind||game.draft.status==='complete')throw new DraftError('Undo is unavailable after the blind deal is exposed.');
    if(!game.draftPicks.length)throw new DraftError('There is no pick to undo.');
    next.draftPicks.pop();next.draft.currentPick--;next.draft.status='paused';return {game:next,deal};
  }
  const turn=game.draft.turns[game.draft.currentPick];
  if(game.draft.status!=='live'||!turn)throw new DraftError('The draft is not live. Wait for the game master.');
  if(command.onBehalf&&!admin)throw new DraftError('Only the game master can act for another player.');
  const ownsTurn=turn.uid?turn.uid===actor.uid:turn.email.toLowerCase()===actor.email.toLowerCase();
  if(!ownsTurn&&!(admin&&command.onBehalf))throw new DraftError('It is not your turn.');
  let pick:DraftPick={id:crypto.randomUUID(),playerId:turn.playerId,castawayId:command.castawayId??'',round:turn.round,pickNumber:turn.pickNumber,multiplier:1};
  if(turn.round<3){
    if(command.decision!=='select')throw new DraftError('Choose a castaway for this round.');
    const problem=pickProblem(game,pick.castawayId);if(problem)throw new DraftError(problem);
  }else{
    const blind=next.draft.blind,original=deal.dealt[turn.playerId];
    if(!blind||!original)throw new DraftError('The blind deal is unavailable.');
    if(command.decision==='keep'){
      blind.keptCount++;
      pick={...pick,castawayId:'',multiplier:1.25,decision:'keep',keptAt:blind.keptCount};
    }else if(command.decision==='swap'){
      const problem=pickProblem(game,pick.castawayId);if(problem)throw new DraftError(problem);
      blind.discards=blind.discards.filter(id=>id!==pick.castawayId);
      blind.discards.push(original);pick.decision='swap';
    }else throw new DraftError('Keep your blind card or choose a face-up discard.');
  }
  next.draftPicks.push(pick);next.draft.currentPick++;
  if(next.draft.currentPick===next.draft.turns.length)next.draft.status='complete';
  if(next.draft.turns[next.draft.currentPick]?.round===3&&!next.draft.blind)next.draft.blind={discards:[...deal.initialDiscards],keptCount:0};
  next.draftPicks=next.draftPicks.map(p=>p.decision==='keep'&&!p.castawayId&&(next.draft.status==='complete'||keepsUntilReveal(next,p)===0)?{...p,castawayId:deal.dealt[p.playerId]}:p);
  return {game:next,deal};
}
