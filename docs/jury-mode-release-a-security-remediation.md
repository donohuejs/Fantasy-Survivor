# Release A security remediation

Date: October 16, 2026. Branch: `feature/jury-mode-release-a`. HEAD remains `5e782a95e267be29eb8c918a83eb323f3f00e05a`. All changes remain uncommitted.

**Verdict: Ready for physical-device acceptance testing.** Both independently reproduced security blockers are resolved in the local implementation and proposed Rules. All required final checks pass. This is a local readiness verdict; production application code and Firebase Rules were not changed.

## 1. Root causes and corrections

### Public JavaScript exposure

The shared initial-game module embedded the seeded player identities and draft order. The shared historical-results module embedded 73 actual league results. Root client providers, history/honors helpers and local setup calculations imported these modules, placing private values into publicly downloadable JavaScript despite the page gates. Legacy draft migration also named a real league player. Commissioner email constants were present in client authorization/calculation code and the admin page.

Private compatibility data now resides in `lib/private-league-seed.ts`, used by server code and test/CLI fixtures. The public `initialGame` contains the original 21 castaways, static rules and empty league collections: no players, draft turns, ownership, current tribes, scores or possessions. Historical helpers accept explicitly supplied rows. The authenticated league API adds a read-only historical compatibility view; imported rows are never written over stored history. Historical profile IDs, honors, missing-season handling and ties are retained.

Private possession compatibility values remain behind a server-only entry point. Legacy named draft migration and commissioner authority are also outside the client graph. The browser receives its commissioner capability only from an authorized, uncached API response. Pure local calculation functions use an explicitly supplied role; the actual API authority is established independently from verified token claims, never a body flag.

Tests inspect the complete client import graph and anonymously download every generated public text asset. The final build contains **25** such assets, all checked. Public HTML, RSC payloads, manifests, original public text assets and generated static page payloads were also inspected. Browser source maps are explicitly disabled and absent; source-map guesses and server-only source/artifact URLs return 404. There is no registered service worker or Cache Storage content. Public rules and the original cast remain accessible.

Unconfigured local development retains its existing fixture workflow through a development-only server response. This response is disabled in production and configured Firebase environments; the production anonymous `view=local-setup` request returns 401. Private seeds are never embedded in that development client's assets either.

### Revoked commissioner authority

The previous proposed Rules accepted the commissioner's verified email claim for direct game/recap/archive/signup access. Firebase token revocation was checked by APIs, but browser database operations bypassed those checks. An otherwise valid, unexpired commissioner token still read and patched the game after revocation.

All remaining browser Firestore operations have been removed, including commissioner transactions, signup subscriptions, automatic registration, profile assignment and season archival. The client Firebase module now initializes Auth only. Protected reads use server APIs; explicit commissioner commands run existing domain functions inside Firebase Admin transactions.

The proposed `firestore.rules` deny **all direct document reads and writes**, including commissioner and signup access. Existing and new APIs verify Firebase tokens with `checkRevoked=true`, then enforce verified-account membership or commissioner authority. Consequently, revocation performed outside this application is checked against the Auth backend on subsequent API requests; direct database access is denied regardless of retained JWT claims. No revocation metadata synchronization mechanism or background maintenance was introduced.

## 2. Authorization flows and transaction guarantees

| Surface | Authority and behavior |
| --- | --- |
| `/api/league` | Verified active UID or unambiguous legacy-email membership, or verified commissioner. Returns game/history compatibility view, published recaps or aggregate polls. Commissioner may also read draft recaps. Missing-game bootstrap is read-only and commissioner-only. |
| `/api/admin` POST | Revocation-checked verified commissioner only. Explicit operation names; no arbitrary replacement-game payload or arbitrary database path. Re-reads current game inside the transaction and applies the existing domain validation. |
| `/api/registration` GET/POST | Revocation-checked verified account. Ordinary users see/create only their own UID-keyed signup. Commissioner listing is server-authorized. Supplied UID, assignment and role fields are ignored. Existing chosen name/assignment is retained on retries. |
| `/api/draft` | Existing current membership, turn/profile, run, revision and proxy guards retained. Commissioner role and legacy migration established server-side. |
| `/api/scoring` | Existing commissioner authorization, versioned preview/save, correction receipts and Edit/Undo retained. Server authority is separate from the pure calculation routine. |
| `/api/jury`, `/api/discussions`, `/api/community` | Existing revocation/membership/ownership checks retained; private commissioner authority helpers moved outside shared client modules. |
| Direct Firestore, every collection | Denied for all browser credentials. Server Admin writes occur only after API authorization. |

The commissioner command API covers ordinary scoring, episode start/finish, councils, eliminations, bonuses, merge/tribe/castaway administration, possession creation/edit/transfer/status, adjustments, profile/check-in management, payment status, reset, finalization and next-season opening.

Each command has a stable request ID and private `adminOperations` receipt containing actor UID, season, operation, request hash and timestamp. Identical retries acknowledge the existing receipt; changed reuse fails. Game changes and receipt creation commit atomically. Profile association includes the signup assignment in the same transaction. Next-season opening includes the full prior-season archive in the same transaction. Firestore retries recompute against current stored data; explicit recipient/season/finalization-review guards remain intact. Existing correction and Jury receipt mechanisms remain separate and unchanged.

Signup lists now refresh through the API every 15 seconds, on focus and after registration/administrative changes. Ordinary cloud mutations cannot fall back to browser storage or direct Firestore writes.

A compatibility rehearsal found that possession transfer results contain absent optional properties represented as JavaScript `undefined`, which Firestore rejects. `lib/firestore-data.ts` omits only those absent object properties at the new transaction boundary, while retaining defined values and Firestore-native objects. Creation/edit/transfer/expiry now pass the actual API rehearsal. The scoring engine was not changed for this repair.

The complete changed-file manifest is appended below. Most test/CLI changes only redirect their seed imports to the private fixture module. Existing uncommitted Release A work was preserved using an audit-start content manifest; the seven previous fixes remain covered by their regressions.

## 3. Reproduced before/after results

| Failure or protected behavior | Before remediation | Final result |
| --- | --- | --- |
| Anonymous production chunk download | Contained historical scores and seeded player/draft order; two asset checks failed. | Original checks pass; all 25 generated public text assets plus HTML/RSC/manifests/public text assets exclude protected markers. |
| Anonymous protected page navigation | Sign-in gate worked, but bundle leaked data. | Sign-in gate retained; rules/original cast accessible; underlying assets no longer contain the private seeds. |
| Revoked commissioner `/api/league` | 401 | 401 |
| Revoked commissioner direct Firestore GET | **200** | **403** |
| Revoked commissioner direct Firestore PATCH | **200** | **403** |
| Revoked commissioner new admin/registration APIs | Not available | 401 |
| Valid commissioner direct Firestore | Allowed for retained browser workflows | Denied; replacement server workflows pass. |
| Valid commissioner standard scoring and historical corrections | Direct/API mixture | Server transaction/API paths pass, including concurrent awards, retry, correction, undo and season archive. |
| Linked and legacy-email players | Authorized APIs | Retained; unlinked/inactive league access remains denied. |

The original failures were rerun before changing Rules. Evidence is retained in `work/security-remediation/before-security.json`, `before-security.txt`, `before-assets.json` and `before-assets.txt`. The baseline revoked token observation was API **401**, direct GET **200**, direct PATCH **200**. The final observation is **401/403/403**.

## 4. Atomicity and original-data preservation

- Unit regressions exercise transaction retries, concurrent ordinary awards, failure rollback, request-ID reuse, atomic signup association, atomic archive/season transition, stale finalization review and returning historical profile IDs.
- Actual Auth/Firestore/API rehearsals execute ordinary episode scoring, concurrent adjustments, completion and recap publication while Jury evidence remains incomplete. Possession lineage survives transfer and expiry. Valid UID, legacy-email and commissioner proxy draft decisions succeed; invalid cached turn/profile ownership is rejected.
- All 33 existing correction integration checks pass, including read-only previews, targeted recipient corrections, tombstones, immutable receipts, retry, Undo and competing edits. Verified commissioner direct permissions are now expected to fail; equivalent protected API access is asserted.
- The existing local, previously audited game copy was exercised entirely offline using MemoryFirestore. All **241 original score events** were compared exactly before and after a non-scoring commissioner command, alongside picks, permanent identities and stored history.
- Original and resulting canonical score-event SHA-256 are identical: `5332c8246a6ee1473036de1f7c1cc890edd81d41c9c292e5b23f32aef5b07a74`.
- Content hashes confirm `lib/scoring.ts`, `lib/jury.ts`, `lib/league.ts`, `lib/score-ledger.ts` and `app/jury/page.tsx` are unchanged from the start of remediation. Jury gameplay, prediction locking, partial answers, grades, stable awards and the earlier stale-response fix remain intact.

**Zero production accesses and zero production writes occurred during remediation.** The 241-event check used the existing local copy, not a new production read. No historical live scores, identities or picks were modified. No Rules publication, production migration/activation, deployment, commit, push, PR, merge or other remote change occurred.

## 5. Final regression results

| Actual command | Result |
| --- | --- |
| `node --experimental-strip-types --test tests/*.test.ts` | **343 passed, 0 failed**, including 13 new remediation tests and all previous audit tests. |
| `npm run lint` | Passed; zero warnings/errors. |
| `npx tsc --noEmit` | Passed. |
| `npm run build` | Successful production build, including the new admin and registration handlers. |
| `node --experimental-strip-types scripts/audit-jury-release-a.mjs` | **132 passed, 0 failed** grouped authorization/compatibility checks. |
| `node --experimental-strip-types scripts/audit-jury-browser.mjs` | **14 passed, 0 failed**, including anonymous downloads of all 25 generated public text assets. |
| `node --experimental-strip-types scripts/rehearse-jury-firebase.mjs` | **26 passed, 0 failed** emulator/API/desktop/mobile browser checks. |
| `node --experimental-strip-types scripts/rehearse-scoring-firebase.mjs` | **33 passed, 0 failed** existing correction checks. |
| `node --experimental-strip-types scripts/verify-jury-remediation-preservation.ts --fixture work/jury-release-a/game-before.json` | Exact 241-event, identity, pick and stored-history preservation passed offline. |
| `git diff --check` | Passed; Git emitted existing Windows line-ending notices, without whitespace errors. |

The fixed project was `demo-fantasy-scoring`, with Auth `127.0.0.1:9098`, Firestore `127.0.0.1:8085`, configured webpack Next server `127.0.0.1:3106` and default production build server `127.0.0.1:3107`. Scripts assert fixed project, loopback hosts, synthetic credential project and exact Rules before writes. The scoring rehearsal sets `SCORING_TEST_URL=http://127.0.0.1:3106`. Test credentials were generated locally by `node scripts/setup-jury-emulators.mjs`; no production credential was used for synthetic tests. Rehearsal setup otherwise follows the existing implementation report.

Earlier intermediate failures exposed the original blockers, caught fixture/authorization import adjustments during extraction, and reproduced the possession serialization problem. All final runs above passed. Ignored evidence, exact commands/output, before/after observations, content manifests and preservation hashes are under `work/security-remediation/`. Detailed matrix/browser reports also remain under `work/jury-audit/`; Jury/correction reports remain at their existing rehearsal paths.

## 6. Remaining concerns and acceptance readiness

There are **no remaining known Release A implementation security blockers from this audit**. Production remains unchanged, including its current permissions and deployed assets; local remediation is not a claim that production exposure has already been closed.

Physical iPhone Safari, installed-PWA behavior and actual Google account-picker behavior remain acceptance steps. Automated browser checks used desktop Chrome and a 390×844 touch viewport with synthetic restored Firebase sessions. No physical iPhone or WebKit testing is claimed.

When separately authorized, application/Rules cutover must require older tabs/PWAs to reload: their direct Firestore calls will fail safely under the new Rules. Previously downloaded private data or old bundles cannot be retracted by this code change. No service worker was found in the current app, and cloud game data is not persisted to local storage by the new client.

Existing non-blocking Release A limitations remain: immutable snapshot recovery requires explicit review; canonical future airtime/roster/merge facts must be verified before any activation; API-backed lists use polling; ordinary authorized league views are not chronologically spoiler-isolated. Release B was not implemented, and late completion remains prohibited.

**Release A is ready for hands-on physical-device acceptance testing in an isolated, separately authorized test environment.** Test real Google sign-in, unlinked/inactive accounts, UID/legacy membership, partial saves/reload/navigation, exact airtime locking, logout/account switching/PWA resume, normal commissioner scoring and recap publication, and safe test grading/downward correction. The earlier audit's iPhone checklist remains applicable with commissioner operations now using server APIs.

Stop here. No local Git checkpoint or release preparation was performed or started automatically.

## 7. Complete remediation file manifest

The following list records content changes relative to the start of this remediation, rather than all pre-existing uncommitted Release A files.

<!-- remediation-file-manifest -->

- `app/admin/page.tsx` — modified
- `app/api/admin/route.ts` — added
- `app/api/community/route.ts` — modified
- `app/api/draft/route.ts` — modified
- `app/api/league/route.ts` — modified
- `app/api/registration/route.ts` — added
- `app/api/scoring/route.ts` — modified
- `app/game-provider.tsx` — modified
- `docs/jury-mode-release-a-audit.md` — modified
- `docs/jury-mode-release-a-security-remediation.md` — added
- `docs/jury-mode-release-a.md` — modified
- `firestore.rules` — modified
- `lib/admin-command.ts` — added
- `lib/admin-store.ts` — added
- `lib/community-auth.ts` — modified
- `lib/community-authority.ts` — added
- `lib/community.ts` — modified
- `lib/discussion-store.ts` — modified
- `lib/draft.ts` — modified
- `lib/firebase.ts` — modified
- `lib/firestore-data.ts` — added
- `lib/game-data.ts` — modified
- `lib/game-normalization.ts` — added
- `lib/history-data.ts` — modified
- `lib/jury-store.ts` — modified
- `lib/league-access.ts` — modified
- `lib/legacy-possession-seed.ts` — modified
- `lib/private-league-seed.ts` — added
- `lib/recap-store.ts` — modified
- `lib/registration-store.ts` — added
- `lib/score-correction-store.ts` — modified
- `lib/score-corrections.ts` — modified
- `lib/scoring-authority.ts` — added
- `next.config.ts` — modified
- `scripts/audit-jury-browser.mjs` — modified
- `scripts/audit-jury-release-a.mjs` — modified
- `scripts/check-ui-cleanup.mjs` — modified
- `scripts/correct-episode4-recap.mjs` — modified
- `scripts/preview-ori-correction.ts` — modified
- `scripts/rehearse-jury-firebase.mjs` — modified
- `scripts/rehearse-scoring-firebase.mjs` — modified
- `scripts/verify-jury-remediation-preservation.ts` — added
- `tests/castaway-leaderboard.test.ts` — modified
- `tests/community.test.ts` — modified
- `tests/discussions.test.ts` — modified
- `tests/draft-board.test.ts` — modified
- `tests/draft.test.ts` — modified
- `tests/elimination-scoring.test.ts` — modified
- `tests/episodes-navigation.test.ts` — modified
- `tests/helpers/jury-fixture.ts` — modified
- `tests/helpers/scoring-fixture.ts` — modified
- `tests/homepage.test.ts` — modified
- `tests/jury-audit.test.ts` — modified
- `tests/jury-store.test.ts` — modified
- `tests/league.test.ts` — modified
- `tests/merge-vote-milestones.test.ts` — modified
- `tests/player-honors.test.ts` — modified
- `tests/possessions.test.ts` — modified
- `tests/registration.test.ts` — modified
- `tests/score-corrections.test.ts` — modified
- `tests/scoring-recipient-tribals.test.ts` — modified
- `tests/scoring.test.ts` — modified
- `tests/security-remediation.test.ts` — added
- `tests/ui-cleanup.test.ts` — modified
