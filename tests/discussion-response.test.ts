import test from 'node:test';
import assert from 'node:assert/strict';
import {readDiscussionResponse} from '../lib/discussion-response.ts';
test('a canceled HTTP 200 discussion body remains an abort, never a successful thread page',async()=>{
  const abort=new DOMException('Canceled after response headers','AbortError');
  const response=new Response(new ReadableStream({start(controller){controller.error(abort);}}),{status:200});
  await assert.rejects(()=>readDiscussionResponse(response),error=>error===abort);
});
test('malformed successful JSON cannot replace thread rows with a fallback error object',async()=>{
  await assert.rejects(()=>readDiscussionResponse(new Response('incomplete JSON',{status:200})),/HTTP 200|JSON/);
});
test('valid thread pages and authorization errors retain their normal behavior',async()=>{
  const page={rows:[],cursor:null};assert.deepEqual(await readDiscussionResponse(Response.json(page)),page);
  await assert.rejects(()=>readDiscussionResponse(Response.json({error:'League membership required'},{status:403})),/League membership required/);
});
