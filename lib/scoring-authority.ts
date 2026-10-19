import {isCommunityOwner} from './community-authority.ts';
import {ScoreCorrectionError,type ScoringActor} from './score-corrections.ts';
/** Server/CLI authority boundary. Client request flags are never used to construct this actor. */
export function assertScoringCommissioner(actor:ScoringActor){if(!actor.uid||!isCommunityOwner(actor))throw new ScoreCorrectionError('Only the game master can correct scoring.',403);}
