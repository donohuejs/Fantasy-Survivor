import type {GameState} from './game-data.ts';
import {CommunityError,type CommunityActor} from './community.ts';
import {isCommunityOwner} from './community-authority.ts';

/** Same verified, UID-first ownership used by draft and discussions; ambiguous links fail closed. */
export function leagueMember(game:GameState,actor:CommunityActor){
  if(!actor.uid||!actor.verified)throw new CommunityError('Sign in with a verified Google account.',{status:401,code:'authentication'});
  const matches=game.players.filter(p=>p.active!==false&&(p.uid?p.uid===actor.uid:Boolean(p.email)&&p.email.toLowerCase()===actor.email.toLowerCase()));
  if(matches.length!==1)throw new CommunityError('Your account must be linked to one active league profile in Player check-in.',{status:403,code:'authorization'});
  return matches[0];
}
export function assertLeagueAccess(game:GameState,actor:CommunityActor){if(!isCommunityOwner(actor))leagueMember(game,actor);}
