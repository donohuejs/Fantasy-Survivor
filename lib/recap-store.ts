import type {Firestore} from 'firebase-admin/firestore';
import type {GameState} from './game-data.ts';
import {CommunityError,isCommunityOwner,makeRecap,wholeNumber,type CommunityActor,type EpisodeRecap} from './community.ts';
import {calendarEpisodes,discussionOpening,type BroadcastSchedule,type EpisodeRecord} from './discussions.ts';

/** Recap changes merge into the episode; discussion metadata and comments survive. */
export async function saveEpisodeRecap(db:Firestore,actor:CommunityActor,input:Record<string,unknown>,now:string){
  if(!isCommunityOwner(actor))throw new CommunityError('Only the game master can publish recaps.',{status:403,code:'authorization'});
  const root=db.doc('games/survivor-51'),id=wholeNumber(input.season,'season')+'-'+wholeNumber(input.episode,'episode');
  return db.runTransaction(async tx=>{
    const gameDoc=await tx.get(root);if(!gameDoc.exists)throw new CommunityError('The league is not ready.');
    const game=gameDoc.data() as GameState,ref=root.collection('episodes').doc(id),old=await tx.get(ref);
    const discussion=old.data() as EpisodeRecord|undefined,recap=makeRecap(game,input,discussion?discussion as EpisodeRecap:null,now);
    let opening:Record<string,unknown>={};
    if(!(discussion&&'discussionOpensAt' in discussion)){
      const calendar=await tx.get(root.collection('discussionSchedules').doc(String(game.season.number)));
      const scheduled=calendar.exists?calendarEpisodes(calendar.data() as BroadcastSchedule).find(item=>item.id===id):undefined;
      opening=scheduled?{discussionOpensAt:scheduled.discussionOpensAt,broadcastDate:scheduled.broadcastDate}:recap.status==='published'?{discussionOpensAt:discussion?.status==='published'?discussionOpening(discussion):now}:{};
    }
    // Never infer that an existing historical episode is safe to migrate.
    // A new parent can still have orphaned comments; leave those for explicit review too.
    let schema:Record<string,unknown>={};
    if(!old.exists){
      const [comments,threads]=await Promise.all([tx.get(ref.collection('comments').limit(1)),tx.get(root.collection('discussionThreads').where('episodeId','==',id).limit(1))]);
      if(comments.empty&&threads.empty)schema={discussionSchemaVersion:2};
    }
    tx.set(ref,{...recap,...opening,...schema},{merge:true});
    return {updatedAt:recap.updatedAt};
  });
}
