import assert from 'node:assert/strict';
import test from 'node:test';
import {planEpisode4RecapCorrection,type FirestoreRestDocument} from '../lib/episode4-recap-correction.ts';

function fixture():FirestoreRestDocument{
  const recipients=['An “Thien An” Nguyen','Brady Booker','Carter Krull','Kristin Flickinger','Maggie Nestor','Mike Pinsky','Ori Jean-Charles'].map(stringValue=>({stringValue}));
  const action={mapValue:{fields:{id:{stringValue:'e0c90d3b-786b-47bd-9fbc-261c5d65329b:cast-thien-an'},label:{stringValue:'Win tribal immunity'},tribeName:{stringValue:'Toka'},points:{integerValue:'2'},recipients:{arrayValue:{values:recipients}},note:{stringValue:''},target:{stringValue:'castaway'}}}};
  return {name:'projects/fantasy-survivor-9da59/databases/(default)/documents/games/survivor-51/episodes/51-4',updateTime:'2026-10-15T02:45:14.518548Z',fields:{season:{integerValue:'51'},episode:{integerValue:'4'},status:{stringValue:'draft'},body:{stringValue:'Keep all editorial content, including Ori.'},title:{stringValue:'Original title'},updatedAt:{stringValue:'keep original time'},discussionVersion:{integerValue:'2'},actions:{arrayValue:{values:[{mapValue:{fields:{id:{stringValue:'appearance'}}}},action,{mapValue:{fields:{id:{stringValue:'dina-immunity'}}}},{mapValue:{fields:{id:{stringValue:'other-action'}}}}]}}}};
}
test('scoped recap plan removes only Ori, preserves three other snapshots, prose and private status',()=>{
  const before=fixture(),original=structuredClone(before),result=planEpisode4RecapCorrection(before,before);
  assert.deepEqual(before,original);assert.equal(result.alreadyCorrected,false);assert.equal(result.recipientCount,6);assert.equal(result.totalPoints,12);assert.deepEqual(result.storedAggregates,[]);
  const actions=result.fields.actions as typeof before.fields.actions & {arrayValue:{values:Array<{mapValue:{fields:Record<string,unknown>}}>}};
  const old=before.fields.actions as typeof actions;
  for(const index of [0,2,3])assert.deepEqual(actions.arrayValue.values[index],old.arrayValue.values[index]);
  assert.deepEqual({...result.fields,actions:before.fields.actions},before.fields);
  const changed=actions.arrayValue.values[1].mapValue.fields,prior=old.arrayValue.values[1].mapValue.fields;
  assert.deepEqual({...changed,recipients:prior.recipients},prior);
  assert.equal((changed.recipients as {arrayValue:{values:unknown[]}}).arrayValue.values.length,6);
});
test('existing stored recipient count and total are adjusted without changing per-recipient points',()=>{
  const before=fixture(),actions=before.fields.actions as {arrayValue:{values:Array<{mapValue:{fields:Record<string,unknown>}}>}};
  Object.assign(actions.arrayValue.values[1].mapValue.fields,{recipientCount:{integerValue:'7'},totalPoints:{doubleValue:14}});
  const result=planEpisode4RecapCorrection(before,before),after=(result.fields.actions as typeof actions).arrayValue.values[1].mapValue.fields;
  assert.deepEqual(after.recipientCount,{integerValue:'6'});assert.deepEqual(after.totalPoints,{doubleValue:12});assert.deepEqual(after.points,{integerValue:'2'});
});
test('unexpected editorial, publication, recipient, aggregate or document-version changes stop the plan',()=>{
  const before=fixture();
  for(const change of [(doc:FirestoreRestDocument)=>doc.fields.body={stringValue:'new editorial text'},(doc:FirestoreRestDocument)=>doc.fields.status={stringValue:'published'},(doc:FirestoreRestDocument)=>doc.updateTime='changed',(doc:FirestoreRestDocument)=>doc.name='wrong-document']){
    const current=structuredClone(before);change(current);assert.throws(()=>planEpisode4RecapCorrection(current,before));
  }
  const published=fixture();published.fields.status={stringValue:'published'};assert.throws(()=>planEpisode4RecapCorrection(published,published));
});
test('repeat execution recognizes the exact corrected snapshot and makes no second change',()=>{
  const before=fixture(),first=planEpisode4RecapCorrection(before,before),after={...before,fields:first.fields,updateTime:'new version'};
  const repeated=planEpisode4RecapCorrection(after,before);assert.equal(repeated.alreadyCorrected,true);assert.deepEqual(repeated.fields,first.fields);
  after.fields.body={stringValue:'unexpected later edit'};assert.throws(()=>planEpisode4RecapCorrection(after,before));
});
