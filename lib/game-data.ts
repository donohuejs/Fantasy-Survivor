export type Player = { id:string; name:string; email:string; entryBonus:number; priorFinish:number; draftSlot:number };
export type Castaway = { id:string; name:string; shortName:string; age:number; occupation:string; bio:string; imageUrl:string; status:'active'|'voted-out' };
export type DraftPick = { id:string; playerId:string; castawayId:string; round:number; pickNumber:number; multiplier:number };
export type ScoreEvent = { id:string; castawayId?:string; playerId?:string; categoryId?:string; points:number; episode?:number; note?:string; createdAt:string };
export type Category = { id:string; label:string; points:number; group:string; details?:string };
export type DraftTurn = { playerId:string; playerName:string; email:string; round:number; pickNumber:number };
export type DraftState = { status:'setup'|'live'|'paused'|'complete'; currentPick:number; turns:DraftTurn[] };
export type GameState = { season:{ id:string; name:string; number:number; currentEpisode:number; entryFee:number }; players:Player[]; castaways:Castaway[]; draftPicks:DraftPick[]; scoreEvents:ScoreEvent[]; draft:DraftState };

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
['tribe-first','First-place tribe',2,'Challenges'],['tribe-second','Second-place tribe',1,'Challenges'],['individual-immunity','Win individual immunity',5,'Challenges'],['individual-reward','Win individual reward',3,'Challenges'],['group-reward','Selected for group reward',1,'Challenges'],['sit-out','Sit out a challenge',-1,'Challenges'],['rice','Sit out to earn rice',2,'Challenges'],['alive','Still on the island',1,'Weekly'],['voted-premerge','Voted out before merge',-1,'Milestones'],['find-idol','Find an idol',5,'Advantages'],['find-advantage','Find an advantage',2,'Advantages'],['use-idol','Successfully use an idol',5,'Advantages'],['use-advantage','Successfully use an advantage',2,'Advantages'],['idol-pocket','Go home with an idol',-10,'Advantages'],['advantage-pocket','Go home with an advantage',-4,'Advantages'],['fake-idol-found','Someone finds your fake idol',2,'Advantages'],['fake-idol-used','Someone uses your fake idol',2,'Advantages'],['fake-idol-home','Use a fake idol and go home',-5,'Advantages'],['shot-safe','Successful shot in the dark',5,'Tribal council'],['shot-unsafe','Unsuccessful shot in the dark',-1,'Tribal council'],['journey','Go on a journey',1,'Milestones'],['no-vote','Attend tribal without a vote',-1,'Tribal council'],['merge','Earn the merge buff',1,'Milestones'],['final-five','Make the final five',5,'Milestones'],['final-three','Make the final three',10,'Milestones'],['sole-survivor','Win Survivor',25,'Milestones'],['title-quote','Episode title quote',1,'Weekly'],['majority','Vote with the majority',2,'Tribal council'],['blindside','Vote is a blindside',1,'Tribal council'],['survive-tribal','Survive tribal council',1,'Tribal council'],['letters','Letters from home',10,'Bonuses'],['orchestrate','Orchestrate a move',5,'Bonuses'],
].map(([id,label,points,group]) => ({id:String(id),label:String(label),points:Number(points),group:String(group)}));

const priorFinish = ['Chad','Jennie','Joey','Ross','Josh','Dunna','Katie','Jackie','Steph','Hilary','Dustin','Zoda','Stanzi'];
const players = priorFinish.map((name,index) => ({id:`player-${name.toLowerCase()}`,name,email:'',entryBonus:0,priorFinish:index+1,draftSlot:priorFinish.length-index}));
export function buildDraftTurns(roster:Player[]):DraftTurn[]{
  const first=[...roster].sort((a,b)=>a.draftSlot-b.draftSlot);
  return [first,[...first].reverse(),first].flatMap((roundPlayers,roundIndex)=>roundPlayers.map((player,index)=>({playerId:player.id,playerName:player.name,email:player.email.toLowerCase(),round:roundIndex+1,pickNumber:index+1})));
}
export const initialGame: GameState = {
  season:{id:'season-51',name:'Survivor 51',number:51,currentEpisode:1,entryFee:20},
  players,
  castaways:cast.map(([name,shortName,age,occupation,bio,imageSlug]) => ({id:`cast-${shortName.toLowerCase().replace(/\s/g,'-')}`,name,shortName,age,occupation,bio,imageUrl:photo(imageSlug),status:'active'})),
  draftPicks:[], scoreEvents:[], draft:{status:'setup',currentPick:0,turns:buildDraftTurns(players)},
};
