import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {acceptanceGame} from '../scripts/iphone-fixture.ts';
import {commissionerAccessForAccount} from '../lib/account-access.ts';
import {stagingCommissioner} from '../lib/staging-environment.ts';

const require=createRequire(import.meta.url),jsx=pathToFileURL(require.resolve('react/jsx-runtime')).href;
const url=(text:string)=>'data:text/javascript;base64,'+Buffer.from(text).toString('base64');
async function header(role:string,commissioner:boolean,operator=true){
  const user={uid:'staging-'+role,email:role+'@jury.test',emailVerified:true};
  const isAdmin=commissionerAccessForAccount(user,{uid:user.uid,status:'authorized',commissioner})&&stagingCommissioner({uid:user.uid,email:user.email,verified:user.emailVerified});
  const game=acceptanceGame();game.players.forEach(p=>{if(p.uid)p.uid=p.uid.replace('iphone-','staging-');});game.juryMode={enabled:true,activationEpisode:5,reviewedEliminations:[]};
  const context=url('export function useGame(){return '+JSON.stringify({game,user,isAdmin,operator})+';}');
  const mocks:Record<string,string>={
    'react/jsx-runtime':jsx,
    'next/link':url(`import {jsx} from ${JSON.stringify(jsx)};export default function Link({children,...props}){return jsx('a',{...props,children});}`),
    './game-provider':context,
    './auth-controls':url('export function AuthControls(){return null;}'),
    './community-polls':url('export function useCurrentSeasonOpenPolls(){return {rows:[]};}'),
    './discussion-provider':url('export function useDiscussions(){return {unreadCount:0};}'),
    '@/lib/jury-public':new URL('../lib/jury-public.ts',import.meta.url).href,
  };
  const source=ts.transpileModule(await readFile('app/site-header.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext}}).outputText.replace(/from ["']([^"']+)["']/g,(_,id:string)=>{assert(mocks[id],id);return 'from '+JSON.stringify(mocks[id]);});
  const component=await import(url(source));
  return renderToStaticMarkup(React.createElement(component.SiteHeader,{active:'/',subtitle:'Test'}));
}
for(const role of ['active','jury','complete','legacy','unlinked'])test(`${role}: operator authorization and even a misassigned commissioner flag never grant staging Game Master navigation`,async()=>{
  for(const flag of [false,true])assert.doesNotMatch(await header(role,flag),/href="\/admin"|Game master/);
});
test('actual Commissioner retains navigation with or without operator authorization',async()=>{
  for(const operator of [true,false])assert.match(await header('commissioner',true,operator),/href="\/admin"/);
  assert.doesNotMatch(await header('commissioner',false),/href="\/admin"/);
});
test('current verified account and confirmed server authorization are both required',()=>{
  const user={uid:'current',emailVerified:true},access={uid:'current',status:'authorized',commissioner:true};
  assert(commissionerAccessForAccount(user,access));
  for(const status of ['loading','unlinked','error','signed-out'])assert(!commissionerAccessForAccount(user,{...access,status}));
  assert(!commissionerAccessForAccount({...user,uid:'other'},access));
  assert(!commissionerAccessForAccount({...user,emailVerified:false},access));
  assert(!commissionerAccessForAccount(null,access));
  assert(!commissionerAccessForAccount(user,{...access,commissioner:'false' as unknown as boolean}));
});
test('switching identities in both directions drops old grants and waits for the new account',()=>{
  const commissioner={uid:'staging-commissioner',emailVerified:true},active={uid:'staging-active',emailVerified:true};
  const grant={uid:commissioner.uid,status:'authorized',commissioner:true};
  assert(commissionerAccessForAccount(commissioner,grant));
  assert(!commissionerAccessForAccount(active,grant));
  const member={uid:active.uid,status:'authorized',commissioner:false};
  assert(!commissionerAccessForAccount(active,member));
  assert(!commissionerAccessForAccount(commissioner,member));
  assert(!commissionerAccessForAccount(commissioner,{...grant,status:'loading'}));
  assert(commissionerAccessForAccount(commissioner,grant));
});
test('auth changes invalidate prior capability state and staging guard stays outside production source',async()=>{
  const provider=await readFile('app/game-provider.tsx','utf8'),packaging=await readFile('scripts/package-jury-staging.mjs','utf8');
  assert(provider.includes("setAccessState({uid:nextUser?.uid??'',status:nextUser?'loading':'signed-out',error:''})"));
  assert(!provider.includes('stagingCommissioner')&&!provider.includes('useStagingOperator'));
  assert(packaging.includes('commissionerAccessForAccount(user,accessState)&&Boolean(user&&stagingCommissioner'));
});
