import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const require=createRequire(import.meta.url),url=(value:string)=>'data:text/javascript;base64,'+Buffer.from(value).toString('base64');
async function render(operator:boolean){
  const imports:Record<string,string>={react:pathToFileURL(require.resolve('react')).href,'react/jsx-runtime':pathToFileURL(require.resolve('react/jsx-runtime')).href,'firebase/auth':url('export function onAuthStateChanged(){return()=>{};}'),'@/lib/firebase':url('export function getFirebase(){throw Error("Not called during render");}'),'@/app/game-provider':url('export function useGame(){return {user:{uid:"staging-active",email:"active@jury.test"},isAdmin:false,leagueAccess:"authorized",authLoading:false};}'),'./build-info':new URL('../staging/app/staging/build-info.ts',import.meta.url).href};
  const source=ts.transpileModule(await readFile('staging/app/staging/diagnostics.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ["']([^"']+)["']/g,(_,id:string)=>{assert(imports[id],id);return 'from '+JSON.stringify(imports[id]);});
  const component=await import(url(source));return renderToStaticMarkup(React.createElement(component.StagingDiagnostics,{operator}));
}
test('staging build identity renders independently of the selected identity or operator grant',async()=>{
  for(const operator of [true,false])assert.match(await render(operator),/data-testid="staging-build-id"/);
});
test('read-only diagnostic capture is available only to the operator in the UI',async()=>{
  assert.match(await render(true),/Capture without reloading/);assert.doesNotMatch(await render(false),/Capture without reloading/);
});
test('diagnostics inspect all actual interactive Game Master targets and preserve caches/auth state',async()=>{
  const source=await readFile('staging/app/staging/diagnostics.tsx','utf8');
  for(const text of ['querySelectorAll(\'a,button\')','getBoundingClientRect','getRegistrations()','caches.keys()','getEntriesByType(\'navigation\')','event.persisted','data-staging-provider-diagnostics'])assert(source.includes(text),text);
  for(const text of ['signOut(','signInWith','unregister(','caches.delete(','localStorage.clear(','location.reload(','location.assign('])assert(!source.includes(text),text);
});
test('diagnostic endpoint verifies operator and current JWT independently, checks revocation and never accesses fixture documents',async()=>{
  const source=await readFile('staging/app/api/staging/diagnostics/route.ts','utf8');
  for(const text of ['authorizeOperator(','verifyIdToken(header.slice(7),true)','stagingCommissioner(actor)','communityReply(','requireCloudStaging()','assertStagingDatabase(db)'])assert(source.includes(text),text);
  for(const text of ['db.doc(','db.collection(','runTransaction(','export async function POST'])assert(!source.includes(text),text);
});
test('staging-only packaging stamps client/server build identity and marks the real header without changing its role condition',async()=>{
  const source=await readFile('scripts/package-jury-staging.mjs','utf8'),header=await readFile('app/site-header.tsx','utf8');
  for(const text of ['stagingBuildId','sourceDigest','X-Jury-Staging-Build','data-staging-component="SiteHeader"','SiteHeader:GameMaster','data-server-commissioner'])assert(source.includes(text),text);
  assert(header.includes("...(isAdmin?[{href:'/admin',label:'Game master'}]:[])"));
  assert(!header.includes('StagingDiagnostics')&&!header.includes('data-staging-component'));
  await assert.rejects(()=>readFile('app/api/staging/diagnostics/route.ts'));
});
