# Release A — staging Game Master navigation guard

Deployed to **https://fantasy-survivor-jury-staging.vercel.app**. Protected Preview `dpl_76sbmznRwWByPb3h1L6PJTBQKqxt` is READY; immutable URL: https://fantasy-survivor-jury-staging-9s5nnc98l.vercel.app. No production deployment, Rules publication or Git checkpoint occurred.

## Investigation and its limit

The original persistent physical-Safari symptom did **not** reproduce in the pre-fix stable HTTPS session: switching Commissioner → Active hid Game master while retaining Staging Controls. Real staging API responses also correctly distinguish the Commissioner from all ordinary identities with the operator cookie present. No operator-cookie privilege escalation was found. The exact original Safari trigger therefore remains unconfirmed; this is not a claim that physical Safari reproduction passed.

The client did retain its prior access object until a new league request finished, accepted a truthy commissioner flag without requiring an authorized request state, and lacked an independent staging-identity check. Although the existing UID comparison blocked normal cross-account response races, a stale/misassigned `commissioner:true` response attributed to an ordinary current identity could show Game master. A controlled browser test of the previous logic reproduced that failure for Active, Jury, Clean Sweep and Legacy. **This fault injection demonstrates the guard gap, not proof that such a response occurred on the commissioner's iPhone.**

## Targeted correction

- Auth callbacks immediately invalidate prior access state on sign-out/sign-in. UI privilege requires the current verified UID, `status:'authorized'`, and literal `commissioner:true`.
- The sanitized **staging-only** provider additionally requires the current Firebase identity to match the fixed staging Commissioner UID and verified email. Operator authorization is not an input to this decision.
- The staging provider is transformed only during packaging. Production source does not import the staging identity guard. The existing local-development setup remains available.
- Header rendering, operator cookies/switching, scenario controls, scoring, membership, server authorization and revocation checks are unchanged. All five non-Commissioner identities fail the staging navigation guard even if commissioner metadata is misassigned.

Changed files:

| File | Change |
|---|---|
| `app/game-provider.tsx` | Invalidate capabilities on every auth change; use strict current-account authorization. |
| `lib/account-access.ts` | Small pure authorization-state predicate. |
| `scripts/package-jury-staging.mjs` | Staging-only current-Commissioner identity check. |
| `tests/jury-navigation.test.ts` | Nine regression cases: all five ordinary roles, actual Commissioner, operator independence, pending/mismatched/unverified state and both transition directions. |
| `scripts/rehearse-jury-navigation.mjs` | Real provider/header/operator-provider browser harness with synthetic auth callbacks and an in-memory backend; no cloud access. Tests in-place auth changes without navigation/reloads and injected stale role flags. |
| `scripts/verify-jury-ui-operator.mjs` | Expanded real-identity API checks; mutation probes use empty/invalid bodies so they cannot modify the fixture even if authorization regresses. |
| `scripts/verify-jury-navigation-staging.mjs` | Real Firebase SDK switching and direct `/admin` denial with an operator session; intercepts only onboarding POSTs to avoid creating signup documents for previously unused roles. |
| This report | Results and investigation limit. |

## Actual verification

| Command/check | Result |
|---|---|
| `node --experimental-strip-types --test tests/*.test.ts` | **402 passed**, zero failures. |
| `npm run lint` | Passed. |
| `npx tsc --noEmit --incremental false` | Passed. |
| `node --experimental-strip-types scripts/rehearse-jury-navigation.mjs --baseline` | **14 passed / 4 expected failures** with the prior guard and injected wrong role metadata. Normal transitions and operator separation did not fail. |
| `node --experimental-strip-types scripts/rehearse-jury-navigation.mjs` | **18 passed**, zero failures; no page reloads, no cloud access. Old responses cannot restore grants; removing operator authorization does not remove the actual Commissioner's privileges. |
| `node scripts/verify-jury-ui-operator.mjs fantasy-survivor-jury-staging` | **50 passed** through the built loopback staging server: real six identities, exact league role flags, valid operator cookie, ordinary `/api/admin`, Jury admin/preview and scoring denials; preserved switching and commissioner-only reset authority. |
| `node scripts/verify-jury-navigation-staging.mjs fantasy-survivor-jury-staging` | **12 passed** at 390px width: all five ordinary identities denied on direct `/admin`, no Game Master link, retained operator controls; reverse switches restore Commissioner navigation, and actual Commissioner can review Jury administration. No corrective manual reload required. The established switching workflow still performs its intentional sign-out/sign-in/reload to clear private state; the separate 18-case harness verifies auth changes with **no** reload at all. |
| `node scripts/prepare-jury-ui-checks.mjs --refresh` then `node work/jury-ui-refinement/local-runtime.mjs build` | Normal production build passed in an isolated demo directory. |
| `node scripts/package-jury-staging.mjs --refresh` then `node work/jury-staging/deployment/build-payload.mjs` | Sanitized staging build passed; Vercel Node 22 build also passed. |
| `node scripts/verify-jury-ui-production-assets.mjs` | **46 anonymous normal-build assets**, no private data, staging controls/credentials or public source maps; staging routes absent. |
| `node scripts/inspect-jury-staging-package.mjs` | **113 allowlisted source files / 404 source and build files**; zero forbidden content or public source maps. |
| `vercel deploy --target preview --project prj_QHqT5XrfpsbdSKO3CavYwe7C7bcG --yes --cwd C:/Users/donoh/AppData/Local/Temp/fantasy-jury-staging-Gh9mzo --scope donohuejs-1066s-projects --json` | READY Preview in the existing isolated project. Stable alias rebound only after verifying protection. |
| `node work/jury-navigation-fix/verify-cloud.mjs fantasy-survivor-jury-staging` | **102 passed** across alias and immutable Preview: anonymous routes and 21 actual observed assets protected, unauthorized POSTs rejected, six direct Firestore GET/PATCH denials. |
| `STAGING_DEPLOYMENT_FILE=work/jury-navigation-fix/deployment.json node scripts/verify-jury-staging-isolation.mjs fantasy-survivor-jury-staging` | All-deployment Vercel Authentication, zero bypass credentials, unchanged protective Rules/IAM, 11 Preview-only variables; Firebase free tier with no billing account, Vercel Hobby. Checked before and after deployment. |
| `node --experimental-strip-types work/jury-navigation-fix/snapshot.mjs fantasy-survivor-jury-staging after` | **All 41 existing documents unchanged; zero added/deleted.** |
| `git diff --check` | Passed with existing Windows line-ending notices. |

Initial test-harness failures were corrected before final verification: a relocated relative import, selectors that did not match the dropdown/admin header, and assertions that needed to await asynchronous operator initialization. These were test issues, not additional application changes. Generated test sources stay ignored under `work/jury-navigation-fix/` and never enter the deployment package.

The final protected HTTPS walkthrough verified **Active → Commissioner → Active** at mobile width, without any additional corrective refresh between switches: the link appears only for Commissioner, operator controls remain present, and Active sees the access-denied page at `/admin`. The `/admin` URL serves the application's static shell; its ordinary-user view is denied, and the privileged data/action APIs return **403 server-side**. No grading or reset was performed.

The cloud fixture remains **lock/version 10, ungraded**, five score events and 17/17/11.5/11.5 totals. No credentials, user privileges, scores, predictions, audit records or fixtures were changed. Branch remains `feature/jury-mode-release-a`, HEAD `5e782a95e267be29eb8c918a83eb323f3f00e05a`; prior uncommitted work is preserved. No production or older-preview resources were accessed, no Rules were published, no paid resource was created, and no commit/push/merge or Release B work occurred.

Physical follow-up: load the updated stable build once, then repeat Commissioner → Active/Jury/Clean Sweep/Legacy/Unlinked → Commissioner. No non-Commissioner should have Game master; Staging Controls must remain available. If the original Safari symptom persists, capture the displayed identity, visible link and resulting `/admin` page so its remaining trigger can be diagnosed. Physical Safari acceptance remains unclaimed.
