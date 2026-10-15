# Commissioner scoring corrections

The implementation and isolated verification are complete. The commissioner has authorized deployment and two precise production corrections, with verified backups and expected-state checks. No Firebase migration is required.

## Inspected architecture

- Project: `fantasy-survivor-9da59`; authoritative document: `games/survivor-51`.
- The document contains the `scoreEvents` ledger, draft picks, players, castaways, scoring rules, possessions, councils, attendance, votes and historical standings. There are no materialized live castaway or fantasy-team score totals.
- Existing award paths in `lib/scoring.ts` are invoked through the commissioner's browser Firestore transaction in `app/game-provider.tsx`. Browser writes are already restricted to the verified owner in `firestore.rules`.
- `batchId` identifies a submission, but council submissions can contain several categories and item outcomes. The editor groups by batch plus episode/category/action/tribe/note/source/target, then persists a stable `scoringActionId` on the first correction. It never treats a whole compound council submission as one award.
- Standings sum castaway ledger points, multiply each fantasy draft pick separately, then add direct player awards and entry bonuses. Episode recap snapshots are separate `episodes/{season}-{episode}` documents.
- The production ledger was inspected using one public, read-only REST document request. No service account or production sign-in was used. The initial unauthenticated Episode 4 recap read returned HTTP 403. A later authenticated, read-only commissioner inspection confirmed a private draft containing the same erroneous Ori award; see [the verification findings](scoring-verification.md).

## Behavior and storage

Episode Activity supports selecting previous episodes, editing recipients/points, and undoing an action. Opening an existing award selects its recorded recipients, regardless of their current tribe/status. Activity Log supports individual recipient/point corrections, individual reversals, older entries, and audit history. Changes require a reason and a review screen showing each changed award, castaway totals, and fantasy-team totals. Undo requires explicit confirmation with the affected award count. Dialogs use native modal focus management, keyboard cancellation and responsive layouts.

Corrections do not create negative gameplay events. Removed entries retain their original `points` and receive `scoringStatus: 'reversed'`; retained/changed/new entries receive `scoringStatus: 'corrected'`. Entries in the selected action receive a stable `scoringActionId`, current active `recipientIds`, `correctionId`, and `correctedAt`. All score consumers use `effectiveScorePoints`, which returns zero for reversed entries. Tombstones also preserve existing duplicate-award guards. Re-adding a removed recipient reuses its original entry. Generic undo changes scoring only, preserving episode/council/possession/elimination records. Automatic elimination reconciliation refuses to overwrite a manually corrected award.

`POST /api/scoring` verifies the Firebase bearer token with revocation checking and requires the existing verified commissioner email, `donohue.js@gmail.com`, regardless of client-provided roles or public environment settings. It accepts preview/save commands; `GET /api/scoring?eventId=...` returns private audit history under the same authorization checks.

The server preview reports whether the associated episode snapshot exists, its publication status and whether its scoring will differ after saving. One Firestore transaction reads the latest game, idempotency receipt and associated recap before writing:

1. Patch only `scoreEvents` and increment `scoringRevision` in the game document.
2. Create one immutable `scoreCorrections/{requestId}` receipt containing full before/after action entries, reason, timestamp, commissioner UID, command, and total impacts.
3. Read the associated recap and flag any scoring discrepancy. Preserve every recap field; correcting its saved snapshot requires a separate commissioner review/approval.

A SHA-256 version over the authoritative scoring inputs rejects stale reviews, including concurrent changes to another award, a multiplier, entry bonus or roster. Object keys are canonicalized to avoid differences between browser and Admin SDK snapshots. A repeated identical request returns its existing receipt without a second write. An ID reused for a different command fails. A new undo request against reversed scoring fails. Firestore retries transaction conflicts atomically ([Firebase transaction documentation](https://firebase.google.com/docs/firestore/manage-data/transactions)).

Audit records are inaccessible to browser Firestore clients, including the commissioner; only the authenticated server route reads/creates them. The explicit rules stanza documents the existing implicit-deny behavior for this new subcollection. No migration or new index is required. Existing whole-document commissioner transactions continue to preserve the added fields. Local setup mode stores its synthetic ledger and audit together in one localStorage value; no development auth bypass was added to the server.

## Files changed

- `lib/game-data.ts`: additive ledger/correction metadata types.
- `lib/score-ledger.ts`: effective points, castaway totals, stable action grouping and review version.
- `lib/score-corrections.ts`: validated correction planning, commissioner authorization, audit snapshots and score impacts.
- `lib/score-correction-store.ts`: atomic persistence, idempotency, read-only recap comparison and private audit retrieval.
- `app/api/scoring/route.ts`: authenticated preview/save/history API.
- `app/game-provider.tsx`: correction API integration, local audit persistence and effective scoring.
- `app/admin/score-editor.tsx`: Episode Activity, Activity Log, recipient editing, review/undo dialog and audit UI.
- `app/admin/scoring-manager.tsx`, `app/admin/page.tsx`, `app/globals.css`: existing Game Master integration and responsive styles.
- `lib/league.ts`, `lib/castaway-leaderboard.ts`, `lib/community.ts`: consistent totals, final standings and episode snapshots excluding reversals.
- `lib/scoring.ts`: preserve manual corrections during elimination reconciliation.
- `firestore.rules`: explicitly deny direct audit access.
- `tests/helpers/scoring-fixture.ts`, `tests/score-corrections.test.ts`, `tests/score-correction-store.test.ts`: synthetic fixtures and automated correction/authorization/concurrency tests.
- `scripts/check-scoring-ui.mjs`: repeatable synthetic desktop/mobile browser checks.
- `scripts/preview-ori-correction.ts`: read-only, strictly scoped production-snapshot preview.
- `scripts/rehearse-scoring-firebase.mjs`, `scripts/inspect-episode4-recap.mjs`: isolated emulator integration checks and authenticated read-only production recap inspection.
- `lib/episode4-recap-correction.ts`, `scripts/correct-episode4-recap.mjs`, `tests/episode4-recap-correction.test.ts`: guarded, separately approved one-off private recap patch and preservation/idempotency tests.
- `README.md` and this document: operation and verification guidance.

## Verification

Verified: 256 passing automated tests plus 33 isolated Auth/Firestore emulator integration checks, clean ESLint, TypeScript/optimized production build, and desktop (1440×1000) plus mobile (390×844) browser workflows. The browser checks also confirm HTTP 401 for unauthenticated scoring requests.

Run `node --experimental-strip-types --test tests/*.test.ts`, `npm run lint`, and `npm run build`.

The UI check uses a local development server with **no Firebase variables/credentials**, synthetic fixtures, a clean browser context for each viewport, and request routing that blocks all external hosts. Install/provide Playwright independently of the app's runtime dependencies. Set `PLAYWRIGHT_PACKAGE` to its absolute `package.json` if using a bundled runtime, and optionally `SCORING_BROWSER_EXECUTABLE` to an installed Chrome executable. Then run:

```powershell
npm run dev -- --hostname 127.0.0.1 --port 3100
node --experimental-strip-types scripts/check-scoring-ui.mjs
```

Screenshots are saved under ignored `work/scoring-ui/`. No production snapshot is loaded into the browser test.

## Approved production correction scope

Observed document update time: **2026-10-15T02:22:43.185252Z**. Ledger contains 223 entries. Season 51, Episode 4 is in progress. Ori's current tribe is `savu`.

Exact target:

- Batch: `e0c90d3b-786b-47bd-9fbc-261c5d65329b`.
- Erroneous entry: `e0c90d3b-786b-47bd-9fbc-261c5d65329b:cast-ori`.
- Episode: `4`; category: `tribal-immunity`; label: `Win tribal immunity`; tribe: `toka` / `Toka`; original award: `+2`.
- Created at: `2026-10-15T02:15:00.430Z`. The original PowerShell preview serialized this same instant as `.43Z`; exact typed REST backups preserve the original string.
- Keep all six other recipients at +2: Thien An, Brady Booker, Carter Krull, Kristin Flickinger, Maggie Nestor, Mike Pinsky.

Approved ledger mutation: reverse only Ori's award, keep its original +2 in the audit/ledger, synchronize this action's recipient lists to those six retained castaways and add correction markers to its seven original entries; create exactly one private audit receipt; increment `scoringRevision` (absent in this snapshot, so first value is 1). The ledger transaction does not change `episodes/51-4`. A separate approved patch removes only Ori from that private draft's matching immunity action, preserving every other field and action. Do not change Ori's tribe, any other award, any multiplier, or any other game fields.

| Recipient/team | Before | After | Change |
| --- | ---: | ---: | ---: |
| Ori Jean-Charles | 15 | 13 | -2 |
| Katie Wernsing (`player-katie`, 1.25× pick) | 60.75 | 58.25 | -2.5 |
| ZACK ZODA (`player-zoda`, 1× pick) | 57.75 | 55.75 | -2 |
| chad bond (`player-chad`, 1× pick) | 53 | 51 | -2 |

Every other castaway/team score remains unchanged. ZACK ZODA moves from fifth to seventh; Stanzi and Joey move up one position. Katie remains third and chad bond remains thirteenth. Live rankings retain the app's existing tie handling.

Generate the offline preview again with:

```powershell
node --experimental-strip-types scripts/preview-ori-correction.ts --snapshot work/production-scoring-readonly.json
```

The script has no network, credential or write capability. It refuses any mismatch in project/document identity, season, Ori's tribe, batch membership, episode/category/label/tribe/points, or prior corrections; it reports no writes if Ori is already reversed. Its proposed API request uses deterministic ID `episode-4-toka-remove-ori-v1`; the interface generates a review-specific request ID instead. Both save paths have the same idempotency and version protection.

Preferred execution after authorization: publish the tested app, reload commissioner/player tabs, open Game Master → Scoring → Episode Activity → Episode 4 → Toka / Win tribal immunity → Edit, uncheck Ori, enter the reason, and review. Confirm that the six retained recipients and score impacts match the approved plan. Save once, then verify the audit, active recipient count, Ori's unchanged Savu assignment, the six +2 awards, and affected team totals. If the authoritative scores changed since this snapshot, obtain a fresh preview before saving.

## Remaining limits

- Deployment and these two precise corrections are explicitly authorized. Stop if the verified backup cannot be recovered, current production differs unexpectedly, or a broader change would be required.
- The isolated Auth/Firestore rehearsal passed 33 checks, including real emulator rule enforcement, direct unauthorized writes, verified-owner API access and revoked-token rejection. Real Google browser OAuth and deployed-environment checks remain for the authorized production verification step.
- Authenticated read-only inspection confirmed that Episode 4's draft snapshot also includes Ori in Toka's immunity recipients. Its separate approved patch changes only this action's recipients using a document-version precondition; no migration is required.
- Older loaded app versions do not understand reversed entries. Reload all existing tabs after deployment before correcting production scoring.
- The existing game document has Firestore's document-size limit; this feature keeps audit snapshots in a subcollection rather than adding a large audit array to production. Reversed ledger entries remain intentionally small and retained for integrity.
