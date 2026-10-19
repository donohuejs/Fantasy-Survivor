# Release A — final UI polish and WebKit investigation

Date: October 18, 2026. Branch: `feature/jury-mode-release-a`. HEAD remains `5e782a95e267be29eb8c918a83eb323f3f00e05a`. All work remains uncommitted.

The three presentation changes are implemented and built. **Deployment is held:** staging Firestore returned `8 RESOURCE_EXHAUSTED: Quota exceeded`, preventing final real-account verification. No new deployment or alias change was performed. The stable address remains https://fantasy-survivor-jury-staging.vercel.app on accepted build **JURY-A-DIAG-c2bea7688886**, deployment **dpl_2rkbasfGA6V1RdDeMMwsGacRSCGP**. The new sanitized, locally built package is **JURY-A-DIAG-b32351c112e9**; that identifier is not yet served remotely.

## UI changes

- Mobile Game Master navigation uses the existing seven accessible tabs in a single horizontally scrollable, sticky strip. Its height is 56px plus the top safe area; buttons have at least 44px touch targets. The active tab reveals horizontally on selection, hash changes and viewport resizing. Desktop retains its original grid. Keyboard navigation and mounted, hidden form panels remain intact. The strip does not scroll the document when revealing a tab; scroll clearance keeps focused fields below it. All seven sections and unsaved evidence were exercised in Chromium and WebKit.
- Confirmed result rows alone receive pale green (`#f0f7f1`), pale red (`#fcf2f1`) or neutral gray (`#f4f5f5`) backgrounds. Icons, own answers, accepted correct answers, anonymous participation, awarded points and compact summaries remain. Measured text contrast is at least 4.5:1. Editable and locked/ungraded questionnaires do not receive these treatments.
- Featured and regular score numbers and PTS units remain inline, with proportional typography at narrow widths. Expanded cards already used inline units and are included in geometry checks. All three layouts preserve Jury-only Castaway Total/Jury Points columns, badges, ranks and subdued styling. Active players show only their overall total. No scoring calculation changed.

## WebKit findings

**Strict WebKit runtime verification still fails. This is not full WebKit or physical Safari acceptance.** No errors were filtered, prevented or reclassified out of the assertion, and no authorization changes were made.

1. The instrumented accepted-build rehearsal passed 16 functional checks but failed its strict check with 16 browser `pageerror` messages. Captures retain stack, request path/status/timing, lifecycle phase and current synthetic identity/privileged-DOM observations; credentials and answer payloads are excluded. These are distinct from expected HTTP 401/403 responses.
2. A second, matched real-identity control removed **all request interception**. Both engines completed nine controls, using existing Commissioner, Active and Jury identities, waiting for the application's automatic reload and settled page state. Chromium recorded zero runtime errors. WebKit recorded five access-control messages during the Jury switch. No window `error` events, unhandled rejections, HTTP authorization denials or observed ordinary-identity privileged DOM occurred in that control.
3. The first WebKit message occurred 41ms after the automatic `/staging` document request and approximately 2.9 seconds before the later explicit `/admin` navigation. Its stack points through the staging fetch wrapper to the staging-page loader; affected requests also include league/registration and Next RSC prefetches. The observed identity was `staging-jury`, `isAdmin=false`, with no admin link, private prediction cards or admin workspace, while the independent operator link remained present. This cannot be dismissed as solely request mocking or an unrealistically rapid test click.
4. A **data-free** loopback reproduction has no Firebase, authentication or Next.js. During a held replacement navigation, WebKit blocks a new fetch in the old document before it reaches the server. The rejection is caught by `try/catch`, yet Playwright emits an access-control `pageerror`; window errors and unhandled rejections remain zero. The no-navigation control returns HTTP 200 without errors. A Chromium SSE-triggered variant returns HTTP 200 during replacement without errors. The two mechanism variants use different triggers, so they are not an identical cross-engine comparison; the matched application control above supplies that comparison. A WebKit SSE attempt timed out and is retained as an invalid control, not passing evidence.
5. The final demo-emulator WebKit UI run passed **27 functional checks**, then failed its unchanged strict assertion with **11** access-control messages involving RSC prefetches. A prior repetition recorded 13, demonstrating timing dependence. The local React identity-transition harness passed all 18 checks in each engine, including deliberately stale Commissioner responses and operator/player separation, without reloads or runtime errors.

The evidence supports WebKit document-replacement/fetch cancellation as the mechanism behind at least some messages; it does **not** prove every application message harmless or resolve strict verification. No reproducible application authorization defect, unhandled promise or privileged-data retention was established. Source inspection also found the relevant fetch callers handle rejection. Broadly suppressing messages, disabling security or changing the switching architecture would not be justified by this evidence. Related primary-source reports describe similar behavior: [Playwright issue 43120](https://github.com/microsoft/playwright/issues/43120) and [issue 42823](https://github.com/microsoft/playwright/issues/42823).

Raw bounded evidence and screenshots are retained locally under ignored `work/jury-final-polish/`, excluded from deployment. Key reports are `accepted-webkit-harness.json`, `webkit-accepted-route-free.json`, `chromium-accepted-route-free.json`, `webkit-data-free-handle.json` and `chromium-data-free-stream.json`. Final UI reports are under `work/jury-ui-refinement/results/` and `results-webkit/`.

## Actual verification

| Command/check | Result |
|---|---|
| `node --experimental-strip-types --test tests/*.test.ts` | **417 passed**, zero failures. Includes component results, all leaderboard layouts, latest-revision accuracy/privacy, initial/correction controls and three new browser-observation tests. |
| `npm run lint` | Passed. |
| `npx tsc --noEmit --incremental false` | Passed. |
| `node scripts/prepare-jury-ui-checks.mjs --refresh` then `node work/jury-ui-refinement/local-runtime.mjs build` | Normal production webpack build passed with the fixed demo configuration. |
| `node scripts/package-jury-staging.mjs --refresh` then `node work/jury-staging/deployment/build-payload.mjs` | Sanitized staging webpack build passed: **JURY-A-DIAG-b32351c112e9**. |
| `node scripts/inspect-jury-staging-package.mjs` | 118 allowlisted source files; 414 source/build files inspected; zero forbidden content, credentials or public source maps. |
| `node scripts/verify-jury-ui-production-assets.mjs` | 46 anonymously downloaded local production assets; zero forbidden/private/staging content or public maps; all four staging routes absent. |
| `node work/jury-ui-refinement/local-runtime.mjs ui` | **28 passed** in Chromium. 320/390/430/1440px geometry, all three leaderboard layouts, result statuses/contrast, initial 28/24 and corrected 25/23, stable awards, Clean Sweep removal, accuracy, privacy and sticky-tab behavior. |
| `$env:UI_BROWSER_ENGINE='webkit'; $env:PLAYWRIGHT_BROWSERS_PATH=(Resolve-Path 'work/jury-navigation-diagnostics/browsers').Path; node work/jury-ui-refinement/local-runtime.mjs ui` | **27 passed / 1 failed**: functional UI checks pass; strict runtime check records 11 prefetch access-control messages. |
| `node --experimental-strip-types scripts/rehearse-jury-navigation.mjs` | **18 passed** in Chromium; repeat with the WebKit environment above: **18 passed**. Actual React providers/header/operator UI with synthetic callbacks and in-memory responses; no cloud writes or page reloads. This does not replace real Firebase switching verification. |
| `node work/jury-ui-refinement/local-runtime.mjs jury` | **26 passed**, fixed demo emulators only. |
| `node work/jury-ui-refinement/local-runtime.mjs scoring` | **33 passed**, including correction atomicity, retries, idempotency, undo and concurrency. |
| `node work/jury-ui-refinement/local-runtime.mjs security` | **132 passed**. Includes ordinary/legacy membership, protected workflows, private predictions, revoked Commissioner API 401 and direct Firestore GET/PATCH 403. |
| `node scripts/diagnose-jury-webkit.mjs fantasy-survivor-jury-staging chromium accepted` / `webkit accepted` | Nine controls each. Chromium strict passes; WebKit strict fails as described above. Built loopback HTTPS app with real staging identities, before the quota failure. |
| `node scripts/diagnose-webkit-replacement.mjs webkit handle` / `chromium stream` | Valid data-free controls; engine/trigger distinction and limitations described above. |
| `node scripts/verify-jury-navigation-staging.mjs fantasy-survivor-jury-staging` and `node scripts/verify-jury-ui-operator.mjs fantasy-survivor-jury-staging` | Final real-account checks blocked by quota-induced 401/500 responses. Not reported as passing. No fixture resets were attempted. |
| `node scripts/verify-jury-staging-isolation.mjs fantasy-survivor-jury-staging` with `STAGING_DEPLOYMENT_FILE=work/jury-mobile-polish/deployment.json` | Read-only checks pass: staging project, unbilled/free Firestore, restricted runtime roles, unchanged Rules, Hobby plan, all-deployment authentication, zero bypass credentials, no Git integration and 11 preview-only variables. |
| `node --use-env-proxy work/jury-final-polish/verify-protection.mjs` | **90 passed** against the accepted immutable deployment and stable alias, including 22 actual asset paths. All anonymous GETs redirect to Vercel Authentication; live alias matches accepted deployment. |
| `git diff --check` | Passed; existing Windows line-ending notices only. |

The final horizontal-scroll assertion initially exposed a 2px textarea-focus settling difference. It now waits for initial network idle, blurs the completed field and permits two rendering frames before measuring. The strict less-than-2px assertion itself remains intact and passes in both engines; it is isolated from native caret scrolling. An initial local WebKit launch lacked the browser path and was corrected to the already installed official browser. These are test setup corrections, not application authorization fixes.

## Staging service blocker and preservation

The separate backend failure was captured locally as **`8 RESOURCE_EXHAUSTED: Quota exceeded`** and rethrown unchanged. A temporary local-only probe recorded the bounded error; it is not in application source or the deployment package. Existing staging authentication error handling can present this database failure as an expired sign-in/401, while other routes return 500. This is not evidence that the synthetic password changed or credentials were revoked.

Read-only quota inspection confirms configured free read-operation/read-unit limits of **50,000/day**. Monitoring from Pacific midnight to **20:22:28 UTC** reports 46,309 document reads, including 3,072 during this task, and **zero document writes during this task**. Document-read telemetry is not the enforced operation counter; the error did not identify its exact quota bucket. Daily free-quota exhaustion is strongly indicated, but the lower document count is not represented as proof that precisely 50,000 reads were consumed. A separate rolling-24-hour report is retained and is not mislabeled as today's usage.

Firestore documents [daily free-quota reset around midnight Pacific](https://firebase.google.com/docs/firestore/quotas), approximately **3am Eastern on October 19**. Recovery must be checked rather than assumed. No billing attachment, upgrade, resource substitution, retry loop, reset or polling-architecture change was made. Agent-created cloud browser polling was stopped; unrelated browser sessions were not closed.

The initial read-only snapshot recorded **46 documents**, **seven synthetic score events**, confirmed key revision **2**, and Jury awards **8/6**: Clean Sweep Player **17+8=25**, Jury Player **17+6=23**, Active and Legacy **11.5** each. All subsequent synthetic scoring writes were confined to disposable `demo-fantasy-scoring` emulators. No staging fixture, score, prediction, account assignment or credential was changed. A final independent cloud hash comparison is blocked and remains outstanding; the zero-write monitoring evidence is explicitly scoped to its capture time.

Of 225 starting source/document files, seven existing files changed and none were deleted. All starting scoring, eligibility, authentication, operator authorization, result/accuracy calculations, Firebase Rules and historical data sources remain byte-identical. Production and the older preview were not accessed or modified. No Git mutation, remote deployment, billing change or Release B work occurred.

## Changed files

Application: `app/admin/admin-tabs.tsx`, `app/globals.css`, `app/page.tsx`.

Existing tests/rehearsals: `tests/jury-mobile-polish.test.ts`, `scripts/rehearse-jury-ui-results.mjs`, `scripts/rehearse-jury-navigation.mjs`, `scripts/verify-jury-navigation-staging.mjs`.

New test-only diagnostics: `scripts/helpers/jury-browser-observer.mjs`, `scripts/diagnose-jury-webkit.mjs`, `scripts/diagnose-webkit-replacement.mjs`, `tests/jury-browser-diagnostics.test.ts`. This report is new. Ignored work artifacts are not deployment inputs.

## Next steps and physical iPhone rechecks

After staging recovers: rerun the read-only fixture comparison, final real-account operator/navigation/API tests in both engines, then deploy the existing sanitized package to the existing protected Preview project. Verify protection, visible/server build ID, real HTTPS flows and unchanged fixture before rebinding the stable alias. Keep the strict WebKit limitation explicit. This deployment remains authorized but has not been performed because its required verification is blocked.

After the updated build is actually deployed:

1. Confirm the new build identifier in Safari and a freshly installed Home Screen PWA; check session persistence.
2. As Commissioner, scroll a long scoring form; swipe through all seven sticky tabs, return to unsaved evidence and verify it remains. Check focus, keyboard/safe areas and footer clearance.
3. Review corrected Jury results: green correct, red incorrect and gray unanswered rows, readable text/points/accuracy and unchanged 25/23 totals.
4. Check featured, regular and expanded scores: number + PTS on one line, Jury-only contribution columns and no clipped names. Active/Legacy remain 11.5 without Jury subtotals.
5. Switch Commissioner → each ordinary identity → Commissioner. Check no privileged navigation/data survives, operator controls remain available, and capture diagnostics for any visible errors.

No physical Safari/PWA acceptance or production readiness is claimed by this report.
