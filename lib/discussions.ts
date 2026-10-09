import {CommunityError,resourceId,wholeNumber,type EpisodeComment,type EpisodeRecap} from './community.ts';

export type EpisodeRecord = Partial<EpisodeRecap> & {
  id:string;season:number;episode:number;discussionOpensAt?:string|null;broadcastDate?:string;
  discussionOverride?:boolean;discussionVersion?:string;discussionSchemaVersion?:number;
  migrationToken?:string;migrationUntil?:string;
};
export type DiscussionComment = EpisodeComment & {
  threadId:string;rootId:string;sequence:number;replyToId:string;replyToName:string;
  updatedAt?:string;deletedAt:string;authorUid?:string;replyToCommentId?:string;
};
export type DiscussionThread = {
  id:string;episodeId:string;season:number;episode:number;rootId:string;authorId:string;
  createdAt:string;lastActivityAt:string;replyCount:number;sequence:number;
};
export type ReadState = {episodeId:string;readSequence:number;unreadCount:number;personalCount:number;sequence?:number};
export type EpisodeView = {
  id:string;season:number;episode:number;opensAt:string|null;broadcastDate:string;version:string;
  lifecycle:'scheduled'|'open'|'ongoing';available:boolean;watched:boolean;spoilerHidden:boolean;
  unreadCount:number;personalCount:number;recap:EpisodeRecap|null;
};
export type ThreadPreview = DiscussionThread & {authorName:string;text:string;deleted:boolean;unreadCount:number;personalCount:number;spoilerHidden:boolean};
export type BroadcastSchedule = {
  season:number;weekday:number;localTime:string;timeZone:string;startDate:string;
  firstEpisode:number;episodeCount:number;skippedDates:string[];
  overrides:Array<{episode:number;date:string|null}>;updatedAt:string;
};
export type DiscussionCatalog = {episodes:EpisodeView[];unread:Record<string,ReadState>;hideSpoilers:boolean;serverNow:string;schedule:BroadcastSchedule|null};
export type ThreadPage = {rows:ThreadPreview[];cursor:string|null};
export type ConversationPage = {thread:ThreadPreview;comments:DiscussionComment[];through:number;hasMore:boolean;spoilerHidden:boolean};

export function episodeIdentity(season:unknown,episode:unknown){return wholeNumber(season,'season')+'-'+wholeNumber(episode,'episode');}
export function parseEpisodeIdentity(value:unknown){
  const id=resourceId(value),match=/^([1-9]\d{0,3})-([1-9]\d{0,3})$/.exec(id);
  if(!match)throw new CommunityError('Choose a valid episode.');
  const season=Number(match[1]),episode=Number(match[2]);
  if(id!==episodeIdentity(season,episode))throw new CommunityError('Choose a valid episode.');
  return {id,season,episode};
}
export function threadIdentity(episodeId:string,rootId:string){return parseEpisodeIdentity(episodeId).id+'__'+resourceId(rootId);}
export function discussionOpening(record:EpisodeRecord):string|null{
  // Only legacy, already-published episodes get a compatibility opening.
  // Explicit null means held/skipped, and cannot fall through to publication.
  if('discussionOpensAt' in record)return record.discussionOpensAt??null;
  return record.status==='published'?(record.publishedAt||record.createdAt||'1970-01-01T00:00:00.000Z'):null;
}
export function discussionAvailable(record:EpisodeRecord,serverNow:string){
  const opening=discussionOpening(record);
  return Boolean(opening&&Number.isFinite(Date.parse(opening))&&Date.parse(opening)<=Date.parse(serverNow));
}
export function assertDiscussionOpen(record:EpisodeRecord,serverNow:string){
  if(!discussionAvailable(record,serverNow))throw new CommunityError('This discussion has not opened yet.');
}
export function assertCommentOwner(comment:EpisodeComment,authorId:string,moderator:boolean){
  if(!moderator&&comment.authorId!==authorId)throw new CommunityError('You can only edit or delete your own comments.');
}
export function commentIsPersonal(comment:DiscussionComment,rootAuthorId:string,recipientId:string){
  return comment.authorId!==recipientId&&(rootAuthorId===recipientId||comment.replyToId===recipientId);
}
export function hiddenEpisode(hideSpoilers:boolean,watched:boolean,revealed=false){return hideSpoilers&&!watched&&!revealed;}
export function previewThread(thread:DiscussionThread,root:DiscussionComment,state:ReadState|undefined,hidden:boolean):ThreadPreview{
  return {...thread,authorName:hidden?'':root.authorName,text:hidden?'':root.deletedAt?'Comment deleted':root.text.slice(0,240),deleted:Boolean(root.deletedAt),unreadCount:state?.unreadCount??0,personalCount:state?.personalCount??0,spoilerHidden:hidden};
}
export function acknowledgeRead(old:ReadState,through:number,removed:number,personalRemoved:number):ReadState{
  return {...old,readSequence:Math.max(old.readSequence,through),unreadCount:Math.max(0,old.unreadCount-removed),personalCount:Math.max(0,old.personalCount-personalRemoved)};
}

function validDate(value:unknown){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)throw new CommunityError('Enter a valid broadcast date.');
  return value;
}
function dateAfter(value:string,days:number){return new Date(Date.parse(value+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);}
function wallParts(time:number,timeZone:string){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(time));
  const get=(key:string)=>parts.find(part=>part.type===key)!.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}
export function localOpening(date:string,localTime:string,timeZone:string){
  validDate(date);
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(localTime))throw new CommunityError('Enter a broadcast time in HH:mm format.');
  try{new Intl.DateTimeFormat('en',{timeZone}).format();}catch{throw new CommunityError('Enter a valid IANA time zone.');}
  const wall=date+'T'+localTime+':00',guess=Date.parse(wall+'Z'),offsets=new Set<number>();
  for(let hours=-48;hours<=48;hours+=6){const sample=guess+hours*3600000;offsets.add(Date.parse(wallParts(sample,timeZone)+'Z')-sample);}
  const candidates=[...offsets].map(offset=>guess-offset).filter(time=>wallParts(time,timeZone)===wall).sort((a,b)=>a-b);
  if(!candidates.length)throw new CommunityError('That local time does not exist because clocks change. Choose another time.');
  // The first occurrence is deterministic when clocks fall back.
  return new Date(candidates[0]).toISOString();
}
export function makeSchedule(input:Record<string,unknown>,activeSeason:number,now:string):BroadcastSchedule{
  const season=wholeNumber(input.season,'season');if(season!==activeSeason)throw new CommunityError('The season changed. Reload the calendar.');
  const weekday=wholeNumber(input.weekday,'weekday',0);if(weekday>6)throw new CommunityError('Choose a broadcast weekday.');
  const firstEpisode=wholeNumber(input.firstEpisode,'first episode'),episodeCount=wholeNumber(input.episodeCount,'episode count');
  if(episodeCount>60||firstEpisode+episodeCount-1>9999)throw new CommunityError('Schedule up to 60 episodes at a time.');
  const startDate=validDate(input.startDate),localTime=String(input.localTime??''),timeZone=String(input.timeZone??'');
  localOpening(startDate,localTime,timeZone);
  if(new Date(startDate+'T12:00:00Z').getUTCDay()!==weekday)throw new CommunityError('The first broadcast date must match the selected weekday. Use episode overrides for exceptions.');
  if(!Array.isArray(input.skippedDates)||input.skippedDates.length>60||!Array.isArray(input.overrides)||input.overrides.length>60)throw new CommunityError('Enter valid skipped dates and episode overrides.');
  const skippedDates=[...new Set(input.skippedDates.map(validDate))];
  const overrides=input.overrides.map(item=>{
    if(!item||typeof item!=='object')throw new CommunityError('Enter valid episode overrides.');
    const value=item as Record<string,unknown>,episode=wholeNumber(value.episode,'override episode');
    if(episode<firstEpisode||episode>=firstEpisode+episodeCount)throw new CommunityError('Override episodes must be inside the calendar range.');
    return {episode,date:value.date===null?null:validDate(value.date)};
  });
  if(new Set(overrides.map(item=>item.episode)).size!==overrides.length)throw new CommunityError('Enter each episode override only once.');
  return {season,weekday,localTime,timeZone,startDate,firstEpisode,episodeCount,skippedDates,overrides,updatedAt:now};
}
export function calendarEpisodes(schedule:BroadcastSchedule){
  let date=schedule.startDate;
  return Array.from({length:schedule.episodeCount},(_,index)=>{
    while(schedule.skippedDates.includes(date))date=dateAfter(date,7);
    const episode=schedule.firstEpisode+index,override=schedule.overrides.find(item=>item.episode===episode);
    const broadcastDate=override?override.date:date;date=dateAfter(date,7);
    return {id:episodeIdentity(schedule.season,episode),season:schedule.season,episode,broadcastDate:broadcastDate??'',discussionOpensAt:broadcastDate?localOpening(broadcastDate,schedule.localTime,schedule.timeZone):null};
  });
}

export function migrateComments(episode:EpisodeRecord,rows:Array<EpisodeComment & Partial<DiscussionComment> & {parentId?:string|null}>){
  const byId=new Map(rows.map(row=>[row.id,row]));
  function rootFor(row:typeof rows[number]){
    const seen=new Set<string>();let current=row;
    while(current.parentId||current.rootId&&current.rootId!==current.id){
      if(seen.has(current.id))throw new CommunityError('A historical reply cycle needs review. No comments were removed.');
      seen.add(current.id);const parent=byId.get(current.parentId||current.rootId!);
      if(!parent)throw new CommunityError('A historical reply parent is missing. No comments were removed.');
      current=parent;
    }
    return current;
  }
  const groups=new Map<string,typeof rows>();
  for(const row of rows){resourceId(row.id);const root=rootFor(row),group=groups.get(root.id)??[];group.push(row);groups.set(root.id,group);}
  const comments:DiscussionComment[]=[],threads:DiscussionThread[]=[];
  for(const [rootId,group] of groups){
    const root=byId.get(rootId)!,id=threadIdentity(episode.id,rootId);
    const ordered=[root,...group.filter(row=>row.id!==rootId).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))];
    const normalized=ordered.map((row,index)=>{
      const recipient=row.parentId?byId.get(row.parentId):undefined;
      return {...row,threadId:id,rootId,sequence:index+1,replyToId:row.replyToId??recipient?.authorId??'',replyToName:row.replyToName??recipient?.authorName??'',deletedAt:row.deletedAt??''} as DiscussionComment;
    });
    comments.push(...normalized);
    threads.push({id,episodeId:episode.id,season:episode.season,episode:episode.episode,rootId,authorId:root.authorId,createdAt:root.createdAt,lastActivityAt:ordered.map(row=>row.createdAt).sort().at(-1)!,replyCount:normalized.filter(row=>row.id!==rootId&&!row.deletedAt).length,sequence:normalized.length});
  }
  return {comments,threads};
}
