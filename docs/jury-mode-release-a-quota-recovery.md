# Release A — staging quota recovery investigation

October 18, 2026, 20:45 UTC / 4:45pm Eastern. Branch remains `feature/jury-mode-release-a`, HEAD `5e782a95e267be29eb8c918a83eb323f3f00e05a`; all existing uncommitted work is preserved.

**Daily Firestore read-quota exhaustion is now confirmed. Recovery and deployment remain pending the daily reset.** No Firestore data request, fixture mutation, account rotation, Rules change, billing change or deployment was performed in this investigation. Only bounded, read-only Monitoring/Logging/Vercel metadata requests and an anonymous protected-page request were made remotely.

## Confirmed error and affected resource

The previous server probe captured gRPC **8 `RESOURCE_EXHAUSTED: Quota exceeded`**. New Google Service Runtime quota telemetry identifies:

```
service:       firestore.googleapis.com
project:       fantasy-survivor-jury-staging
quota_metric:  firestore.googleapis.com/read_operations_per_project
limit_name:    ReadOperationsPerProjectPerDay
exceeded:      true
timestamps:    2026-10-18T19:58:58.097480Z
               2026-10-18T19:59:40.019885Z
configured:    50,000 operations/day
```

This establishes the exhausted **daily read limit**, rather than inferring it solely from an HTTP 429 or a generic resource error. It is not evidence of transaction contention or an exhausted write quota. The separately listed 60/minute `database_operation_requests` quota concerns administration operations such as GetDatabase, not ordinary document-read throughput; it must not be mistaken for a 60 document-reads/minute limit.

The failing application verification involved GET/read operations on league, registration and staging surfaces. The staging authentication wrapper calls `stagingRequestDatabase`, whose first database operation reads `stagingControl/state`; another immediate guard read follows. The saved probe did not record each reference path/method, so it does not identify every failing underlying lookup or query. Existing Logging API results contain no detailed Firestore error entries. No additional logging or billable service was enabled. The exact quota telemetry, source call paths and prior error establish a read-quota incident without another failing document request.

The packaged staging authentication catch can turn a database error into an expired-sign-in 401; other paths returned 500. Those symptoms do not establish invalid passwords or revoked accounts. Authentication/error presentation has not been rewritten as part of quota recovery.

Firestore's free daily quota [resets around midnight Pacific](https://firebase.google.com/docs/firestore/quotas), approximately **3am Eastern / 07:00 UTC on October 19**. At the time of this report that reset is still in the future. Recovery is **not yet verified**. A five-minute safety margin is built into the prepared probe, which refuses all cloud calls before **03:05 Eastern / 07:05 UTC**. There will be no repeated live test retries before reset.

## Consumption evidence and attribution

The saved complete document-read telemetry from Pacific midnight through 20:22 UTC totals **46,309 successful document reads**. Of these, **3,072** occurred during the preceding final-polish task beginning at 19:41 UTC: about 6.6%. Consequently that final task alone does not explain the day's exhaustion.

Four early hourly bins contain **4,596, 4,629, 4,622 and 4,791 reads**—approximately **18,638 reads** before 11:00 UTC. There are also short peaks of **1,126/minute** around 17:12 UTC and **1,106/minute** around 19:50 UTC. Sustained consumption and short test bursts both matter.

The newer `document/read_ops_count` telemetry through 20:38 UTC reports 33,700 LOOKUP, 1,444 NOT_FOUND and 11,333 QUERY operations: **46,477**. This is successful-read telemetry, not an exact remaining-free-quota counter. Empty queries have a minimum read charge and collection-ID listing also consumes reads; Google's [pricing documentation](https://firebase.google.com/docs/firestore/pricing) explains these cases. No exact reconciliation to 50,000 is claimed. The provider's explicit daily-quota-exceeded record is authoritative evidence of the incident. Duplicate exports of API counts under legacy and Database resource types were kept separate, not added together.

Source-derived costs for the accepted fixture are:

| Operation | Approximate reads per request | Trigger |
|---|---:|---|
| League game | 3 | Every 15 seconds, focus and league-refresh |
| Registrations, ordinary player / Commissioner | 3 / 7 | Every 15 seconds; Commissioner reads five signup documents |
| Open polls | 4 | Every 15 seconds, focus and league-refresh |
| Discussion catalog | 7 | Every 30 seconds while visible, plus focus/visibility changes |
| Operator status with valid proof | 1 | Every 15 seconds, plus focus |
| `/staging` scenario status with operator proof | 3 | Every 10 seconds |
| Player's confirmed Jury catalog | 9 | Every 15 seconds on the Jury page |
| Commissioner Jury catalog | 23 | On mount/manual refresh; includes 15 audit records |

These estimates include the two staging-control guard reads and, where applicable, a transaction's additional control read. Empty-result query minimums are included. They assume the accepted fixture, no retries, and successful normal requests; they are **not provider-metered per-request bills**.

With a valid operator session and timers executing normally, estimated foreground-equivalent consumption is **3,480/hour** for ordinary standings, **4,440/hour** for Commissioner standings, **4,560–5,520/hour** on `/staging`, or **5,640/hour** for graded player results. Browser background throttling/suspension may reduce this; focus and account transitions add bursts. Several timers have no visibility gate at the application layer. These rates are consistent with the observed sustained baseline; they do not prove which browser or device produced it.

A saved, route-interception-free WebKit control made **152 API requests in 78.469 seconds**. Its recorded paths, methods and synthetic identities imply **575–643 reads** under the same cost model. Account transitions remount providers; registration success dispatches league-refresh, which triggers additional refreshes. Running multiple engine controls concurrently can therefore explain large test-time spikes. The day's 272 collection-ID listing calls also show recursive preservation scans occurred; these are a smaller but avoidable contributor. The available metadata does not support assigning the whole day's usage to particular tests, users or tabs.

Firebase password sign-in, token revocation verification and the operator's Auth user check do **not themselves read Firestore**. Their subsequent application requests and staging guards do. No browser Firestore snapshot listener was found in these protected paths; they use server-backed polling. Revocation verification must remain enabled.

## Bounded recovery and deployment plan

**Do not rerun the old live suites unbounded or concurrently.** All ordinary scoring, correction, privacy edge cases and UI fixtures continue using emulators/mocks. No cloud regrading, reset, registration creation or credential revocation is needed to test this unchanged package.

Execution ceilings for the remaining live work:

| Phase | Request ceiling | Modeled read allowance |
|---|---:|---:|
| Single connectivity probe after reset | 1 document GET | 1 |
| Pre-deployment accepted-fixture comparison | 46 known document GETs | 46 |
| Serial live API/operator matrix for all six existing identities | 100 application API requests | 900 |
| Compact Chromium mobile real-identity/UI check | 160 API requests; 2-minute limit | 900 |
| Compact WebKit counterpart, preserving strict errors | 160 API requests; 2-minute limit | 900 |
| Protected remote HTTPS smoke after Preview deployment | 80 authenticated API requests | 500 |
| Post-deployment fixture comparison | 46 known document GETs | 46 |
| Total planned / stop ceiling including margin | 593 data/application requests | **3,293 / 3,500 modeled reads** |

Control-plane and anonymous-protection requests do not consume application Firestore reads. Limit those to the required settings/alias/protection checks; the last patch's complete protection/asset matrix need not be repeatedly downloaded. Start with one context/page at a time and close it promptly. API/browser request counters and a conservative cost ledger must enforce the phase ceilings when those phases run; they are planning ceilings, not a claim that the provider exposes an exact per-test billing counter. Stop immediately on any new quota error, budget/deadline breach, unexpected write or authorization regression. Do not retry a failed phase in a loop. Leave at least 10,000 reads of estimated daily headroom; absent trustworthy headroom telemetry, stop for review rather than assume it.

Prepared local helper: `work/jury-quota-recovery/bounded-fixture-check.mjs`:

```
node --experimental-strip-types work/jury-quota-recovery/bounded-fixture-check.mjs fantasy-survivor-jury-staging plan
node --use-env-proxy --experimental-strip-types work/jury-quota-recovery/bounded-fixture-check.mjs fantasy-survivor-jury-staging probe
node --use-env-proxy --experimental-strip-types work/jury-quota-recovery/bounded-fixture-check.mjs fantasy-survivor-jury-staging before
node --use-env-proxy --experimental-strip-types work/jury-quota-recovery/bounded-fixture-check.mjs fantasy-survivor-jury-staging after
```

The probe and comparisons are **not run against Firestore yet**. The plan mode ran with zero cloud calls; a pre-reset probe invocation was deliberately verified to fail at its time guard before credentials or networking. The helper enforces the exact staging project/service account, read-only REST GETs, one request per known path, no automatic retries, no collection discovery and a bounded deadline. It compares all 46 original hashes and verifies seven events, key revision 2 and totals 25/23/11.5/11.5. It does not claim to discover unknown added documents. This replaces repeated recursive whole-database scans, including billed list-collection operations. Its future live behavior and REST decoding still require the bounded post-reset run.

After a successful probe and unchanged-fixture check, attach the request counters before live API/browser checks. Verify all six actual roles independently of the operator cookie, ordinary admin-route/API denial, owner-only predictions, Commissioner read access and protected direct Firestore denial. Preserve the existing emulator revocation coverage without revoking an accepted cloud identity. Only then deploy the unchanged sanitized package to the existing protected Preview project. Verify Vercel Authentication before/after upload, the new immutable URL through normal owner SSO, application roles/privacy and fixture hashes, then bind the existing stable alias and confirm the served build ID. Any quota or security block holds the deployment. Known strict WebKit findings must remain explicitly reported, not filtered into a pass.

## Prevention recommendations

Immediate operational measures require no architectural changes: close unused staging tabs/PWA sessions, run cloud checks serially with ceilings, use known-path comparisons, keep comprehensive write/edge-case tests in emulators, and avoid repeating successful phases without a new reason.

Potential small follow-up changes warrant separate implementation review: pause appropriate polling when a page is hidden; back off read refreshes after quota/service failures; scope registration polling to screens needing it; and avoid duplicate read-only staging-control lookups while retaining transaction-time version checks. None is implemented here. Do not cache authorization decisions across accounts, disable revocation checks, remove mutation guards, expose private shared caches or weaken direct Firestore Rules to save reads. Persistent polling means a reset alone will not prevent recurrence if test views remain running all day.

## Additional local WebKit evidence

The data-free reproduction now supports a **page-owned timer** trigger. Identical timer/navigation controls ran in both engines, without Firebase, credentials, request interception or old-context protocol evaluation:

| Engine | No-navigation control | Held document replacement |
|---|---|---|
| Chromium | HTTP 200; no runtime messages | HTTP 200; server receives fetch; no runtime messages |
| WebKit | HTTP 200; no runtime messages | Fetch caught as `TypeError: Load failed`; server receives no fetch; one access-control `pageerror`; zero window errors/unhandled rejections |

Commands: `node scripts/diagnose-webkit-replacement.mjs webkit timer` and `node scripts/diagnose-webkit-replacement.mjs chromium timer`. Both mechanism controls are valid. New evidence is saved separately as `webkit-data-free-timer.json` and `chromium-data-free-timer.json`; prior handle/stream and real-identity evidence is preserved.

This removes the earlier different-trigger limitation for the new comparison and strengthens the WebKit provisional-navigation mechanism. It does not prove every real application message harmless, establish a new authorization defect or make the strict application runtime test pass. Its last result remains **27 functional checks passed / strict runtime check failed with 11 access-control messages**. Physical Safari/PWA acceptance of the new UI is still pending.

## Actual results and deployment status

- This investigation made **eight Monitoring/Logging API requests**, **two Vercel metadata reads** and **one anonymous Vercel-protected GET**, with **zero Firestore data requests** and zero remote mutations. The first unaggregated Monitoring responses for some ancillary metrics were paginated; they were not treated as complete totals. Complete saved telemetry and the subsequent hourly-aggregated operation query were used for totals.
- `node --experimental-strip-types --test tests/*.test.ts`: **417 passed**, zero failures. `npm run lint`: passed.
- The two additional local mechanism comparisons pass their control-validity checks; WebKit intentionally reproduces the unresolved message, not a strict runtime pass.
- `node scripts/inspect-jury-staging-package.mjs`: **118 source files / 414 source-build files**, zero forbidden content or public source maps. All 118 current allowlisted source hashes still match verified package **JURY-A-DIAG-b32351c112e9**. No application/scoring/authorization code changed, so the previously successful production/staging builds and 26 Jury / 33 scoring-correction / 132 security checks are carried forward, not represented as newly rerun.
- At 20:45:46 UTC, read-only Vercel checks confirm the stable alias still points to **dpl_2rkbasfGA6V1RdDeMMwsGacRSCGP**, accepted build **JURY-A-DIAG-c2bea7688886**. All-deployment Vercel Authentication remains configured, bypass credential count is zero, and anonymous root access returns the expected 302 to Vercel Authentication.
- Stable URL: **https://fantasy-survivor-jury-staging.vercel.app**. The new build has **not** been deployed or aliased. No new deployment identifier exists.
- The accepted fixture was not read or changed during this investigation. Its last confirmed state remains Clean Sweep **17+8=25**, Jury **17+6=23**, Active/Legacy **11.5**, seven events and key revision 2. The new independent hash comparison awaits reset. No preservation claim is based on a new cloud snapshot.

Changed tracked-source scope in this investigation: `scripts/diagnose-webkit-replacement.mjs` adds only the test timer trigger; this report is new. Ignored evidence/recovery helpers remain outside the sanitized package. Existing uncommitted feature work, production and the older preview remain untouched.

No billing or further deployment authorization is required for the already approved bounded staging work. The external prerequisite is quota reset/recovery; closing unused testing views helps preserve the next allowance. If recovery, headroom or security verification fails, stop and report rather than deploy. No production readiness or rollout is authorized or claimed.
