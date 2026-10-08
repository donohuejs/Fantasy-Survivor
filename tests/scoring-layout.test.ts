import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const scoring=readFileSync(new URL('../app/admin/scoring-manager.tsx',import.meta.url),'utf8');

test('Game Master scoring places outside-tribal elimination after Tribal Council resolution',()=>{
  const buckets=scoring.indexOf('<div className="admin-grid scoring-buckets">');
  const tribalCouncil=scoring.indexOf('<TribalCouncilManager game=');
  const elimination=scoring.indexOf('<EliminationManager game=');
  assert.ok(buckets>=0&&tribalCouncil>buckets&&elimination>tribalCouncil);
});
