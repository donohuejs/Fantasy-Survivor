import type {Firestore,Transaction,DocumentReference,DocumentSnapshot,Query} from 'firebase-admin/firestore';
import type {GameState} from './game-data.ts';
import {CommunityError,isCommunityOwner,linkedAuthor,requiredText,resourceId,type CommunityActor,type EpisodeRecap} from './community.ts';
import {acknowledgeRead,assertCommentOwner,assertDiscussionOpen,calendarEpisodes,commentIsPersonal,discussionAvailable,discussionOpening,hiddenEpisode,localOpening,makeSchedule,migrateComments,parseEpisodeIdentity,previewThread,threadIdentity,type BroadcastSchedule,type ConversationPage,type DiscussionCatalog,type DiscussionComment,type DiscussionThread,type EpisodeRecord,type MigrationInspection,type MigrationResult,type ReadState,type ThreadPage} from './discussions.ts';

const leaguePath='games/survivor-51';
const emptyRead=(episodeId:string):ReadState=>({episodeId,readSequence:0,unreadCount:0,personalCount:0});
function counterData(thread:DiscussionThread,state:ReadState){return {...state,id:thread.id,season:thread.season,episode:thread.episode,sequence:thread.sequence,lastActivityAt:thread.lastActivityAt,createdAt:thread.createdAt,hasUnread:state.unreadCount>0};}
function asRecord(snapshot:DocumentSnapshot){return snapshot.data() as EpisodeRecord;}
function timestamp(value:unknown){if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw new CommunityError('Invalid activity cursor.');return value;}
type MigrationPlan=ReturnType<typeof migrateComments>;

/** All discussion writes stay below the league root; the scoring document is read-only here. */
export class DiscussionStore{
  private db:Firestore;
  private actor:CommunityActor;
  private clock:()=>string;
  constructor(db:Firestore,actor:CommunityActor,clock=()=>new Date().toISOString()){
    this.db=db;this.actor=actor;this.clock=clock;
  }
  private root(){return this.db.doc(leaguePath);}
  private user(){return this.root().collection('discussionUsers').doc(this.actor.uid);}
  private episode(id:unknown){return this.root().collection('episodes').doc(parseEpisodeIdentity(id).id);}
  private thread(id:unknown){return this.root().collection('discussionThreads').doc(resourceThreadId(id));}
  private async game(tx?:Transaction){
    const snapshot=tx?await tx.get(this.root()):await this.root().get();
    if(!snapshot.exists)throw new CommunityError('The league is not ready.');
    const game=snapshot.data() as GameState;
    linkedAuthor(game,this.actor,true);return game;
  }
  private owner(){if(!isCommunityOwner(this.actor))throw new CommunityError('Only the game master can manage this discussion operation.',{status:403,code:'authorization'});}
  private async audience(game:GameState,tx:Transaction){
    const signups=await tx.get(this.root().collection('signups'));
    const audience=new Map<string,string>();
    for(const player of game.players)if(player.uid)audience.set(player.uid,player.id);
    for(const signup of signups.docs){const data=signup.data();try{const author=linkedAuthor(game,{uid:signup.id,email:data.email??'',verified:true},true);audience.set(signup.id,author.id);}catch{/* Unlinked signups are not members. */}}
    audience.set(this.actor.uid,linkedAuthor(game,this.actor,true).id);
    if(audience.size>100)throw new CommunityError('This league exceeds the supported 100 discussion accounts.');
    return audience;
  }
  private async states(tx:Transaction,threadId:string,audience:Map<string,string>){
    const entries=[...audience].map(([uid,authorId])=>({uid,authorId,ref:this.root().collection('discussionUsers').doc(uid).collection('threads').doc(threadId)}));
    const snapshots=entries.length?await tx.getAll(...entries.map(entry=>entry.ref)):[];
    return entries.map((entry,index)=>({...entry,state:snapshots[index].exists?snapshots[index].data() as ReadState:undefined}));
  }

  private async inspectMigration(id:string):Promise<{ref:DocumentReference;inspection:MigrationInspection;plan:MigrationPlan|null}>{
    const ref=this.episode(id),snapshot=await ref.get(),episodeId=ref.id;
    if(!snapshot.exists)return {ref,plan:null,inspection:{episodeId,status:'missing',schemaVersion:null,commentCount:0,threadCount:0,plannedCommentCount:0,plannedThreadCount:0,issues:['Episode not found.'],migrationUntil:''}};
    const record=asRecord(snapshot),[rows,threads]=await Promise.all([ref.collection('comments').get(),this.root().collection('discussionThreads').where('episodeId','==',episodeId).get()]);
    const comments=rows.docs.map(row=>({...row.data(),id:row.id}) as DiscussionComment),schemaVersion=typeof record.discussionSchemaVersion==='number'?record.discussionSchemaVersion:null;
    let plan:MigrationPlan|null=null,issues:string[]=[];
    if(schemaVersion!==2){
      try{plan=migrateComments(record,comments);}
      catch(error){issues=[error instanceof CommunityError?error.message:'Historical comments could not be validated.'];}
    }else{
      const missingFields=comments.some(comment=>typeof comment.threadId!=='string'||!comment.threadId||typeof comment.rootId!=='string'||!comment.rootId||!Number.isSafeInteger(comment.sequence)||comment.sequence<1);
      if(missingFields)issues.push('Some comments are missing threaded fields.');
      const roots=new Set(comments.map(comment=>comment.rootId));
      if(roots.size!==threads.size)issues.push('The thread index does not match the comment roots.');
    }
    const until=record.migrationUntil??'',active=Boolean(record.migrationToken&&Date.parse(until)>Date.parse(this.clock()));
    const status:MigrationInspection['status']=issues.length?'blocked':schemaVersion===2?'ready':active?'in-progress':'pending';
    return {ref,plan,inspection:{episodeId,status,schemaVersion,commentCount:comments.length,threadCount:threads.size,plannedCommentCount:plan?.comments.length??0,plannedThreadCount:plan?.threads.length??0,issues,migrationUntil:until}};
  }

  async migrationStatus(episodeId?:string):Promise<MigrationInspection|MigrationInspection[]>{
    await this.game();this.owner();
    if(episodeId)return (await this.inspectMigration(episodeId)).inspection;
    const episodes=await this.root().collection('episodes').get();
    return Promise.all(episodes.docs.map(snapshot=>this.inspectMigration(snapshot.id).then(result=>result.inspection)));
  }

  /** Explicit, owner-only, resumable migration. Dry runs only read and validate. */
  async migrateEpisode(id:string,options:{dryRun?:boolean}={}):Promise<MigrationResult>{
    await this.game();this.owner();
    const canonicalId=parseEpisodeIdentity(id).id,initial=await this.inspectMigration(canonicalId);
    if(options.dryRun)return {...initial.inspection,dryRun:true,changed:initial.inspection.status==='pending'};
    if(initial.inspection.status==='missing')throw new CommunityError('Episode not found.',{status:404,code:'not-found'});
    if(initial.inspection.status==='blocked')throw new CommunityError('Historical comments need review before migration.',{status:409,code:'migration'});
    if(initial.inspection.status==='in-progress')throw new CommunityError('Historical conversations are being prepared. Retry in a moment.',{status:409,code:'migration'});
    if(initial.inspection.status==='ready')return {...initial.inspection,dryRun:false,changed:false};
    const ref=initial.ref,now=this.clock(),token=crypto.randomUUID();
    const plan=await this.db.runTransaction(async tx=>{
      await this.game(tx);const snapshot=await tx.get(ref);
      if(!snapshot.exists)throw new CommunityError('Episode not found.',{status:404,code:'not-found'});
      if(snapshot.data()!.discussionSchemaVersion===2)return null;
      const record=asRecord(snapshot);
      if(record.migrationToken&&Date.parse(record.migrationUntil??'')>Date.parse(now))throw new CommunityError('Historical conversations are being prepared. Retry in a moment.',{status:409,code:'migration'});
      const rows=await tx.get(ref.collection('comments')),result=migrateComments(record,rows.docs.map(row=>({...row.data(),id:row.id}) as DiscussionComment));
      tx.update(ref,{migrationToken:token,migrationUntil:new Date(Date.parse(now)+60000).toISOString()});return result;
    });
    if(!plan){const ready=await this.inspectMigration(canonicalId);return {...ready.inspection,dryRun:false,changed:false};}
    const patches:Array<{ref:DocumentReference;data:object}>=plan.comments.map(comment=>({ref:ref.collection('comments').doc(comment.id),data:{threadId:comment.threadId,rootId:comment.rootId,sequence:comment.sequence,replyToId:comment.replyToId,replyToName:comment.replyToName,deletedAt:comment.deletedAt}}));
    patches.push(...plan.threads.map(thread=>({ref:this.thread(thread.id),data:thread})));
    try{
      for(let start=0;start<patches.length;start+=300){
        await this.db.runTransaction(async tx=>{
          const snapshot=await tx.get(ref);
          if(snapshot.data()!.migrationToken!==token)throw new CommunityError('Migration changed. Retry after refreshing.',{status:409,code:'migration'});
          for(const patch of patches.slice(start,start+300))tx.set(patch.ref,patch.data,{merge:true});
          tx.update(ref,{migrationUntil:new Date(Date.parse(this.clock())+60000).toISOString()});
        });
      }
      await this.db.runTransaction(async tx=>{
        const snapshot=await tx.get(ref);if(snapshot.data()!.migrationToken!==token)throw new CommunityError('Migration changed. Retry.',{status:409,code:'migration'});
        const rows=await tx.get(ref.collection('comments')),incomplete=rows.docs.some(row=>{const data=row.data();return typeof data.threadId!=='string'||!data.threadId||typeof data.rootId!=='string'||!data.rootId||!Number.isSafeInteger(data.sequence)||Number(data.sequence)<1;});
        if(incomplete)throw new CommunityError('New historical comments were added during migration. Run the migration again.',{status:409,code:'migration'});
        tx.update(ref,{discussionSchemaVersion:2,migrationToken:'',migrationUntil:''});
      });
    }catch(error){try{await ref.set({migrationUntil:''},{merge:true});}catch{/* Preserve the original failure; the lease will expire safely. */}throw error;}
    const complete=await this.inspectMigration(canonicalId);return {...complete.inspection,dryRun:false,changed:true};
  }

  async catalog():Promise<DiscussionCatalog>{
    await this.game();
    const [episodes,user,watched,states]=await Promise.all([
      this.root().collection('episodes').get(),this.user().get(),this.user().collection('episodes').get(),
      this.user().collection('threads').where('hasUnread','==',true).get(),
    ]);
    const now=this.clock(),hideSpoilers=user.data()?.hideSpoilers===true,unread=Object.fromEntries(states.docs.map(row=>[row.id,row.data() as ReadState]));
    const watchedIds=new Set(watched.docs.filter(row=>row.data().watched===true).map(row=>row.id));
    return {serverNow:now,hideSpoilers,unread,schedule:null,
      episodes:episodes.docs.map(snapshot=>{
        const record=asRecord(snapshot),available=discussionAvailable(record,now),watched=watchedIds.has(record.id),hidden=hiddenEpisode(hideSpoilers,watched);
        const counters=Object.values(unread).filter(state=>state.episodeId===record.id);
        return {id:record.id,season:record.season,episode:record.episode,opensAt:discussionOpening(record),broadcastDate:record.broadcastDate??'',version:record.discussionVersion??'',available,discussionReady:record.discussionSchemaVersion===2,watched,spoilerHidden:hidden,
          lifecycle:!available?'scheduled' as const:Date.parse(now)-Date.parse(discussionOpening(record)!)<86400000?'open' as const:'ongoing' as const,
          unreadCount:counters.reduce((n,state)=>n+state.unreadCount,0),personalCount:counters.reduce((n,state)=>n+state.personalCount,0),recap:record.status==='published'&&!hidden?recapOnly(record):null};
      }).sort((a,b)=>b.season-a.season||b.episode-a.episode)};
  }
  async adminSchedule(season:number){await this.game();this.owner();const row=await this.root().collection('discussionSchedules').doc(String(season)).get();return row.exists?row.data() as BroadcastSchedule:null;}
  async saveSchedule(input:Record<string,unknown>){
    this.owner();
    return this.db.runTransaction(async tx=>{
      const game=await this.game(tx),now=this.clock(),schedule=makeSchedule(input,game.season.number,now),calendar=calendarEpisodes(schedule);
      const scheduleRef=this.root().collection('discussionSchedules').doc(String(schedule.season)),old=await tx.get(scheduleRef);
      if((old.data()?.updatedAt??'')!==input.expectedUpdatedAt)throw new CommunityError('The calendar changed in another window. Reload before saving.');
      const refs=calendar.map(record=>this.episode(record.id)),existing=await tx.getAll(...refs);
      for(let index=0;index<calendar.length;index++){
        const record=calendar[index],saved=existing[index].data() as EpisodeRecord|undefined;
        // A confirmed calendar never closes a discussion that already has access,
        // or overwrites an explicit administrator override.
        if(saved?.discussionOverride||saved&&discussionAvailable(saved,now))continue;
        tx.set(refs[index],{...record,discussionVersion:crypto.randomUUID(),...(!saved?{status:'draft',title:'Episode '+record.episode,body:'',actions:[],createdAt:now,updatedAt:'',publishedAt:'',discussionSchemaVersion:2}:{})},{merge:true});
      }
      tx.set(scheduleRef,schedule);return {schedule};
    });
  }
  async override(input:Record<string,unknown>){
    this.owner();const ref=this.episode(input.episodeId);
    return this.db.runTransaction(async tx=>{
      const game=await this.game(tx),snapshot=await tx.get(ref),now=this.clock(),identity=parseEpisodeIdentity(ref.id);
      if(identity.season!==game.season.number)throw new CommunityError('Only the active season calendar can be changed.');
      const saved=snapshot.data() as EpisodeRecord|undefined;
      if((saved?.discussionVersion??'')!==input.expectedVersion)throw new CommunityError('This opening changed. Reload before saving.');
      let opensAt:string|null,broadcastDate=saved?.broadcastDate??'';
      if(input.mode==='open')opensAt=now;
      else if(input.mode==='hold')opensAt=null;
      else if(input.mode==='schedule'){
        broadcastDate=String(input.date??'');opensAt=localOpening(broadcastDate,String(input.localTime??''),String(input.timeZone??''));
      }else throw new CommunityError('Choose open, hold, or schedule.');
      tx.set(ref,{...identity,discussionOpensAt:opensAt,broadcastDate,discussionOverride:true,discussionVersion:crypto.randomUUID(),...(!saved?{status:'draft',title:'Episode '+identity.episode,body:'',actions:[],createdAt:now,updatedAt:'',publishedAt:'',discussionSchemaVersion:2}:{})},{merge:true});return {opensAt};
    });
  }
  async preferences(input:Record<string,unknown>){
    await this.game();
    if(typeof input.hideSpoilers!=='boolean')throw new CommunityError('Choose a spoiler preference.');
    await this.user().set({hideSpoilers:input.hideSpoilers},{merge:true});
  }
  async watched(input:Record<string,unknown>){
    await this.game();const episode=await this.episode(input.episodeId).get();
    if(!episode.exists)throw new CommunityError('Episode not found.');
    if(typeof input.watched!=='boolean')throw new CommunityError('Choose a watched status.');
    await this.user().collection('episodes').doc(episode.id).set({watched:input.watched});
  }
  async threads(input:{episodeId?:string;season?:number;unread?:boolean;sort?:string;cursor?:string;pageSize?:number}):Promise<ThreadPage>{
    const catalog=await this.catalog(),eligible=new Set(catalog.episodes.filter(episode=>episode.available&&episode.discussionReady&&(!input.episodeId||episode.id===parseEpisodeIdentity(input.episodeId).id)&&(!input.season||episode.season===input.season)).map(episode=>episode.id));
    const order=input.sort==='newest'?'createdAt':'lastActivityAt',size=Math.min(25,Math.max(1,input.pageSize??25));
    let source:Query=input.unread?this.user().collection('threads').where('hasUnread','==',true):this.root().collection('discussionThreads');
    if(input.episodeId)source=source.where('episodeId','==',parseEpisodeIdentity(input.episodeId).id);
    else if(input.season)source=source.where('season','==',input.season);
    source=source.orderBy(order,'desc').orderBy('id','desc');
    if(input.cursor){let cursor;try{cursor=JSON.parse(Buffer.from(input.cursor,'base64url').toString());}catch{throw new CommunityError('Invalid activity cursor.');}source=source.startAfter(timestamp(cursor.at),resourceThreadId(cursor.id));}
    const selected:DiscussionThread[]=[];let cursor:string|null=null,exhausted=false;
    // Scan bounded pages so held episodes never leak into a feed. No per-thread queries.
    for(let page=0;page<8&&selected.length<size&&!exhausted;page++){
      const requested=size-selected.length,rows=await source.limit(requested).get();exhausted=rows.empty;
      if(rows.empty)break;
      const summaries=input.unread?await this.db.getAll(...rows.docs.map(row=>this.thread(row.id))):rows.docs;
      for(const snapshot of summaries){if(snapshot.exists){const thread=snapshot.data() as DiscussionThread;if(eligible.has(thread.episodeId))selected.push(thread);}}
      const last=rows.docs.at(-1)!;cursor=Buffer.from(JSON.stringify({at:last.data()[order],id:last.id})).toString('base64url');
      source=source.startAfter(last.data()[order],last.id);
      if(rows.size<requested)exhausted=true;
    }
    const roots=selected.length?await this.db.getAll(...selected.map(thread=>this.episode(thread.episodeId).collection('comments').doc(thread.rootId))):[];
    const rows=selected.flatMap((thread,index)=>{const root=roots[index],episode=catalog.episodes.find(item=>item.id===thread.episodeId);return root?.exists&&episode?[previewThread(thread,root.data() as DiscussionComment,catalog.unread[thread.id],episode.spoilerHidden)]:[];});
    return {rows,cursor:exhausted?null:cursor};
  }
  async conversation(threadId:string,after=0,reveal=false):Promise<ConversationPage>{
    await this.game();const summary=await this.thread(threadId).get();if(!summary.exists)throw new CommunityError('Conversation not found.');
    const thread=summary.data() as DiscussionThread,ref=this.episode(thread.episodeId);
    const [episode,user,watched,state,root]=await Promise.all([ref.get(),this.user().get(),this.user().collection('episodes').doc(ref.id).get(),this.user().collection('threads').doc(thread.id).get(),ref.collection('comments').doc(thread.rootId).get()]);
    if(!episode.exists)throw new CommunityError('Episode not found.',{status:404,code:'not-found'});
    if(episode.data()!.discussionSchemaVersion!==2)throw new CommunityError('This historical conversation is not ready yet.',{status:409,code:'migration'});
    assertDiscussionOpen(asRecord(episode),this.clock());
    if(!root.exists)throw new CommunityError('Conversation data needs repair.',{status:503,code:'migration'});
    const hidden=hiddenEpisode(user.data()?.hideSpoilers===true,watched.data()?.watched===true,reveal);
    const preview=previewThread(thread,root.data() as DiscussionComment,state.data() as ReadState|undefined,hidden);
    if(hidden)return {thread:preview,comments:[],through:0,hasMore:false,spoilerHidden:true};
    if(!Number.isSafeInteger(after)||after<0||after>thread.sequence)throw new CommunityError('Invalid reply cursor.');
    const comments=await ref.collection('comments').where('threadId','==',thread.id).where('sequence','>',after).orderBy('sequence','asc').limit(51).get();
    const rows=comments.docs.slice(0,50).map(row=>row.data() as DiscussionComment).map(comment=>comment.deletedAt?{...comment,text:''}:comment);
    return {thread:preview,comments:rows,through:rows.at(-1)?.sequence??after,hasMore:comments.size>50,spoilerHidden:false};
  }
  async recap(episodeId:string,reveal:boolean){
    await this.game();const ref=this.episode(episodeId),[snapshot,user,watched]=await Promise.all([ref.get(),this.user().get(),this.user().collection('episodes').doc(ref.id).get()]);
    if(!snapshot.exists)throw new CommunityError('Episode not found.');
    if(hiddenEpisode(user.data()?.hideSpoilers===true,watched.data()?.watched===true,reveal))return {recap:null};
    return {recap:snapshot.data()!.status==='published'?recapOnly(asRecord(snapshot)):null};
  }
  async post(input:Record<string,unknown>){
    const episodeRef=this.episode(input.episodeId),id=resourceId(input.id),text=requiredText(input.text,'Comment',2000);
    return this.db.runTransaction(async tx=>{
      const game=await this.game(tx),author=linkedAuthor(game,this.actor,true),now=this.clock(),episode=await tx.get(episodeRef);
      if(!episode.exists)throw new CommunityError('Episode not found.',{status:404,code:'not-found'});assertDiscussionOpen(asRecord(episode),now);
      if(episode.data()!.discussionSchemaVersion!==2)throw new CommunityError('The game master must migrate this historical conversation before posting.',{status:409,code:'migration'});
      const commentRef=episodeRef.collection('comments').doc(id),existing=await tx.get(commentRef);
      const replyId=input.replyToCommentId?resourceId(input.replyToCommentId):'';
      const target=replyId?await tx.get(episodeRef.collection('comments').doc(replyId)):null;
      if(replyId&&!target?.exists)throw new CommunityError('The reply target no longer exists.');
      const recipient=target?.data() as DiscussionComment|undefined;
      const rootId=recipient?.rootId??id,threadId=threadIdentity(episodeRef.id,rootId),threadRef=this.thread(threadId),oldThread=await tx.get(threadRef);
      if(existing.exists){const saved=existing.data() as DiscussionComment;if(saved.authorUid===this.actor.uid&&saved.text===text&&saved.threadId===threadId&&(saved.replyToCommentId??'')===replyId)return {threadId};throw new CommunityError('This post ID is already used. Reload before posting again.');}
      if(replyId&&(!oldThread.exists||recipient?.threadId!==threadId))throw new CommunityError('This reply does not belong to that conversation.');
      const cooldownRef=this.root().collection('communityPrivate').doc(this.actor.uid),cooldown=await tx.get(cooldownRef);
      if(cooldown.exists&&Date.parse(now)-Date.parse(cooldown.data()!.lastCommentAt)<3000)throw new CommunityError('Please wait a few seconds before posting again.');
      const audience=await this.audience(game,tx),states=await this.states(tx,threadId,audience);
      const previous=oldThread.data() as DiscussionThread|undefined,sequence=(previous?.sequence??0)+1;
      const comment:DiscussionComment={id,authorId:author.id,authorUid:this.actor.uid,authorName:author.name,text,createdAt:now,threadId,rootId,sequence,replyToId:recipient?.authorId??'',replyToName:recipient?.authorName??'',replyToCommentId:replyId,deletedAt:''};
      const thread:DiscussionThread=previous?{...previous,sequence,replyCount:previous.replyCount+1,lastActivityAt:now}:{id:threadId,episodeId:episodeRef.id,season:asRecord(episode).season,episode:asRecord(episode).episode,rootId:id,authorId:author.id,createdAt:now,lastActivityAt:now,replyCount:0,sequence};
      tx.create(commentRef,comment);tx.set(threadRef,thread);tx.set(cooldownRef,{lastCommentAt:now},{merge:true});
      for(const entry of states){const state=entry.state??{...emptyRead(episodeRef.id),readSequence:previous?.sequence??0},own=entry.authorId===author.id;tx.set(entry.ref,counterData(thread,{...state,unreadCount:state.unreadCount+(own?0:1),personalCount:state.personalCount+(!own&&commentIsPersonal(comment,thread.authorId,entry.authorId)?1:0)}));}
      return {threadId};
    });
  }
  async changeComment(input:Record<string,unknown>,remove=false){
    const episodeRef=this.episode(input.episodeId),commentRef=episodeRef.collection('comments').doc(resourceId(input.id));
    await this.db.runTransaction(async tx=>{
      const game=await this.game(tx),author=linkedAuthor(game,this.actor,true),episode=await tx.get(episodeRef),snapshot=await tx.get(commentRef);
      if(!episode.exists||!snapshot.exists)throw new CommunityError('Comment not found.',{status:404,code:'not-found'});
      if(episode.data()!.discussionSchemaVersion!==2)throw new CommunityError('The game master must migrate this historical conversation before editing it.',{status:409,code:'migration'});
      assertDiscussionOpen(asRecord(episode),this.clock());const comment=snapshot.data() as DiscussionComment;
      assertCommentOwner(comment,author.id,isCommunityOwner(this.actor));
      if(comment.deletedAt){if(remove)return;throw new CommunityError('This comment was deleted.');}
      if(!remove){
        if((comment.updatedAt??comment.createdAt)!==input.expectedUpdatedAt)throw new CommunityError('This comment changed. Reload before editing.');
        tx.update(commentRef,{text:requiredText(input.text,'Comment',2000),updatedAt:this.clock()});return;
      }
      const threadRef=this.thread(comment.threadId),threadSnapshot=await tx.get(threadRef),thread=threadSnapshot.data() as DiscussionThread;
      const audience=await this.audience(game,tx),states=await this.states(tx,thread.id,audience);
      tx.update(commentRef,{text:'',deletedAt:this.clock(),updatedAt:this.clock()});
      if(comment.id!==comment.rootId)tx.update(threadRef,{replyCount:Math.max(0,thread.replyCount-1)});
      for(const entry of states)if(entry.state&&comment.sequence>entry.state.readSequence&&comment.authorId!==entry.authorId){tx.set(entry.ref,counterData(thread,{...entry.state,unreadCount:Math.max(0,entry.state.unreadCount-1),personalCount:Math.max(0,entry.state.personalCount-(commentIsPersonal(comment,thread.authorId,entry.authorId)?1:0))}));}
    });
  }
  async markRead(input:Record<string,unknown>){
    const threadRef=this.thread(input.threadId);
    if(!Number.isSafeInteger(input.through)||Number(input.through)<0)throw new CommunityError('Invalid read position.');
    await this.db.runTransaction(async tx=>{
      const game=await this.game(tx),author=linkedAuthor(game,this.actor,true),snapshot=await tx.get(threadRef);
      if(!snapshot.exists)throw new CommunityError('Conversation not found.');
      const thread=snapshot.data() as DiscussionThread,episode=await tx.get(this.episode(thread.episodeId));
      if(!episode.exists)throw new CommunityError('Episode not found.',{status:404,code:'not-found'});
      if(episode.data()!.discussionSchemaVersion!==2)throw new CommunityError('This historical conversation is not ready yet.',{status:409,code:'migration'});
      assertDiscussionOpen(asRecord(episode),this.clock());
      const through=Number(input.through);if(through>thread.sequence)throw new CommunityError('Reload the conversation before marking it read.');
      const stateRef=this.user().collection('threads').doc(thread.id),stateSnapshot=await tx.get(stateRef),state=(stateSnapshot.data() as ReadState|undefined)??emptyRead(thread.episodeId);
      if(through<=state.readSequence)return;
      const rows=await tx.get(this.episode(thread.episodeId).collection('comments').where('threadId','==',thread.id).where('sequence','>',state.readSequence).where('sequence','<=',through).orderBy('sequence'));
      const unread=rows.docs.map(row=>row.data() as DiscussionComment).filter(comment=>!comment.deletedAt&&comment.authorId!==author.id);
      tx.set(stateRef,counterData(thread,acknowledgeRead(state,through,unread.length,unread.filter(comment=>commentIsPersonal(comment,thread.authorId,author.id)).length)));
    });
  }
}

function resourceThreadId(value:unknown){if(typeof value!=='string'||value.length>112||!/^([1-9]\d{0,3})-([1-9]\d{0,3})__[a-zA-Z0-9_-]{1,100}$/.test(value))throw new CommunityError('Invalid conversation.');return value;}
function recapOnly(record:EpisodeRecord):EpisodeRecap{return {id:record.id,season:record.season,episode:record.episode,title:record.title??'Episode '+record.episode,body:record.body??'',status:record.status??'draft',actions:record.actions??[],createdAt:record.createdAt??'',updatedAt:record.updatedAt??'',publishedAt:record.publishedAt??''};}
