# Release A — persistent navigation investigation

## Verdict

**The physical iPhone root cause is not established. This is a diagnostic deployment, not a third authorization fix or a declaration that the defect is resolved.** The unwanted Game master navigation did not reproduce in the tested real-identity sessions. Physical Safari acceptance remains open.

Protected stable URL: **https://fantasy-survivor-jury-staging.vercel.app**.

- Visible build: **JURY-A-DIAG-634396051591**.
- Deployment: **dpl_7cpsC9LCcd3LBQDA8Rss4drQH4Cq**, READY Preview.
- Immutable URL: https://fantasy-survivor-jury-staging-1e837mvnn.vercel.app.
- Client/server source digest: `63439605159153f77469051fe84e4db4f8cef05e3e1e7c58d49979607310481e`.

## Delivery and component trace

Before this deployment, the stable alias correctly pointed to the preceding second fix, `dpl_76sbmznRwWByPb3h1L6PJTBQKqxt` (`…9s5nnc98l.vercel.app`). The uploaded immutable deployment's actual source was downloaded through the official Vercel API. Its header contains the conditional `isAdmin` link, and its provider contains both access invalidation and the staging Commissioner identity guard. This rules out an omitted guard in that uploaded source; it does not establish which JavaScript was executing on the iPhone.

The main navigation's **Game master** anchor is rendered once in `app/site-header.tsx`, targeting `/admin`. Mobile and desktop use the same component and link array; CSS changes layout and scrolling. There is no second mobile admin menu. Its only insertion condition is `isAdmin` from `useGame()`.

In the existing packaged staging provider, `isAdmin` requires a verified current Firebase account, matching access-state UID, `authorized` status, literal server `commissioner:true`, and the fixed staging Commissioner's verified UID/email. The operator cookie is not an input. Auth changes invalidate the previous access state; stale account responses cannot restore it. These authorization conditions were **not changed in this investigation**.

Other similar text is distinguishable: `/staging` has a separately conditional **Game Master grading** destination; `/admin` has a Game master brand subtitle and a denial heading for ordinary accounts. The brand points to `/`, not `/admin`. Without the reported screenshot/destination, it is not established which of these elements was seen. Diagnostics now record actual matching anchors/buttons, their destination, visibility, component marker and associated header UID/admin state.

No service-worker registration, Workbox setup or worker script was found in the current application. A manifest alone does not register a worker. The fresh protected browser reported no controller, registrations or CacheStorage entries; this says nothing about historical registrations on the commissioner's device.

A controlled delivery check kept the previous page open across the alias update. It continued running its old client, without the new build badge, while a fresh tab at the identical stable URL received the diagnostic build. Alias correctness does not update an already loaded document. This demonstrates a coverage gap, **not proof that caching caused the reported failure**. No cache, service worker or PWA data was cleared.

## Why previous tests did not settle the physical report

The earlier browser tests ran Chromium in fresh controlled contexts. Some tested helpers and injected incorrect commissioner metadata; those establish guard behavior, not the actual iPhone trigger. They did not correlate the iPhone's loaded build, rendered button, current Firebase SDK identity, React access state and independently verified server identity. The earlier report itself recorded that the Safari symptom had not reproduced.

Expanded tests now inspect all actual interactive Game Master candidates and use real Firebase identities through the existing switch workflow, both directions, all five non-Commissioner roles, direct admin denial and history return. They still cannot substitute for an affected physical Safari session.

Windows Playwright WebKit with an iPhone profile passed 13 functional checks but failed the strict uncaught-runtime-error check. Three access-control page errors occurred during the first Active switch (`/api/staging`, `/api/league`, `/api/registration`), with cancelled requests around document replacement. The unwanted admin link did not appear. These failures were retained, not filtered out. Similar cancellation/error classifications are documented in official Playwright issues [43120](https://github.com/microsoft/playwright/issues/43120) and [42823](https://github.com/microsoft/playwright/issues/42823); they are context, not proof that these errors are harmless or the cause of this defect.

## Diagnostic changes

The staging operator bar displays the build identifier, with an operator-only **Build & navigation diagnostics** panel. **Capture without reloading** records:

- Baked client identity, response-header identity, server build/deployment and fresh HTML probe headers.
- Current Firebase SDK UID/email/verification, React context, raw provider access state, and server-verified current JWT identity independently of operator authorization.
- Actual Game Master anchors/buttons and loaded script URLs.
- Bounded synthetic identity/navigation breadcrumbs, pageshow persistence, viewport/PWA state, and read-only service-worker/cache inventory.

The new GET endpoint requires the independently authorized staging operator cookie and separately verifies the current bearer token with `verifyIdToken(token, true)`. An operator session without a valid player token receives no player identity or commissioner grant. It reads no league, prediction or audit documents and performs no fixture writes. Responses use the existing private/no-store response helper. Captures contain synthetic identity/build information, not tokens, passwords or prediction answers. They stay in the current tab until copied; the breadcrumb buffer uses sessionStorage, capped at 25 entries.

No login, cache-clearing, worker-unregistering or navigation correction is performed by capture. Instrumentation can affect timing; a failure disappearing with diagnostics would not establish its original cause.

Changed files in this investigation:

| File | Purpose |
|---|---|
| `scripts/package-jury-staging.mjs` | Deterministic source/build stamp, staging-only provider/header DOM markers and response header. Existing role condition preserved. |
| `staging/app/staging/build-info.ts` | Client/server stamp template. |
| `staging/app/staging/diagnostics.tsx` | Read-only capture, bounded breadcrumbs and copy UI. |
| `staging/app/api/staging/diagnostics/route.ts` | Operator-protected, revocation-aware current-identity diagnostics. |
| `staging/app/staging/operator-navigation.tsx` | Small build indicator and diagnostic panel alongside existing operator controls. |
| `staging/app/staging/staging.css` | Compact mobile diagnostic presentation. |
| `tests/staging-build-diagnostics.test.ts` | Five focused component/security/packaging checks. |
| `scripts/verify-jury-navigation-staging.mjs` | Real rendered navigation/build assertions, WebKit option, captured failure evidence and history transition coverage. |
| `scripts/verify-jury-ui-operator.mjs` | Independent operator/current-JWT diagnostic and authorization checks. |
| `scripts/verify-jury-ui-production-assets.mjs` | Normal-build diagnostic-marker exclusion and new route absence. |
| This report | Findings, evidence and remaining uncertainty. |

`app/game-provider.tsx`, `app/site-header.tsx`, `lib/account-access.ts`, scoring/authentication logic and Rules were not edited in this investigation. The diagnostic transforms only affect the sanitized staging package. Production builds contain neither the controls nor endpoint.

## Actual verification

| Command/check | Result |
|---|---|
| `node --experimental-strip-types --test tests/*.test.ts` | **407 passed**, zero failures. |
| `npm run lint` | Passed. |
| `npx tsc --noEmit --incremental false` | Passed. |
| `node --experimental-strip-types scripts/rehearse-jury-navigation.mjs` | **18 passed**, actual providers/header with synthetic callbacks, in-place transitions without reload, zero cloud writes. |
| `node scripts/verify-jury-ui-operator.mjs fantasy-survivor-jury-staging` | **60 passed**, real six identities against the built staging server: operator/JWT separation, missing/invalid tokens, commissioner positive, all five ordinary admin/Jury/scoring API denials with valid operator cookie. Invalid/empty mutation probes cannot change the fixture. |
| `STAGING_BROWSER_ENGINE=chromium STAGING_BROWSER_URL=https://127.0.0.1:3119 node scripts/verify-jury-navigation-staging.mjs fantasy-survivor-jury-staging` | **14 passed**, real Firebase switching, actual rendered navigation, all five ordinary roles, Commissioner, build alignment and back navigation. |
| Same command with `STAGING_BROWSER_ENGINE=webkit` | **13 passed / 1 failed**: role/navigation/build checks passed; strict runtime guard failed on three access-control messages during navigation. **Not a clean WebKit pass.** |
| `node scripts/prepare-jury-ui-checks.mjs --refresh` then `node work/jury-ui-refinement/local-runtime.mjs build` | Normal production webpack build passed in an isolated demo package. |
| `node scripts/package-jury-staging.mjs --refresh` then `node work/jury-staging/deployment/build-payload.mjs` | Sanitized staging webpack build passed. Vercel's separate Node 22 build also passed. |
| `node scripts/verify-jury-ui-production-assets.mjs` | **46 anonymous assets**, zero forbidden content/maps; four staging routes absent, including diagnostics. |
| `node scripts/inspect-jury-staging-package.mjs` | **116 allowlisted source files / 412 source+build files**, zero forbidden content or public source maps. |
| `vercel deploy --target preview --project prj_QHqT5XrfpsbdSKO3CavYwe7C7bcG --yes --cwd C:/Users/donoh/AppData/Local/Temp/fantasy-jury-staging-Gh9mzo --scope donohuejs-1066s-projects --json` | READY protected Preview. No production target. |
| `node work/jury-navigation-diagnostics/alias-staging.mjs` | Protection verified before rebinding only the stable staging alias. |
| `node work/jury-navigation-diagnostics/verify-cloud.mjs fantasy-survivor-jury-staging` | **106 passed**: anonymous protection on alias and immutable deployment, including 22 observed assets and diagnostic endpoint; unauthorized POSTs blocked; six direct Firestore GET/PATCH denials for anonymous/player/Commissioner. |
| `STAGING_DEPLOYMENT_FILE=work/jury-navigation-diagnostics/deployment.json node scripts/verify-jury-staging-isolation.mjs fantasy-survivor-jury-staging` | All-deployment Vercel Authentication, zero bypass credentials, 11 Preview-only variables, unchanged Rules and two restricted runtime IAM roles; Firebase free tier/no billing account and Vercel Hobby. |
| `node --experimental-strip-types work/jury-navigation-diagnostics/snapshot.mjs fantasy-survivor-jury-staging after` | **41/41 document hashes unchanged**, zero added/deleted, five score events preserved. |

The Chromium/WebKit checks used the built staging application over loopback HTTPS with real staging identities. The two-day local test certificate was accepted only by the isolated Playwright context; no machine trust store or remote protection changed. Onboarding POSTs were intercepted only in those browser test contexts to avoid adding signup documents for previously unused roles. API and identity authorization checks remained real. These are not physical Safari tests.

The final normal-owner-SSO HTTPS walkthrough at the stable URL verified Active → Commissioner → Active. Commissioner had the actual `SiteHeader:GameMaster` link; Active had zero admin nav links, `isAdmin:false`, server `commissioner:false`, and retained Staging Controls. Direct `/admin` displayed **This account is not the game master.** with the operator session still valid. Client, server and response-header build IDs agreed with this deployment. Mobile width 402px was checked. One automation click occurred before the existing intentional account-switch reload settled and had to be repeated after it; no corrective refresh or authorization change was used. A guessed denial-text selector was corrected to the actual displayed wording.

Evidence is retained under ignored `work/jury-navigation-diagnostics/`: prior immutable source and alias, full Chromium/WebKit reports including failure, API/security reports, deployed current-identity captures, package/isolation/preservation records and mobile screenshot. This material is excluded from deployment.

## Preservation and remaining limits

No fixture reset, grading, scoring correction, credential rotation, Rules publication or cloud data mutation was performed. Auth sign-ins/token verification occurred as required for testing. All 41 records match the start snapshot, including after the interrupted session resumed. The pre-existing fixture is **lock/version 10, ungraded**, with totals **17 / 17 / 11.5 / 11.5**; this investigation did not load the separate 28/24 grading scenario.

Only the existing isolated staging Vercel project was deployed and aliased. Production and the older Firebase preview project were not accessed or changed. Branch remains `feature/jury-mode-release-a`, HEAD `5e782a95e267be29eb8c918a83eb323f3f00e05a`; all prior uncommitted work is preserved. No commit, push, merge, paid resource or Release B work occurred.

The physical failure remains unresolved, and the WebKit runtime failure remains documented. No third speculative privilege change was made. Diagnostic staging is available securely; it is not a release-acceptance approval.

## Next iPhone check

1. At the stable URL, confirm the bottom bar says **Build JURY-A-DIAG-634396051591**. If absent/different, report that before clearing anything. An already loaded tab may still be running earlier code.
2. Repeat Commissioner → Active. If Game master appears, **leave it visible and do not reload or clear Safari/PWA data**.
3. Expand **Build & navigation diagnostics**, tap **Capture without reloading**, then **Copy diagnostics**. Send the captured text and a screenshot of the unexpected button. The text contains synthetic identity/build details, no tokens or answers.
4. Include the button's long-press link destination and whether this was Safari or Home Screen PWA. Repeat with other roles only after preserving the failure capture.

If the wrong button is already visible in an older tab without diagnostics, preserve a screenshot/destination first, then open a fresh stable tab to obtain the identified diagnostic build. A fresh tab succeeding does not prove the older failure's cause.
