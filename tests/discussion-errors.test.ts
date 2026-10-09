import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {CommunityError} from '../lib/community.ts';
import {classifyCommunityFailure} from '../lib/community-errors.ts';

test('discussion backend identifies missing indexes without exposing Firebase details',()=>{
  const error=Object.assign(new Error('https://console.firebase.google.com/project/secret/firestore/indexes?create_composite=secret'),{code:'failed-precondition'});
  const result=classifyCommunityFailure(error);
  assert.equal(result.status,503);assert.deepEqual({error:result.message,code:result.code},{error:'Discussion storage indexes are not ready. Try again later.',code:'storage-index-missing'});assert(!JSON.stringify(result).includes('secret'));
});

test('discussion backend distinguishes storage authorization and authentication failures',()=>{
  const permission=classifyCommunityFailure(Object.assign(new Error('permission denied for private path'),{code:'permission-denied'}));
  assert.equal(permission.status,503);assert.equal(permission.code,'storage-permission-denied');
  const authentication=classifyCommunityFailure(Object.assign(new Error('token expired'),{code:'unauthenticated'}));
  assert.equal(authentication.status,401);assert.equal(authentication.code,'authentication-failed');
});

test('community authorization failures retain a safe structured response',()=>{
  const response=classifyCommunityFailure(new CommunityError('Only the game master can manage this discussion operation.',{status:403,code:'authorization'}));
  assert.equal(response.status,403);assert.deepEqual({error:response.message,code:response.code},{error:'Only the game master can manage this discussion operation.',code:'authorization'});
});

test('all threaded discussion composite query shapes are represented in the checked-in indexes',()=>{
  const config=JSON.parse(readFileSync(fileURLToPath(new URL('../firestore.indexes.json',import.meta.url)),'utf8')) as {indexes:Array<{collectionGroup:string;fields:Array<{fieldPath:string;order:string}>}>};
  const has=(collectionGroup:string,fields:string[])=>config.indexes.some(index=>index.collectionGroup===collectionGroup&&JSON.stringify(index.fields.map(field=>field.fieldPath))===JSON.stringify(fields));
  for(const fields of [['lastActivityAt','id'],['episodeId','lastActivityAt','id'],['season','lastActivityAt','id'],['createdAt','id'],['episodeId','createdAt','id'],['season','createdAt','id']])assert(has('discussionThreads',fields),`missing discussionThreads index ${fields.join(',')}`);
  for(const fields of [['hasUnread','lastActivityAt','id'],['hasUnread','episodeId','lastActivityAt','id'],['hasUnread','season','lastActivityAt','id'],['hasUnread','createdAt','id'],['hasUnread','episodeId','createdAt','id'],['hasUnread','season','createdAt','id']])assert(has('threads',fields),`missing threads index ${fields.join(',')}`);
  assert(has('comments',['threadId','sequence']));
});
