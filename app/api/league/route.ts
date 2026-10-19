import 'server-only';
import {NextRequest} from 'next/server';
import type {GameState} from '@/lib/game-data';
import {authenticateCommunity,communityReply,communityFailure} from '@/lib/community-auth';
import {assertLeagueAccess} from '@/lib/league-access';
import {CommunityError} from '@/lib/community';
import {isCommunityOwner} from '@/lib/community-authority';
import {seedCurrentSeasonPossessions} from '@/lib/legacy-possession-seed';
import {initialGame,withHistoricalSeed,migrateLegacyDraftOrder} from '@/lib/private-league-seed';
import {withOfficialCastawayProfiles} from '@/lib/game-normalization';
import {firebaseConfigured} from '@/lib/firebase';
import {localAcceptance} from '@/lib/acceptance-environment';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
  if(process.env.NODE_ENV!=='production'&&!firebaseConfigured&&request.nextUrl.searchParams.get('view')==='local-setup')return communityReply({game:withHistoricalSeed(initialGame)});
  const auth=await authenticateCommunity(request);if(auth.error)return auth.error;
  try{
    const ref=auth.server.db.doc('games/survivor-51'),snapshot=await ref.get();
    if(!snapshot.exists&&!isCommunityOwner(auth.actor))throw new CommunityError('The league is not initialized.',{status:404});
    const raw=snapshot.exists?snapshot.data() as GameState:initialGame;
    assertLeagueAccess(raw,auth.actor);
    const game=localAcceptance()?withOfficialCastawayProfiles(raw):withHistoricalSeed(migrateLegacyDraftOrder(withOfficialCastawayProfiles(raw,seedCurrentSeasonPossessions(raw.season.id,raw.season.number,raw.possessions),initialGame)));
    const view=request.nextUrl.searchParams.get('view');
    if(view==='recaps'||view==='polls'){
      const collection=ref.collection(view==='recaps'?'episodes':'polls');
      const source=view==='recaps'&&!isCommunityOwner(auth.actor)?collection.where('status','==','published'):collection;
      return communityReply({rows:(await source.get()).docs.map(d=>d.data())});
    }
    return communityReply({game,commissioner:isCommunityOwner(auth.actor)});
  }catch(error){return communityFailure(error);}
}
