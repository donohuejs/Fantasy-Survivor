'use client';
import {SiteHeader} from '../site-header';
import { useGame } from '../game-provider';

export default function Rules() {
  const {game}=useGame();
  const groups = Object.groupBy(game.categories,(category) => category.group);
  return <main className="inner-page">
    <SiteHeader active="/rules" subtitle="League rulebook"/>
    <section className="inner-hero rules-hero"><p className="eyebrow"><span/> Official scoring</p><h1>Every move has a price.</h1><p>The same scoring system as the workbook, including the round-three blind-pick multiplier.</p></section>
    <section className="draft-rulebook"><h2>How the draft works</h2><ol>
      <li><strong>A fresh pool every round.</strong> Each castaway can be selected once within a round. All castaways return for the next round.</li>
      <li><strong>Rounds one and two.</strong> Round one uses reverse prior-season finish order; round two snakes back. Your two-castaway pair cannot match another player’s pair, even in reverse order.</li>
      <li><strong>Round three: shuffle and deal.</strong> Turn order is randomized separately. The full deck is shuffled and one face-down castaway is dealt to each player. The remaining castaways turn face up in the discard pile.</li>
      <li><strong>Keep or swap.</strong> Keep your unknown dealt card for a 1.25× multiplier on its points. Or take a face-up discard at 1×, forfeiting the bonus. Your original dealt card turns face up in the discard pile and can be taken by any later player.</li>
      <li><strong>Delayed reveals.</strong> A kept card reveals after two more blind cards are kept. Swaps do not advance the count. Any cards still hidden reveal when round three ends.</li>
      <li><strong>No earlier-round restrictions in round three.</strong> You may keep or swap for a castaway you already drafted in round one or two. Your choices are limited only by the current deal and discard pile.</li>
    </ol><p>Round-three decisions are final. The game master can submit a decision for an absent player under the same rules. Undo is available only before the blind deal opens.</p></section>
    <section className="rules-layout"><aside><div className="rule-summary"><span>${game.season.entryFee}</span><strong>Entry fee</strong><p>League entry for the new season.</p></div><div className="rule-summary"><span>3</span><strong>Castaways drafted</strong><p>Three rounds, with round three eligible for the blind-pick bonus.</p></div><div className="rule-summary"><span>1.25×</span><strong>Blind-pick bonus</strong><p>Keep the blind pick and that castaway’s score receives a 25% boost.</p></div></aside><div className="rules-groups">{Object.entries(groups).map(([group,items]) => <article key={group}><h2>{group}</h2><div>{items?.map((category) => <div className="scoring-rule" key={category.id}><span className={category.points < 0 ? 'negative' : ''}>{category.points > 0 ? '+' : ''}{category.points}</span><p><strong>{category.label}</strong></p></div>)}</div></article>)}</div></section>
  </main>;
}
