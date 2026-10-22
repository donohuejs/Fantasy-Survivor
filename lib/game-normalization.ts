import {initialGame,migrateLegacyTribalState,normalizeCategories,type GameState,type Possession} from './game-data.ts';
import {ensureEliminationScoringBoundary} from './scoring.ts';
export function withOfficialCastawayProfiles(saved:GameState,legacyPossessions:Possession[]=[],defaults:GameState=initialGame):GameState {
  const legacyStarted=saved.season.episodeStarted??Boolean(saved.scoreEvents?.some(event=>event.episode===saved.season.currentEpisode));
  const savedStatus=saved.season.episodeStatus;
  const episodeStatus=savedStatus==='not-started'||savedStatus==='in-progress'||savedStatus==='complete'?savedStatus:(legacyStarted?'in-progress':'not-started');
  const normalized={
    ...saved,
    tribes:saved.tribes??(saved.season.number===51?defaults.tribes:[]),
    categories:normalizeCategories(saved.categories),
    history:saved.history??[],
    season:{...saved.season,entryFee:saved.season.entryFee??defaults.season.entryFee,episodeStarted:episodeStatus==='in-progress',episodeStatus},
    draft:saved.draft??defaults.draft,
    draftPicks:saved.draftPicks??[],
    scoreEvents:saved.scoreEvents??[],
    possessions:saved.possessions?.length?saved.possessions:legacyPossessions,
    tribalCouncilResolutions:saved.tribalCouncilResolutions??[],
    tribalVotes:saved.tribalVotes??[],
    players:saved.players.map((player,index)=>({...player,email:player.email??'',priorFinish:player.priorFinish??index+1,draftSlot:player.draftSlot??saved.players.length-index})),
    castaways:saved.castaways.map((castaway) => {
      const official = saved.season.number===51?defaults.castaways.find((item) => item.id === castaway.id):undefined;
      return official ? {...castaway,name:official.name,shortName:official.shortName,age:official.age,occupation:official.occupation,bio:official.bio,imageUrl:official.imageUrl} : castaway;
    }),
  };
  return migrateLegacyTribalState(ensureEliminationScoringBoundary(normalized));
}

