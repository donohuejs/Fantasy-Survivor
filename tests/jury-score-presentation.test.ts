import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
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
  const names=await componentUrl('app/player-name.tsx');
  const empty=moduleUrl('export function SiteHeader(){return null;} export function CampfireCommentary(){return null;} export function useCurrentSeasonOpenPolls(){return {rows:[]};}');
  const link=moduleUrl(`import {jsx} from ${JSON.stringify(jsxRuntime)};export default function Link({children,...props}){return jsx('a',{...props,children});}`);
  const image=moduleUrl(`import {jsx} from ${JSON.stringify(jsxRuntime)};export default function Image({priority,...props}){return jsx('img',props);}`);
  const scores=await componentUrl('app/score-contributions.tsx');
  const discord=await componentUrl('app/discord-invite.tsx',{'./game-provider':context,'./discord-invite.module.css':moduleUrl('export default {invite:"discord-invite"};'),'next/image':image});
  const home=await import(await componentUrl('app/page.tsx',{'./game-provider':context,'./site-header':empty,'./player-name':names,'./community-polls':empty,'./discussion-content':empty,'./score-contributions':scores,'./discord-invite':discord,'next/link':link,'next/image':image}));
  const teams=await import(await componentUrl('app/draft/team-scores.tsx',{'../game-provider':context,'../player-name':names,'../score-contributions':scores}));
  const homepage=renderToStaticMarkup(React.createElement(home.default));
  const teamPage=renderToStaticMarkup(React.createElement(teams.TeamScores));
  return {
    homepage,
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
    assert.doesNotMatch(html,/score-contributions|Castaway Total|Jury Points/);
    assert.doesNotMatch(html,/jury-mode-label|Jury starts/);
  });
  test(`${layout}: Jury player with zero awards still gets the activated breakdown`,async()=>{
    const html=(await renderLayouts(singlePlayer('complete')))[layout];
    assert.match(html,/<dt>Castaway Total<\/dt><dd>17\.0<\/dd>/);
    assert.match(html,/<dt>Jury Points<\/dt><dd>\+0\.0<\/dd>/);
  });
  const juryClass={featured:'jury-torch-card',regular:'jury-leader-row',expanded:'jury-team-card'}[layout];
  test(`${layout}: eliminated roster is muted now with no added badge, label or score display`,async()=>{
    const game=singlePlayer('complete',4),before=structuredClone(game),html=(await renderLayouts(game))[layout];
    assert.match(html,new RegExp(juryClass));assert.doesNotMatch(html,/jury-mode-label|Jury starts/);assert.match(html,/17\.0/);
    assert.doesNotMatch(html,/score-contributions|Castaway Total|Jury Points|>Jury Mode</);
    assert.match(html,new RegExp({featured:'leader-roster-eliminated',regular:'leader-pick-eliminated',expanded:'draft-roster-eliminated'}[layout]));
    game.juryMode!.enabled=false;
    const original=(await renderLayouts(game))[layout];
    assert.equal(html.replaceAll(juryClass,''),original);
    game.juryMode!.enabled=true;assert.deepEqual(game,before);
  });
  test(`${layout}: an earlier episode before the last elimination keeps normal styling`,async()=>{
    assert.doesNotMatch((await renderLayouts(singlePlayer('complete',3)))[layout],new RegExp(juryClass));
  });
  test(`${layout}: Jackie is marked for muted styling once Jury activation is effective, without predictions`,async()=>{
    // Synthetic roster with the reported display name; no production records or predictions.
    const game=singlePlayer('complete');game.players[0].name='Jackie Humphrey';
    const html=(await renderLayouts(game))[layout];
    assert.match(html,/Jackie Humphrey/);assert.match(html,new RegExp(juryClass));
    assert.match(html,/Jury Mode/);assert.match(html,/17\.0/);
    assert.match(html,new RegExp({featured:'leader-roster-eliminated',regular:'leader-pick-eliminated',expanded:'draft-roster-eliminated'}[layout]));
  });
  test(`${layout}: one or two eliminated slots keep an active player normally styled`,async()=>{
    for(const eliminatedCount of [0,1,2]){
      const game=singlePlayer('active');
      for(const castaway of game.castaways.slice(2,2+eliminatedCount)){castaway.status='voted-out';castaway.eliminationEpisode=4;}
      assert.doesNotMatch((await renderLayouts(game))[layout],new RegExp(juryClass));
    }
  });
  test(`${layout}: future players transition when eliminated and retain Jury styling in their first eligible episode`,async()=>{
    const game=singlePlayer('active');
    for(const castaway of game.castaways.slice(2,5)){castaway.status='voted-out';castaway.eliminationEpisode=5;}
    const transition=(await renderLayouts(game))[layout];
    assert.match(transition,new RegExp(juryClass));assert.doesNotMatch(transition,/jury-mode-label|Jury starts/);
    assert.doesNotMatch(transition,/score-contributions/);
    game.season.currentEpisode=6;
    const participating=(await renderLayouts(game))[layout];
    assert.match(participating,new RegExp(juryClass));assert.match(participating,/>Jury Mode</);
  });
  test(`${layout}: incomplete elimination history never receives Jury styling`,async()=>{
    const game=singlePlayer('complete');delete game.castaways[1].eliminationEpisode;
    assert.doesNotMatch((await renderLayouts(game))[layout],new RegExp(juryClass));
  });
  test(`${layout}: disabled Jury stays unmarked; future activation adds only muted styling`,async()=>{
    const game=singlePlayer('complete');game.juryMode!.enabled=false;
    assert.doesNotMatch((await renderLayouts(game))[layout],new RegExp(juryClass));
    game.juryMode!.enabled=true;game.juryMode!.activationEpisode=6;
    const html=(await renderLayouts(game))[layout];
    assert.match(html,new RegExp(juryClass));assert.doesNotMatch(html,/jury-mode-label|Jury starts/);
    assert.doesNotMatch(html,/score-contributions/);
  });
}

function unifiedGame(){
  const game=acceptanceGame();game.season.currentEpisode=5;
  game.juryMode={enabled:true,activationEpisode:5,reviewedEliminations:[]};
  game.players.find(player=>player.id==='synthetic-complete')!.name='Jackie Humphrey';
  for(const [role,points] of [['complete',11],['jury',7]] as const)game.scoreEvents.push({id:'synthetic-award-'+role,source:'jury',playerId:'synthetic-'+role,points,createdAt:'2026-10-20T12:00:00Z'});
  return game;
}

test('transition and active Jury styling preserve unified totals, ties and ranking positions without mutating the game',async()=>{
  for(const episode of [4,5]){
    const game=unifiedGame();game.season.currentEpisode=episode;
    if(episode===4)game.scoreEvents=game.scoreEvents.filter(event=>event.source!=='jury');
    const before=structuredClone(game),standings=seasonStandings(game),expectedTotals=episode===4?['17.0','17.0','11.5','11.5']:['28.0','24.0','11.5','11.5'];
    const activated=await renderLayouts(game);game.juryMode!.enabled=false;
    const disabled=await renderLayouts(game);game.juryMode!.enabled=true;
    const totals=(html:string)=>[...html.matchAll(/<strong class="score">([\d.]+)/g)].map(match=>match[1]);
    const ranks=(html:string)=>[...html.matchAll(/<span class="rank">(\d+)<\/span>/g)].map(match=>match[1]);
    for(const rendered of [activated,disabled]){assert.deepEqual(totals(rendered.homepage),expectedTotals);assert.deepEqual(ranks(rendered.homepage),['1','2','3','4']);}
    assert.equal((activated.homepage.match(/jury-leader-row/g)??[]).length,2);
    assert.doesNotMatch(disabled.homepage,/jury-leader-row/);
    assert.deepEqual(seasonStandings(game),standings);assert.deepEqual(game,before);
  }
});

// Opt in using the existing browser-tool dependency location; no app server,
// Firebase, emulator, auth session or network access is involved.
test('browser: muted Jury entries retain readable contrast, strikes, ranks and scores at mobile and desktop widths',{skip:!process.env.PLAYWRIGHT_PACKAGE},async()=>{
  const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE!)('playwright');
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
  try{
    const css=await readFile('app/globals.css','utf8'),evidence=process.env.JURY_STYLE_EVIDENCE??'work/jury-transition-hotfix/browser';
    await mkdir(evidence,{recursive:true});
    for(const episode of [4,5]){
      const game=unifiedGame();game.season.currentEpisode=episode;
      if(episode===4)game.scoreEvents=game.scoreEvents.filter(event=>event.source!=='jury');
      const rendered=await renderLayouts(game);
      for(const width of [393,1440]){
      const page=await browser.newPage({viewport:{width,height:1000}});
      await page.route('**/*',(route:{abort:()=>Promise<void>})=>route.abort());
      await page.setContent(`<style>${css}</style>${rendered.homepage}${rendered.expanded}`,{waitUntil:'domcontentloaded'});
      for(const selector of ['.jury-leader-row','.jury-torch-card','.jury-team-card']){
        const entries=await page.locator(selector).count();assert.equal(entries,selector==='.jury-torch-card'?1:2);
        for(const entry of await page.locator(selector).all()){
          assert.equal(await entry.evaluate((element:Element)=>getComputedStyle(element).filter),'grayscale(1)');
          // Check actual text nodes and their nearest opaque backgrounds. This
          // catches explicit child colors overriding a muted parent, and opacity
          // that would otherwise invalidate the measured contrast.
          const failures=await entry.evaluate((element:Element)=>{
            const rgb=(value:string)=>value.match(/[\d.]+/g)!.map(Number);
            const luminance=(value:string)=>rgb(value).slice(0,3).map(channel=>{const s=channel/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;}).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
            const problems:string[]=[];
            for(const node of [element,...element.querySelectorAll('*')]){
              const style=getComputedStyle(node);
              if(style.opacity!=='1')problems.push(node.className+': opacity '+style.opacity);
              if(style.display==='none'||!Array.from(node.childNodes).some(child=>child.nodeType===Node.TEXT_NODE&&child.textContent?.trim()))continue;
              let background:Element|null=node;
              while(background&&rgb(getComputedStyle(background).backgroundColor)[3]===0)background=background.parentElement;
              if(!background){problems.push(node.className+': no opaque background');continue;}
              const color=rgb(style.color);
              if(color[0]!==color[1]||color[1]!==color[2])problems.push(node.className+': non-grey text '+style.color);
              const a=luminance(style.color),b=luminance(getComputedStyle(background).backgroundColor),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
              if(ratio<4.5)problems.push(node.className+': contrast '+ratio.toFixed(2));
            }
            return problems;
          });
          assert.deepEqual(failures,[],`${width}px ${selector}`);
        }
      }
      for(const selector of ['.leader-row:not(.jury-leader-row)','.team-score-card:not(.jury-team-card)']){
        assert.equal(await page.locator(selector).count(),2);
        assert.equal(await page.locator(selector).first().evaluate((element:Element)=>getComputedStyle(element).filter),'none');
        assert.equal(await page.locator(selector+' .jury-mode-label').count(),0);
      }
      assert.deepEqual(await page.locator('.leader-row .rank').allTextContents(),['1','2','3','4']);
      assert.deepEqual(await page.locator('.leader-row .score').allTextContents(),episode===4?['17.0 pts','17.0 pts','11.5 pts','11.5 pts']:['28.0 pts','24.0 pts','11.5 pts','11.5 pts']);
      assert.deepEqual(await page.locator('.jury-mode-label').allTextContents(),episode===4?[]:Array(5).fill('Jury Mode'));
      assert.equal(await page.locator('.score-contributions').count(),episode===4?0:5);
      assert.deepEqual(await page.locator('.leader-row .change').allTextContents(),episode===4?['TOP','TOP','TOP','—']:['','','TOP','—']);
      assert.equal(await page.getByText(/Jury starts Episode/).count(),0);
      for(const [selector,count] of [['.leader-pick-eliminated',6],['.leader-roster-eliminated .leader-roster-name',3],['.jury-team-card .draft-roster-eliminated strong',6]] as const){
        assert.equal(await page.locator(selector).count(),count);
        for(const strike of await page.locator(selector).all()){
          assert.equal(await strike.isVisible(),true);
          assert.match(await strike.evaluate((element:Element)=>getComputedStyle(element).textDecorationLine),/line-through/);
        }
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
      await page.locator('.leaderboard-panel').screenshot({path:`${evidence}/standings-${episode}-${width}.png`});
      await page.locator('.torch-card').screenshot({path:`${evidence}/featured-${episode}-${width}.png`});
      await page.locator('.team-scores-section').screenshot({path:`${evidence}/teams-${episode}-${width}.png`});
      await page.close();
      }
    }
  }finally{await browser.close();}
});
