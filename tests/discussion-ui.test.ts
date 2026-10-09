import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const discussion=readFileSync(new URL('../app/discussion-content.tsx',import.meta.url),'utf8');
const chatter=readFileSync(new URL('../app/chatter/page.tsx',import.meta.url),'utf8');
const episodes=readFileSync(new URL('../app/episodes/page.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');

test('Campfire Commentary keeps the compact Home feed states and direct thread links',()=>{
  assert.match(discussion,/className="campfire-header"/);
  assert.match(discussion,/Campfire Commentary/);
  assert.match(discussion,/threadHref\(thread\)/);
  assert.match(discussion,/No conversations yet\. Start one!/);
  assert.match(discussion,/Discussions couldn’t load\./);
  assert.match(discussion,/Comment previews hidden to avoid spoilers\./);
});

test('Chatter and recaps preserve inline composition, filters, and thread replies',()=>{
  assert.match(chatter,/className="inner-page chatter-page"/);
  assert.match(chatter,/Campfire Commentary/);
  assert.match(chatter,/Come on in, and join the chatter/);
  for(const label of ['All Episodes','Current Episode','Unread','Selected Episode'])assert.match(chatter,new RegExp(label));
  assert.match(chatter,/CommentComposer/);
  assert.match(episodes,/<EpisodeDiscussion episode=\{view\}/);
  assert.match(discussion,/thread-reply-composer/);
  assert.match(discussion,/discussionCommentDepths/);
  assert.match(discussion,/Reply/);
});

test('discussion presentation has compact feed rules and mobile wrapping safeguards',()=>{
  assert.match(css,/\.campfire-header\s*\{/);
  assert.match(css,/\.campfire-thread-preview p\s*\{[^}]*-webkit-line-clamp:2/);
  assert.match(css,/\.chatter-thread\s*\{[^}]*border:0/);
  assert.match(css,/\.chatter-reply\s*\{[^}]*border-left:2px/);
  assert.match(css,/@media\(max-width:600px\)/);
  assert.match(css,/\.campfire-thread-preview\s*\{[^}]*overflow-wrap:anywhere/);
});
