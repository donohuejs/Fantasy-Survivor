import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {acceptanceGame} from '../scripts/iphone-fixture.ts';
import {seasonStandings} from '../lib/league.ts';
import type {GameState} from '../lib/game-data.ts';

const require=createRequire(import.meta.url);
const jsxRuntime=pathToFileURL(require.resolve('react/jsx-runtime')).href;
const moduleUrl=(source:string)=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');

// Render the real Home/TeamScores/ScoreContributions components. Only context and
// unrelated navigation/content are stubbed; eligibility and point math are real.
async function componentUrl(file:string,mocks:Record<string,string>={}){
  const source=ts.transpileModule(await readFile(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  return moduleUrl(source.replace(/from ["']([^"']+)["']/g,(_,specifier:string)=>{
    const resolved=mocks[specifier]??(specifier==='react/jsx-runtime'?jsxRuntime:pathToFileURL(path.resolve(specifier.startsWith('@/')?specifier.slice(2)+'.ts':path.join(path.dirname(file),specifier)+'.ts')).href);
    return 'from '+JSON.stringify(resolved);
  }));
}
async function renderLayouts(game:GameState){
  const standings=seasonStandings(game).map(row=>({id:row.profileId,name:row.name,score:row.score,rank:row.finish,picks:''}));
  const context=moduleUrl('export function useGame(){return '+JSON.stringify({game,standings,loading:false})+';}');
  const names=moduleUrl('export function PlayerName({name}){return name;}');
  const empty=moduleUrl('export function SiteHeader(){return null;} export function CampfireCommentary(){return null;} export function useCurrentSeasonOpenPolls(){return {rows:[]};}');
  const link=moduleUrl(`import {jsx} from ${JSON.stringify(jsxRuntime)};export default function Link({children,...props}){return jsx('a',{...props,children});}`);
  const image=moduleUrl(`import {jsx} from ${JSON.stringify(jsxRuntime)};export default function Image({priority,...props}){return jsx('img',props);}`);
  const scores=await componentUrl('app/score-contributions.tsx');
  const home=await import(await componentUrl('app/page.tsx',{'./game-provider':context,'./site-header':empty,'./player-name':names,'./community-polls':empty,'./discussion-content':empty,'./score-contributions':scores,'next/link':link,'next/image':image}));
  const teams=await import(await componentUrl('app/draft/team-scores.tsx',{'../game-provider':context,'../player-name':names,'../score-contributions':scores}));
  const homepage=renderToStaticMarkup(React.createElement(home.default));
  const teamPage=renderToStaticMarkup(React.createElement(teams.TeamScores));
  return {
    featured:homepage.match(/<article class="torch-card [\s\S]*?<\/article>/)![0],
    regular:homepage.match(/<div class="leader-row [\s\S]*?<\/strong><\/div>/)![0],
    expanded:teamPage,
  };
}
function singlePlayer(role:'active'|'complete',episode=5){
  const game=acceptanceGame();
  const playerId='synthetic-'+role;
  game.players=game.players.filter(player=>player.id===playerId);
  game.draftPicks=game.draftPicks.filter(pick=>pick.playerId===playerId);
  game.juryMode={enabled:true,activationEpisode:5,reviewedEliminations:[]};
  game.season.currentEpisode=episode;
  return game;
}

for(const layout of ['featured','regular','expanded'] as const){
  test(`${layout}: active player shows authoritative 11.5 total without component labels`,async()=>{
    const html=(await renderLayouts(singlePlayer('active')))[layout];
    assert.match(html,/11\.5/);
    assert.doesNotMatch(html,/score-contributions|Castaway Total|Jury Points|jury-mode-label/);
  });
  test(`${layout}: one surviving original slot prevents a breakdown despite existing Jury awards`,async()=>{
    const game=singlePlayer('active');
    for(const castaway of game.castaways.filter(c=>['synthetic-dusk','synthetic-fern'].includes(c.id))){castaway.status='voted-out';castaway.eliminationEpisode=4;}
    game.scoreEvents.push({id:'synthetic-existing-award',source:'jury',playerId:'synthetic-active',points:7,createdAt:'2026-10-17T12:00:00Z'});
    const html=(await renderLayouts(game))[layout];
    assert.match(html,/18\.5/);
    assert.doesNotMatch(html,/score-contributions|Castaway Total|Jury Points|jury-mode-label/);
  });
  test(`${layout}: activated Jury leader shows 17 + 11 = 28, badge and subdued styling`,async()=>{
    const game=singlePlayer('complete');
    game.scoreEvents.push({id:'synthetic-jury-award',source:'jury',playerId:'synthetic-complete',points:11,createdAt:'2026-10-17T12:00:00Z'});
    const html=(await renderLayouts(game))[layout];
    assert.match(html,/28\.0/);
    assert.match(html,/<dt>Castaway Total<\/dt><dd>17\.0<\/dd>/);
    assert.match(html,/<dt>Jury Points<\/dt><dd>\+11\.0<\/dd>/);
    assert.match(html,/jury-mode-label/);
    assert.doesNotMatch(html,/Total:|score-total-label| total pts/);
    assert.match(html,new RegExp({featured:'jury-torch-card',regular:'jury-leader-row',expanded:'jury-team-card'}[layout]));
    assert.doesNotMatch(html,/<dt>Fantasy<\/dt>|<dt>Jury Mode<\/dt>/);
  });
  test(`${layout}: final-elimination episode never shows a breakdown, even with ledger awards`,async()=>{
    const game=singlePlayer('complete',4);
    game.scoreEvents.push({id:'synthetic-jury-award',source:'jury',playerId:'synthetic-complete',points:7,createdAt:'2026-10-17T12:00:00Z'});
    const html=(await renderLayouts(game))[layout];
    assert.match(html,/24\.0/);
    assert.doesNotMatch(html,/score-contributions|Castaway Total|Jury Points|jury-mode-label/);
  });
  test(`${layout}: Jury player with zero awards still gets the activated breakdown`,async()=>{
    const html=(await renderLayouts(singlePlayer('complete')))[layout];
    assert.match(html,/<dt>Castaway Total<\/dt><dd>17\.0<\/dd>/);
    assert.match(html,/<dt>Jury Points<\/dt><dd>\+0\.0<\/dd>/);
  });
}
