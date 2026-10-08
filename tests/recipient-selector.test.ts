import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
const component=readFileSync(new URL('../app/admin/recipient-selector.tsx',import.meta.url),'utf8');
const scoring=readFileSync(new URL('../app/admin/scoring-manager.tsx',import.meta.url),'utf8');

test('recipient mode controls use compact accessible sizing and selected-state styling',()=>{
  assert.match(css,/\.admin-form input:not\(\[type=checkbox\]\):not\(\[type=radio\]\),\.admin-form select/);
  assert.match(css,/\.recipient-mode-list \{[^}]*grid-template-columns:repeat\(auto-fit,minmax\(120px,1fr\)\)/);
  assert.match(css,/\.recipient-mode \{[^}]*min-height:44px/);
  assert.match(css,/\.recipient-mode input\[type=radio\] \{[^}]*width:19px;[^}]*height:19px/);
  assert.match(css,/\.recipient-mode:has\(input:checked\) \{/);
});

test('custom recipient rows use the canonical castaway objects and retain bulk actions',()=>{
  assert.match(component,/const eligible=castaways;/);
  assert.match(component,/<span>\{castaway\.name\}<\/span>/);
  assert.match(component,/Select all eligible/);
  assert.match(component,/Clear all/);
});

test('Individual scoring passes the selected castaway through both preview and submission',()=>{
  assert.match(scoring,/selection\.mode==='individual'\?selection\.castawayIds\[0\]:selection\.tribeId/);
  assert.match(scoring,/recipientId:selection\.mode==='individual'\?selected\[0\]\?\.id:selection\.tribeId/);
  assert.match(scoring,/missingSelection=mode==='individual'\?'Choose exactly one castaway\.'/);
});
