import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');

test('typography uses only the shared body and heading families',()=>{
  assert.match(css,/--font-body:Arial,sans-serif;/);
  assert.match(css,/--font-heading:Georgia,serif;/);
  const families=[...css.matchAll(/font-family:([^;}]+)/g)].map(match=>match[1].trim());
  assert.ok(families.length>0);
  assert.ok(families.every(family=>['var(--font-body)','var(--font-heading)','inherit'].includes(family)));
  assert.doesNotMatch(css,/Inter|ui-sans-serif|font:\s*\d/);
  assert.match(css,/code,pre,kbd,samp\s*\{\s*font-family:var\(--font-body\)/);
});

test('component text sizes come from a shared rem-based scale',()=>{
  const sizes=[...css.matchAll(/font-size:([^;}]+)/g)].map(match=>match[1].trim());
  assert.ok(sizes.every(size=>/^var\(--text-[a-z]+\)$/.test(size)||size==='inherit'));
  assert.match(css,/--text-caption:\.75rem;/);
  assert.match(css,/--text-body:1rem;/);
  assert.match(css,/--text-title:clamp\(2\.25rem,5vw,3\.5rem\);/);
});

test('font weights use regular and bold rather than one-off intermediate weights',()=>{
  const weights=[...css.matchAll(/font-weight:([^;}]+)/g)].map(match=>match[1].trim());
  assert.ok(weights.every(weight=>['400','700'].includes(weight)));
});

test('native controls have an explicit body font and readable shared size',()=>{
  assert.match(css,/button,input,select,textarea\s*\{\s*font:inherit; font-family:var\(--font-body\)/);
  assert.match(css,/\.recap-editor-picker input\s*\{\s*font-family:var\(--font-body\); font-size:var\(--text-body\); font-weight:400; line-height:1\.5;\s*min-height:44px;/);
  assert.match(css,/\.setup-notice\s*\{ min-width:0; max-width:100%; overflow-wrap:anywhere;/);
});
