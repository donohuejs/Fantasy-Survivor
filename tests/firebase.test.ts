import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// No credentials or live Firebase services are used in these regression tests.
for(const name of ['API_KEY','AUTH_DOMAIN','PROJECT_ID','APP_ID'])delete process.env[`NEXT_PUBLIC_FIREBASE_${name}`];
const {authenticationError,firebaseConfigured,missingFirebaseSettings,getFirebase}=await import('../lib/firebase.ts');

test('missing Firebase config cannot silently initialize authentication',()=>{
  assert.equal(firebaseConfigured,false);
  assert.deepEqual(missingFirebaseSettings,[
    'NEXT_PUBLIC_FIREBASE_API_KEY','NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID','NEXT_PUBLIC_FIREBASE_APP_ID',
  ]);
  assert.throws(()=>getFirebase(),/Firebase is not configured/);
});
test('blocked popups explain how to retry',()=>{
  assert.match(authenticationError({code:'auth/popup-blocked'}),/Allow pop-ups/);
});
test('unauthorized domains show the Firebase setting to fix',()=>{
  assert.match(authenticationError({code:'auth/unauthorized-domain'}),/Authorized domains/);
});
test('closed popups are visible and retryable',()=>{
  assert.match(authenticationError({code:'auth/popup-closed-by-user'}),/try again/);
});
test('unexpected errors retain their useful message',()=>{
  assert.equal(authenticationError(new Error('Test sign-out failure')),'Test sign-out failure');
});
test('production page with missing config does not claim a wrong account',()=>{
  const html=readFileSync(new URL('../.next/server/app/admin.html',import.meta.url),'utf8');
  assert.match(html,/Firebase setup is incomplete/);
  assert.doesNotMatch(html,/>This account is not the game master\.</);
  assert.doesNotMatch(html,/an unknown account/);
});
