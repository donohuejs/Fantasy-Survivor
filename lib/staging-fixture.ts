import {acceptanceGame,acceptanceSnapshot,acceptanceFacts,acceptanceAccounts} from '../scripts/iphone-fixture.ts';
import {STAGING_PROJECT,STAGING_SCHEMA} from './staging-environment.ts';
export {acceptanceSnapshot,acceptanceFacts,acceptanceAccounts};
export const stagingScenarios=['open','lock','grading','wrong-merge','merge','postmerge'] as const;
export type StagingScenario=typeof stagingScenarios[number];
export function stagingGame(version:number,postMerge=false){
  const game=acceptanceGame(postMerge);
  for(const player of game.players)if(player.uid)player.uid=player.uid.replace(/^iphone-/,'staging-');
  return {...game,stagingFixture:{projectId:STAGING_PROJECT,schema:STAGING_SCHEMA,version}};
}
export function stagingParameters(input:Record<string,unknown>){
  if(!stagingScenarios.includes(input.scenario as StagingScenario)||!Number.isSafeInteger(input.seconds)||Number(input.seconds)<60||Number(input.seconds)>86400||!Number.isSafeInteger(input.expectedVersion)||Number(input.expectedVersion)<1||input.confirmed!==true||typeof input.requestId!=='string'||!/^[-a-zA-Z0-9_]{16,100}$/.test(input.requestId))throw new Error('Confirm a listed synthetic scenario, current version and a deadline from 60 to 86400 seconds.');
  return {scenario:input.scenario as StagingScenario,seconds:Number(input.seconds),expectedVersion:Number(input.expectedVersion),requestId:input.requestId};
}
