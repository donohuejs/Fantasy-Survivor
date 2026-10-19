import type {GameState} from './game-data.ts';
import {CommunityError,type CommunityActor} from './community.ts';
import {localAcceptance} from './acceptance-environment.ts';
const communityOwner='donohue.js@gmail.com';
export function isCommunityOwner(actor:CommunityActor){return actor.verified&&actor.email.toLowerCase()===(localAcceptance()?'commissioner@jury.test':communityOwner);}
export function linkedAuthor(game:GameState,actor:CommunityActor,allowOwner=false){
  if(!actor.verified||!actor.uid)throw new CommunityError('Sign in with a verified Google account.',{status:401,code:'authentication'});
  const matches=game.players.filter(p=>p.active!==false&&(p.uid?p.uid===actor.uid:Boolean(p.email)&&p.email.toLowerCase()===actor.email.toLowerCase()));
  const player=matches.length===1?matches[0]:undefined;
  if(player)return {id:player.id,name:player.name};
  if(allowOwner&&isCommunityOwner(actor))return {id:'commissioner',name:'Game master'};
  throw new CommunityError('Your Google account needs to be linked to a league profile in Player check-in first.',{status:403,code:'authorization'});
}
