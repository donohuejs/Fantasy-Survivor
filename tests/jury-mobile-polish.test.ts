import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';import path from 'node:path';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import ts from 'typescript';
import {acceptanceGame,acceptanceSnapshot,acceptanceFacts} from '../scripts/iphone-fixture.ts';
import {emptyFacts,type JuryEpisode,type JuryPrediction} from '../lib/jury.ts';
import {evidenceSourceError,hasUsefulEvidenceSuggestions} from '../app/admin/jury-evidence-presentation.ts';
import {adminTabs} from '../lib/admin-navigation.ts';
const require=createRequire(import.meta.url),url=(source:string)=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64'),game=acceptanceGame();
async function component(file:string):Promise<string>{
  let source=ts.transpileModule(await readFile(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const names=[...source.matchAll(/from ["']([^"']+)["']/g)].map(match=>match[1]),imports:Record<string,string>={};
  for(const name of names){
    if(name==='react'||name==='react/jsx-runtime')imports[name]=pathToFileURL(require.resolve(name)).href;
    else if(name==='../game-provider')imports[name]=url('export function useGame(){return '+JSON.stringify({game,cloud:true,isAdmin:true,user:{uid:'synthetic-commissioner'}})+';}');
    else if(name==='../jury/client')imports[name]=url('export function juryRequest(){throw Error("No requests during component render");}');
    else{const resolved=name.startsWith('@/')?name.slice(2):path.join(path.dirname(file),name);imports[name]=name==='./jury-predictions'?await component(resolved+'.tsx'):pathToFileURL(path.resolve(resolved+'.ts')).href;}
  }
  source=source.replace(/from ["']([^"']+)["']/g,(_,name)=>'from '+JSON.stringify(imports[name]));return url(source);
}
async function render(file:string,name:string,props:object){const loaded=await import(await component(file));return renderToStaticMarkup(React.createElement(loaded[name],props));}
function record(confirmed=false):JuryEpisode{return {snapshot:acceptanceSnapshot(game,'2026-10-17T00:00:00Z'),facts:acceptanceFacts(),revision:confirmed?5:1,key:confirmed?{q1:['amber'],q2:['idol'],q3:['2'],q4:['synthetic-fern','synthetic-gale'],q5:['synthetic-dusk']}:null,keyRevision:confirmed?2:0,gradedAt:confirmed?'2026-10-17T01:00:00Z':null,confirmedAt:null,confirmedBy:null,...(confirmed?{confirmedEvidenceRevision:5}:{})};}

test('shared Game Master tab strip preserves all seven deep links and mounted panels',async()=>{
  const html=await render('app/admin/admin-tabs.tsx','AdminTabs',{panels:Object.fromEntries(adminTabs.map(tab=>[tab.id,'Unsaved '+tab.id]))});
  assert.match(html,/role="tablist" aria-label="Game master sections"/);assert.equal((html.match(/role="tab"/g)??[]).length,7);assert.doesNotMatch(html,/<select/);
  for(const tab of adminTabs){assert(html.includes('id="tab-'+tab.id+'"'));assert(html.includes('id="panel-'+tab.id+'"'));assert(html.includes('Unsaved '+tab.id));}
});
test('private predictions render readable player cards with all answers and administrative metadata',async()=>{
  const prediction={playerId:'p',episode:5,revision:3,answers:{q1:{value:'amber',savedAt:'2026-10-17T00:00:00.123Z',revision:2,late:false}}} as JuryPrediction;
  const html=await render('app/admin/jury-predictions.tsx','PrivatePredictions',{record:record(),players:[{id:'p',name:'Synthetic participant',fromEpisode:5},{id:'empty',name:'No answers',fromEpisode:null}],predictions:[prediction]});
  assert.equal((html.match(/class="jury-prediction-card"/g)??[]).length,2);assert.match(html,/1\/5 saved/);assert.match(html,/0\/5 saved/);assert.match(html,/Submission revision 3/);assert.match(html,/revision 2/);assert.match(html,/pre-airtime/);assert.match(html,/<time dateTime="2026-10-17T00:00:00.123Z"/);assert.match(html,/Eligibility needs review/);assert.equal((html.match(/Unanswered/g)??[]).length,9);assert.doesNotMatch(html,/<table|<select/);
});
test('evidence sources require a useful source description separately from correction reasons',()=>{
  for(const value of ['', '  ', 'short'])assert.match(evidenceSourceError(value),/Add an evidence source.*10 characters.*correction reason is separate/i);
  assert.equal(evidenceSourceError('Verified broadcast, Episode 5'), '');
});
test('empty suggestion sets are distinguished from recorded councils, merge, immunity or item facts',()=>{
  const facts=emptyFacts();assert.equal(hasUsefulEvidenceSuggestions(facts),false);assert.deepEqual(facts,emptyFacts());
  for(const extra of [{mergeOccurred:false},{immunityWinnerIds:['synthetic-dusk']},{councils:acceptanceFacts().councils},{items:[{id:'i',councilId:'c',kind:'idol' as const,successful:false}]}])assert.equal(hasUsefulEvidenceSuggestions({...facts,...extra}),true);
});
test('initial grading presents required evidence, explicit verification and guarded preview workflow',async()=>{
  const html=await render('app/admin/jury-manager.tsx','EvidenceEditor',{record:record(),busy:false,run:async()=>null});
  for(const label of ['Initial grading','Evidence sources (required)','minLength="10"','All councils and vote-outs verified','All counted and nullified votes','All qualifying item plays verified','Save verified evidence','Preview key and point awards','Do not add them again'])assert(html.includes(label),label);
  assert.doesNotMatch(html,/Correction reason \(required|Confirm corrected key/);
});
test('confirmed grading retains correction reason, current key and explicit preview/confirmation steps',async()=>{
  const html=await render('app/admin/jury-manager.tsx','EvidenceEditor',{record:record(true),busy:false,run:async()=>null});
  for(const label of ['Correct Confirmed Results','Previously confirmed results','Currently confirmed answer key','Correction reason (required, at least 10 characters)','Save verified correction','Preview scoring changes','Synthetic Fern or Synthetic Gale'])assert(html.includes(label),label);
  assert.match(html,/<button[^>]*disabled=""[^>]*>Save verified correction/);assert.match(html,/<button[^>]*disabled=""[^>]*>Preview scoring changes/);
});
test('compact result rows preserve all statuses, accepted answers, accurate denominators and separate Clean Sweep',async()=>{
  const outcomes=['correct','incorrect','unanswered','correct','correct'] as const;
  const html=await render('app/jury/results.tsx','JuryResults',{episode:5,results:{total:7,cleanSweep:0,keyRevision:2,questions:outcomes.map((outcome,index)=>({id:'q'+(index+1),title:'Short title',outcome,answer:outcome==='unanswered'?null:'Own answer',correctAnswers:['Accepted one','Accepted two'],points:index===4?5:outcome==='correct'?1:0,accuracy:{correct:1,answered:2}}))}});
  assert.equal((html.match(/class="jury-result-question"/g)??[]).length,5);for(const outcome of ['correct','incorrect','unanswered'])assert(html.includes('aria-label="'+outcome+'"'));
  assert.equal((html.match(/Correct: /g)??[]).length,2);assert.match(html,/Accepted one or Accepted two/);assert.match(html,/1 of 2 graded Jury participants who answered/);assert.match(html,/Clean Sweep: 0/);assert.match(html,/Episode total: 7 points/);assert.doesNotMatch(html,/<footer|<select|savedAt|revision/);
});
