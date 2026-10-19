# Jury leaderboard presentation correction

October 16, 2026. Branch `feature/jury-mode-release-a`; HEAD remains `5e782a95e267be29eb8c918a83eb323f3f00e05a`. All changes are uncommitted.

## Root cause and reproduction

The actual synthetic grading fixture contained Episode 5 aggregate Jury awards of 11 and 7, but its shared season was still **Episode 4**. Both original rosters were Cinder/Echo/Echo, with eliminations in Episodes 3 and 4. `playerInJuryMode` correctly begins in Episode 5, subject to activation; it therefore returned false in this inconsistent test state. Eligibility data was present and complete. Zero surviving castaways alone must not activate Jury during the final elimination episode.

Separately, the featured leader card and expanded **Draft → Teams & Scores** cards had no Jury status rendering. Advancing the synthetic fixture to Episode 5 restored the existing main-row status, but those other cards still lacked labels. The new browser regression failed before the rendering correction because the featured card had no Jury label. Before screenshots and observations are retained under ignored `work/jury-leaderboard/`.

## Targeted correction

- `app/page.tsx`: use the existing eligibility helper for the featured card as well as ordinary rows. Show a consistently visible **Jury Mode** badge at mobile and desktop widths. Preserve the first-place player, “Current fantasy leader”, rank, lead and score.
- `app/draft/team-scores.tsx`: apply the same status helper, badge and subdued card treatment to expanded team cards.
- `app/globals.css`: muted row/card backgrounds, restrained featured-card accents and readable badges. Scores and names remain fully visible; no whole-card opacity, player hiding or rank penalty.
- `scripts/iphone-seed.ts`: after the real airtime boundary, completed grading/result fixtures advance only their synthetic current-episode field to the episode being graded. Future/open predictions and locking behavior are unchanged. The immutable snapshot and score events are not rewritten.
- Added `tests/jury-leaderboard.test.ts` and `scripts/verify-jury-leaderboard.mjs` for eligibility boundaries, preserved first-place totals and real browser rendering.

The existing in-use synthetic fixture was first repaired with a guarded transaction updating **only** `season.currentEpisode: 4 → 5`; a deep comparison verified that every other root field, including scores, picks and identities, stayed unchanged. A fresh grading reset was then independently exercised and graded through the normal commissioner API, confirming the repeatable fixture correction. The environment is left running with that fresh, graded Episode 5 fixture.

No changes were made to `lib/jury-public.ts`, Jury eligibility/grading, scoring, score-ledger, standings/provider logic, Firebase Rules or authorization.

## Points reconciliation

| Synthetic player | Ordinary fantasy points | Aggregate Jury award | Total | Rank |
| --- | ---: | ---: | ---: | ---: |
| Clean Sweep Player | 17.0 | 11.0 | **28.0** | 1 |
| Jury Player | 17.0 | 7.0 | **24.0** | 2 |
| Active Player | 11.5 | 0.0 | **11.5** | 3 |
| Legacy Player | 11.5 | 0.0 | **11.5** | 4 |

Each eliminated team's ordinary total is Cinder **8×1** + Echo **4×1** + repeated Echo **4×1.25** = **17**. The partial questionnaire earns Q1 **1** + Q2 **1** + Q5 **5** = **7**. The complete questionnaire earns **1+1+1+1+5**, plus **2** Clean Sweep = **11**. These aggregate Jury awards receive no draft multiplier. Active/legacy rosters have Dusk **6** + Fern **3** + Gale **2×1.25** = **11.5**. Entry bonuses and other direct adjustments are zero. No scoring defect was found.

## Actual verification

- `node --experimental-strip-types --test tests/jury-leaderboard.test.ts`: **3 passed, 0 failed**. Covers Episode 4/5 boundary with repeated slots, unresolved history/activation guards, and the Jury player retaining first place with unchanged regular events and unified totals.
- `node --experimental-strip-types --test tests/*.test.ts`: **350 passed, 0 failed**.
- `npm run lint`, `npx tsc --noEmit`, `git diff --check`: passed.
- `node --experimental-strip-types scripts/verify-jury-leaderboard.mjs verify`: **6 passed** at **393px, 520px and 1440px**. At every width it checks main rows/featured first place and expanded team cards, visible badges, computed subdued colors, four-player unified ordering/totals, no Jury marking on active/legacy teams, and no horizontal page overflow. The same six checks passed again after a fresh `grading` reset and normal API confirmation.
- Screenshots were visually inspected. Final browser trace contains **zero runtime errors**. Two earlier development runs were interrupted by a discussion render error while working against the live dev server; the final clean runs returned valid discussion data and passed without changing discussion code. Reload existing Safari tabs to load the updated client.
- Source hashes confirm the scoring/Jury/eligibility/standings/provider engines and proposed Rules are unchanged. Browser verification deep-compares the game before/after its reads. No full security audit or production build was repeated for this focused presentation change.

Evidence: `work/jury-leaderboard/capture-episode4-results.json`, `capture-results.json`, `before-check.txt`, `preserved-fixture-results.json`, `verify-results.json`, `browser-trace.json`, `unit-tests.txt`, screenshots and `preservation.json`.

Windows Chrome mobile-width verification is complete; this correction still needs the commissioner's physical Safari recheck. The existing private test URL/password remain valid. Refresh the normal leaderboard and Draft → Teams & Scores. Expect Jury labels on the 28.0-point leader and 24.0-point player, with surviving teams unmarked.

There were no production accesses/writes, deployments, commits, pushes, merges, PRs, Rules publication or Release B changes. Existing uncommitted feature/security work was preserved. Stopped before release.
