# Release A — remote iPhone staging plan

**Read-only preflight update:** The [verified preflight report](jury-mode-release-a-remote-staging-preflight.md) supersedes the Firebase reuse recommendation below. `fantasy-survivor-preview` contains earlier users/documents, two real compatibility possession records and legacy public-read Rules. Preserve it unchanged; propose a fresh `fantasy-survivor-jury-staging` Spark project. The offline preparation helper now generates that proposed target. Neither project creation nor deployment is authorized yet.

October 16, 2026. **Prepared for approval; no remote deployment or resource change performed.** Branch `feature/jury-mode-release-a`, HEAD `5e782a95e267be29eb8c918a83eb323f3f00e05a`. Existing uncommitted implementation, audit fixes, security remediation, leaderboard correction and local acceptance environment are preserved.

## Recommendation and resource inventory

Use a **new Vercel project `fantasy-survivor-jury-staging`**, with Vercel Authentication protecting **All Deployments**, and a dedicated Firebase Auth/Firestore project. Prefer the already existing `fantasy-survivor-preview` project **only after confirming that its contents are exclusively disposable/safely preservable test data and its billing plan is acceptable**. If it contains live/private league data or serves another active test, stop and obtain approval for a new Spark project instead of overwriting it. A registered web app in the production Firebase project would not provide database or Auth isolation.

Read-only CLI inspection established:

| Resource | Observed | Consequence |
| --- | --- | --- |
| Vercel account/team | `donohuejs-1066`, owner of `donohuejs-1066s-projects`, active **Hobby** plan | Existing account can own staging; commissioner can use this Vercel identity on Safari. |
| Existing Vercel app | `fantasy-survivor`, Next.js, Node 24.x, Git connected | Leave it unchanged. Create a separate project without a Git connection or inherited production environment variables. |
| Firebase production | `fantasy-survivor-9da59` | Explicit forbidden staging target. No records or secrets inspected. |
| Firebase staging candidate | `fantasy-survivor-preview`, active; web app `fantasy-survivor-preview-web` | Project and web app already exist; no new Firebase account is inherently required. |
| Candidate database | `(default)`, Firestore Native Standard, `nam5`, pessimistic concurrency, free-tier database | Supports existing Admin transactions. `freeTier: true` does **not** prove Spark/no linked billing. |
| Unverified candidate settings | Auth providers/accounts, existing document contents, IAM/service-account availability, billing linkage | Must be checked before writes. No existing remote records were exported or copied. |

Inventory commands: `vercel whoami`, `vercel project ls`, `vercel api /v2/teams --method GET`, read-only project metadata GET; `firebase projects:list --json`, `firebase apps:list --project fantasy-survivor-preview --json`, `firebase firestore:databases:list --project fantasy-survivor-preview --json`. No environment-variable values, production keys or production documents were downloaded.

Vercel Authentication now supports all deployments on all plans without an added charge, per the [September 2026 announcement](https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan) and [current authentication documentation](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication). Use account access, with no public deployment exceptions, shareable bypass links or bypass secrets in phone URLs. A secret-looking URL is not the access control.

The outer Vercel login and inner synthetic Firebase login are separate: keep the commissioner's Vercel session while switching between synthetic player/commissioner accounts. Firebase-signed-out rules and original cast remain accessible **inside** the protected staging site; private league APIs still require verified membership. Firebase's public Auth endpoint remains internet-accessible by design; a new/unlinked account receives no league authority, and direct Firestore is denied.

## Reuse and bounded work still needed

Reuse the release implementation, existing API authorization, `verifyIdToken(token, true)`, deny-all direct Firestore Rules, Admin transactions, stable award IDs, correction receipts, membership checks, leaderboard styling, synthetic fixture definitions and existing rehearsals. The existing pure fixture has six invented castaways, four invented teams, six test identities and no historical league records.

The cloud target is **not deployable unchanged**:

1. **Separate staging guard.** Keep `localAcceptance()` unchanged: it deliberately rejects production builds and cloud Firebase. Add a server-only cloud guard requiring staging mode, `VERCEL_ENV=preview`, the approved staging Firebase ID in both public configuration and Admin credential, an approved staging service-account identity, no emulator hosts, and the expected synthetic fixture marker. Reject mixed/partial settings and missing league initialization. Apply project/credential checks before every staging Admin connection/write, including provisioning/reset tools; never fall back to production configuration. The separate one-time provisioner may create an absent marker only after confirming the target is empty or its earlier synthetic fixture replacement was approved; normal app requests must require the marker. A public rendering flag cannot grant authority. Run deployed Node functions using the repo's supported Node 22.x.
2. **Cloud synthetic sign-in.** Reuse the password form mechanics but enable a distinct guarded cloud staging path and redirects. The current `/acceptance` page is emulator/development-only. Provision verified `@jury.test` accounts with fixed staging UIDs; preserve the legacy player's email-only profile association. Commissioner authority must match the staging UID **and** verified email on the server after revocation checks. A client-supplied role or email must never grant it. Do not change production Google sign-in behavior.
3. **Remove real data from the entire upload.** `lib/private-league-seed.ts` still correctly contains real server-only historical compatibility data. Uploading it to staging violates the requested data boundary. Prepare a separate source directory from the current uncommitted files using an explicit allowlist. Replace that module **in the staging copy only** with empty/synthetic compatibility exports; omit real history, seeded player/draft order, named migration and current possession fallbacks. `/api/league` and admin bootstrap must fail closed/use synthetic state rather than import real fallback records. Replace the production commissioner constant in that copy with staging-only authority. Preserve the real compatibility module in this working tree.
4. **Phone scenario controls.** Add a small staging-only commissioner page/API with whitelisted scenarios, current fixture version, canonical deadline, preparation status and explicit reset confirmation. Both route and server handler must enforce the staging guard and revocation-checked commissioner authority. It must accept no arbitrary document path, credential, player ID or replacement game. Reuse existing Jury APIs for snapshots, approval, answer saves, preview and grading. Fixture preparation can sign in the fixed synthetic accounts using private server-side test credentials; these must never be returned to the browser or logged.
5. **Safe resets and timing.** A reset replaces only the known synthetic test league after validating its marker and expected IDs. Keep Auth UIDs/passwords stable. Use a transactional fixture version/operation receipt and short preparation lock; reject conflicting scoring/saves during reset, prevent partially prepared fixtures being usable, and make retries recoverable. Existing ordinary/Jury transactions and receipts remain intact. For locked/grading scenarios create a future snapshot, save before airtime, return preparation status immediately and let real time pass. No long-running Vercel sleep, late backfill, clock override or snapshot rewrite. Advance the synthetic season to Episode 5 when that grading scenario reaches its deadline, as the local fixture correction requires.

The selected scenarios remain `open`, `lock`, `grading`, `wrong-merge`, `merge`, `postmerge`. A reset intentionally replaces prior **synthetic** predictions, scores and audit receipts; the phone must make that consequence clear. Provide a downloadable synthetic result/checklist report before reset. Normal grading and downward corrections remain the existing commissioner workflow.

Expected standard grading result:

| Player | Fantasy baseline | Jury award | Combined |
| --- | ---: | ---: | ---: |
| Synthetic Clean Sweep Player | 17.0 | 11.0 | **28.0** |
| Synthetic Jury Player | 17.0 | 7.0 | **24.0** |
| Synthetic Active Player | 11.5 | 0.0 | **11.5** |
| Synthetic Legacy Player | 11.5 | 0.0 | **11.5** |

No staging change may alter gameplay, ordinary scoring, ranking or the featured first-place Jury label. This is environment support, not Release B.

## Local preparation provided

Run from this repository:

```powershell
node --experimental-strip-types scripts/prepare-jury-staging.ts
```

This **offline-only** script checks the branch, reuses the invented fixture, verifies baseline standings and Episode 5 eligibility, and writes review material to ignored `work/jury-staging/review/`: `synthetic-game.review.json`, `staging.env.example`, `vercel-protection.review.json`, `readiness.review.json`. No Firebase/Vercel/network client is imported. It does not read local credentials, contact emulators, reset the active fixture, construct an uploadable application or deploy anything. The example staging flags are proposed configuration; runtime support is still to be implemented.

Actual local verification for this preparation:

- `node --experimental-strip-types scripts/prepare-jury-staging.ts`: passed; generated only the local review files and confirmed **17/17/11.5/11.5** baselines and Episode 5 eligibility.
- `node --experimental-strip-types --test tests/iphone-acceptance.test.ts tests/jury-leaderboard.test.ts`: **7 passed, 0 failed**, including the **28/24** combined grading totals and unchanged first-place Jury behavior.
- `npx eslint scripts/prepare-jury-staging.ts`, `npx tsc --noEmit --incremental false`, `git diff --check`: passed.
- SHA-256 comparison of all **183 pre-existing tracked/untracked repository files**: unchanged; branch and HEAD unchanged. Only this plan and the offline preparation script were added outside ignored `work/`. No application/emulator state or remote resources were modified. This was a focused planning/preparation check, not another full security audit.

## Approvals, credentials and manual actions

Required approval is for the new isolated Vercel project, its protection/settings/environment configuration, staging-only IAM/Auth/Rules/index changes, synthetic initialization, a harmless protected bootstrap deployment and one protected **Preview** deployment. No paid upgrade, Git push, production application or production Firebase change is included.

Required commissioner actions/decisions:

- Confirm `fantasy-survivor-preview` is exclusively nonproduction and whether an earlier synthetic fixture may be replaced after preserving it. Otherwise authorize a new uniquely named Spark project; its exact ID must be bound into the guards before use.
- Be able to sign in to the existing Vercel owner account from Safari, including its MFA/passkey. No additional Vercel account is needed for this single commissioner.
- Confirm Spark/no billing linkage in the Firebase console. Do not attach a billing account, enable paid services or upgrade Vercel automatically.
- Allow creation/use of a staging-only runtime service account scoped to this Firebase project. Recommended roles: `roles/datastore.user` and `roles/firebaseauth.viewer` (revocation lookup). Use a separately authorized provisioning identity for one-time Auth user creation/verification; do not deploy an Auth-admin provisioning credential as the runtime key. If these permissions are unavailable, the commissioner must grant them in the **staging** Google Cloud IAM console.
- Store the newly generated runtime service-account JSON only as a sensitive **Preview** environment variable `FIREBASE_SERVICE_ACCOUNT_JSON` on the new Vercel project. Generate fresh synthetic passwords and store them privately/password manager; any fixture-runner password mapping is a separate server-only staging secret. The fake emulator key and all production keys are unusable/prohibited here.

Most provisioning, narrow fixture seeding, packaging/scanning, protection verification, preview deployment and regression checks can be automated after approval using the existing CLI sessions. MFA/consent, unavailable IAM grants, initial credential handling and physical iPhone testing may require human interaction. Do not paste secrets into chat, Git or client configuration.

## Deployment procedure after approval

These steps are the required sequence; the guarded cloud support and packaging scripts above must be implemented and tested before step 5. Nothing below has been executed.

1. Confirm the approved Firebase project and billing state. Inspect only that project's existing seed marker/collections and Auth configuration. If it is not exclusively test data or replacement is not approved, stop. Preserve an earlier synthetic fixture separately; never import a production export. Enable Email/Password on the staging Auth project and provision the fixed synthetic accounts with `emailVerified=true`. Obtain only that web app's public SDK configuration.
2. Prepare staging IAM and runtime credentials. Configure the strict selected-project guard and synthetic commissioner UID/email. Publish the unchanged deny-all direct Rules and required indexes **only to the approved staging project**, with both project and configuration arguments explicit:

   ```powershell
   firebase deploy --only firestore:rules,firestore:indexes --project fantasy-survivor-preview --config .\firebase.json
   ```

   This command requires the approval above. Never use a default project alias. If another project was approved, update the hard guard and this command together before executing.
3. Create `fantasy-survivor-jury-staging` in Vercel team `donohuejs-1066s-projects` **without importing/connecting Git**. In that new project's Settings → Deployment Protection, enable Vercel Authentication → **All Deployments**; disable public exceptions and shared bypasses. Read settings back and verify protection before any deployment. Do not modify the existing `fantasy-survivor` project or team-wide defaults.
4. Handle Vercel's first-deployment behavior explicitly. The [CLI guide](https://vercel.com/docs/projects/deploy-from-cli) states the first deployment in a new project is Production, even without `--prod`. First upload a harmless, protected static placeholder containing no app, Firebase configuration or secrets to the **new staging project only**. This establishes its initial deployment; it has no relationship to the real production app. Then select Next.js/Node 22.x for the staging project and add staging variables to **Preview only**. The app's guard must reject a Production target. If the harmless bootstrap is not approved, stop and choose an already provisioned isolated staging project instead.
5. Build a fresh sanitized source directory under ignored `work/jury-staging/payload/`. Include only reviewed runtime app/lib/public files, lockfile and build configuration, plus the required staging fixture module. Exclude `.git`, `.env*`, `.vercel`, all `work`, logs, backups, attachments, historical fixture tests, operational scripts and reports. Include no real-data module even in server artifacts. Use the current uncommitted source; do not use `git archive HEAD`, which would omit Release A changes. Do not build over the running LAN server's `.next` directory.
6. Validate the whole sanitized source and locally generated server/client output before upload. Check actual Vercel upload inputs with `vercel deploy --dry --json` from the prepared directory. Scan for private historical records, seeded player identities/draft order, private possessions, production owner/project/configuration and credentials. Inspect JavaScript, server chunks, manifests, static HTML/RSC and source maps. Only the publicly approved original roster/static rules may be retained from league content. Keep secrets outside the source payload.
7. Link **only the prepared directory** to the new staging project. Verify `.vercel/project.json` matches that project/team. Deploy explicitly to Preview, never relying on the default target:

   ```powershell
   vercel deploy --cwd .\work\jury-staging\payload --project fantasy-survivor-jury-staging --scope donohuejs-1066s-projects --target preview
   ```

   Inspect deployment metadata for the correct project, `target=preview` and protection. If the target is not Preview, do not seed or expose the app; its runtime guard must refuse cloud access. No Git commit/push is required. If local build-output upload is supported and verified, `vercel build --target preview` followed by `vercel deploy --prebuilt --target preview` can ensure the inspected output is the uploaded build.
8. Use the immutable generated HTTPS Preview URL for the trip. Add only its exact hostname to staging Firebase Auth authorized domains if required for the chosen provider; never authorize all `vercel.app` domains. No real production domain, custom certificate, local tunnel or home-computer service is needed. Validate Vercel protection on every assigned URL/alias. Keep automatic deployment expiry beyond the intended test period; the inspected team defaults to a 30-day expiry policy, so check the deployment's actual retention.
9. Initialize only the synthetic marker/game/accounts and prepare `grading` through normal authenticated APIs with future airtime. Once the real deadline passes, grade using the normal commissioner preview/confirmation. Verify **28.0/24.0/11.5/11.5**, stable award identities, main/featured/team Jury labels and unchanged five synthetic ordinary events. Keep an open/lock scenario available via the phone controls.
10. Run focused staging preflight before handoff: anonymous outer-gate denial including assets; signed-out inner API denial; unlinked/inactive denial; active and legacy membership; private prediction separation; valid and revoked commissioner API behavior; revoked direct Firestore **GET/PATCH denied**; normal scoring/correction, draft, recap, discussion and poll smoke tests. Reuse the local emulator rehearsals for concurrency and grading regression, with their fixed demo guards intact. Test a completed correction that reduces an existing award. Recheck no production data in authenticated staging responses or upload artifacts.
11. Give the commissioner the protected URL, private synthetic login details, scenario instructions, deadline and expected totals. Confirm Safari can open it over cellular with the home computer unavailable. Record deployment/project IDs and staging fixture version, without credentials, for recovery and cleanup.

## iPhone operation and remaining acceptance tests

All scenario changes must work on the staging commissioner page; no PowerShell, emulator reset, desktop browser or home process may be required after handoff. Sign in to Vercel once, then use the synthetic login selector and saved passwords. Close other test tabs before a confirmed scenario reset. Changes persist in staging Firestore across device sleep and serverless function restarts.

- Cellular Safari: outer access challenge; successful synthetic sign-in; unlinked/inactive rejection; signed-out public rules/original roster and protected league routes.
- Eligibility begins Episode 5 after final Episode 4 elimination, including the repeated original slot. Surviving active/legacy teams stay outside Jury.
- Individual autosaves, edits and incomplete answers; refresh/navigation/background/resume; actual server-airtime lock with an old tab and interrupted connection. No late completion.
- Main leaderboard, featured first-place card and expanded teams: visible Jury labels/subdued presentation, unchanged rank and **28.0/24.0** totals.
- Commissioner evidence/key preview, explicit confirmation, retry safety, recap completion independent of grading, corrected key reducing an aggregate award with no duplicate awards.
- Switch player/commissioner on the same phone; private answers/grades/audit evidence must not persist into an unauthorized session. Reopen after token revocation and verify denial.
- Safari Add to Home Screen: HTTPS secure context, icon, standalone launch, separate Vercel/Firebase login if prompted, password persistence, background/resume and return to the same deployment URL. The current app has a manifest/icons and **no service worker**; offline operation is not promised and no new caching layer is proposed. Safari remains the fallback if standalone login/storage is unreliable.

Physical iPhone behavior and remote deployment are unverified at this planning stage. The earlier Windows/browser checks are not a substitute.

## Cost and alternatives

Expected incremental cost: **$0** for a short, low-volume rehearsal on the existing Hobby team plus Spark Auth/Firestore. This is conditional on confirming the candidate project's billing and staying within account-wide Vercel/free Firebase limits. [Vercel Hobby is $0/month](https://vercel.com/pricing); Vercel Authentication adds no charge. [Firebase Spark requires no payment information](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans). Firestore's free tier includes 1 GiB storage, 50,000 reads/day, 20,000 writes/day, 20,000 deletes/day and 10 GiB/month outbound transfer ([quotas](https://firebase.google.com/docs/firestore/quotas)). Close idle polling tabs and monitor usage. No Firebase Functions, SMS authentication, paid domain, VM or billing upgrade is needed for this design.

Password Protection is a paid alternative: currently Pro plus **$20/month per protected project**, per [Vercel's current password documentation](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/password-protection). It is unnecessary for one owner testing on an iPhone. Do not enable it or upgrade automatically.

An existing-app Vercel Preview could save creation of a project, but couples staging to the production project's environment/settings and is less suitable for the requested boundary. A separately hosted Next.js server with Firebase is viable but adds hosting, HTTPS, access-gate and lifecycle administration. Tunnels/home-hosted emulators fail the requirement to operate independently of the home computer. The separate Vercel project is the simplest fit.

## Cleanup procedure, after testing and separate confirmation

1. Export only the synthetic acceptance results needed for the test record. Stop scenario activity and leave Vercel protection enabled.
2. In staging Firebase, disable/revoke the synthetic test users' sessions and revoke/delete the staging runtime service-account key. Remove staging Preview environment secrets. Verify the app can no longer read or write through APIs; deny-all Firestore Rules remain in place.
3. Delete **all** deployments of `fantasy-survivor-jury-staging`, including the placeholder and older Preview URLs, then remove that dedicated Vercel project. Do not merely remove an alias or disable protection, which would expose remaining deployments. Confirm each recorded URL is unavailable.
4. Remove the authorized Preview hostname from staging Auth. Delete only marked synthetic scenario records/test users with the guarded cleanup script, or preserve them if desired. The pre-existing `fantasy-survivor-preview` project must **not** be deleted wholesale; restore any earlier preserved synthetic fixture when appropriate. A newly created dedicated Firebase project may be deleted only with explicit cleanup approval and its exact project ID verified.
5. Remove ignored local staging credentials/build payloads once no longer needed, preserving this plan/test report and every unrelated worktree change. Verify the actual production project, domain, identities and scores were untouched.

**Next action:** approve the isolated project/settings/deployment scope above and confirm whether the existing preview Firebase project is available for these synthetic scenarios. Then implement the bounded cloud support, verify it locally, and deploy only within that approved scope. Until then, the LAN environment remains untouched and no remote test URL exists.
