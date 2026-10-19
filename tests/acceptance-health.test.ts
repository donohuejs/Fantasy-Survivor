import test from 'node:test';
import assert from 'node:assert/strict';
import {checkAcceptanceHealth} from '../scripts/acceptance-health.mjs';
test('acceptance health accepts working pages and expected anonymous API denial',async()=>{
  const statuses=[200,200,200,401];await checkAcceptanceHealth(async()=>new Response('',{status:statuses.shift()}));assert.deepEqual(statuses,[]);
});
test('an HTTP 500 cannot be reported as a healthy running acceptance environment',async()=>{
  const statuses=[200,200,500];await assert.rejects(()=>checkAcceptanceHealth(async()=>new Response('',{status:statuses.shift()})),/HTTP 500.*expected 200/);
});
test('acceptance health rejects an unavailable service and an incorrectly public Jury API',async()=>{
  await assert.rejects(()=>checkAcceptanceHealth(async()=>{throw Error('Connection refused');}),/Connection refused/);
  const statuses=[200,200,200,200];await assert.rejects(()=>checkAcceptanceHealth(async()=>new Response('',{status:statuses.shift()})),/expected 401/);
});
