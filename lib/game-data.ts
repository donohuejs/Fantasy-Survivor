export type Player = { id:string; name:string; email:string; uid?:string; entryBonus:number; priorFinish:number; draftSlot:number; paid?:boolean; active?:boolean };
export type Castaway = { id:string; name:string; shortName:string; age:number; occupation:string; bio:string; imageUrl:string; status:'active'|'voted-out'; tribeId?:string };
export type Tribe = {id:string;name:string;color:string};
export type DraftPick = { id:string; playerId:string; castawayId:string; round:number; pickNumber:number; multiplier:number; decision?:'keep'|'swap'; keptAt?:number };
export type ScoreEvent = { id:string; castawayId?:string; playerId?:string; categoryId?:string; points:number; episode?:number; note?:string; createdAt:string; batchId?:string; awardKey?:string; actionLabel?:string; recipientName?:string; tribeId?:string; tribeName?:string; source?:'standard'|'episode-wide'|'one-time-bonus'|'first-tribal-council'|'tribe-wide' };
export type CategoryPhase = 'pre-merge'|'merge-only';
export type Category = { id:string; label:string; points:number; group:string; details?:string; target:'individual'|'tribe'; custom?:boolean; phase?:CategoryPhase; recipientStatus?:Castaway['status']; bulkOnly?:boolean; retired?:boolean; dynamicPoints?:'episode' };
export type DraftTurn = { playerId:string; playerName:string; email:string; uid?:string; round:number; pickNumber:number };
export type DraftState = { status:'setup'|'live'|'paused'|'complete'; currentPick:number; turns:DraftTurn[]; version?:2; runId?:string; revision?:number; blind?:{discards:string[];keptCount:number} };
export type SeasonResult={profileId:string;name:string;score:number;finish:number};
export type SeasonArchive={season:number;finalizedAt:string;results:SeasonResult[]};
export type GameState = { season:{ id:string; name:string; number:number; currentEpisode:number; entryFee:number; mergeEpisode?:number; finalized?:boolean }; players:Player[]; castaways:Castaway[]; draftPicks:DraftPick[]; scoreEvents:ScoreEvent[]; draft:DraftState; tribes:Tribe[]; categories:Category[]; history?:SeasonArchive[]; draftOrderVersion?:2 };

const photo = (filename:string) => `https://public-assets-pressexpress.s3.amazonaws.com/assets/releases/docimages/ac468eba/${filename}`;
const cast: Array<[string,string,number,string,string,string]> = [
['Aaliyah Puglia','Aaliyah',24,'Chef','A confident, quick-thinking Providence chef raised in Gloucester City, New Jersey.','Survivor51_CastAnnouncementFinal_html_2b8c64d64c20b785.jpg'],
['Alexis Levine','Alexis',34,'Criminal Defense Attorney','An outgoing Atlanta attorney whose thoughtful approach is backed by fierce determination.','Survivor51_CastAnnouncementFinal_html_df099f663b92bd7c.jpg'],
['An “Thien An” Nguyen','Thien An',24,'Medical Student','A quick-witted and empathetic Fort Worth medical student who thrives around people.','Survivor51_CastAnnouncementFinal_html_96f6b7a8ee9f1650.jpg'],
['Ana Sani','Ana',34,'Voice Actress','A Toronto-based voice actress bringing ambition, humor, and an embrace of chaos.','Survivor51_CastAnnouncementFinal_html_4f46d8a3c9d62f11.jpg'],
['Angelica “Jelly” Loblack','Jelly',29,'Sociology Professor','A passionate sociology professor in Bloomington, Indiana, with curiosity and range.','Survivor51_CastAnnouncementFinal_html_a3ab8c71bbf5156b.jpg'],
['Brady Booker','Brady',27,'Pro Wrestler','A Knoxville pro wrestler whose game promises intensity, enthusiasm, and fun.','Survivor51_CastAnnouncementFinal_html_309d09df0debca50.jpg'],
['Carter Krull','Carter',24,'Livestock Farmer','An adventurous and competitive livestock farmer from the Iowa–South Dakota region.','Survivor51_CastAnnouncementFinal_html_dd88d2f1469038e2.jpg'],
['Cristian Chavez','Cristian',26,'Head of HR','A loud, fun, and self-described chaotic HR leader from Salt Lake City.','Survivor51_CastAnnouncementFinal_html_76e63b78578a9535.jpg'],
['Danny Kilby','Danny',30,'Game Designer','A playful Canadian game designer who plans to turn chaos into strategy.','Survivor51_CastAnnouncementFinal_html_ba1bf4c7e6311a9e.jpg'],
['Devin Way','Devin',33,'Actor','A Los Angeles actor from Lufkin, Texas, known for charm, playfulness, and loyalty.','Survivor51_CastAnnouncementFinal_html_1d63c14f438c28bb.jpg'],
['Eric Macksoud','Eric',34,'Mental Health Counselor','An animated and empathetic mental health counselor now living in Connecticut.','Survivor51_CastAnnouncementFinal_html_ae9434cdd0d7bea3.jpg'],
['Jenna Doore','Jenna',30,'Wedding Photographer','An energetic Toledo wedding photographer combining empathy with determination.','Survivor51_CastAnnouncementFinal_html_37e9257d3121a71f.jpg'],
['Kristin Flickinger','Kristin',49,'Crisis Management','A joyful, determined crisis-management professional with roots in Idaho and California.','Survivor51_CastAnnouncementFinal_html_d9a703578a0bf342.jpg'],
['Lewis Kelly','Lewis',28,'Farmer','A Dublin-born farmer living in Puerto Rico with a cheeky, charming streak.','Survivor51_CastAnnouncementFinal_html_703774c1349fe7c2.jpg'],
['Linnea Capobianco','Linnea',25,'Entrepreneur','A rational and optimistic Jersey City entrepreneur with an outgoing social game.','Survivor51_CastAnnouncementFinal_html_1b3c21e5270d7415.jpg'],
['Maggie Nestor','Maggie',40,'Farmer','A joyful and intentional West Virginia farmer proudly bringing her country roots.','Survivor51_CastAnnouncementFinal_html_c7c2767a51456b4f.jpg'],
['Mike Pinsky','Mike',32,'Baseball Executive','A driven and strategic New York baseball executive with infectious enthusiasm.','Survivor51_CastAnnouncementFinal_html_3ad0c3893772efe6.jpg'],
['Ori Jean-Charles','Ori',27,'Personal Trainer','A consistent and hard-working personal trainer from Spring Valley, New York.','Survivor51_CastAnnouncementFinal_html_638df7b963b02b06.jpg'],
['Patt Cannaday','Patt',33,'Federal Prosecutor','A goofy, loyal, and intense federal prosecutor based in Washington, D.C.','Survivor51_CastAnnouncementFinal_html_fdda8036294f0e97.jpg'],
['Rob Antonson','Rob',40,'Airline Gate Agent','A competitive and funny Rhode Island airline agent who leads with heart.','Survivor51_CastAnnouncementFinal_html_ae8298ef96a6cfcd.jpg'],
['Sharonda Cox','Sharonda',34,'OB-GYN Resident','A resilient and charismatic OB-GYN resident now living in Richmond, Kentucky.','Survivor51_CastAnnouncementFinal_html_b3b8bea29d4e6e3e.jpg'],
];

export const categories: Category[] = [
  {id:'tribal-immunity',label:'Win tribal immunity',points:2,group:'Challenges',target:'tribe',phase:'pre-merge'},
  {id:'marooning-win',label:'Win the marooning challenge',points:2,group:'Challenges',target:'tribe',phase:'pre-merge'},
  {id:'individual-immunity',label:'Win individual immunity',points:5,group:'Challenges',target:'individual'},
  {id:'individual-reward',label:'Win individual reward',points:2,group:'Rewards',target:'individual'},
  {id:'individual-reward-selected',label:'Selected for individual reward',points:1,group:'Rewards',target:'individual'},
  {id:'group-reward',label:'Selected for group reward',points:1,group:'Rewards',target:'individual'},
  {id:'tribal-reward-primary',label:'Primary tribal reward',points:2,group:'Rewards',target:'tribe'},
  {id:'tribal-reward-secondary',label:'Secondary tribal reward',points:1,group:'Rewards',target:'tribe'},
  {id:'sit-out',label:'Sit out a challenge',points:-1,group:'Challenges',target:'individual'},
  {id:'rice',label:'Sit out to earn rice',points:2,group:'Challenges',target:'individual'},
  {id:'still-on-island',label:'Still on the island',points:1,group:'Weekly',target:'individual',bulkOnly:true},
  {id:'first-tribal-council',label:'First Tribal Council attendance',points:1,group:'Tribal council',target:'individual',bulkOnly:true,dynamicPoints:'episode'},
  {id:'voted-premerge',label:'Voted out before merge',points:-1,group:'Milestones',target:'individual',phase:'pre-merge',recipientStatus:'voted-out'},
  {id:'find-idol',label:'Find an idol',points:5,group:'Advantages',target:'individual'},
  {id:'find-advantage',label:'Find an advantage',points:2,group:'Advantages',target:'individual'},
  {id:'use-idol',label:'Successfully use an idol',points:5,group:'Advantages',target:'individual'},
  {id:'use-advantage',label:'Successfully use an advantage',points:2,group:'Advantages',target:'individual'},
  {id:'idol-pocket',label:'Go home with an idol',points:-10,group:'Advantages',target:'individual'},
  {id:'advantage-pocket',label:'Go home with an advantage',points:-4,group:'Advantages',target:'individual'},
  {id:'fake-idol-found',label:'Someone finds your fake idol',points:2,group:'Advantages',target:'individual'},
  {id:'fake-idol-used',label:'Someone uses your fake idol',points:2,group:'Advantages',target:'individual'},
  {id:'fake-idol-home',label:'Use a fake idol and go home',points:-5,group:'Advantages',target:'individual'},
  {id:'shot-safe',label:'Successful shot in the dark',points:5,group:'Tribal council',target:'individual'},
  {id:'shot-unsafe',label:'Unsuccessful shot in the dark',points:-1,group:'Tribal council',target:'individual'},
  {id:'journey',label:'Go on a journey',points:1,group:'Milestones',target:'individual'},
  {id:'no-vote',label:'Attend tribal without a vote',points:-1,group:'Tribal council',target:'individual'},
  {id:'merge',label:'Earn the merge buff',points:1,group:'Milestones',target:'individual'},
  {id:'final-five',label:'Make the final five',points:5,group:'Milestones',target:'individual'},
  {id:'final-three',label:'Make the final three',points:10,group:'Milestones',target:'individual'},
  {id:'sole-survivor',label:'Win Survivor',points:25,group:'Milestones',target:'individual'},
  {id:'title-quote',label:'Episode title quote',points:1,group:'Weekly',target:'individual'},
  {id:'majority',label:'Vote with the majority',points:2,group:'Tribal council',target:'individual',phase:'merge-only'},
  {id:'blindside',label:'Vote is a blindside',points:1,group:'Tribal council',target:'individual',phase:'merge-only'},
  {id:'survive-tribal',label:'Survive pre-merge Tribal Council',points:1,group:'Tribal council',target:'tribe',phase:'pre-merge',bulkOnly:true},
  {id:'letters',label:'Letters from home',points:10,group:'Bonuses',target:'individual'},
  {id:'orchestrate',label:'Orchestrate a move',points:5,group:'Bonuses',target:'individual'},
];

const retiredCategoryIds = new Set(['tribe-first','tribe-second','tribe-third','alive']);
const canonicalCategories = new Map(categories.map(category => [category.id,category]));

export function normalizeCategories(saved:Category[]|undefined):Category[] {
  const existing=saved??[];
  const normalized=existing.map(category=>{
    const canonical=canonicalCategories.get(category.id);
    if(canonical)return category.custom?{...canonical,custom:true}:canonical;
    return retiredCategoryIds.has(category.id)?{...category,retired:true}:category;
  });
  return [...normalized,...categories.filter(category=>!existing.some(savedCategory=>savedCategory.id===category.id))];
}

const priorFinish = ['Chad','Jennie','Joey','Ross','Josh','Dunna','Katie','Jackie','Steph','Hilary','Dustin','Zoda','Stanzi'];
const players = priorFinish.map((name,index) => ({id:`player-${name.toLowerCase()}`,name,email:'',entryBonus:0,priorFinish:index+1,draftSlot:priorFinish.length-index}));
export const DRAFT_ORDER_VERSION = 2;
export function activePlayers(roster:Player[]):Player[]{return roster.filter(player=>player.active!==false);}
export function tribeForCastaway(game:Pick<GameState,'tribes'|'castaways'>,castawayId:string):Tribe|undefined {
  const castaway=game.castaways.find(item=>item.id===castawayId);
  return castaway?.tribeId?game.tribes.find(tribe=>tribe.id===castaway.tribeId):undefined;
}
export function draftOrder(roster:Player[]):Player[]{
  return [...activePlayers(roster)].sort((a,b)=>a.draftSlot-b.draftSlot||a.priorFinish-b.priorFinish||a.id.localeCompare(b.id));
}
export function movePlayerToDraftFront(roster:Player[],playerId:string):Player[]{
  const player=roster.find(item=>item.id===playerId);
  if(!player||player.active===false)return roster;
  const slots=new Map<string,number>([[playerId,1]]);
  draftOrder(roster).filter(item=>item.id!==playerId).forEach((item,index)=>slots.set(item.id,index+2));
  return roster.map(item=>{
    const slot=slots.get(item.id);
    return slot===undefined||item.draftSlot===slot?item:{...item,draftSlot:slot};
  });
}
export function insertPlayerAtDraftFront(roster:Player[],player:Player):Player[]{
  return movePlayerToDraftFront([...roster.filter(item=>item.id!==player.id),player],player.id);
}
export function migrateLegacyDraftOrder(game:GameState):GameState{
  if(game.draftOrderVersion===DRAFT_ORDER_VERSION)return game;
  const canReorder=game.draft.status==='setup'&&game.draftPicks.length===0;
  const adam=game.players.find(player=>player.active!==false&&player.name.trim().toLowerCase()==='adam');
  const previousWinner=adam&&((adam.priorFinish===1)||game.history?.some(archive=>archive.season===game.season.number-1&&archive.results.some(result=>result.profileId===adam.id&&result.finish===1)));
  const legacyNewPlayer=Boolean(adam&&!previousWinner&&adam.priorFinish===adam.draftSlot);
  const players=canReorder&&adam&&!previousWinner?movePlayerToDraftFront(game.players,adam.id).map(player=>legacyNewPlayer&&player.id===adam.id?{...player,priorFinish:0}:player):game.players;
  return {...game,draftOrderVersion:DRAFT_ORDER_VERSION,players,draft:canReorder?{...game.draft,turns:buildDraftTurns(players)}:game.draft};
}
export function buildDraftTurns(roster:Player[],thirdRound:Player[]=[]):DraftTurn[]{
  const first=draftOrder(roster);
  return [first,[...first].reverse(),thirdRound].flatMap((roundPlayers,roundIndex)=>roundPlayers.map((player,index)=>({playerId:player.id,playerName:player.name,email:player.uid?'':player.email.toLowerCase(),...(player.uid?{uid:player.uid}:{}),round:roundIndex+1,pickNumber:index+1})));
}
export const initialGame: GameState = {
  tribes:[{id:'savu',name:'Savu',color:'#7030A0'},{id:'toka',name:'Toka',color:'#F2CC24'}],
  categories,
  season:{id:'season-51',name:'Survivor 51',number:51,currentEpisode:1,entryFee:10},
  players,
  castaways:cast.map(([name,shortName,age,occupation,bio,imageSlug]) => ({id:`cast-${shortName.toLowerCase().replace(/\s/g,'-')}`,name,shortName,age,occupation,bio,imageUrl:photo(imageSlug),status:'active'})),
  draftPicks:[], scoreEvents:[], draft:{status:'setup',currentPick:0,turns:buildDraftTurns(players)}, draftOrderVersion:DRAFT_ORDER_VERSION,
};
