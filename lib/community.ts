import type {GameState} from './game-data';

export type EpisodeAction={id:string;label:string;points:number;recipients:string[];tribeName:string;note:string;target:'castaway'|'player'};
export type EpisodeRecap={id:string;season:number;episode:number;title:string;body:string;status:'draft'|'published';actions:EpisodeAction[];createdAt:string;updatedAt:string;publishedAt:string};
export type EpisodeComment={id:string;authorId:string;authorName:string;text:string;createdAt:string};
export type LeaguePoll={id:string;season:number;episode:number;question:string;options:string[];counts:number[];status:'open'|'closed';createdAt:string;updatedAt:string};
export type CommunityActor={uid:string;email:string;verified:boolean};
export class CommunityError extends Error {}
export const communityOwner='donohue.js@gmail.com';
export function isCommunityOwner(actor:CommunityActor){return actor.verified&&actor.email.toLowerCase()===communityOwner;}
export function linkedAuthor(game:GameState,actor:CommunityActor,allowOwner=false){
  if(!actor.verified||!actor.uid)throw new CommunityError('Sign in with a verified Google account.');
  const player=game.players.find(p=>p.uid?p.uid===actor.uid:Boolean(p.email)&&p.email.toLowerCase()===actor.email.toLowerCase());
  if(player)return {id:player.id,name:player.name};
  if(allowOwner&&isCommunityOwner(actor))return {id:'commissioner',name:'Game master'};
  throw new CommunityError('Your Google account needs to be linked to a league profile in Player check-in first.');
}
export function requiredText(value:unknown,label:string,max:number){
  if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw new CommunityError(label+' must be between 1 and '+max+' characters.');
  return value.trim();
}
export function wholeNumber(value:unknown,label:string,min=1){
  if(!Number.isSafeInteger(value)||Number(value)<min||Number(value)>9999)throw new CommunityError('Choose a valid '+label+'.');
  return Number(value);
}
export function resourceId(value:unknown){
  if(typeof value!=='string'||! /^[a-zA-Z0-9_-]{1,100}$/.test(value))throw new CommunityError('Invalid item. Reload and try again.');
  return value;
}
export function episodeActions(game:GameState,episode:number):EpisodeAction[]{
  const grouped=new Map<string,EpisodeAction>();
  for(const event of game.scoreEvents.filter(e=>e.episode===episode)){
    const label=event.actionLabel||game.categories.find(c=>c.id===event.categoryId)?.label||'Player adjustment';
    const target=event.playerId?'player':'castaway';
    const key=JSON.stringify([event.batchId||event.id,label,event.points,event.tribeName||'',event.note||'',target]);
    const name=event.recipientName||game.castaways.find(c=>c.id===event.castawayId)?.name||game.players.find(p=>p.id===event.playerId)?.name||'Unknown recipient';
    const group=grouped.get(key);
    if(group)group.recipients.push(name);
    else grouped.set(key,{id:event.id,label,points:event.points,recipients:[name],tribeName:event.tribeName||'',note:event.note||'',target});
  }
  return [...grouped.values()];
}
export function makeRecap(game:GameState,input:Record<string,unknown>,existing:EpisodeRecap|null,now:string):EpisodeRecap{
  const season=wholeNumber(input.season,'season'),episode=wholeNumber(input.episode,'episode');
  if(season!==game.season.number)throw new CommunityError('Only the active season’s recaps can be edited.');
  if(input.status!=='draft'&&input.status!=='published')throw new CommunityError('Choose draft or published.');
  if((existing?.updatedAt??'')!==input.expectedUpdatedAt)throw new CommunityError('This recap changed in another window. Reload it before saving.');
  return {id:season+'-'+episode,season,episode,title:requiredText(input.title,'Title',150),body:typeof input.body==='string'&&input.body.length<=12000?input.body.trim():(()=>{throw new CommunityError('Commentary must be no more than 12,000 characters.');})(),status:input.status,actions:episodeActions(game,episode),createdAt:existing?.createdAt??now,updatedAt:now,publishedAt:input.status==='published'?(existing?.publishedAt||now):(existing?.publishedAt??'')};
}
export function makePoll(game:GameState,input:Record<string,unknown>,now:string):LeaguePoll{
  if(wholeNumber(input.season,'season')!==game.season.number)throw new CommunityError('The season changed. Reload before opening a poll.');
  const episode=wholeNumber(input.episode,'episode',0);
  if(!Array.isArray(input.options)||input.options.length<2||input.options.length>6)throw new CommunityError('Enter between 2 and 6 choices.');
  const options=input.options.map(option=>requiredText(option,'Choice',100));
  if(new Set(options.map(s=>s.toLowerCase())).size!==options.length)throw new CommunityError('Each poll choice must be different.');
  return {id:resourceId(input.id),season:game.season.number,episode,question:requiredText(input.question,'Question',300),options,counts:options.map(()=>0),status:'open',createdAt:now,updatedAt:now};
}
export function changeVote(poll:LeaguePoll,previous:number|null,choice:unknown,activeSeason:number,now:string):LeaguePoll{
  if(poll.status!=='open'||poll.season!==activeSeason)throw new CommunityError('This poll is closed.');
  if(!Number.isInteger(choice)||Number(choice)<0||Number(choice)>=poll.options.length)throw new CommunityError('Choose one of the poll options.');
  if(previous===choice)return poll;
  const counts=[...poll.counts];
  if(previous!==null){if(!Number.isInteger(previous)||previous<0||previous>=counts.length||counts[previous]<1)throw new CommunityError('This vote needs review by the game master.');counts[previous]--;}
  counts[Number(choice)]++;
  return {...poll,counts,updatedAt:now};
}
