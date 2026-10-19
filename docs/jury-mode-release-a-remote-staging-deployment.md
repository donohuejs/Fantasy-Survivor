# Release A remote staging deployment — 2026-10-16

**Verdict: ready for physical-device acceptance testing.** The isolated cloud environment is available without the Windows computer or private Wi-Fi. Physical iPhone Safari and Home Screen acceptance of this remote deployment remains the commissioner's next step.

## Access and resources

- Acceptance controls: https://fantasy-survivor-jury-staging-2e0otsjhx.vercel.app/staging
- Standings: https://fantasy-survivor-jury-staging-2e0otsjhx.vercel.app/
- Firebase project: `fantasy-survivor-jury-staging`, number `343309828044`.
- Web app: `1:343309828044:web:903b6d73ca9d7f6f4c2769`, display name `jury-staging-web`. Exact public web configuration is retained in ignored `work/jury-staging/deployment/firebase-web-config.json`.
- Firestore: `(default)`, Native Standard, `nam5`, free tier, pessimistic transactions.
- Vercel project: `fantasy-survivor-jury-staging`, ID `prj_QHqT5XrfpsbdSKO3CavYwe7C7bcG`, Hobby team `donohuejs-1066s-projects`. No Git integration.
- Acceptance Preview: `dpl_Edz6kKHF4XCyjrys63RXRkZn9ESD`, READY, Node 22.
- Every deployment is protected by Vercel Authentication. Protection bypass entries: **zero**. No shareable bypass link was created.

Use the full acceptance URL above. The shorter `fantasy-survivor-jury-staging.vercel.app` alias intentionally still serves the protected, data-free bootstrap placeholder. It is not the acceptance application.

## Isolation, authorization and cost

Only the newly authorized Firebase and Vercel projects were provisioned or written. Neither `fantasy-survivor-9da59`, `fantasy-survivor-preview`, nor the production Vercel application was changed. No production credentials, private league history, player records or possessions were copied. The staging league contains six invented castaways, four invented teams, synthetic picks, predictions and scores. The existing public original cast catalog and rules remain application static content.

Firebase billing inspection confirms `billingEnabled:false`, an empty billing account name, and Firestore `freeTier:true`. Vercel remains Hobby. No payment, billing attachment, paid upgrade, paid domain or additional paid service was configured. Expected incremental cost is **$0 while remaining within free quotas**. Firebase CLI initialized Auth with subtype `IDENTITY_PLATFORM`; the project remains Spark with no billing account. Its free Spark limit is 3,000 daily active users, well above this six-account test.

Firestore's free daily quotas include 50,000 reads, 20,000 writes and 20,000 deletes; storage is 1 GiB. Close idle polling tabs and avoid unnecessary resets. Vercel account-wide Hobby limits are shared with other projects. Reaching a free limit can interrupt testing; no automatic paid upgrade is authorized. See [Firebase plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [Auth limits](https://firebase.google.com/docs/auth/limits), and [Firestore quotas](https://firebase.google.com/docs/firestore/quotas).

Authorization flow:

1. Vercel Authentication checks access before HTML, routes, APIs, scripts, styles, images and manifest delivery.
2. Firebase verified synthetic credentials identify the application user. Protected APIs verify ID tokens with revocation checking.
3. League membership requires exactly one active UID-linked or supported legacy-email profile. The synthetic commissioner requires both the fixed UID and verified commissioner email.
4. Firestore client Rules deny **all** direct reads/writes, including valid and revoked commissioner tokens. Server Admin access uses the new staging-only runtime service account with only `roles/datastore.user` and `roles/firebaseauth.viewer` in the new project.
5. Runtime guards require the exact project ID, app ID, Auth domain, runtime service-account identity, staging flags and Vercel Preview environment, and reject emulator/local-acceptance selectors.

Secrets are Preview-only encrypted Vercel environment variables. No service-account file or passwords are in the uploaded source package or public build assets. The runtime can read Auth state for revocation checks; it cannot administer users. Provisioning/revocation tests use the existing authorized operator session, scoped explicitly to the new project.

## Safe packaging and deployment

The deployment uses current uncommitted working files through `scripts/package-jury-staging.mjs`, with an explicit allowlist. It contains **103 source files** in a generated unsynced temporary directory. It excludes `.git`, `.env*`, credentials, reports, operational scripts, local acceptance routes, generated test data, and the historical operational correction module.

The private seed module is replaced only in the package with empty history and compatibility helpers. The real commissioner identity is replaced only in the package by the synthetic UID/email authority. Production source/configuration stays intact.

Eleven package-only adaptations: `app/api/league/route.ts`, `app/api/scoring/route.ts`, `app/auth-controls.tsx`, `app/game-provider.tsx`, `app/league-gate.tsx`, `lib/community-auth.ts`, `lib/community-authority.ts`, `lib/discussion-store.ts`, `lib/firebase-admin.ts`, `lib/private-league-seed.ts`, `next.config.ts`. They connect staging authentication, prevent bootstrap from real seeds, fence writes during scenario reset, and avoid OneDrive build tracing.

The separate Vercel project had all-deployment authentication enabled **before** its first upload. The data-free bootstrap and CSS were denied anonymously at its deployment URL and alias (four checks). Only then was the reviewed application uploaded. An earlier staging Preview was removed after the separate scoring endpoint was found to need the same fixture-version fence as other mutation endpoints; the final Preview includes it. No application source already present at the beginning of this task was overwritten.

Package/build inspection scanned **387 files**, including server output, browser chunks and manifests: zero forbidden private-data/credential matches and zero public source maps. The app has no service worker or offline cache implementation. Authenticated data responses use private/no-store caching.

An attempt to retain a Vercel automation bypass credential was rejected by automatic approval review before execution. No bypass was generated. The rejected helper was removed. Browser verification used the owner's normal Vercel session; backend transaction rehearsals used the staging-only service account and real synthetic ID tokens. No authentication bypass was needed.

## Phone instructions

1. Open the acceptance controls URL in Safari. Sign in with the existing Vercel account that owns `donohuejs-1066s-projects`; complete any Vercel MFA personally.
2. Choose **commissioner** and enter the temporary password supplied privately in the handoff message. This signs in `commissioner@jury.test`.
3. Commissioner controls have **Switch to jury / complete / active / legacy / unlinked** buttons. These authenticate the selected synthetic account without exposing a credential publicly. Return to `/staging`, choose commissioner and enter its password again to return. These are six distinct verified Firebase accounts; legacy has an email-associated profile without a stored UID, and unlinked has no league profile.
4. The current **grading** scenario is already locked and graded: Clean Sweep Player **17 fantasy + 11 Jury = 28.0**; Jury Player **17 + 7 = 24.0**. Active and legacy players have **11.5** each. Normal scoring contains five baseline synthetic events. Final key revision is **4** after a successful browser confirmation.
5. To start another scenario, close other test tabs, choose a scenario and seconds until airtime, check the explicit replacement confirmation, then tap **Confirm synthetic reset**. Reset deletes only the marked synthetic league tree; it preserves Auth accounts/passwords and reset receipts. It replaces synthetic scores, predictions and Jury audit records. Reload old tabs; their saved fixture version is rejected after a reset.

| Scenario | Purpose |
|---|---|
| `open` | Empty Episode 5 questionnaires. Use 86,400 seconds for extended entry testing, or 180 seconds for a short rehearsal. |
| `lock` | Partial and complete pre-airtime predictions; observe the real server deadline and try a late unanswered question. |
| `grading` | Prefilled 3/5 and 5/5 questionnaires. After airtime, Game Master → Scoring → Jury → Preview → confirm checkbox → Confirm key. Expected awards 7 and 11. |
| `wrong-merge` | Wrong Merge Q1 while independently correct Q4/Q5 remain eligible. |
| `merge` | Actual merge: Q1 remains +1 for that episode; Clean Sweep maximum 11. |
| `postmerge` | Episode 6 with verified merge history; empty questionnaires, individual-immunity Q1 +3, maximum 13. |

Each deadline is real server time, 60–86,400 seconds after preparation. Prefilled answers are submitted normally before that deadline; there is no late backfill or clock override. Standard scoring/recaps remain independent of Jury grading. To test a downward Jury correction, correct the invented evidence with a reason, save it, preview the changed awards, then confirm the new key. Generic scoring Edit/Undo rejects Jury awards.

Reset preparation uses a commissioner-only version check, operation UUID/receipt, bounded lease and phase marker. Every ordinary application transaction checks that same generation inside the transaction, including scoring corrections and discussion writes. Old or concurrent saves cannot enter a replaced scenario. A failed/expired preparation can be retried from the commissioner page; do not remove the protection to recover it.

## Executed verification

| Command/check | Actual result |
|---|---|
| `node --experimental-strip-types --test tests/*.test.ts` | **362 passed, 0 failed**, including six new staging regressions. |
| `npm run lint` | Passed. Final staging verification scripts also passed a focused ESLint rerun. |
| `npx tsc --noEmit --incremental false` | Passed against the working tree. |
| `node work/jury-staging/deployment/build-payload.mjs` | Production webpack build and TypeScript passed. Actual Vercel Linux/Node 22 builds also passed. |
| `node scripts/inspect-jury-staging-package.mjs` | 103 source files, 387 inspected files, zero forbidden matches/public source maps. |
| `node scripts/verify-jury-staging-protection.mjs` | **45 passed, 0 failed**: anonymous application pages, nine APIs, manifest/images and 22 actual deployed script/style URLs all redirected to Vercel Authentication. |
| `node --experimental-strip-types scripts/verify-jury-staging-firebase.mjs fantasy-survivor-jury-staging` | **13 passed, 0 failed**: six verified logins, anonymous/player/commissioner direct GET/PATCH denied (403), inactive profile rejected and exact fixture restored. |
| `node scripts/verify-jury-staging-revocation.mjs fantasy-survivor-jury-staging` | **5 passed, 0 failed**: otherwise valid revoked token rejected, direct revoked commissioner GET/PATCH 403, same-password reauthentication succeeds, game unchanged. |
| `node --experimental-strip-types scripts/rehearse-jury-staging.mjs fantasy-survivor-jury-staging` | **24 passed, 0 failed** against the real new Firestore/Auth project and sanitized server stores. |
| `node scripts/verify-jury-staging-isolation.mjs fantasy-survivor-jury-staging` | Free billing, exact IAM roles/Rules, Hobby plan, READY Preview, all-deployment protection, zero bypass entries/Git integration, ten Preview-only variables confirmed. |

The 24 cloud store checks include standard scoring atomic receipts/idempotency, downward Edit and Undo, unauthorized commissioner commands, stale/reset races, partial autosaves, Merge filtering, concurrent answer revisions, real airtime denial without forfeiture, wrong Merge independence, merge/postmerge maxima, private catalogs, stable Jury award IDs and a downward regrade. That correction produced **25/23**, then an audited restoration returned **28/24** without duplicate awards or baseline-score changes.

Normal authorized-browser verification through public HTTPS additionally confirmed: synthetic commissioner/player and legacy sign-in/account switching; phone scenario reset; Merge plus cross-tribe Q4 partial autosaves surviving reload; hosted preview and atomic confirmation (key v4); legacy discussion creation and poll vote; recap and completed draft/team rendering; unlinked league denial; signed-out login gate and inner API authentication error; revoked session loss of commissioner controls and same-password recovery; featured/regular/expanded Jury cards; and final 28.0/24.0 standings. A 402-pixel viewport showed the correct Jury classes/labels and no horizontal page overflow. This is browser emulation, **not physical iPhone testing**.

The existing local emulator rehearsals hardcode the currently running LAN fixture's ports/project and reset its data/accounts. They were not rerun during this cloud task, preserving that acceptance environment. The full unit suite and the new isolated cloud transaction rehearsal provide current regression coverage. No claim is made that these 24 backend checks are all HTTP/browser checks; the hosted browser workflow was verified separately with normal Vercel Authentication.

Resolved setup/harness limitations: an expired operator CLI token was refreshed read-only; a Vercel credential-path assumption was replaced with its official CLI; the initial scoring test used the wrong existing event ID prefix; a fixture equality assertion was changed from JSON byte order to structural equality after Firestore reordered map keys. The final runs above pass. Build output was moved to an unsynced generated directory after OneDrive file-lock failures. These were not gameplay changes.

Evidence lives in ignored `work/jury-staging/deployment/`: `*-tests.json`, `package-inspection.json`, `source-manifest.json`, `app-deployment.json`, `unit-tests.txt`, preservation hashes, and `mobile-standings.jpg`. Credentials/tokens remain in ignored private files and encrypted Vercel configuration; do not attach that directory wholesale.

## Preservation and local additions

All **186 pre-existing tracked/untracked working files** match their starting SHA-256 hashes. Branch remains `feature/jury-mode-release-a`; HEAD remains `5e782a95e267be29eb8c918a83eb323f3f00e05a`. Prior audit/remediation/leaderboard fixes and all uncommitted work are preserved. No Git checkpoint, push, PR or merge occurred. No production access/write, historical-score change, or original league identity/pick change was performed; the original 241 score events were not copied into staging or modified.

New uncommitted staging files: `app/api/staging/route.ts`; `app/staging/{page,controls}.tsx`; `lib/staging-{environment,fixture,request,fetch,store}.ts`; `scripts/package-jury-staging.mjs`, `scripts/provision-jury-staging-users.mjs`, `scripts/inspect-jury-staging-package.mjs`, `scripts/rehearse-jury-staging.mjs`, `scripts/verify-jury-staging-{firebase,protection,revocation,isolation}.mjs`; `tests/staging.test.ts`; and this report. Provisioning scratch material and secrets are ignored under `work/`.

## Remaining acceptance feedback and limitations

- **Outstanding presentation feedback, not implemented:** display fantasy/castaway points and aggregate Jury points separately on the featured leader, regular leaderboard and expanded team cards. Never expose private answers. Existing Jury labels/subdued styling were already confirmed physically by the commissioner; the remote build preserves them.
- Test this remote URL on the actual iPhone 16 Pro: Vercel sign-in/MFA, Firebase account switching, touch/select controls, partial saves, navigation/background/resume, deadline locking, grading/corrections and prediction privacy.
- Try Safari → Share → Add to Home Screen using the same URL. Standalone Safari can require separate Vercel and Firebase sign-in. Manifest/icons exist; there is no service worker or promised offline mode. Use Safari if the protected standalone flow is inconvenient. No physical-device acceptance is claimed.
- Temporary synthetic credentials remain valid until cleanup/revocation; do not use real league credentials. Keep Vercel Authentication enabled and avoid opening many idle polling tabs.
- No Release B functionality or production release preparation was performed.

## Shutdown and cleanup (instructions only)

After acceptance, explicitly authorize cleanup of **only** these new named projects. Keep Vercel Authentication enabled while removing the acceptance Preview and bootstrap deployment, then delete the new Vercel project/environment secrets. Delete/revoke the `jury-staging-runtime` key, synthetic users and fixtures, or delete the entire new Firebase project through its normal recovery flow. Verify the exact project IDs before each action. Remove ignored local staging credentials/tokens and the generated source package after any needed evidence is retained. Do not delete or change the older preview or production projects. Nothing was shut down automatically; staging is left available for testing.
