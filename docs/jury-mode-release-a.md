# Jury Mode Release A — implementation and release review

Subsequent review: [Independent security and regression audit](jury-mode-release-a-audit.md) corrected seven bounded defects and identified two security blockers. The later [Security remediation](jury-mode-release-a-security-remediation.md) resolves both blockers and supersedes the earlier readiness/security conclusions. Production remains unchanged.

Status: implemented locally on `feature/jury-mode-release-a`, with changes left uncommitted. Production activation, deployment, Firebase Rules publication, pushes, pull requests, merges, and production data changes have **not** been performed.

## 1. Implementation summary

Release A provides private, playable episode predictions and commissioner-confirmed grading. Eligibility uses all three original draft slots, including repeated picks, and begins in the episode after the last verified elimination. All removal reasons count. Missing history blocks activation for a fully eliminated roster until the commissioner supplies a sourced reconciliation.

Each episode has one immutable, versioned pre-episode roster/tribe snapshot, an explicit merge-history verification, a canonical ISO airtime with UTC offset, an IANA display time zone, and the `jury-a-1` rules version. Predictions never follow later tribe edits. Creating or replacing historical prediction snapshots is rejected; reads never create entries.

All five questions score independently. The implementation includes Merge, tribe filtering, No Tribal Council, individual immunity beginning after the recorded merge episode, all four item-play classifications, counted-vote categories, council-specific secondary recipients, multiple vote-outs, Nobody outcomes, and the +2 Clean Sweep. Maximums are 11 before/during the merge and 13 afterward. A wrong Merge prediction does not invalidate Q4 or Q5.

Private per-question grades feed one stable, aggregate player-level ledger award per episode. Retrying or regrading replaces the same award identity and preserves existing events. Jury points never pass through drafted-castaway multipliers or change ranking/tie rules.

## 2. Changed files

| Files | Purpose |
| --- | --- |
| `lib/jury.ts`, `lib/jury-store.ts`, `lib/jury-public.ts` | Rules, eligibility, immutable options, server transactions, private grades, audit receipts, and leaderboard status. |
| `app/api/jury/route.ts`, `app/jury/*` | Authenticated prediction and commissioner endpoints; player questionnaire, automatic saves, locks, history, and private grades. |
| `app/admin/jury-manager.tsx`, `app/admin/page.tsx` | Integrated commissioner eligibility, snapshot, evidence, confirmation, preview, and correction controls within Scoring. Existing tabs remain intact. |
| `lib/league-access.ts`, `app/api/league/route.ts`, `app/league-client.ts`, `app/league-gate.tsx` | Verified account and active-profile membership checks; protected league, recap, and poll reads. |
| `app/game-provider.tsx`, `app/community-polls.tsx`, `app/episodes/community-client.ts`, `app/layout.tsx` | Compatible authenticated subscriptions through the server; immediate refresh after local mutations; account-scoped clearing; no migration writes during reads. |
| `firestore.rules` | Locally tested denial of anonymous live-data reads and all browser access to private Jury records. Commissioner direct game transactions and private signup permissions remain supported. |
| `lib/game-data.ts`, `lib/legacy-possession-seed.ts` | Jury summary/source types; historical possession fallback moved out of public browser bundles and into the authenticated server path. Existing stored possessions remain authoritative. |
| `lib/league.ts`, `lib/score-corrections.ts`, `lib/community.ts` | Clean Jury/vote state on an explicitly opened next season; route Jury corrections through key regrading; reject ambiguous/inactive account links. |
| `app/page.tsx`, `app/site-header.tsx`, `app/castaways/page.tsx`, `app/rules/page.tsx`, `app/globals.css` | Subdued Jury leaderboard labels, eligible entry point, original public cast profiles, Jury rulebook, and mobile layouts. |
| `tests/jury*.test.ts`, `tests/helpers/jury-fixture.ts` | Eligibility, partial saves, concurrency, grading, corrections, preservation, privacy, and vote-accumulator regression tests. |
| `scripts/preview-jury-activation.ts`, `scripts/rehearse-jury-firebase.mjs` | Deterministic read-only activation review and isolated real-emulator/API/browser rehearsal. |
| `.gitignore`, `eslint.config.mjs` | Exclude generated emulator logs, TypeScript cache, and ignored local rehearsal artifacts. |

No dependency installation or package changes were required. `lib/scoring.ts`, draft algorithms, historical league results, and existing score-correction transaction behavior were preserved.

## 3. Player workflow

1. Sign in with a verified Google account linked to one active league profile. Signed-out visitors see login, public rules, and the original, unedited Season 51 cast profiles.
2. Once activation and elimination history are verified, a fully eliminated player receives a Jury Mode entry point. Their first eligible episode is the following episode, regardless of when the last elimination occurred during its episode.
3. Select an episode from history. Each answer saves immediately and independently, with a server timestamp, answer revision, snapshot version, and stable Q1–Q5 identity. The page shows Saved, Saving, Unanswered, and Locked states.
4. Before airtime, edit saved answers. Requests use an optimistic prediction revision, so concurrent sessions cannot silently overwrite each other. Retries reuse audited request identities. Save failures remain visible and can be retried.
5. Selecting a tribe limits Q4/Q5 to its snapshot members; Merge opens the entire snapshot roster. No Tribal Council offers the Nobody outcomes. A Q1 edit that would remove a saved castaway option requires the player to change that castaway answer first; it never silently deletes a saved answer.
6. At canonical airtime the server rejects all new answers and edits, including unanswered questions. Locking needs no app visit or scheduled job. Previously saved partial answers retain their scoring eligibility. Unanswered questions are not marked voluntarily forfeited.
7. After Game Master confirms results, the locked history displays private question points, Clean Sweep, total, and key revision. Players remain in normal standings, with a subdued Jury Mode label once that mode is effective for the current episode.

The server is the time authority. Client clocks do not admit answers or determine scoring. The interface refreshes server state every 15 seconds and on focus; stale or offline screens cannot bypass the API lock.

## 4. Game Master workflow

Open **Game master → Scoring → Jury Mode**.

1. Review active players, original slots, elimination records, unresolved history, and their first eligible episodes.
2. Save a verified future episode snapshot. Current roster assignments are suggestions for a future snapshot only; verify each member, tribe, merge history, and canonical airtime. Snapshot creation requires explicit merge-history confirmation and provenance.
3. Record missing historical elimination episodes with provenance in private Jury configuration, approve the first activation episode, and explicitly enable predictions. This changes no historical castaway record or score. The first activated episode becomes immutable; pausing/re-enabling does not reset history.
4. Review all private saved predictions, timestamps, revisions, and completion counts. No-answer participants remain visible without creating historical prediction entries.
5. Load suggestions from recorded councils, immunity events, and possessions. Suggestions deliberately leave completeness unconfirmed. Add missing unsuccessful item plays, Shot in the Dark, voting rounds, counted/nullified/additional votes, or explicit empty outcomes.
6. For pre-merge episodes, evidence stays inside private Jury records. For a recorded merge or post-merge episode, vote tallies and vote-outs are read from standard scoring; supplied replacement tallies cannot override that accumulator. Additional votes are already included in counted votes. Revotes union distinct recipients within each council; Q3 accepted categories are evaluated per council. Q4 accepts any actual secondary recipient, including a one-vote recipient, and applicable Nobody else council outcomes.
7. Save verified evidence, then preview the five-question key and affected awards. No preview writes scores or receipts.
8. Explicitly confirm all five answers and the awards. One atomic transaction confirms the key, saves private grades, updates aggregate awards, and creates an audit receipt. A changed game, prediction set, configuration, or evidence invalidates the preview and requires another review.
9. To correct a result, save revised evidence with a correction reason, preview again, and confirm. Existing award IDs are updated; previous evidence, keys, and impacts remain in immutable private receipts. Generic scoring Edit/Undo directs Jury awards back to this workflow.

Later elimination corrections re-evaluate eligibility without rewriting saved answers. Confirmed grades remain authoritative while review is pending. Regrading can revoke an ineligible episode’s points to zero through the same receipt-backed process.

Standard episode scoring, episode completion, recaps, polls, and discussions do not depend on completing Jury evidence.

## 5. Security changes

- Firebase tokens are verified server-side with revocation checks. Accounts must be verified and linked to exactly one active profile; UID ownership takes precedence over legacy email matching. Commissioner authority remains the verified configured owner email used by existing server/rules checks.
- `GET /api/league` validates membership before returning game state, published recaps, or polls. Commissioner recap access also includes drafts. Responses are private, uncached, and vary by Authorization.
- Private `juryConfig`, `juryEpisodes`, `juryPredictions`, and `juryAudit` records deny all direct browser reads/writes, including Game Master. The API enforces player ownership and commissioner access. A participant catalog contains only that participant’s predictions; keys and other participants’ answers are excluded.
- Shared game state contains only the public eligibility summary and aggregate Jury awards. Answer values, per-question results, timestamps, and receipts stay private. Predictions remain private after season finalization.
- Commissioner direct game reads/writes remain available for existing transactional scoring, profile linking, season administration, and draft controls. Signup owners retain only their existing limited private signup access. Discussion/recap/poll mutations keep their authenticated server workflows.
- Historical possession fallback data no longer ships in public application bundles. Its authenticated compatibility fallback and stored production inventory are preserved.
- **Rules have been prepared and tested locally, not published. Existing production access permissions are unchanged by this task.**

Release A does not provide chronological or episode-specific spoiler isolation for authorized league members.

## 6. Testing results

Observed successful checks:

| Command / rehearsal | Result |
| --- | --- |
| `node --experimental-strip-types --test tests/*.test.ts` | 324 passing tests, including 57 new Jury cases. |
| `npm run lint` | Passed, no warnings or errors. |
| `npx tsc --noEmit` | Passed. |
| `npm run build` | Successful optimized production build, including `/jury`, `/api/jury`, and `/api/league`. |
| `scripts/rehearse-jury-firebase.mjs` | 22 passing real Auth/Firestore emulator, API, desktop browser, and 390px mobile browser checks. |
| `scripts/rehearse-scoring-firebase.mjs` | All 33 existing isolated scoring-correction integration checks passed. |

The emulators used `demo-fantasy-scoring`, Auth at `127.0.0.1:9098`, Firestore at `127.0.0.1:8085`, and Next at `127.0.0.1:3106`. Tests assert the fixed demo project and loopback hosts before writing synthetic fixtures. Proposed repository Rules were loaded exactly and their SHA-256 recorded in the rehearsal report. No production service-account credential was used in these tests.

Desktop and mobile screenshots were inspected. Browser interactions produced no uncaught JavaScript errors, and both viewports passed horizontal-overflow checks. Actual iPhone Safari/WebKit and installed-PWA hardware testing remain release checklist items; the successful mobile checks used Chromium with a 390×844 touch viewport.

Windows sandbox permissions initially blocked replacing generated `.next` files. The successful normal production build ran with approved filesystem access. An initial Turbopack dev junction error was avoided by using webpack for the isolated test server. A test run during generated-file replacement could not find the build HTML; the final suite was run after the completed build. These were environment/test-order issues, not reported as successful runs.

Local evidence: `work/jury-release-a/unit-tests.txt`, `lint.txt`, `build.txt`, `emulator-results.json`, and `browser/`. Existing correction rehearsal evidence is in `work/firebase-rehearsal/results.json`. These are ignored local artifacts, not production records or committed fixtures containing credentials.

To reproduce the emulator rehearsal, run `node scripts/setup-jury-emulators.mjs` to prepare synthetic demo credentials and copy the proposed Rules. With a local Java 21+ runtime and Firebase CLI available, start `firebase emulators:start --only auth,firestore --project demo-fantasy-scoring --config work/firebase-rehearsal/firebase.json`. In the local Next server and rehearsal shell, set `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-fantasy-scoring`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8085`, and `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9098`. For the Next server also set `NEXT_PUBLIC_FIREBASE_API_KEY=demo-api-key`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-fantasy-scoring.firebaseapp.com`, `NEXT_PUBLIC_FIREBASE_APP_ID=demo-app-id`, and load the generated JSON into `FIREBASE_SERVICE_ACCOUNT_JSON`. Run `npx next dev --webpack --hostname 127.0.0.1 -p 3106`, then `node --experimental-strip-types scripts/rehearse-jury-firebase.mjs`. The browser rehearsal uses the bundled Playwright package (override with `PLAYWRIGHT_PACKAGE`) and installed Chrome. Never substitute a production project or credential for this fixed demo setup.

## 7. Preservation audit

Remote `main` was fetched read-only and still matched audited baseline `5e782a95e267be29eb8c918a83eb323f3f00e05a` (release PR #5). The starting UI cleanup branch had identical file contents to that merge baseline. The dedicated branch starts at that baseline. No unrelated local work existed or was overwritten. No commit, push, PR, merge, Vercel deployment, Firebase publication, production write, or production migration ran.

Two authenticated read-only production inspections produced the same canonical game-document SHA-256:

`b04412f7654193a5b3957bad04b0a377c3759e0835988e7d96c8d47252503796`

The preservation audit confirms unchanged season metadata, player identities, draft slots and multipliers, all 241 score events, castaways, tribes, possessions, league history, councils, votes, and computed standings. The production game’s update time remained `2026-10-15T12:24:39.267415Z`. The inspection script only GETs the game document; it never touches recaps, discussions, drafts, or production auth users.

Unit and emulator regression checks separately verify ordinary Jury reads do not create entries, Jury evidence cannot affect Final 5/Final 3 vote bonuses, direct awards are not multiplied, regrading cannot duplicate awards, and existing commissioner corrections retain audited, atomic behavior.

## 8. Read-only migration preview

Latest observed state: **Season 51, Episode 4, 13 active fantasy players, 39 picks, 241 score events**. Episode 4’s metadata still says `in-progress`; finishing the normal episode workflow remains a commissioner action.

The commissioner confirmed in this chat on October 15, 2026 that **Rob quit in Episode 3** and selected **Episode 5 as the planning target**, with airtime to be confirmed separately. Production Rob history remains unchanged. The local preview applies that confirmation only as a sourced, private Jury reconciliation:

| Player | Original slots | Verified final elimination | First eligible episode |
| --- | --- | --- | --- |
| Jackie Humphrey | Jenna / Rob / Jenna | Jenna: Episode 4; Rob: Episode 3 commissioner confirmation | **5** |

Jackie is the only currently fully eligible player in the preview and already has a linked UID. Twelve active profiles use UID links; Stanzi retains the supported legacy-email link, so no identity migration is required. Missing Ana/Patt episodes still affect other players’ reconciliation lists, but those players have surviving slots and do not presently qualify. Aaliyah also has missing historical elimination metadata and is shown in the commissioner’s complete missing-history form.

The preview contains a **16-castaway future roster candidate** with current recorded tribe IDs, marked as requiring commissioner verification. It is not a saved or usable prediction snapshot. Canonical Episode 5 airtime is **unset**, and raw production merge metadata is incomplete, so explicit pre-episode merge verification is required before opening the snapshot. No historical options are guessed from current tribes.

Expected records after separately authorized activation: one private `juryConfig/51`, one immutable `juryEpisodes/51-5`, one public Jury eligibility summary, private audit receipts, and one prediction document only when each eligible player first saves. Aggregate score awards exist only after confirmed grading. No historical scores or castaway elimination records need migration.

Local artifacts: `work/jury-release-a/activation-preview.json`, `commissioner-reviews.json`, and `preservation-audit.json`. Reproduce using the existing commissioner CLI session:

```powershell
node --experimental-strip-types scripts/preview-jury-activation.ts --episode 5 --reviews work/jury-release-a/commissioner-reviews.json
```

This command performs a production GET and local report writes only. `--fixture <local-game.json>` permits a completely offline preview. Do not invent an airtime or backdate a snapshot if Episode 5 has already aired at cutover.

## 9. Known limitations and deferred work

- Release B watched declarations, late completion, irreversible forfeitures, skipping, reminder preferences, and chronological spoiler filtering are not implemented or enabled. Stable answer identities, revisions, snapshot versions, and a reserved resolution model provide the path for that work.
- Release A is not fully spoiler-protected. Authorized participants can still see ordinary current-season league information, including results and recaps; saved predictions lock at broadcast and late entry is unavailable.
- Snapshot v1 is immutable. Verify it carefully before opening; correcting an opened snapshot requires a separately designed/versioned commissioner recovery, rather than silently changing existing predictions.
- Jury administration requires a configured Firebase server; browser-only local setup mode does not pretend to provide authenticated private predictions. The fixed emulator rehearsal is the supported isolated test path.
- API-backed league/recap/poll reads refresh every 15 seconds, on focus, and after local mutations. This replaces anonymous browser subscriptions without introducing a membership-index migration.
- The first activation episode, future roster/tribes, pre-episode merge status, and canonical airtime must be confirmed in production after the release is authorized. No production Jury configuration currently exists from this work.

## 10. Release checklist — separate approvals required

1. **Review approval:** review this uncommitted branch, source, Rules, test evidence, and the private local activation preview. Approve committing/pushing/PR creation only if desired; none is implied by this implementation task.
2. **Gameplay configuration approval:** retain the Episode 5 target only if the complete system can be operational before its verified broadcast. Confirm canonical date/time and `America/New_York` (or the explicitly chosen league zone), the 16-member candidate roster and tribes, and pre-episode merge history. If the target has aired, choose a later future episode instead; do not backdate.
3. **Historical reconciliation approval:** record Rob Episode 3 with the commissioner-chat provenance in private Jury configuration. Resolve any newly fully eliminated roster’s missing history. Do not modify historical standard score events to establish Jury eligibility.
4. **Isolated release rehearsal:** use a separate Firebase demo/preview project, proposed Rules, and the exact build. Rehearse linked member, legacy-email member, unlinked account, signed-out access, commissioner scoring and corrections, draft, recaps, discussions, partial saves, locking, and grading. Test a physical iPhone Safari and installed PWA; close/reopen and confirm partial answers persist.
5. **Production readiness:** verify Firebase Auth authorized domains and the existing server-only `FIREBASE_SERVICE_ACCOUNT_JSON` for the correct project. No new secret, scheduler, service worker, or production backfill is required. Prepare a separately authorized read-only backup and rollback plan before changing Rules or configuration.
6. **Application deployment approval:** deploy the compatible application with Jury predictions disabled. Confirm `/api/league` and `/api/jury` reject anonymous/unlinked accounts and permit the intended accounts. This step alone does not close the existing direct Firestore anonymous-read exposure.
7. **Firebase Rules publication approval:** separately publish the reviewed `firestore.rules` in a coordinated cutover window. Verify direct anonymous game/recap/poll reads and all direct Jury reads/writes fail; verify owner direct scoring and signup creation/linking still work. Older open clients must reload to use the authenticated API paths; include PWA reload in cutover verification. Do not restore anonymous access as a routine rollback.
8. **Activation-write approval:** through Game Master, save the verified immutable future snapshot and the sourced private reconciliation, approve the first activation episode, and explicitly enable Jury Mode. These are production writes and require authorization beyond this task. Review the resulting receipts and confirm standard historical scores, picks, and standings are unchanged.
9. **Participant verification before broadcast:** confirm Jackie’s account is linked to the correct existing profile, her Episode 5 entry opens, a single answer saves/reloads, and the deadline displayed matches the approved canonical airtime. No proxy prediction entry or backdated answer path is included.
10. **Operational grading:** after broadcast, complete and review factual evidence, confirm the answer key, preview aggregate impacts, and apply grading. Correct later evidence through audited regrading. Preserve permanent prediction privacy and leave Release B disabled until its separate implementation is verified.
