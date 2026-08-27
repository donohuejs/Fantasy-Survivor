export type Player = { id:string; name:string; email?:string; entryBonus:number };
export type Castaway = { id:string; name:string; shortName:string; age:number; occupation:string; bio:string; imageUrl:string; status:'active'|'voted-out' };
export type DraftPick = { id:string; playerId:string; castawayId:string; round:number; pickNumber:number; multiplier:number };
export type ScoreEvent = { id:string; castawayId?:string; playerId?:string; categoryId?:string; points:number; episode?:number; note?:string; createdAt:string };
export type Category = { id:string; label:string; points:number; group:string; details?:string };
export type GameState = { season:{ id:string; name:string; number:number; currentEpisode:number; entryFee:number }; players:Player[]; castaways:Castaway[]; draftPicks:DraftPick[]; scoreEvents:ScoreEvent[] };

const photo = (slug:string) => `https://www.thewrap.com/wp-content/uploads/2026/08/3197255_SRVR_S51_${slug}-scaled.jpg?fit=bounds&height=683&width=1024`;
const cast: Array<[string,string,number,string,string,string]> = [
['Aaliyah Puglia','Aaliyah',24,'Chef','A confident, quick-thinking Providence chef raised in Gloucester City, New Jersey.','Aaliyah-Puglia_00233b'],
['Alexis Levine','Alexis',34,'Criminal Defense Attorney','An outgoing Atlanta attorney whose thoughtful approach is backed by fierce determination.','Alexis-Levine_00414b'],
['An “Thien An” Nguyen','Thien An',24,'Medical Student','A quick-witted and empathetic Fort Worth medical student who thrives around people.','Thein-An-Nguyen_00074b'],
['Ana Sani','Ana',34,'Voice Actress','A Toronto-based voice actress bringing ambition, humor, and an embrace of chaos.','Ana-Sani_00648b'],
['Angelica “Jelly” Loblack','Jelly',29,'Sociology Professor','A passionate sociology professor in Bloomington, Indiana, with curiosity and range.','Angelica-_Jelly_-Loblack_01038b'],
['Brady Booker','Brady',27,'Pro Wrestler','A Knoxville pro wrestler whose game promises intensity, enthusiasm, and fun.','Brady-Booker_01089b'],
['Carter Krull','Carter',24,'Livestock Farmer','An adventurous and competitive livestock farmer from the Iowa–South Dakota region.','Carter-Krull_01398b'],
['Cristian Chavez','Cristian',26,'Head of HR','A loud, fun, and self-described chaotic HR leader from Salt Lake City.','Cristian-Chavez_01508b'],
['Danny Kilby','Danny',30,'Game Designer','A playful Canadian game designer who plans to turn chaos into strategy.','Danny-_Kilby_-Kilby_01719b'],
['Devin Way','Devin',33,'Actor','A Los Angeles actor from Lufkin, Texas, known for charm, playfulness, and loyalty.','Devin-Way_01860b'],
['Eric Macksoud','Eric',34,'Mental Health Counselor','An animated and empathetic mental health counselor now living in Connecticut.','Eric-Macksoud_02058b'],
['Jenna Doore','Jenna',30,'Wedding Photographer','An energetic Toledo wedding photographer combining empathy with determination.','Jenna-Doore_02163b'],
['Kristin Flickinger','Kristin',49,'Crisis Management','A joyful, determined crisis-management professional with roots in Idaho and California.','Kristin-Flickinger_02415b'],
['Lewis Kelly','Lewis',28,'Farmer','A Dublin-born farmer living in Puerto Rico with a cheeky, charming streak.','Lewis-Kelly_02482b'],
['Linnea Capobianco','Linnea',25,'Entrepreneur','A rational and optimistic Jersey City entrepreneur with an outgoing social game.','Linnea-Capobianco_02720b'],
['Maggie Nestor','Maggie',40,'Farmer','A joyful and intentional West Virginia farmer proudly bringing her country roots.','Maggie-Nestor_03035b'],
['Mike Pinsky','Mike',32,'Baseball Executive','A driven and strategic New York baseball executive with infectious enthusiasm.','Mike-Pinsky_03098b'],
['Ori Jean-Charles','Ori',27,'Personal Trainer','A consistent and hard-working personal trainer from Spring Valley, New York.','Ori-Jean-Charles_03280b'],
['Patt Cannaday','Patt',33,'Federal Prosecutor','A goofy, loyal, and intense federal prosecutor based in Washington, D.C.','Patt-Cannaday_03473b'],
['Rob Antonson','Rob',40,'Airline Gate Agent','A competitive and funny Rhode Island airline agent who leads with heart.','Rob-Antonson_03679b2'],
['Sharonda Cox','Sharonda',34,'OB-GYN Resident','A resilient and charismatic OB-GYN resident now living in Richmond, Kentucky.','Sharonda-Cox_03865b'],
];

export const categories: Category[] = [
['tribe-first','First-place tribe',2,'Challenges'],['tribe-second','Second-place tribe',1,'Challenges'],['individual-immunity','Win individual immunity',5,'Challenges'],['individual-reward','Win individual reward',3,'Challenges'],['group-reward','Selected for group reward',1,'Challenges'],['sit-out','Sit out a challenge',-1,'Challenges'],['rice','Sit out to earn rice',2,'Challenges'],['alive','Still on the island',1,'Weekly'],['voted-premerge','Voted out before merge',-1,'Milestones'],['find-idol','Find an idol',5,'Advantages'],['find-advantage','Find an advantage',2,'Advantages'],['use-idol','Successfully use an idol',5,'Advantages'],['use-advantage','Successfully use an advantage',2,'Advantages'],['idol-pocket','Go home with an idol',-10,'Advantages'],['advantage-pocket','Go home with an advantage',-4,'Advantages'],['fake-idol-found','Someone finds your fake idol',2,'Advantages'],['fake-idol-used','Someone uses your fake idol',2,'Advantages'],['fake-idol-home','Use a fake idol and go home',-5,'Advantages'],['shot-safe','Successful shot in the dark',5,'Tribal council'],['shot-unsafe','Unsuccessful shot in the dark',-1,'Tribal council'],['journey','Go on a journey',1,'Milestones'],['no-vote','Attend tribal without a vote',-1,'Tribal council'],['merge','Earn the merge buff',1,'Milestones'],['final-five','Make the final five',5,'Milestones'],['final-three','Make the final three',10,'Milestones'],['sole-survivor','Win Survivor',25,'Milestones'],['title-quote','Episode title quote',1,'Weekly'],['majority','Vote with the majority',2,'Tribal council'],['blindside','Vote is a blindside',1,'Tribal council'],['survive-tribal','Survive tribal council',1,'Tribal council'],['letters','Letters from home',10,'Bonuses'],['orchestrate','Orchestrate a move',5,'Bonuses'],
].map(([id,label,points,group]) => ({id:String(id),label:String(label),points:Number(points),group:String(group)}));

const playerNames = ['Chad','Jennie','Joey','Ross','Josh','Dunna','Katie','Jackie','Steph','Hilary','Dustin','Zoda','Stanzi'];
export const initialGame: GameState = {
  season:{id:'season-51',name:'Survivor 51',number:51,currentEpisode:1,entryFee:20},
  players:playerNames.map((name) => ({id:`player-${name.toLowerCase()}`,name,entryBonus:0})),
  castaways:cast.map(([name,shortName,age,occupation,bio,imageSlug]) => ({id:`cast-${shortName.toLowerCase().replace(/\s/g,'-')}`,name,shortName,age,occupation,bio,imageUrl:photo(imageSlug),status:'active'})),
  draftPicks:[], scoreEvents:[],
};
