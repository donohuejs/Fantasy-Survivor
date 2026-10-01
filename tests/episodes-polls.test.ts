import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const page=readFileSync(new URL('../app/episodes/page.tsx',import.meta.url),'utf8');
const content=readFileSync(new URL('../app/episodes/episode-content.tsx',import.meta.url),'utf8');
const home=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');

test('Episodes page places the poll section after recap and keeps one top live indicator',()=>{
  const recapIndex=page.indexOf('<article className="episode-recap"');
  const pollsIndex=page.indexOf('<EpisodePolls polls={selectedPolls}/>');
  assert.ok(recapIndex>=0&&pollsIndex>recapIndex);
  assert.match(page,/className="episodes-live-poll"/);
  assert.match(page,/href=\{`\/episodes\?poll=\$\{encodeURIComponent\(livePolls\[0\]\.id\)\}`\}/);
  assert.equal((page.match(/<PollCard/g)??[]).length,1);
});

test('previous poll history is collapsed by default and exposes accessible toggle text',()=>{
  assert.match(content,/useState\(false\)/);
  assert.match(content,/expanded\?'Hide previous polls':'Show previous polls'/);
  assert.match(content,/aria-expanded=\{expanded\}/);
  assert.match(content,/if\(!polls\.length\)return null/);
});

test('Home page keeps its active poll alert and deep-links to the poll',()=>{
  assert.match(home,/useCurrentSeasonOpenPolls/);
  assert.match(home,/className="homepage-action homepage-action-poll"/);
  assert.match(home,/href=\{`\/episodes\?poll=\$\{encodeURIComponent\(poll\.id\)\}`\}/);
});

test('poll navigation has mobile-safe focus and scroll styling',()=>{
  assert.match(page,/target\.scrollIntoView\(\{behavior:reducedMotion\?'auto':'smooth',block:'center'\}\)/);
  assert.match(page,/target\.focus\(\{preventScroll:true\}\)/);
  assert.match(css,/\.league-poll\s*\{\s*scroll-margin-top:120px/);
  assert.match(css,/\.episodes-live-poll/);
  assert.match(css,/\.poll-history-toggle\{width:100%\}/);
});
