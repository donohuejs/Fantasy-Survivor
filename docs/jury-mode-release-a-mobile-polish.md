# Release A — consolidated mobile UI polish

The approved presentation changes are implemented on `feature/jury-mode-release-a`, with prior uncommitted work preserved. Gameplay, scoring, authorization, server privacy and Firebase Rules are unchanged. Physical acceptance of these changed screens remains for the commissioner.

**Deployed:** https://fantasy-survivor-jury-staging.vercel.app · visible build **JURY-A-DIAG-c2bea7688886** · READY protected Preview **dpl_2rkbasfGA6V1RdDeMMwsGacRSCGP**. Immutable URL: https://fantasy-survivor-jury-staging-2t723po59.vercel.app. The stable alias, rendered client, verified server response and response-header identifier agree.

## Presentation changes

- Featured leader, regular leaderboard rows and expanded teams retain the authoritative score at the right, without redundant Total labels. Activated Jury players alone receive two compact contribution columns: **Castaway Total** and **Jury Points**. Badge, subdued styling, eliminated picks, unified ranks and activation timing are unchanged. Active players retain only their score.
- Confirmed Jury results use compact separated rows, with status/title at the left and awarded points at the right. Own answers, every accepted correct outcome when needed, and anonymous question participation remain. The summary is compact and no longer inherits the global site-footer background, padding, height and typography. Editable and locked/ungraded states are unchanged.
- At mobile widths, a native **Game Master section** selector replaces the seven-tab sticky grid. All seven existing hash destinations remain; forms stay mounted, so switching sections preserves unsaved input. Desktop keeps the keyboard-accessible tab bar. Commissioner authorization is unchanged.
- Private saved predictions use player cards with readable question responses, completion, eligibility, submission revision, per-answer server timestamp/revision and pre-airtime/late metadata. Cards stack on mobile; no private prediction table clips horizontally.
- Evidence sources are explicitly required, with a separate associated label, source examples, a 10-character hint and actionable validation before a save request. Correction reasons remain separately required. Empty recorded-fact suggestions explain that no useful suggestions exist and preserve entered evidence. Additional votes are clearly described as already included in counted-vote totals. Council/vote/item verification and Save → Preview → Confirm remain intact.
- The staging footer measures its actual height with ResizeObserver and reserves matching page/scroll clearance, including safe-area padding, stale notices and expanded diagnostics. Diagnostics expand in the footer's normal flow rather than floating over the form. The build identifier, operator navigation and capture/copy functions remain available. None of this staging code enters normal production builds.

## Authority and preservation

`playerPointContributions` is unchanged: Castaway Total equals the authoritative overall score minus effective Jury ledger awards. All ordinary bonuses, deductions, repeated slots and multipliers therefore stay in that subtotal; Jury awards are unmultiplied. The corrected cloud fixture remains **25.0 = 17.0 + 8.0** and **23.0 = 17.0 + 6.0**. Active/Legacy remain 11.5 each.

Confirmed results and accuracy still use the existing server-only latest confirmed grading records. Only eligible, graded participants who answered a question enter that question's denominator, once each. The browser receives its owner's results and authorized anonymous aggregates, not other participants' records. No answer-key visibility condition or aggregation calculation changed.

The evidence helper validates presentation inputs only. It does not infer missing facts, mark verification boxes, save suggestions, change scoring or skip review. Preview tokens, correction reasons, stable awards, optimistic revisions, immutable receipts and atomic regrading remain unchanged. Operator switching and Commissioner permissions remain independent.

## Changed files

| File | Change |
|---|---|
| `app/page.tsx` | Featured score at right; regular breakdown beneath player information; remove redundant total labels. |
| `app/draft/team-scores.tsx` | Simplify score unit label. |
| `app/globals.css` | Two-column subtotals, compact results/summary, responsive admin selector and readable prediction cards using the shared type scale. |
| `app/jury/results.tsx` | Compact question heading/points and explicit participation text; summary separated from global footer styles. |
| `app/admin/admin-tabs.tsx` | Mobile native selector, preserving existing tabs, panels and hash destinations. |
| `app/admin/jury-manager.tsx` | Evidence validation/help, non-destructive empty-suggestion handling and prediction-card presentation. |
| `app/admin/jury-predictions.tsx` (new) | Presentational Commissioner prediction cards. |
| `app/admin/jury-evidence-presentation.ts` (new) | Source-validation message and useful-suggestion predicate. |
| `staging/app/staging/operator-navigation.tsx` | Measure footer height and release observer on unmount. |
| `staging/app/staging/staging.css` | Reserved clearance, safe-area spacing and in-flow diagnostic panel. |
| `tests/jury-mobile-polish.test.ts` (new) | Seven component/presentation regressions. |
| `tests/jury-score-presentation.test.ts` | Existing three-layout coverage also excludes redundant total labels. |
| `scripts/rehearse-jury-ui-results.mjs` | Four viewport sizes, field validation, empty suggestions, all layouts/statuses, private-card fit and preserved section inputs. |
| `scripts/verify-jury-navigation-staging.mjs` | Real-identity layout, footer, correction controls and corrected-fixture checks in Chromium/WebKit. |
| This report | Results and focused physical rechecks. |

## Verification

| Actual command/check | Result |
|---|---|
| `node --experimental-strip-types --test tests/*.test.ts` | **414 passed**, zero failures. Includes three leaderboard layouts, active/Jury timing, subtotal authority, correct/incorrect/unanswered rows, multiple accepted answers, latest-revision accuracy and privacy, plus seven new presentation tests. |
| `npm run lint` | Passed. |
| `npx tsc --noEmit --incremental false` | Passed. |
| `node scripts/prepare-jury-ui-checks.mjs --refresh` then `node work/jury-ui-refinement/local-runtime.mjs build` | Normal production webpack build passed using the fixed demo configuration. |
| `node scripts/package-jury-staging.mjs --refresh` then `node work/jury-staging/deployment/build-payload.mjs` | Sanitized staging webpack build passed using existing staging-only configuration. |
| `node work/jury-ui-refinement/local-runtime.mjs ui` | **22 passed**: real demo-emulator lifecycle, 28/24 initial awards, 25/23 correction, Clean Sweep removal, accuracy/privacy, source validation, empty suggestions and 320/390/430/1440px layouts. |
| `node work/jury-ui-refinement/local-runtime.mjs jury` | **26 passed**, including partial saving, locking, confirmed/corrected grading, privacy and mobile browser behavior. |
| `node work/jury-ui-refinement/local-runtime.mjs scoring` | **33 passed**, existing correction atomicity, idempotency, undo and concurrency. |
| `node work/jury-ui-refinement/local-runtime.mjs security` | **132 passed**, zero failures; revoked Commissioner API 401, direct Firestore GET/PATCH 403. All writes used only the fixed local demo project. |
| `node scripts/verify-jury-ui-operator.mjs fantasy-survivor-jury-staging` | **60 passed**, six real staging identities, valid operator cookie with ordinary admin denials, independent operator/current-JWT checks; no fixture reset or credential rotation. |
| `STAGING_BROWSER_ENGINE=chromium STAGING_BROWSER_RESULT_DIR=work/jury-mobile-polish STAGING_BROWSER_URL=https://127.0.0.1:3119 node scripts/verify-jury-navigation-staging.mjs fantasy-survivor-jury-staging` | **17 passed**, zero failures; real identity transitions, exact build identity, ordinary/Commissioner navigation, corrected fixture, private cards, retained unsaved input and measured footer clearance. |
| Same command with `STAGING_BROWSER_ENGINE=webkit` | **16 functional checks passed / 1 failed** at the strict uncaught-runtime guard. See limitation below. |
| `node scripts/inspect-jury-staging-package.mjs` | **118 allowlisted source files / 414 source+build files**; zero forbidden content or public source maps. |
| `node scripts/verify-jury-ui-production-assets.mjs` | **46 anonymously downloaded normal-build assets**, zero forbidden private data/staging controls/credentials/maps; all four staging routes absent. |
| `vercel deploy --target preview --project prj_QHqT5XrfpsbdSKO3CavYwe7C7bcG --yes --cwd C:/Users/donoh/AppData/Local/Temp/fantasy-jury-staging-Gh9mzo --scope donohuejs-1066s-projects --json` | Vercel Node 22 build passed; protected Preview READY. |
| `node work/jury-mobile-polish/alias-staging.mjs` | Protection verified before updating only the stable staging alias. |
| `node work/jury-mobile-polish/verify-cloud.mjs fantasy-survivor-jury-staging` | **106 passed** across alias and immutable deployment: anonymous routes/APIs/22 observed assets protected, unauthorized POSTs rejected and six direct Firestore GET/PATCH denials. |
| `STAGING_DEPLOYMENT_FILE=work/jury-mobile-polish/deployment.json node scripts/verify-jury-staging-isolation.mjs fantasy-survivor-jury-staging` | All-deployment Vercel Authentication, zero bypass credentials, 11 Preview-only variables, unchanged protective Rules/two restricted runtime roles; Firebase free tier/no billing account and Vercel Hobby. Checked before and after deployment. |
| `node --experimental-strip-types work/jury-mobile-polish/snapshot.mjs fantasy-survivor-jury-staging after` | **46/46 document hashes unchanged**, zero added/deleted, seven score events and 25/23/11.5/11.5 totals preserved after deployment and HTTPS walkthrough. |
| `node work/jury-mobile-polish/check-source-preservation.mjs` | Of 221 starting source/document files, only the 11 listed existing files changed; 210 unchanged, none deleted. All scoring/authentication/Rules files are unchanged. |
| `git diff --check` | Passed, with existing Windows line-ending notices. |

Browser runs use the built applications. The real-account staging browser uses only fixed loopback HTTPS with a test-context-only self-signed certificate exception, and intercepts onboarding POSTs to avoid creating signup documents for unused synthetic roles. These are not physical Safari/PWA tests. Real membership, token validation and all authorization API checks remain exercised. Loopback HTTP does not retain the Secure operator cookie in WebKit, so the existing local HTTPS proxy is retained; no remote security or machine certificate trust was weakened.

The first full unit run caught raw pixel typography outside the existing shared scale; it was corrected to the shared variables. An initial browser failure exposed a wrapped textarea label incorporating its text; the source label is now explicitly associated outside the textarea. A footer assertion originally sampled before the site's smooth scroll finished; it now waits for the field/summary to be visibly above the footer. These were resolved before final verification.

## WebKit limitation carried forward

The final WebKit run passed all changed-screen, navigation, identity and clearance checks but recorded **17 access-control runtime messages**, clustered during Jury/Legacy switching and route replacement/prefetch. They include `/api/staging`, `/api/league`, `/api/registration` and Next RSC requests. The strict zero-error assertion fails and remains in the saved report. Requests were cancelled around navigation; the original cause has not been established. No errors were filtered and no authorization/caching shortcut was introduced. This is **not full WebKit acceptance**. Full evidence is retained in ignored `work/jury-mobile-polish/webkit-real-staging-browser.json` and the existing diagnostic capture remains available for physical-device evidence.

## Deployment and fixture preservation

Only the existing protected staging project is targeted. Source is an explicit sanitized allowlist from the current uncommitted working tree; no Git upload, production history/credentials, work artifacts or test fixtures are included. Existing all-deployment Vercel Authentication and zero bypass credentials are verified before and after deployment; staging Firebase remains free/unbilled with unchanged Rules/IAM.

The starting snapshot contains **46 documents and seven score events**, with standings 25/23/11.5/11.5. Pre-deployment checks match every document hash. No reset, accepted cloud fixture mutation, Rules publication, credential rotation, production/older-preview access, commit, push, merge or Release B work is authorized or performed by this patch.

The final protected HTTPS walkthrough used the existing normal Vercel owner session. Active had no admin navigation. Commissioner switching retained its privileges and showed all seven mobile section choices, two readable private-prediction cards and correction controls. Jury switching showed five confirmed compact results, a six-point episode total and no admin link. At 390px, the results summary ended at y=732 and the footer began at y=781, with measured 79px page clearance; no horizontal overflow occurred. Expanding diagnostics also updated the reserved height. No save, preview-confirmation or reset action was performed in this cloud walkthrough.

Branch/HEAD remain `feature/jury-mode-release-a` / `5e782a95e267be29eb8c918a83eb323f3f00e05a`. New work is uncommitted. Full logs, browser reports, preservation hashes, deployment metadata and screenshots are retained under ignored `work/jury-mobile-polish/`, excluded from the deployment. Temporary loopback test services are independent of remote staging; staging does not require the Windows computer.

## Focused iPhone rechecks

1. Confirm the new visible build ID at the stable URL in Safari and the installed PWA.
2. Check featured, regular and expanded teams: Jury-only two-column subtotals, total at right, 25/23 preserved; active player shows only 11.5.
3. Review both Jury players' corrected results: compact five rows, wrong/unanswered correct answers, participation counts and Clean Sweep outcome.
4. As Commissioner, use all seven section choices and return to an unsaved evidence entry. Review private prediction cards without sideways scrolling.
5. Try a missing evidence source and an empty suggestion load without saving valid changes. Confirm the actionable message and preserved input. Leave the corrected fixture intact.
6. Open the keyboard at the bottom evidence fields, scroll to bottom results/cards, and open/close diagnostics. Check controls remain reachable above the footer with Safari chrome and Home Screen safe areas.
7. Repeat Commissioner ↔ ordinary-player switching. If Game Master navigation or a runtime error appears unexpectedly, capture diagnostics while it is visible; do not clear caches before capture.
