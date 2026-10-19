# Jury Mode Release A — independent hardening audit

Historical audit snapshot: both blockers identified here were subsequently repaired and verified in [Security remediation](jury-mode-release-a-security-remediation.md). That report supersedes this document's blocked readiness verdict; the findings and before-fix evidence below are retained.

Audit date: October 16, 2026. Repository: `donohuejs/Fantasy-Survivor`. Branch: `feature/jury-mode-release-a`. HEAD remains `5e782a95e267be29eb8c918a83eb323f3f00e05a`. All implementation and audit changes remain uncommitted.

This report supersedes the implementation report's security/readiness conclusions. It does not replace its gameplay specification. The implementation report was read first; the actual source, generated production assets, proposed Rules, and working tree were independently inspected. An audit-start SHA-256 manifest distinguishes the pre-existing uncommitted implementation from this pass's corrections.

## A. Executive verdict

**Blocked by issues requiring commissioner review.** Seven bounded, reproduced defects were corrected. Two security blockers remain:

1. **Public JavaScript exposes private league seed data.** Shared client imports contain all 73 historical results for Seasons 45–50, plus the 13 seeded player identities and prior-finish/draft order. Anonymous Chrome downloaded a production chunk containing these values. Page gates and Firestore Rules cannot protect downloadable JavaScript. The final build still reproduces this leak.
2. **Revoked commissioner credentials retain direct database authority.** After revoking a synthetic commissioner's token, `/api/league` returned **401**, but Firestore REST GET and PATCH on the shared game both returned **200** under the proposed Rules. The database checks verified owner-email claims without revocation metadata. This affects the direct transaction authority retained for existing commissioner workflows.

These repairs were stopped and submitted for commissioner guidance under the request's architectural-change restriction. No response authorizing either architectural repair had been received when this report was prepared. Suggested scopes are server-only private seed loading, and either maintained revocation-aware database authorization or server-backed commissioner transactions. Neither was implemented speculatively.

Firebase documents why checking revoked JWTs in Rules requires additional maintained metadata; API verification already uses `verifyIdToken(token, true)`. See [Firebase session management](https://firebase.google.com/docs/auth/admin/manage-sessions#detect_id_token_revocation).

## B. Security audit matrix

Identity legend: **A** anonymous; **U** verified but unlinked; **I** inactive linked profile; **P** active UID-linked player; **L** active legacy-email player; **G** verified Game Master; **R** revoked token; **X** malformed token. An additional unverified account was tested. Game Master authority comes from verified server token claims, never a request flag.

| Surface | Expected access | Observed access and test | Result |
| --- | --- | --- | --- |
| `/`, `/draft`, `/episodes`, `/chatter`, `/history`, `/jury` | Authorized league participants | Anonymous production browser navigation displayed sign-in gate; no prediction controls. API checks below cover underlying data. | Pass for pages; public bundle blocker remains |
| `/admin` | Login/setup visible; administrative data/actions G only | Source inspection of admin gate and server handlers; G desktop/mobile controls rendered; P forged admin flag and admin API views denied. | Pass, except revoked direct G authority |
| `/rules` | Public static rules | Anonymous production and configured-development browser navigation succeeded; stale local league cache ignored after correction. | Pass |
| `/castaways` | Original, unedited roster only for signed-out users | Anonymous browsers displayed 21 original castaway cards, no live leaderboard/status/ownership view; source always selects original roster for unauthorized viewers. | Pass |
| `/_next/static/**` | No private league values | Anonymous browser downloaded private historical scores and seeded player order; full generated-chunk inspection reproduced it. | **BLOCKER** |
| Icons, manifest, branding; missing/legacy routes | Non-spoiler static content only | Route inventory contains no extra legacy API/page or dynamic recap endpoint; icon/manifest/layout source has no live data loader. | Pass by inspection |
| `GET /api/league`, including unknown view | P/L/G | A 401; U/I/unverified 403; R/X 401; P/L/G 200. Unknown view goes through the same authorization. | Pass |
| `/api/league?view=recaps` | P/L published; G drafts too | Same identity matrix; member response excluded seeded unpublished recap marker. | Pass |
| `/api/league?view=polls` | P/L/G aggregate polls/results | Same identity matrix; no individual other-player ballots returned. | Pass |
| `GET /api/jury` | Submitting P/L; G uses admin view | A 401; U/I/unverified 403; R/X 401; P/L 200. Other player's answers/UID were absent, including after finalization. Unlinked G has no personal player questionnaire. | Pass |
| `/api/jury?view=admin`, `view=suggestion` | G only | G admin catalog 200; P/L/U/I 403; commissioner snapshot sources omitted from player catalog after correction. | Pass |
| `POST /api/jury` | Own eligible saves; all administration G | Supplied `playerId` ignored; actual authenticated profile used. Nonmembers denied; forged GM flags denied; direct private writes denied; revision/locking/retry tests exercised actual API. | Pass |
| `/api/discussions`: catalog, threads, recap, conversation | P/L/G | Catalog/threads/recap matrix: A 401, U/I/unverified 403, R/X 401, P/L/G 200. Conversation calls membership validation before loading comments. Cursor/page-size handling inspected. | Pass; conversation authorization also covered by unit/store suite |
| `/api/discussions`: schedule, migration, override | G only | P/L/U/I schedule/migration views denied 403; owner checks precede private management operations. Existing migration/read-state tests passed. | Pass |
| `/api/discussions`: post/edit/delete/read/preferences/watched | Authorized member; edit/delete ownership or G | Actual member post succeeded; U/I writes denied; store tests cover comment ownership, edits, deletion, opening, pagination and read tracking. | Pass |
| `GET /api/community?pollId=…` | Own P/L ballot | A 401; U/I/unverified 403; R/X 401; P/L 200. Supplied other `playerId` did not select another ballot. | Pass |
| `POST /api/community`: vote and legacy comment/delete | P/L, own author/ballot | Member vote/post passed; U/I existing and nonexistent poll IDs now both 403 before poll read; legacy comment requests denied for nonmembers. | Pass after correction |
| `/api/community`: save-recap/create-poll/close-poll | G only | Role guards inspected; recap publication/store tests and ordinary participation rehearsal passed. Published/draft recap separation verified. | Pass |
| `POST /api/draft` | Current active linked turn owner; G controls/proxy | A/R/X 401. Inactive turn owner and an active account reassigned to a different profile now 403 with zero picks written. Actual UID pick, legacy-email pick and G proxy each 200; draft unit suite also passes. | Pass after correction |
| `GET/POST /api/scoring` | G only | A/R/X 401; P/L/U/I 403. Existing correction rehearsal covers verified owner writes, disabled/revoked API tokens, forged owner claims, wrong-project/expired credentials, concurrent corrections and undo. | Pass |
| Firestore `/games/{id}` | Direct G only; ordinary reads through API | A/U/I/P/L/R-player 403; malformed token 400; G read/write permitted for existing transactions. Revoked G still GET/PATCH 200. | **BLOCKER for revoked G** |
| Firestore `episodes`, `polls`, `archives` | Direct G only; member API access | A/U/I/P/L/R-player document reads and collection queries 403; malformed token 400. G rule permissions match existing transactions. | Pass for membership; same G revocation blocker |
| Firestore `episodes/*/comments`, `discussionThreads`, `discussionSchedules`, `discussionUsers/**`, `communityPrivate` | No direct browser access, including G | A/U/I/P/L/G/R-player direct reads and writes 403; malformed token 400. Server workflows use Admin SDK and membership/role checks. | Pass |
| Firestore `polls/*/votes`, `draftPrivate`, `scoreCorrections` | No direct browser access | Same direct-read/write denial matrix, including G. Own poll vote is available only through the bound server API. | Pass |
| Firestore `juryConfig`, `juryEpisodes`, `juryPredictions`, `juryAudit` | No direct browser access; API separates own answers/G records | All direct read/write attempts denied, including G and submitting player. Member API excludes keys, evidence, receipts and other predictions. | Pass |
| Firestore `signups/{uid}` | Own signup/check-in; G assignment/listing | Own read succeeds, other-player read and self-assignment denied. Rules constrain verified own creation and unassigned name edits; G linking remains allowed. Own signup is a deliberate onboarding exception, not league access. | Pass for normal identities; direct revocation mechanism remains unresolved |
| Cached state, logout and resumed navigation | No previous account's private data | Production stale-cache regression passed; configured browser logout/back navigation passed; delayed Jury response guard passed. Same-device second-account test uses synthetic restored Firebase sessions. No service worker or Cache Storage entries found. | Pass within tested browser scope |

All protected API paths use no-store responses; the shared auth helper also uses `private` and `Vary: Authorization`. Authentication precedes payload reads. Error/log inspection found no raw prediction answers, keys, credentials or Firestore exceptions returned through these paths. One poll existence oracle was reproduced and corrected as described below. Public seeds remain the explicit exception to the privacy verdict.

The machine-readable matrix is `work/jury-audit/security-results.json`; production-browser findings are in `work/jury-audit/browser-results.json`. Each grouped direct-database check performs multiple reads/writes; grouped totals are not HTTP request counts.

## C. Defects discovered and corrected

| Severity | Defect and root cause | Small correction / files | Targeted regression |
| --- | --- | --- | --- |
| Medium | Commissioner snapshot evidence leaked because player catalog returned the full private snapshot. | Explicit player snapshot allowlist; public snapshot type excludes `provenance`. `lib/jury.ts`, `lib/jury-store.ts`, `app/jury/client.ts`. | `tests/jury-audit.test.ts` private-marker test; real API matrix proves player omission and G retention. |
| High | Cached draft turns continued authorizing deactivated/reassigned accounts; turn UID/email was treated as current profile authority. | Server transaction requires current unique active membership and matching current turn profile before executing a player pick. G controls/proxy remain supported. `app/api/draft/route.ts`. | Two real API regressions: inactive turn, and account now linked to a different profile; both 403 and zero pick writes. Existing draft suite passes. |
| Low | Unlinked accounts could distinguish existing/nonexistent poll IDs through errors because poll lookup preceded membership validation. | Validate membership immediately after transaction root read. `app/api/community/route.ts`. | Existing/nonexistent poll requests from U/I both 403 without existence message. |
| Medium | Correcting merge history across a snapshot's format boundary still allowed incompatible question weights/keys. | Fail closed on incompatible current merge history for saves and evidence/grading; catalog pauses that snapshot with review status. Existing answers/grades remain untouched pending review. `lib/jury.ts`, `lib/jury-store.ts`. | Pure grading guard and store test prove no answer, evidence, receipt or award write. No snapshot migration introduced. |
| Medium | `Date.parse` normalized impossible dates such as February 30 into another airtime. | Validate month/day against calendar before accepting timestamp. `lib/jury.ts`. | Invalid future calendar-date test now rejects. |
| Medium | Production missing-config fallback loaded old local league state, exposing custom league information on public rules. | Read local setup cache only in non-production local setup. `app/game-provider.tsx`. | Production Chrome seeds a private cached custom rule; public rules no longer display it. |
| Medium | Out-of-order catalog responses replaced a newer autosave on screen. | Sequence refresh requests and invalidate pending refreshes at cleanup. `app/jury/page.tsx`. | Browser holds an old GET, saves a new answer, releases old GET; newer answer remains displayed. |

New audit files: `tests/jury-audit.test.ts`, `scripts/audit-jury-release-a.mjs`, `scripts/audit-jury-browser.mjs`, and this report. `scripts/rehearse-jury-firebase.mjs` was extended with browser and downward-regrade regressions. The earlier implementation's unrelated uncommitted changes were preserved.

The public-seed and revoked-G findings are verified defects, not optional enhancements. Their architectural repair portions remain stopped. Cosmetic redesign, new features and Release B were excluded.

## D. Gameplay verification

| Invariant | Source and executed evidence | Conclusion |
| --- | --- | --- |
| Three original slots, repeated picks, every removal reason | `juryEligibility`, `eligibleForEpisode`; Jury eligibility tests validate rounds 1–3, surviving/missing slots, all supported removals and next-episode boundary. | Preserved; no mid-episode eligibility. |
| Missing history never guessed; Jackie Episode 5 | Reconciliation uses castaway identity plus status/episode/reason fingerprint. Added actual-name fixture: Jenna / Rob / Jenna, Jenna Episode 4, Rob quit with missing episode; unresolved until sourced Rob Episode 3 review, then first eligible Episode 5. | Preserved without player-specific production logic or historical record changes. |
| Q1 and merge | `validateSnapshot`, `answerOptions`, `confirmedFacts`, `answerKey`, `gradePrediction`; before/merge +1, post-actual-merge episode +3; Merge opens entire saved eligible roster for Q4/Q5. | Preserved; incompatible corrected phase now pauses for review. |
| Wrong Merge doesn't invalidate Q4/Q5 | Five independent correctness checks; wrong-Merge test keeps independently correct castaway awards. | Preserved. |
| Q2 categories | Confirmed complete item evidence distinguishes no play, one idol, one advantage/Shot in the Dark, and multiple items; unsuccessful plays count. | Preserved; missing completeness cannot default to Nothing. |
| Q3/Q4 | Distinct counted recipients union voting rounds per council; nullified-only recipients excluded; any secondary recipient qualifies, regardless of runner-up rank. | Preserved. |
| Q5/Nobody/multiple councils | Any verified qualifying vote-out +5; explicit no-council/no-vote/no-vote-out outcomes; one award per question even with multiple accepted council outcomes. | Preserved. |
| Clean Sweep and maximum | All five correct exactly +2; question weights 1/1/1/1/5 before/merge and 3/1/1/1/5 after. | 11 and 13, respectively. |
| Partial autosave and edits | Per-question IDs/revisions, server transaction receipts, tested 1/3/5 saves, reload/navigation, pre-airtime edits and unchanged unanswered state. | Preserved. |
| Deadline, retries and concurrency | Fresh server clock inside transaction/retry; stale revision rejection; no mutation on accepted replay; concurrent requests produce one winner; late edit and late unanswered completion both rejected. | Preserved; client timestamps do not bypass locking. No voluntary-forfeiture records created. |
| Direct points and standings | `applyJuryAwards` writes aggregate player events; existing ledger/standings perform direct player addition and unchanged ranking. | No castaway multiplier; ordinary score engine unchanged. |
| Stable regrading and corrections | Stable `jury:season:episode:player:total` identity, atomic game/key/private-grade/receipt writes, preview hash over current inputs. Unit and actual API downward correction passed. | No duplicate award; reduction supported; answers and earlier receipts preserved. |
| Corrected eligibility | Eligibility recalculated against current sourced history; regrade can reduce ineligible prior episode to zero through audited confirmation. | Preserved; no silent answer rewriting. |
| Vote accumulator isolation | Pre-merge tallies stay private; merge/post-merge councils use authoritative standard counted votes. Final 5/Final 3 regression fixtures unaffected. | Preserved. |
| Ordinary episode completion | Added test actually records an ordinary reward, finishes Episode 4 and publishes recap while future Jury facts remain incomplete and key null. | Jury grading is not a prerequisite. |

Admin review confirms explicit roster/tribe/merge/airtime sources, completeness checkboxes, read-only key/impact preview, commissioner confirmation and immutable audit receipts. Generic scoring Edit/Undo rejects Jury awards and directs the commissioner to key regrading. Stale previews and evidence revisions fail closed.

Snapshot v1 remains immutable. If a correction changes the applicable pre/post-merge format, this pass stops invalid writes; a versioned recovery is still a commissioner design decision. It does not silently replace options, infer answers or invent missing facts.

## E. Regression execution and limits

Final command results and complete logs are recorded in `work/jury-audit/`. The fixed demo project is `demo-fantasy-scoring`; Auth `127.0.0.1:9098`, Firestore `127.0.0.1:8085`, configured Next webpack server `127.0.0.1:3106`, production build server `127.0.0.1:3107`. Scripts assert the demo project, loopback endpoints, synthetic service-account project and exact proposed Rules before write rehearsals.

| Command | Final result |
| --- | --- |
| `node --experimental-strip-types --test tests/*.test.ts` | **330 passed, 0 failed**; six additional audit unit tests (63 Jury-related tests in total). |
| `npm run lint` | Passed, zero warnings/errors. |
| `npx tsc --noEmit` | Passed. |
| `npm run build` | Successful optimized production build; all six API handlers and nine application pages present. |
| `node --experimental-strip-types scripts/audit-jury-release-a.mjs` | **124 passed, 1 failed** grouped checks; failure is revoked G direct Firestore access. |
| `node --experimental-strip-types scripts/audit-jury-browser.mjs` | **9 passed, 2 failed**; both failures detect the same public private-seed leak, through downloaded and all-build assets. Cache fix and public page checks pass. |
| `node --experimental-strip-types scripts/rehearse-jury-firebase.mjs` | **26 passed, 0 failed**, including the original 22 checks and four added browser/regrade checks. Logs: `work/jury-audit/jury-integration.txt`, `work/jury-release-a/emulator-results.json`. |
| `node --experimental-strip-types scripts/rehearse-scoring-firebase.mjs` | **33 passed, 0 failed** existing checks. Logs: `work/jury-audit/scoring-integration.txt`, `work/firebase-rehearsal/results.json`. |

Reproduction setup:

```powershell
node scripts/setup-jury-emulators.mjs
# Use the locally available Java 21 runtime, then start only the fixed demo services:
firebase emulators:start --only auth,firestore --project demo-fantasy-scoring --config work/firebase-rehearsal/firebase.json
```

For the configured test server and rehearsal shell set `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-fantasy-scoring`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8085`, and `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9098`. Server-only setup also uses `NEXT_PUBLIC_FIREBASE_API_KEY=demo-api-key`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-fantasy-scoring.firebaseapp.com`, `NEXT_PUBLIC_FIREBASE_APP_ID=demo-app-id`, and the generated synthetic JSON from `work/firebase-rehearsal/server-service-account.json` as `FIREBASE_SERVICE_ACCOUNT_JSON`. Start `npx next dev --webpack --hostname 127.0.0.1 -p 3106`. For the scoring rehearsal set `SCORING_TEST_URL=http://127.0.0.1:3106`.

The separate default production build intentionally has no Firebase credentials/configuration and is served with `npx next start --hostname 127.0.0.1 -p 3107` for fail-closed/public-cache tests. Configured authorized browser/API tests use the webpack server. No claim is made that this is a configured production-preview hardware test.

Initial failing regressions established the defects before correction: three added unit assertions, stale browser answer response, anonymous cached rules, inactive draft action and poll error probing. Initial matrix expectations were corrected for malformed emulator JWTs (**400**, denied) and an unlinked commissioner's personal questionnaire (**403**, admin view **200**). Added second-account fixture assertions initially expected an intact drafted team and an injected display name: the fixture has no picks and correctly displays eligibility review, and Firebase restores its actual account email. These were harness expectation errors; the final check verifies the actual restored email and absence of previous answers. Earlier TypeScript narrowing errors in a new test and two lint warnings were corrected before final successful checks.

Testing used installed desktop Chrome and a 390×844 touch viewport. **No physical Safari/iPhone, WebKit or installed-iPhone-PWA testing occurred.** Synthetic Firebase sessions were restored for browser tests; production Google account-picker behavior was not exercised. Existing older deployed clients were inspected by their access paths, not recreated as a separate historical browser build.

## F. Existing-data preservation

- **Zero production accesses and zero production writes in this audit.** Synthetic emulator writes only. The earlier report's 241 production scoring events were not re-counted in this pass; this pass performed no operation that changes them.
- No historical league scores, profile IDs, picks, multipliers or production castaway history were modified. Emulator preservation assertions compare standard events, castaways, picks, vote accumulators and earlier audit receipts before/after grading and correction.
- Audit-start hashes confirm `lib/scoring.ts`, `lib/league.ts`, `lib/game-data.ts`, `lib/history-data.ts`, `lib/score-corrections.ts`, `lib/score-correction-store.ts` and `firestore.rules` remained unchanged during this pass. This distinguishes existing Release A changes from new audit fixes.
- HEAD and feature branch are unchanged. No commit, push, PR, merge, deployment, Firebase publication, production migration or activation occurred. No remote operation was necessary.

Evidence: `work/jury-audit/baseline-manifest.json`, `preservation.json`, unit/API/browser reports and local test logs. These ignored artifacts contain no production credential or synthetic bearer-token dumps.

## G. Remaining risks

**Release A blockers:** public private-seed bundles; revoked commissioner direct database authorization. Keep their failing checks enabled until repaired. Do not weaken the tests or restore anonymous Rules permissions to obtain a green run.

**Non-blocking limitations and release prerequisites:** immutable snapshot recovery needs a separate versioned procedure; new incompatible merge-history corrections now pause safely. Canonical Episode 5 airtime, roster/tribes and merge history require explicit commissioner verification before any separately authorized activation. Snapshot sources and Rob reconciliation remain private. Physical-device UAT remains outstanding. API league/recap/poll polling remains 15 seconds plus focus/local mutations. Server/Rules publication was not rehearsed against production.

**Older clients/PWA cutover:** new code uses authenticated server reads for ordinary players. Proposed Rules deny the old anonymous/root subscriptions and direct recap/poll reads; old tabs will need reload and may report permission errors. Direct G root transactions and signup workflows remain compatible for nonrevoked credentials. No service worker was found, but previously downloaded JavaScript/data cannot be retracted by a rule change. Close/reopen old tabs and installed PWA, verify account changes, and use a coordinated application/Rules cutover after blockers are resolved. The audit cannot certify the current pair as release-safe while the blockers remain.

**Deliberately deferred Release B:** chronological spoiler isolation, new watched declarations, late completion, irreversible forfeitures, skipping/reminders and related spoiler-aware lifecycle work. Release A still prohibits all late completion and does not mark unanswered questions as voluntary forfeitures. Pre-existing discussion preferences/watched behavior was preserved.

## H. Physical iPhone acceptance checklist

After blockers are resolved, use a separately authorized isolated preview/demo environment with synthetic data:

- Signed out: open standings, draft, episodes, chatter, history and Jury URLs directly; confirm sign-in gate. Open rules and original cast; confirm no status, points, owners, possessions or current tribe assignments.
- Sign in through actual Google UI with unlinked/inactive test accounts; confirm no league access. Test active UID and supported legacy-email accounts.
- Verify sourced Jackie fixture eligibility begins Episode 5, with Rob Episode 3 and Jenna Episode 4; confirm no entry while a draft slot survives.
- Save one answer, navigate away/back and reload. Save three of five; confirm partial answers persist, remaining questions stay unanswered. Edit an answer before the synthetic deadline; check displayed timezone/time.
- Close/reopen Safari and the installed PWA if used. Test slow network and a second tab; verify saved values and sensible stale-save feedback.
- At a synthetic server deadline, try an edit and completing an unanswered question; both must fail while saved answers still count. Changing device time must not unlock them.
- Sign out, navigate back, then sign in as another account on the same iPhone; confirm no prior player's answers/results appear. Verify ordinary players cannot open commissioner grading or another player's answers.
- As G in the isolated environment, finish ordinary scoring/publish a recap with Jury evidence incomplete. Then verify sources, preview/confirm Jury grading, apply a downward correction, and confirm one stable award plus preserved audit history. Test stale preview rejection.

## I. Release recommendation

Release A has **not passed** this independent review. Defer the passed-release Git checkpoint and controlled release preparation decision until the two security blockers have commissioner-approved repairs and their targeted regressions pass, followed by physical-device acceptance testing. This task performs no checkpoint or release action. Keep the branch and all changes uncommitted for commissioner review.
