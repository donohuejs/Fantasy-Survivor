import 'server-only';
import {assertScoringCommissioner} from './scoring-authority.ts';
import type {Firestore} from 'firebase-admin/firestore';
import type {GameState} from './game-data.ts';
import {episodeActions,type EpisodeRecap} from './community.ts';
import {canonicalJson} from './score-ledger.ts';
import {parseScoreCorrection,planScoreCorrection,sameCorrection,ScoreCorrectionError,type ScoreCorrection,type ScoringActor} from './score-corrections.ts';

export async function correctScoring(db:Firestore,actor:ScoringActor,input:unknown,save:boolean,at=new Date().toISOString()){
  assertScoringCommissioner(actor);
  const command=parseScoreCorrection(input),ref=db.doc('games/survivor-51'),auditRef=ref.collection('scoreCorrections').doc(command.id);
  return db.runTransaction(async tx=>{
    const [snapshot,receipt]=await Promise.all([tx.get(ref),tx.get(auditRef)]);
    if(!snapshot.exists)throw new ScoreCorrectionError('The league is not initialized.');
    const current=snapshot.data() as GameState;
    if(current.season.number!==command.season)throw new ScoreCorrectionError('The active season changed.');
    if(receipt.exists){
      const correction=receipt.data() as ScoreCorrection;
      if(!sameCorrection(correction.command,command)||correction.actorUid!==actor.uid)throw new ScoreCorrectionError('That correction ID was already used for a different request.');
      return {correction,expectedVersion:command.expectedVersion,alreadyApplied:true};
    }
    const result=await planScoreCorrection(current,{...actor,commissioner:true},command,at);
    const episode=result.preview.correction.episode;
    const recapRef=episode!==undefined?ref.collection('episodes').doc(`${command.season}-${episode}`):null;
    const recap=recapRef?await tx.get(recapRef):null;
    if(recap?.exists){
      const data=recap.data() as EpisodeRecap;
      if(data.season!==command.season||data.episode!==episode)throw new ScoreCorrectionError('Episode snapshot identity needs review.');
    }
    if(save){
      // Update only ledger fields; preserve unknown fields and all other game data.
      tx.update(ref,{scoreEvents:result.game.scoreEvents,scoringRevision:result.game.scoringRevision});
      tx.create(auditRef,result.preview.correction);
      // Historical recap snapshots are inspected only. Refreshing one is a
      // separate commissioner decision in the recap editor, never a side effect.
    }
    return {...result.preview,...(recapRef?{recap:{id:recapRef.id,exists:recap?.exists??false,...(recap?.exists?{status:String(recap.data()!.status??'draft'),scoringDiffersAfterSave:canonicalJson(recap.data()!.actions??[])!==canonicalJson(episodeActions(result.game,episode!))}:{})}}:{}),alreadyApplied:false};
  });
}
export async function scoringCorrectionHistory(db:Firestore,actor:ScoringActor,eventId:string){
  assertScoringCommissioner(actor);
  if(!eventId||eventId.length>500)throw new ScoreCorrectionError('Choose a scoring entry.',400);
  const ref=db.doc('games/survivor-51'),game=await ref.get();
  if(!game.exists)throw new ScoreCorrectionError('The league is not initialized.');
  const current=game.data() as GameState;
  const rows=await ref.collection('scoreCorrections').where('season','==',current.season.number).get();
  return rows.docs.map(doc=>doc.data() as ScoreCorrection).filter(row=>row.before.some(e=>e.id===eventId)||row.after.some(e=>e.id===eventId)).sort((a,b)=>b.at.localeCompare(a.at));
}
