# Remote staging preflight — verified findings

October 16, 2026. **Decision: use a fresh Firebase Spark project for Jury staging; preserve the existing preview project.** Architecture approved in principle only. No resource creation, cloud writes, deployments, Git operations or production configuration changes are authorized/performed by this preflight.

## 1. Is `fantasy-survivor-preview` safe to reuse?

It is technically capable, but **not a clean synthetic-only environment and not safe to reset/reuse as-is**. Recommend new Firebase project ID **`fantasy-survivor-jury-staging`** (proposed, not created; global name availability/project-creation quota still to be checked during authorized provisioning). Keep the existing preview project and its users/data/settings unchanged.

Read-only inspection confirmed:

| Item | Actual result |
| --- | --- |
| Project | `fantasy-survivor-preview`, number `296710513778`, active; display name `Fantasy survivor preview` |
| Web app | `fantasy-survivor-preview-web`; app ID `1:296710513778:web:ae2c65dbc1913a06268eeb` |
| Auth domain | `fantasy-survivor-preview.firebaseapp.com` |
| SDK storage-bucket setting | `fantasy-survivor-preview.firebasestorage.app`; this configured string does not mean a bucket exists |
| Messaging sender ID | `296710513778` |
| Full public SDK configuration | Independently retrieved through Firebase Management API; saved locally in ignored `work/jury-staging/inspected-preview-web-config.json`, including the public API key. This is inspection evidence, **not configuration to copy into the proposed new project**. |
| Firestore | Enabled; one `(default)` Native Standard database, `nam5`, pessimistic transactions, free-tier database; PITR disabled |
| Authentication | Enabled, subtype `FIREBASE_AUTH`; Google provider enabled. Email/password and anonymous sign-in currently disabled. |
| Existing Auth users | **2 verified, enabled Google accounts**; one is the authorized owner's identity. These are existing personal/test identities, not the planned synthetic password accounts. No passwords, hashes or tokens were exported. |
| Existing documents | **26**, all beneath `games/survivor-51`; earlier preview fixture/migration records created October 9 |
| Existing game | Episode 3, one `Preview Member` profile; **0 scores, 0 draft picks, 0 castaways, 0 historical results**; **2 possession records whose IDs match the private league compatibility seed**, with no synthetic IDs |
| Seed marker | Earlier `previewSeed/metadata`, schema 1, explicitly names `fantasy-survivor-preview` |
| Other inspected services | No Cloud Storage buckets or Realtime Database instances listed. Default Firebase Hosting site exists, with **no releases**. |
| Billing | `billingEnabled=false`, empty `billingAccountName`: **no billing account attached; Spark/no paid services available** |

Document inventory: 1 game, 2 `communityPrivate`, 1 discussion schedule, 3 discussion threads, 2 discussion-user roots, 4 nested per-user thread records, 3 episodes, 7 comments, 1 seed marker and 2 signups. Preserve **all 26 documents and both users**, even where content was originally intended as a test. No decision about their disposability was inferred.

The two possession IDs match server-only real league compatibility entries. This is enough to reject a claim that the project is exclusively invented data; its previous fixture is not copied to the new staging environment. Stored scores/history are empty, so the inspection does **not** imply that production scores or the 241 live events are present there.

### Existing preview security issue

The currently published October 9 Rules are older than the local Release A remediation: they permit public game/poll reads and commissioner access based on verified email, without the new deny-all direct-access policy. A read-only anonymous REST **GET**, with a field mask limited to `season.number`, returned **200**. It sent no Authorization header and downloaded no private game fields. This confirms the game-read exposure without attempting any write.

These Rules were **not changed**. A fresh staging project must receive the current deny-all Rules before fixture initialization. Closing the old preview's exposure is a **separate authorization** to publish restrictive Rules there; it can affect its earlier Preview application. Creating new staging alone does not close that older exposure. No anonymous PATCH or authenticated sign-in was attempted during this no-writes preflight.

## 2. Accounts, IAM and isolation

The existing Firebase CLI account is a project **Owner**. A corrected read-only `testIamPermissions` request returned all 29 requested permissions, including Firestore reads/writes, Auth configuration/user administration, service-account/key creation, IAM policy updates, Rules creation/release and Monitoring reads. This verifies authority in the **existing preview project**, not a guarantee of global project-creation quota or name availability.

One existing staging-project service account was found:

`firebase-adminsdk-fbsvc@fantasy-survivor-preview.iam.gserviceaccount.com`

It has Firebase SDK service-agent, Firebase Auth Admin and Service Account Token Creator roles, with one user-managed key created October 9. Only key metadata was read; its private key was neither retrieved nor reused. This broader, existing identity should remain untouched.

For the new project, provision a fresh **`jury-staging-runtime`** service account with only project-scoped `roles/datastore.user` and `roles/firebaseauth.viewer`. The latter supports revocation checks. Use the authorized owner separately for initial synthetic Auth provisioning; do not put a provisioning/Auth-admin key in the running application. Store a newly generated runtime key as a sensitive server-only Preview variable on the new Vercel project. If key creation is blocked by an organization policy, stop and choose an approved keyless setup or obtain the specific IAM action; never substitute a production key.

Firebase production `fantasy-survivor-9da59` is a different project, number `302469194118`. The inspected preview's database resource name, web app, Auth configuration, billing resource and service-account identity all refer to `fantasy-survivor-preview`. Shared ownership/Google login does not merge their databases or Auth user stores. No production documents, IAM policy or credentials were accessed. Existing service-account grants in other projects were not inspected; creating a new identity and granting it roles **only in the new staging project** avoids relying on that unknown.

Vercel read-only verification reconfirmed owner access to team **`donohuejs-1066s-projects`**, active **Hobby** plan. Keep production project `fantasy-survivor` unchanged. New Vercel project name: **`fantasy-survivor-jury-staging`**, without Git integration or inherited environment variables. No additional paid account is required. The commissioner needs access to the existing Vercel owner login and its MFA/passkey on the iPhone.

## 3. Costs and usage

Expected incremental cost: **$0**, using Vercel Hobby and a new Firebase Spark project. The existing preview also has no billing account attached. Do not link billing, enable paid services, purchase a domain, upgrade Vercel or enable paid Password Protection as part of this scope.

[Firebase Spark](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans) supports the required Auth and Firestore usage without payment information. [Firestore free quotas](https://firebase.google.com/docs/firestore/quotas) are 1 GiB stored, 50,000 reads/day, 20,000 writes/day, 20,000 deletes/day and 10 GiB/month outbound transfer; daily quotas reset around midnight Pacific. Synthetic Email/Password accounts avoid SMS charges. A separate project gives the Jury fixture its own Firebase quota rather than sharing the earlier preview's usage.

Monitoring requests for the existing preview's read/write/delete metrics in the preceding 24-hour window returned **no time series**. Exact current quota consumption therefore remains unavailable; this was **not interpreted as zero usage**. The 26-document inventory is confirmed independently. Monitoring is approximate and can lag; [Firebase documents its usage-report limitations](https://firebase.google.com/docs/firestore/monitor-usage).

[Vercel Authentication protects All Deployments without additional cost on every plan](https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan). Hobby usage is shared across the team's projects, so heavy polling/builds or exhausted shared limits could interrupt testing. Close idle tabs and check limits before deployment. The inspected retention default is 30 days/10 retained deployments; pin and verify the test deployment's actual expiry for the travel period. Keep any quota interruption as a pause/decision, rather than automatically upgrading. No spend alerts or budget changes are needed on a project with billing unlinked.

## 4. Exact proposed remote changes — after approval only

| Target | Proposed change |
| --- | --- |
| New Google/Firebase project | Create `fantasy-survivor-jury-staging` on Spark with no billing linkage. Register web app `jury-staging-web`; create only `(default)` Firestore in `nam5`; enable Email/Password Auth. Do not create a storage bucket, Functions, Cloud Run service or paid domain. |
| New project IAM | Create `jury-staging-runtime`, grant the two runtime roles above only on the new project, and generate a new runtime credential. Use existing authorized owner credentials for one-time provisioning only. |
| New project Rules/indexes | Publish current deny-all direct Firestore Rules and required indexes to the **explicit new project ID**, before any game data is initialized. |
| New project Auth/data | Create six verified invented `@jury.test` identities with new `staging-*` UIDs and private generated passwords. Seed only the invented fixture, snapshots, predictions, evidence, audit/operation receipts and synthetic grading results through guarded setup and existing APIs. Do not import existing preview users/documents or production exports. |
| New Vercel project | Create `fantasy-survivor-jury-staging` under the existing Hobby team; no Git connection. Set Vercel Authentication to **All Deployments**, no public exceptions/shareable bypass links. Read protection back before upload. |
| First Vercel deployment | Protected static placeholder containing no private application data, Firebase configuration or secrets. Vercel's first deployment is Production even without `--prod`; this is only the **new staging project**, never the production application. See [Vercel's CLI guide](https://vercel.com/docs/projects/deploy-from-cli). |
| Acceptance deployment | Set new-project-only public Firebase configuration and sensitive runtime secrets in **Preview**. Select Next.js/Node 22.x. Upload the reviewed sanitized application explicitly with `--target preview`; confirm target/project/protection before initialization. |
| Auth domain | Add only the exact generated Preview hostname to the new staging Auth project's allowed domains as needed; no wildcard. Verify every assigned Vercel URL is protected. |
| Preserved remote resources | No changes to `fantasy-survivor-preview`, `fantasy-survivor-9da59`, the existing Vercel application, production domains/secrets or GitHub. |

The exact new Firebase ID is proposed, not reserved. If unavailable or project creation is blocked, stop and report the naming/quota/permission issue; do not silently select an existing project. Rules publication, user creation, fixture seeding and Auth login are all cloud writes and remain outside this preflight.

## 5. Packaging, controls and verification

The completed release is still uncommitted. Prepare a **separate directory from the current working files**, using an explicit file allowlist and per-file hashes. Include the uncommitted Release A corrections; `git archive HEAD` would omit them. Exclude `.git`, `.env*`, `.vercel`, `work`, logs, backup/export files, attachments, real historical fixtures, operational scripts and private reports. Leave the repository and its Git connection unchanged.

In that staging copy only, replace the private league compatibility module with empty/synthetic exports, remove real history/player/draft/possession fallback records and production commissioner authority, and fail closed when the synthetic game is missing. Keep the original production compatibility data intact in this working tree. Inspect the full upload manifest and **both server and client build output** for forbidden content before upload. Build in the prepared directory, preserving the active LAN dev server's build cache.

Local cloud support still needs implementation and verification before an actual deploy: a distinct staging guard, cloud synthetic sign-in, and commissioner phone scenario controls. Keep the emulator guard unchanged. Require the exact new Firebase project, matching runtime credential, `VERCEL_ENV=preview`, no emulator hosts, approved synthetic marker and verified commissioner UID/email. Client flags grant no role. Retain `verifyIdToken(token, true)`, unique active UID/legacy-email membership, API prediction privacy and the existing atomic transactions/receipts.

Scenario controls must accept only whitelisted scenarios and bounded parameters, validate fixture version, use idempotent operation receipts/preparation locks, and require an explicit confirmation before replacing a marked synthetic scenario. Preserve Auth identities/passwords on reset; accept no arbitrary document path or replacement game. A reset can erase only the new project's marked fixture. Prepare future airtimes and autosaves through normal APIs, return status immediately, and let real server time cross the lock; no queued late completion, snapshot rewrite or long serverless wait.

| Scenario/check | Required acceptance evidence |
| --- | --- |
| Sign-in/switching | Verified player, commissioner, unlinked and legacy-email identities; inactive denial via controlled synthetic status change; logout/account switch removes private state |
| Open/partial | Individual autosaves and edits persist across navigation, refresh, background/resume; incomplete questionnaires remain valid |
| Merge/filtering | Pre-merge tribes, Merge, Nobody/No Council where appropriate; wrong Merge does not invalidate independent Q4/Q5; separate post-merge Episode 6 scenario |
| Lock | Actual future deadline, stale tab and interrupted/queued save cannot bypass server airtime |
| Grade/correct | Normal evidence/key preview and confirmation; downward correction updates stable award IDs, private receipts and aggregate totals atomically; recap can finish independently |
| Standings | Fantasy baseline **17+11=28** for Clean Sweep and **17+7=24** for Jury; active/legacy **11.5**. First-place player remains featured; Jury labels/subdued styling appear in main, featured and expanded cards. |
| Privacy | Outer Vercel challenge for pages/assets; inner signed-out/unlinked/inactive denial; owner-only answers; revoked commissioner APIs rejected and direct Firestore GET/PATCH denied with otherwise valid revoked tokens |
| Physical device | Cellular Safari with home PC unavailable; HTTPS, keyboard/navigation, sleep/resume; Home Screen install and standalone authentication/persistence |

Reuse the existing unit/emulator/browser rehearsals for gameplay, atomicity, scoring corrections and privacy. Cloud write tests occur only after provisioning approval and only in the exact new staging project; fixed demo rehearsals keep their existing emulator guards. Test anonymous access to all assigned deployment URLs and public assets without any bypass credential. Use normal owner access for protected checks; a temporary automation mechanism, if needed, requires secure server-side handling and must not become a shareable phone URL.

**Outstanding presentation enhancement remains OPEN:** The featured leader and regular leaderboard should visibly distinguish ordinary fantasy points from aggregate Jury points without displaying answers, correctness, private timestamps or grades. The current totals and Jury labels can be tested independently; this infrastructure scope does **not** implement or mark that enhancement complete. It needs separate authorization and a targeted UI change.

The existing manifest/icons support an HTTPS Home Screen rehearsal. No service worker/offline caching is introduced. Vercel and Firebase sessions may need separate login in standalone mode; validate this on the actual iPhone and use Safari if standalone access is unreliable. Once deployed, application execution, persistent fixture state and scenario controls reside in Vercel/Firebase and require no home PC.

## 6. Commissioner actions and next authorization

No console work is required from the commissioner **now**. After approval, automate provisioning using existing authorized accounts wherever permissions permit. Human actions should be limited to:

1. Any Google/Vercel MFA, consent or project-creation quota issue that automation cannot complete. Existing preview ownership is confirmed; permission/quota to create a new project is not yet proven.
2. Sign into the protected deployment with the existing Vercel owner account from iPhone Safari, save the privately supplied synthetic passwords and use the in-app account/scenario controls.
3. Run the physical-device checklist, optionally Add to Home Screen, and download a synthetic results record before an intentional scenario reset. No local certificate installation, VPN, terminal or Windows process is required.

**Requested next authorization:** “Create a new Firebase Spark project `fantasy-survivor-jury-staging` with no billing account, its web app/Auth/Firestore, staging-only least-privilege runtime service account/key, deny-all Rules/indexes and synthetic fixture. Create the separate Vercel Hobby project with Authentication protecting All Deployments, deploy a data-free protected placeholder and the sanitized acceptance build explicitly as Preview, and perform isolated synthetic verification. Preserve both existing Firebase projects and the production Vercel app. No paid upgrade, production changes or Git commit/push.”

This approval would include implementing the bounded staging-only sign-in/guards/scenario controls before deployment; it would **not** authorize the points-presentation enhancement, Release B, or modification of the older preview's Rules. Optional separate permission is needed to restrict the older preview's currently public game access.

After testing, cleanup requires a separate confirmation: retain synthetic results, revoke the new runtime key/test sessions, remove all new staging deployments and their secrets, and optionally delete the newly created Firebase project after verifying its exact ID. Keep Vercel protection enabled until deployments are removed. Both earlier Firebase projects and the production Vercel project remain outside cleanup scope.

## 7. Evidence and preservation

Evidence is in ignored `work/jury-staging/cloud-preflight.json`: project/configuration, redacted Auth/IAM inventory, key metadata, document paths/field names/counts, billing response, Rules, recent-metric availability and read-only request results. No document bodies, private keys, password hashes, user passwords or access tokens are included. The only POST requests were documented **read-only** `getIamPolicy`, `testIamPermissions` and `listCollectionIds`; the anonymous probe was GET. One initial permission-query request used an invalid permission prefix and returned 400; the corrected request succeeded. The Firebase CLI SDK-config command returned its result then hit a Windows exit assertion; independent Management API retrieval confirmed the configuration successfully.

Local preparation now proposes the new project and adds `provisioning.review.json`; these review files are explicitly **not deployable**. The previous plan is retained with a superseding preflight link. All Release A application code, Rules, gameplay, scoring, leaderboard behavior, credentials and local emulator state remain untouched.

Actual local checks:

- `node --experimental-strip-types scripts/prepare-jury-staging.ts`: passed; review material targets the **proposed new project**, with no network/resource changes.
- `node --experimental-strip-types --test tests/iphone-acceptance.test.ts tests/jury-leaderboard.test.ts`: **7 passed, 0 failed**, including server-guard rejection, repeated-slot Episode 5 eligibility, partial/full **7/11** Jury awards and unified **28/24** totals with the Jury player first.
- `npx eslint scripts/prepare-jury-staging.ts`, `npx tsc --noEmit --incremental false`, `git -c core.safecrlf=false diff --check`: passed.
- Generated proposal checks passed for the new exact project target, no billing linkage, All Deployments authentication and no shareable bypass links.
- SHA-256 comparison checked **185 pre-existing tracked/untracked files**: only `scripts/prepare-jury-staging.ts` and the previous staging plan changed, both as intended for this preparation. All **183 other pre-existing files** are unchanged. This report is new; generated inventory/review material is ignored. Branch remains `feature/jury-mode-release-a`; HEAD unchanged. No commits, pushes, deployments, cloud writes, production access or local fixture resets occurred.

This verification covers preparation and the reused pure scenarios; it does not claim a cloud deployment, full new security audit or physical iPhone/PWA pass.
