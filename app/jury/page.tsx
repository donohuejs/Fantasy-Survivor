'use client';
import {useVisiblePolling} from '@/app/use-visible-polling';
import {readIntervals} from '@/lib/visible-polling';
import {requestId} from '@/lib/request-id';
import {useCallback,useRef,useState} from 'react';
import {SiteHeader} from '../site-header';
import {useGame} from '../game-provider';
import {answerOptions,questionIds,type QuestionId} from '@/lib/jury';
import {juryRequest,juryQuestionLabels,type PlayerJuryCatalog,type PlayerJuryEpisode} from './client';
import {JuryResults} from './results';

export default function JuryPage(){
  const {user,cloud}=useGame();
  const [state,setState]=useState<{uid:string;data:PlayerJuryCatalog|null;error:string}>({uid:'',data:null,error:''});
  const [selected,setSelected]=useState<number|null>(null);
  const refreshSequence=useRef(0);
  const read=useCallback(async(signal:AbortSignal)=>{
    if(!user||!cloud)return;
    const sequence=++refreshSequence.current;
    try{const data=await juryRequest<PlayerJuryCatalog>({},true,signal);if(!signal.aborted&&sequence===refreshSequence.current)setState({uid:user.uid,data,error:''});}
    catch(error){if(!signal.aborted&&sequence===refreshSequence.current)setState(old=>({...old,uid:user.uid,error:error instanceof Error?error.message:'Could not load predictions.'}));throw error;}
  },[user,cloud]);
  const refresh=useVisiblePolling(read,readIntervals.jury,Boolean(user&&cloud));
  const data=state.uid===user?.uid?state.data:null;
  const episode=data?.episodes.find(e=>e.snapshot.episode===selected)??data?.episodes[0];
  return <main className="inner-page"><SiteHeader active="/jury" subtitle="Jury Mode"/><section className="inner-hero"><p className="eyebrow">Stay in the game</p><h1>Jury Mode</h1><p>Keep earning league points with five predictions each episode. Each answer saves separately before airtime.</p></section><section className="panel jury-workspace">
    {state.error&&<p role="alert" className="setup-notice">{state.error} <button onClick={refresh}>Refresh</button></p>}
    {!cloud?<p>Connect an isolated Firebase test environment to rehearse Jury Mode.</p>:!data&&!state.error?<p role="status">Loading your predictions…</p>:data&&!episode?<><h2>{data.eligibility.issues.length?'Eligibility needs review':data.eligibility.fromEpisode?'You’re eligible for Jury Mode.':'Your drafted team is still in play.'}</h2><p>{data.eligibility.issues.length?'The game master must verify missing draft or elimination history before predictions open.':data.eligibility.fromEpisode?`Your first eligible episode is ${data.eligibility.fromEpisode}. The game master will open verified future episode predictions after activation is approved.`:'Jury Mode begins in the episode after all three original draft slots are eliminated.'}</p></>:null}
    {episode&&data&&<><label className="jury-history">Episode history<select value={episode.snapshot.episode} onChange={e=>setSelected(Number(e.target.value))}>{data.episodes.map(e=><option value={e.snapshot.episode} key={e.snapshot.episode}>Season {e.snapshot.season} · Episode {e.snapshot.episode} · {e.status}</option>)}</select></label><PredictionEpisode key={episode.snapshot.episode+':'+user?.uid} episode={episode} refresh={refresh}/></>}
  </section></main>;
}
function PredictionEpisode({episode,refresh}:{episode:PlayerJuryEpisode;refresh:()=>Promise<void>}){
  const {snapshot,prediction}=episode;
  const [saving,setSaving]=useState<QuestionId|null>(null),[error,setError]=useState('');
  const [failed,setFailed]=useState<Record<string,unknown>|null>(null);
  const busy=useRef(false);
  async function submit(command:Record<string,unknown>){
    if(busy.current)return;busy.current=true;setSaving(command.question as QuestionId);setError('');setFailed(command);
    try{await juryRequest(command);setFailed(null);await refresh();}
    catch(error){setError(error instanceof Error?error.message:'Answer could not save.');await refresh();}
    finally{busy.current=false;setSaving(null);}
  }
  function save(question:QuestionId,value:string){void submit({action:'save-answer',season:snapshot.season,episode:snapshot.episode,question,value,expectedRevision:prediction?.revision??0,requestId:requestId()});}
  const count=Object.keys(prediction?.answers??{}).length;
  if(episode.results)return <><JuryResults episode={snapshot.episode} results={episode.results}/>{episode.eligibilityNeedsReview&&<p className="setup-notice">Eligibility is under Game Master review. These are the last confirmed results.</p>}</>;
  return <article className="jury-episode"><div className="panel-heading"><div><p className="eyebrow dark">Season {snapshot.season}</p><h2>Episode {snapshot.episode}</h2></div><span className="season-button">{episode.status}</span></div><p>Locks {new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:snapshot.timeZone}).format(new Date(snapshot.airtime))} ({snapshot.timeZone}).</p><p role="status">{count} of 5 answers saved · {episode.locked?'Locked at airtime':episode.canSave?'Open for predictions':'Predictions paused'}</p>
    {episode.locked&&<p className="setup-notice">Predictions are locked. Scoring is pending Game Master confirmation.</p>}
    {episode.eligibilityNeedsReview&&<p className="setup-notice">Eligibility changed after a correction. The game master must review affected awards. Your saved answers are preserved.</p>}
    {error&&<p className="setup-notice" role="alert">{error} {failed&&<button type="button" disabled={Boolean(saving)} onClick={()=>submit(failed!)}>Retry saved request</button>}</p>}
    <div className="jury-questions">{questionIds.map((q,index)=>{
      const answer=prediction?.answers[q],options=answerOptions(snapshot,q,prediction?.answers.q1?.value),label=q==='q1'&&snapshot.format==='post-merge'?'Who will win individual immunity?':juryQuestionLabels[q],weight=q==='q1'&&snapshot.format==='post-merge'?3:q==='q5'?5:1;
      return <section className="jury-question" key={q}><label htmlFor={'jury-'+q}><span>Question {index+1} · +{weight}</span><strong>{label}</strong></label><select id={'jury-'+q} value={answer?.value??''} disabled={!episode.canSave||Boolean(saving)} onChange={e=>save(q,e.target.value)}><option value="" disabled>Choose an answer</option>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select><p className="jury-save-state" role="status">{saving===q?'Saving…':answer?`${episode.locked?'Locked':'Saved'} · ${new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZone:snapshot.timeZone}).format(new Date(answer.savedAt))} · revision ${answer.revision}`:'Unanswered'}</p></section>;
    })}</div>
  </article>;
}
