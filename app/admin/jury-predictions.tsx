import {answerOptions,questionIds,type JuryEpisode,type JuryPrediction} from '@/lib/jury';
import {juryQuestionTitle} from '@/lib/jury-results';

/** Presentational only: its parent receives the Commissioner-only catalog. */
export function PrivatePredictions({record,players,predictions}:{record:JuryEpisode;players:Array<{id:string;name:string;fromEpisode:number|null}>;predictions:JuryPrediction[]}){
  return <section className="jury-private-predictions" aria-labelledby="private-predictions-heading"><h3 id="private-predictions-heading">Private saved predictions · Episode {record.snapshot.episode}</h3><div className="jury-prediction-list">{players.map(player=>{
    const saved=predictions.find(row=>row.playerId===player.id&&row.episode===record.snapshot.episode);
    return <article className="jury-prediction-card" key={player.id}><header><h4>{player.name}</h4><span>{Object.keys(saved?.answers??{}).length}/5 saved</span></header><p className="jury-prediction-meta">{player.fromEpisode===null?'Eligibility needs review':`Eligible from Episode ${player.fromEpisode}`}{saved?` · Submission revision ${saved.revision}`:' · No saved answers'}</p><dl>{questionIds.map(question=>{
      const answer=saved?.answers[question];
      return <div key={question}><dt>{question.toUpperCase()}. {juryQuestionTitle(record.snapshot,question)}</dt><dd>{answer?<><strong>{answerOptions(record.snapshot,question,saved?.answers.q1?.value).find(option=>option.value===answer.value)?.label??answer.value}</strong><small><time dateTime={answer.savedAt}>{answer.savedAt}</time> · revision {answer.revision} · {answer.late?'late':'pre-airtime'}</small></>:'Unanswered'}</dd></div>;
    })}</dl></article>;
  })}</div></section>;
}
