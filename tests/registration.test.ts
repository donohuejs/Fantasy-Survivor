import assert from 'node:assert/strict';
import test from 'node:test';
import {automaticRegistration,registrationForAccount,registrationErrorMessage} from '../lib/registration.ts';
import {initialGame} from '../lib/game-data.ts';
import {linkedAuthor} from '../lib/community.ts';

const user={uid:'google-one',email:'Player@Example.com',displayName:' New Player ',emailVerified:true};
const now='2026-09-04T12:00:00Z';
test('Google identity creates only the allowed signup fields and uses the display name',()=>{
  assert.deepEqual(automaticRegistration(user,null,now),{uid:user.uid,name:'New Player',email:'player@example.com',createdAt:now});
});
test('missing display name uses a usable email-based name, within Firebase limits',()=>{
  assert.equal(automaticRegistration({...user,displayName:null},null,now).name,'player');
  assert.equal(automaticRegistration({...user,displayName:'  '},null,now).name,'player');
  assert.equal(automaticRegistration({...user,displayName:'N'.repeat(100)},null,now).name.length,50);
});
test('existing names, emails, assignments, and creation dates survive repeat sign-ins',()=>{
  const existing={uid:user.uid,name:'Chosen league nickname',email:'old@example.com',createdAt:'earlier',assignedPlayerId:'player-stanzi'};
  const before=structuredClone(existing);
  assert.equal(automaticRegistration(user,existing,now),existing);
  assert.deepEqual(existing,before);
});
test('restoring a session or retrying preserves one registration and never assigns a slot',()=>{
  const first=automaticRegistration(user,null,now);
  assert.deepEqual(automaticRegistration(user,first,'tomorrow'),first);
  assert(!('assignedPlayerId' in first));
  assert.throws(()=>linkedAuthor(initialGame,{uid:first.uid,email:first.email,verified:true}),/linked/);
});
test('unverified, missing-email and mismatched-UID accounts fail instead of creating misleading profiles',()=>{
  assert.throws(()=>automaticRegistration({...user,emailVerified:false},null,now),/not verified/);
  assert.throws(()=>automaticRegistration({...user,email:null},null,now),/email address/);
  assert.throws(()=>automaticRegistration({...user,uid:''},null,now),/email address/);
  assert.throws(()=>automaticRegistration(user,{uid:'someone-else',name:'Other',email:'other@example.com',createdAt:now},now),/review/);
});
test('success for an old account cannot appear as registration success after account switching',()=>{
  const signup=automaticRegistration(user,null,now),state={owner:user.uid,status:'registered' as const,signup,error:''};
  assert.equal(registrationForAccount(state,user.uid).signup,signup);
  assert.deepEqual(registrationForAccount(state,'other-account'),{status:'registering',error:'',signup:undefined});
  assert.deepEqual(registrationForAccount(state,undefined),{status:'idle',error:'',signup:undefined});
});
test('registration errors are account-scoped and do not disappear into signed-in success',()=>{
  const state={owner:user.uid,status:'error' as const,error:'Save failed'};
  assert.equal(registrationForAccount(state,user.uid).status,'error');
  assert.equal(registrationForAccount(state,'other').error,'');
  assert.equal(registrationForAccount(null,user.uid).status,'registering');
});
test('connection and permissions errors explain the recovery action',()=>{
  assert.match(registrationErrorMessage({code:'permission-denied'}),/signup rules/);
  assert.match(registrationErrorMessage({code:'unavailable'}),/connection/);
  assert.equal(registrationErrorMessage(new Error('Specific error')),'Specific error');
});
