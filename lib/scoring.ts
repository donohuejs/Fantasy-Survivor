import type {Category,GameState,Tribe,Castaway} from './game-data';

export type ScoringInput={categoryId:string;recipientId:string;episode:number;note:string;expectedRecipientIds:string[];batchId:string};
export type CustomActionInput={label:string;points:number;target:Category['target']};

export function recipients(game:GameState,category:Category,recipientId:string):Castaway[] {
  if(category.target==='tribe'){
    if(!game.tribes.some(t=>t.id===recipientId))throw new Error('Choose a valid tribe.');
    return game.castaways.filter(c=>c.tribeId===recipientId&&c.status==='active');
  }
  const castaway=game.castaways.find(c=>c.id===recipientId);
  if(!castaway)throw new Error('Choose a valid castaway.');
  return [castaway];
}

export function recordScoring(game:GameState,input:ScoringInput):GameState {
  if(!Number.isInteger(input.episode)||input.episode<1)throw new Error('Episode must be a positive whole number.');
  const action=game.categories.find(c=>c.id===input.categoryId);
  if(!action)throw new Error('Choose a saved scoring action.');
  if(!Number.isFinite(action.points))throw new Error('Points must be a finite number.');
  if(game.scoreEvents.some(e=>e.batchId===input.batchId))return game;
  const selected=recipients(game,action,input.recipientId);
  if(!selected.length)throw new Error('This tribe has no active members. Assign members before scoring.');
  if([...selected.map(c=>c.id)].sort().join('|')!==[...input.expectedRecipientIds].sort().join('|'))throw new Error('Tribe membership changed. Review the updated recipients and try again.');
  const tribe=action.target==='tribe'?game.tribes.find(t=>t.id===input.recipientId):null;
  const createdAt=new Date().toISOString();
  const events=selected.map(c=>({id:`${input.batchId}:${c.id}`,batchId:input.batchId,castawayId:c.id,recipientName:c.name,categoryId:action.id,actionLabel:action.label,points:action.points,episode:input.episode,note:input.note.trim(),createdAt,...(tribe?{tribeId:tribe.id,tribeName:tribe.name}:{})}));
  return {...game,season:{...game.season,currentEpisode:Math.max(game.season.currentEpisode,input.episode)},scoreEvents:[...game.scoreEvents,...events]};
}

export function saveCustomAction(game:GameState,input:CustomActionInput,id:string):GameState {
  const label=input.label.trim();
  if(!label||label.length>100)throw new Error('Enter an action name between 1 and 100 characters.');
  if(!Number.isFinite(input.points)||input.points===0)throw new Error('Enter positive or negative points, not zero.');
  if(input.target!=='tribe'&&input.target!=='individual')throw new Error('Choose tribe or individual.');
  if(game.categories.some(c=>c.label.trim().toLowerCase()===label.toLowerCase()))throw new Error('An action with that name already exists. Select it from the scoring list.');
  return {...game,categories:[...game.categories,{id,label,points:input.points,target:input.target,group:'Custom actions',custom:true}]};
}

export function saveTribe(game:GameState,tribe:Tribe):GameState {
  const name=tribe.name.trim();
  if(!name||name.length>60)throw new Error('Enter a tribe name between 1 and 60 characters.');
  if(!/^#[0-9a-f]{6}$/i.test(tribe.color))throw new Error('Choose a valid tribe color.');
  if(game.tribes.some(t=>t.id!==tribe.id&&t.name.toLowerCase()===name.toLowerCase()))throw new Error('That tribe name already exists.');
  const next={...tribe,name};
  return {...game,tribes:game.tribes.some(t=>t.id===tribe.id)?game.tribes.map(t=>t.id===tribe.id?next:t):[...game.tribes,next]};
}

export function assignCastaway(game:GameState,id:string,tribeId:string,status:Castaway['status']):GameState {
  if(!game.castaways.some(c=>c.id===id))throw new Error('Unknown castaway.');
  if(tribeId&&!game.tribes.some(t=>t.id===tribeId))throw new Error('Unknown tribe.');
  if(status!=='active'&&status!=='voted-out')throw new Error('Invalid castaway status.');
  return {...game,castaways:game.castaways.map(c=>c.id===id?{...c,tribeId,status}:c)};
}
