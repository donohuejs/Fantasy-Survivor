import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

test('Jury Mode has its own Game Master panel and legacy controls remain available',async()=>{
  const [page,workspace]=await Promise.all([
    readFile('app/admin/page.tsx','utf8'),
    readFile('app/admin/jury-workspace.tsx','utf8'),
  ]);
  assert.match(page,/['"]jury-mode['"]:<JuryWorkspace/);
  assert.doesNotMatch(page,/ScoringManager key=\{game\.season\.number\}\/>\s*<JuryManager/);
  assert.match(workspace,/<JuryManager\/>/);
  assert.match(workspace,/Advanced · existing Jury Mode setup and grading/);
  assert.match(workspace,/juryRequest<AdminJuryCatalog>\(\{view:'admin'\},true\)/);
  assert.doesNotMatch(workspace,/action:'snapshot'|action:'configure'|action:'confirm-grade'/);
});
