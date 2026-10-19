# Release A — recovered quota and verified staging deployment

October 19, 2026. The approved staging recovery and deployment are complete. No application source, gameplay, authentication, Rules, billing or Git state was changed by this turn.

**Stable URL:** https://fantasy-survivor-jury-staging.vercel.app  
**Visible/client/server/header build:** `JURY-A-DIAG-b32351c112e9`  
**Deployment:** `dpl_FmGkV9zhcCNvBQtPWFbnk1vQ58f7`  
**Protected immutable Preview:** https://fantasy-survivor-jury-staging-qu2m5lif0.vercel.app

The exact previously built package was uploaded to the existing staging project, verified through normal Vercel owner authentication, then bound to the existing stable alias. No `--prod`, public bypass, new project, credential rotation, Firebase Rules publication or production/older-preview action occurred. The feature branch and extensive uncommitted work remain in place; no Git command was issued by this workflow.

## Recovery and fixture integrity

The October 19 03:05 Eastern guard had passed. Monitoring since the 07:00 UTC daily reset showed no new quota-exceeded events and 4,198 successful reads before testing. The single read-only connectivity probe succeeded. The prior incident remains definitively identified as `firestore.googleapis.com/read_operations_per_project`, limit `ReadOperationsPerProjectPerDay`, gRPC 8 `RESOURCE_EXHAUSTED`.

All **46 known document hashes** match the accepted baseline both before checks and after the Preview deployment/hosted smoke. Both comparisons used exactly 46 REST document GETs, with no recursive scans, collection listing or retries. The fixture still has **seven scoring events**, confirmed answer-key revision **2**, and:

| Player | Castaway Total | Jury Points | Overall |
|---|---:|---:|---:|
| Synthetic Clean Sweep Player | 17.0 | 8.0 | **25.0** |
| Synthetic Jury Player | 17.0 | 6.0 | **23.0** |
| Synthetic Active Player | — | — | **11.5** |
| Synthetic Legacy Player | — | — | **11.5** |

The stable URL subsequently rendered those same four totals under its existing Jury identity, with `isAdmin=false`. No fixture reset, grading, correction, event update, new registration or account-assignment change was performed. Ordinary sign-in/role switching continued using the existing synthetic Firebase accounts. Expected-denial direct Firestore PATCH attempts all returned 403 and made no writes.

## Bounded verification and results

| Actual command/check | Result |
|---|---|
| `node --use-env-proxy work/jury-staging-recovered/metrics.mjs fantasy-survivor-jury-staging baseline` | No new quota exhaustion; 4,198 successful reads, zero writes since reset. |
| `node --use-env-proxy --experimental-strip-types work/jury-staging-recovered/fixture-check.mjs fantasy-survivor-jury-staging probe` | **1 GET passed**. |
| Same helper with `before` and `after` | **46/46 hashes match each time**, seven events, revision 2, 25/23/11.5/11.5. |
| `node --use-env-proxy work/jury-staging-recovered/operator-check.mjs fantasy-survivor-jury-staging` | **60 passed**: all six existing passwords/identities, legacy membership, operator proof independent of fantasy privileges, tampered/cross-origin rejection, ordinary admin/API denial with a valid operator cookie and no reset authority. |
| `node --use-env-proxy work/jury-staging-recovered/privacy-check.mjs fantasy-survivor-jury-staging` | **11 passed**: own confirmed revision-2 results only, anonymous accuracy, Commissioner private-catalog access, signed-out/invalid API rejection and six direct Firestore GET/PATCH denials for anonymous/Jury/Commissioner. |
| `node work/jury-staging-recovered/browser-check.mjs chromium` and bounded `--remaining` continuation | Four initial checks and four continuation checks passed; no runtime messages, window exceptions, unhandled rejections or observed privileged-DOM leakage. See the timing limitation below rather than treating this as eight unique checks in one uninterrupted run. |
| `node work/jury-staging-recovered/browser-check.mjs webkit` | **8 functional checks passed**; **strict runtime failed with 10 access-control messages**, preserved in the report. Zero window errors, unhandled rejections, backend failures or observed ordinary-identity privileged DOM. |
| `node scripts/inspect-jury-staging-package.mjs` | **118 source / 414 source-build files**, zero forbidden content or public source maps. All 118 current allowlisted source hashes match the specified package. |
| `node scripts/verify-jury-staging-isolation.mjs fantasy-survivor-jury-staging`, using the old/new deployment files before/after upload | Passed: unbilled/free staging Firestore, unchanged Rules and restricted IAM, staging-only Preview variables, Hobby plan, READY deployment, all-deployment Vercel Authentication, zero bypass credentials and no Git integration. |
| Vercel CLI Preview deployment from the existing sanitized temporary package | READY, deployment ID above; staging project only. |
| `node --use-env-proxy work/jury-staging-recovered/protect.mjs preview` / `stable` | **10 anonymous protection checks passed on each URL**, including pages, APIs, manifest, icon and application JavaScript; 302 to Vercel Authentication. |
| Normal authenticated owner-browser HTTPS smoke | New client/server/header identifiers agree; synthetic Commissioner sign-in, key-v2 correction interface and seven tabs, 25/23 standings. Stable alias subsequently renders the new build and all four accepted scores for the existing Jury identity without admin privileges. |

The local built-app browser checks exercised the live Firebase staging backend through fixed loopback HTTPS. No requests or responses were mocked. Only already-registered Commissioner/Active/Jury identities were used by the browser, so normal registration association remained a read-only no-op. The six-role API checks did not register accounts.

The first Chromium fragment ended on an immediate `count()===1` assertion for the operator link after direct navigation to the denied admin page. Its trace shows the independent operator-status request was still in flight; the preceding page had already rendered that link for Active. The same trace confirms no Active admin navigation/private cards/workspace. The helper was corrected to wait for the link, without changing application code. Only remaining Jury/Commissioner flow was run in Chromium, using normal internal links; the original fragment is retained. Full WebKit then exercised the corrected wait and passed all eight functional checks. Both Chromium fragments together remained within the original cumulative 160-request/900-read ceiling. This was a bounded test synchronization correction, not an application authorization repair or an indefinite retry.

No new product implementation required repeating local scoring writes/builds. The prior **417 unit / 26 Jury / 33 scoring-correction / 132 security checks**, lint, TypeScript and production/staging builds remain the local validation baseline for this identical package. They are not represented as newly run today. The previous emulator revoked-token tests remain intact; no accepted cloud identity was revoked to repeat them. Live Rules were checked byte-for-byte and direct access remains denied.

## Read budget and actual observed consumption

The cumulative ledger remained below the approved **3,500 modeled-read ceiling**:

| Phase | Tracked requests | Modeled reads |
|---|---:|---:|
| Connectivity probe | 1 | 1 |
| Pre-comparison | 46 | 46 |
| Operator/privacy/API/direct-denial checks | 65 | 667 |
| Chromium, both fragments combined | 143 | 643 |
| WebKit | 116 | 532 |
| Hosted owner-browser smoke | See reservation below | 500 reserved |
| Post-comparison | 46 | 46 |
| **Total** | **417 tracked, plus interactive HTTPS smoke** | **2,435 including the full reservation** |

Node/API/browser-test requests have counters and modeled costs; the browser phases also had deadlines and immediate budget-abort hooks. The CUA owner-browser surface does not expose a complete request counter. Its HTTPS smoke therefore used a conservative **500-read reservation**, one selected identity at a time, **42 seconds on the Preview plus 25 seconds on the stable URL**, no writes, and prompt navigation away afterward. This is a reservation, not an invented measured API count. Both interactive views together were below the two-minute time allowance. Remote resources and private accounts were accessed only through normal authentication, without extracting owner cookies or using a protection-bypass token.

Monitoring initially showed **4,198** successful reads since reset and finally **5,847** at the 12:18:25 UTC sample, an observed **1,649-read increase**, with **zero writes** and **no new quota-exceeded events** in the reported window. These are project-wide successful-document-read metrics, not an exact billable/quota counter or a per-test attribution. Other clients and reporting delay may affect the delta; it is not substituted for the conservative ledger. No exact remaining-free-read balance is claimed. The earlier sample is preserved separately. Raw metrics, timestamps and the ledger are in ignored `work/jury-staging-recovered/`.

## Where the 3,500–5,600 reads/hour comes from

**The quoted sustained rates describe ordinary use of the staging application, not a timer added by the test harness.** Global application providers poll the league, registration and polls about every 15 seconds, and discussions about every 30 seconds while visible. Staging adds an operator-status poll every 15 seconds, two control-document guard reads on many API requests, and a 10-second scenario-status poll on `/staging`. The Jury page adds its own 15-second catalog refresh. Commissioner signup/catalog queries return multiple documents. Even a view left untouched can therefore consume substantial reads while its timers run.

The harness adds short bursts by switching identities, loading new documents/providers, checking APIs and sometimes running multiple browser contexts. Registration success also dispatches league-refresh. Both contribute, but the hourly estimate is principally the application polling multiplied by staging's per-request read costs. It is not a measured production polling cost; production has no staging-only operator/status guards. Firebase Auth sign-in and token-revocation verification themselves do not consume Firestore reads.

An obsolete agent browser tab was found still signed in as Commissioner to the first immutable staging deployment. It displayed current corrected data, so it was still a viable polling source. It was reused for this verification and navigated to the Vercel staging dashboard between/after checks, stopping that view's application polling. The two local test servers were also stopped. No other browser's tabs, phone sessions or accounts were altered. This finding does not prove that tab caused the entire prior exhaustion.

**Safest immediate operating practice:** use one staging view at a time—Safari or the Home Screen PWA—and close unused/old deployment tabs and end the test view between sessions. Avoid leaving Commissioner `/staging` or Jury results open for hours. No repeated cloud test loops are needed for hands-on acceptance.

**Safest code follow-up before long acceptance sessions:** a small, staging-only, visibility/idle-aware polling change, with refresh on resume and backoff after quota/service errors. Stop polling on screens that are no longer visible; avoid refreshing registration data on screens that do not need it. Preserve explicit manual refresh, server-side revocation checks, canonical airtime locking, prediction privacy and transaction-time fixture-version checks. Any duplicate read-only control lookup reduction needs review for races. No shared private cache, longer-lived authorization grant or weaker Rules should be introduced. This follow-up was **not implemented**, because today's authorization specifies deploying the existing exact build. It requires a separate targeted patch/approval; a quota reset alone does not eliminate recurrence risk.

## WebKit and remaining acceptance risks

Strict WebKit verification still fails. All ten messages in today's run are the known `due to access control checks` form during route replacement/identity changes. The captured stack/request/state evidence is retained; no messages were filtered or suppressed. There were no observed unhandled rejections, global window exceptions, backend errors or ordinary-identity privileged DOM.

The existing identical-trigger, data-free timer reproduction continues to support WebKit refusing a caught fetch from an old document during provisional navigation, while Chromium succeeds. This does not prove every real-application message harmless. The unresolved strict result is carried into final release review and physical Safari/PWA testing; no full WebKit acceptance or production readiness is claimed. The prior evidence was preserved.

Physical iPhone rechecks for this deployed build: confirm the footer identifier; install a fresh Home Screen PWA; scroll a long Commissioner form and swipe all seven sticky tabs while preserving unsaved input; review green/red/neutral confirmed rows; check inline PTS and unchanged 25/23 scores; repeat Commissioner/ordinary switching and session persistence. Keep one test view open at a time and retain the corrected fixture.

No further authorization is required to use the verified protected staging URL. Any polling optimization, Git checkpoint, production rollout or cleanup requires its own explicit authorization. Production and the older preview remain untouched.
