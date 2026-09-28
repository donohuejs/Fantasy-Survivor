'use client';

import {SiteHeader} from '../site-header';
import {useGame} from '../game-provider';
import {DraftBoard} from './draft-board';
import {TeamScores} from './team-scores';

export default function Draft(){
  const {game}=useGame();
  const complete=game.draft.status==='complete';
  return <main className="inner-page">
    <SiteHeader active="/draft" subtitle="Draft board"/>
    <section className="inner-hero"><p className="eyebrow"><span/> Survivor {game.season.number}</p><h1>Three rounds. Every pick counts.</h1><p>Track the live draft as it happens, then follow every roster, active castaway, current tribe, and running score in one place. Round three uses a separately randomized order, and its overall pick numbers stay visible in the history.</p></section>
    {complete?<><TeamScores/><DraftBoard/></>:<><DraftBoard/><TeamScores/></>}
  </main>;
}
