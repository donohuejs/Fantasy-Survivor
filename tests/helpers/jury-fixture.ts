import {initialGame} from '../../lib/private-league-seed.ts';
import {type GameState} from '../../lib/game-data.ts';
import {JURY_RULES_VERSION,emptyFacts,type JuryConfig,type JuryFacts,type JuryPrediction,type JurySnapshot} from '../../lib/jury.ts';

export const juryOwner={uid:'jury-owner',email:'donohue.js@gmail.com',verified:true,commissioner:true};
export const juryMember={uid:'jury-member',email:'member@example.com',verified:true};
export const before='2026-10-21T23:59:59.999Z',airtime='2026-10-22T00:00:00.000Z';
export function juryFixture():GameState {
  const game=structuredClone(initialGame);
  game.season.currentEpisode=4;game.season.mergeOccurred=false;game.season.mergeState='pre-merge';delete game.season.mergeEpisode;
  game.castaways=game.castaways.slice(0,5).map((c,i)=>({...c,status:i<2?'voted-out':'active',tribeId:i===4?'blue':'red',...(i<2?{eliminationEpisode:i===0?2:4,eliminationReason:'voted-out' as const}:{})}));
  game.players=[{...game.players[0],id:'jury-player',uid:juryMember.uid,email:'',entryBonus:0},{...game.players[1],uid:'other-member'}];
  game.tribes=[{id:'red',name:'Red',color:'#ff0000'},{id:'blue',name:'Blue',color:'#0000ff'}];
  game.draftPicks=[0,1,0].map((cast,index)=>({id:'pick-'+index,playerId:'jury-player',castawayId:game.castaways[cast].id,round:index+1,pickNumber:index+1,multiplier:index===2?1.25:1}));
  game.scoreEvents=[{id:'historical',castawayId:game.castaways[0].id,points:8,episode:2,createdAt:'2026-10-01T00:00:00Z'}];
  game.possessions=[];game.tribalVotes=[];game.tribalCouncils=[];game.tribalCouncilResolutions=[];return game;
}
export function jurySnapshot(game=juryFixture()):JurySnapshot{return {season:51,episode:5,version:1,rulesVersion:JURY_RULES_VERSION,airtime,timeZone:'America/New_York',mergeEpisode:null,mergeVerified:true,format:'pre-merge',castaways:game.castaways.filter(c=>c.status==='active').map(c=>({id:c.id,name:c.name,tribeId:c.tribeId!})),tribes:game.tribes.map(t=>({id:t.id,name:t.name})),provenance:'Synthetic verified fixture: roster, tribes, and airtime.'};}
export const juryConfig=():JuryConfig=>({season:51,enabled:true,activationEpisode:5,revision:1,approvedAt:before,approvedBy:juryOwner.uid,approval:'Synthetic commissioner approval',reconciliations:[]});
export function juryPrediction():JuryPrediction{return {season:51,episode:5,playerId:'jury-player',ownerUid:juryMember.uid,snapshotVersion:1,answers:{},revision:0,eligibility:{fromEpisode:5,slots:juryFixture().draftPicks.map(p=>p.castawayId)}};}
export function juryFacts(snapshot=jurySnapshot()):JuryFacts{return {...emptyFacts(),mergeOccurred:false,councilsComplete:true,votesComplete:true,itemsComplete:true,provenance:'Synthetic council and vote evidence verified.',councils:[{id:'council-1',tribeId:'red',votedOutIds:[snapshot.castaways[0].id],rounds:[{id:'1',votes:[{castawayId:snapshot.castaways[0].id,countedVotes:4,nullifiedVotes:0,extraVotes:1},{castawayId:snapshot.castaways[1].id,countedVotes:1,nullifiedVotes:0,extraVotes:0},{castawayId:snapshot.castaways[2].id,countedVotes:0,nullifiedVotes:5,extraVotes:0}]}]}]};}
