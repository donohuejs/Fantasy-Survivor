import assert from 'node:assert/strict';
import {canonicalJson} from './score-ledger.ts';

export type FirestoreRestDocument={name:string;updateTime:string;fields:Record<string,unknown>};
const documentName='projects/fantasy-survivor-9da59/databases/(default)/documents/games/survivor-51/episodes/51-4';
const actionId='e0c90d3b-786b-47bd-9fbc-261c5d65329b:cast-thien-an';
const originalNames=['An “Thien An” Nguyen','Brady Booker','Carter Krull','Kristin Flickinger','Maggie Nestor','Mike Pinsky','Ori Jean-Charles'];
function object(value:unknown):Record<string,unknown>{assert(value&&typeof value==='object'&&!Array.isArray(value),'Expected a Firestore object.');return value as Record<string,unknown>;}
function array(value:unknown):unknown[]{const values=object(object(value).arrayValue).values;assert(Array.isArray(values),'Expected a Firestore array.');return values;}
function number(value:unknown){const field=object(value);return Number(field.integerValue??field.doubleValue);}
function setNumber(value:unknown,before:number,after:number){assert.equal(number(value),before,'Unexpected stored scoring aggregate.');return 'integerValue' in object(value)?{...object(value),integerValue:String(after)}:{...object(value),doubleValue:after};}

/** One-off approved correction. Preserves the complete typed snapshot except this award. */
export function planEpisode4RecapCorrection(current:FirestoreRestDocument,backup:FirestoreRestDocument){
  assert.equal(current.name,documentName);assert.equal(backup.name,documentName);
  assert.equal(object(backup.fields.status).stringValue,'draft','Recap must remain unpublished.');
  assert.equal(number(backup.fields.season),51);assert.equal(number(backup.fields.episode),4);
  const fields=structuredClone(backup.fields),actions=array(fields.actions);
  assert.equal(actions.length,4,'Unexpected saved scoring snapshot count.');
  const matches=actions.map(value=>object(object(value).mapValue).fields).map(object).filter(action=>object(action.id).stringValue===actionId);
  assert.equal(matches.length,1,'Expected exactly the previously inspected Toka immunity action.');
  const action=matches[0];
  assert.equal(object(action.label).stringValue,'Win tribal immunity');assert.equal(object(action.tribeName).stringValue,'Toka');assert.equal(number(action.points),2);
  const recipients=array(action.recipients);
  assert.deepEqual(recipients.map(value=>object(value).stringValue),originalNames,'Recorded recipients differ from the approved seven.');
  object(action.recipients).arrayValue={...object(object(action.recipients).arrayValue),values:recipients.filter(value=>object(value).stringValue!=='Ori Jean-Charles')};
  const aggregates=[];
  if(action.recipientCount!==undefined){action.recipientCount=setNumber(action.recipientCount,7,6);aggregates.push('recipientCount');}
  if(action.totalPoints!==undefined){action.totalPoints=setNumber(action.totalPoints,14,12);aggregates.push('totalPoints');}
  assert.equal(object(fields.status).stringValue,'draft');
  if(canonicalJson(current.fields)===canonicalJson(fields))return {alreadyCorrected:true,fields,actionId,recipientCount:6,totalPoints:12,storedAggregates:aggregates};
  assert.equal(canonicalJson(current.fields),canonicalJson(backup.fields),'Recap differs from its complete verified backup. Stop before writing.');
  assert.equal(current.updateTime,backup.updateTime,'Recap document version changed. Stop before writing.');
  return {alreadyCorrected:false,fields,actionId,recipientCount:6,totalPoints:12,storedAggregates:aggregates};
}
