import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
const component=readFileSync(new URL('../app/admin/recipient-selector.tsx',import.meta.url),'utf8');

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
