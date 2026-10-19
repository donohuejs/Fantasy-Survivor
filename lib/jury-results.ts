import {answerOptions,questionIds,type JuryEpisode,type JuryPrediction,type PlayerJurySnapshot,type QuestionId} from './jury.ts';

export type QuestionAccuracy={correct:number;answered:number};
export type PlayerJuryResults={keyRevision:number;total:number;cleanSweep:number;questions:Array<{id:QuestionId;title:string;answer:string|null;correctAnswers:string[];outcome:'correct'|'incorrect'|'unanswered';points:number;accuracy:QuestionAccuracy}>};
export function juryAnswerLabel(snapshot:PlayerJurySnapshot,question:QuestionId,value:string){return answerOptions(snapshot,question,'merge').find(option=>option.value===value)?.label??value;}
export function juryQuestionTitle(snapshot:PlayerJurySnapshot,question:QuestionId){return {q1:snapshot.format==='post-merge'?'Individual immunity':'Tribal Council tribe',q2:'Played at Tribal',q3:'Castaways receiving votes',q4:'Other vote recipient',q5:'Voted off'}[question];}
/** Central visibility boundary; later spoiler policy can further restrict this, never weaken it. */
export function mayViewConfirmedJuryResults(record:JuryEpisode,prediction:JuryPrediction|null,now:string){
  return Boolean(Date.parse(now)>=Date.parse(record.snapshot.airtime)&&record.key&&record.keyRevision>0&&record.confirmedAt&&record.gradedAt&&(!prediction||prediction.grade?.keyRevision===record.keyRevision&&prediction.gradedAt===record.gradedAt));
}
export function juryQuestionAccuracy(record:JuryEpisode,predictions:JuryPrediction[]):Record<QuestionId,QuestionAccuracy>{
  const totals=Object.fromEntries(questionIds.map(question=>[question,{correct:0,answered:0}])) as Record<QuestionId,QuestionAccuracy>;
  const seen=new Set<string>();
  for(const prediction of predictions){
    if(prediction.season!==record.snapshot.season||prediction.episode!==record.snapshot.episode||prediction.gradingEligible!==true||prediction.grade?.keyRevision!==record.keyRevision||prediction.gradedAt!==record.gradedAt||seen.has(prediction.playerId))continue;
    seen.add(prediction.playerId);
    for(const question of questionIds)if(prediction.answers[question]){totals[question].answered++;if(prediction.grade.correct[question])totals[question].correct++;}
  }
  return totals;
}
export function playerJuryResults(record:JuryEpisode,prediction:JuryPrediction|null,predictions:JuryPrediction[],now:string):PlayerJuryResults|null{
  if(!mayViewConfirmedJuryResults(record,prediction,now))return null;
  const accuracy=juryQuestionAccuracy(record,predictions);
  return {keyRevision:record.keyRevision,total:prediction?.grade?.total??0,cleanSweep:prediction?.grade?.cleanSweep??0,questions:questionIds.map(id=>({id,title:juryQuestionTitle(record.snapshot,id),answer:prediction?.answers[id]?juryAnswerLabel(record.snapshot,id,prediction.answers[id]!.value):null,correctAnswers:record.key![id].map(value=>juryAnswerLabel(record.snapshot,id,value)),outcome:!prediction?.answers[id]?'unanswered':prediction.grade!.correct[id]?'correct':'incorrect',points:prediction?.grade?.points[id]??0,accuracy:accuracy[id]}))};
}
