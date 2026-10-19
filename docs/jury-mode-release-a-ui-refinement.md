# Jury Mode Release A — UI refinement and protected staging patch

The approved refinement patch is deployed and ready for the commissioner to repeat the changed-screen iPhone acceptance checks. Core gameplay, scoring and transaction logic remain unchanged. No production deployment, Firebase Rules publication, Git checkpoint, push or merge occurred.

## Deployment and phone access

**Use https://fantasy-survivor-jury-staging.vercel.app/staging going forward.**

This existing staging-project alias now points to the new **Preview** deployment, `dpl_8JqdRBpWx82aWWu5mUFhGHepnC32`. Its immutable URL is https://fantasy-survivor-jury-staging-bxr0e0gl6.vercel.app. It built successfully on Vercel Node 22. The prior `…-2e0otsjhx.vercel.app` URL still points to the previous immutable build; an installed Home Screen shortcut to that URL will not update itself. Open the stable address above and replace that shortcut once.

Vercel Authentication remains enabled for **all deployments**, including this alias, HTML, APIs, scripts, styles and images. There are zero protection-bypass credentials or shareable bypass links. The new deployment is not a Production deployment or a production pipeline promotion.

Use the existing commissioner credentials once on the stable address. A fresh commissioner sign-in establishes operator switching for this browser/PWA origin. The six **Switch to …** buttons then remain available even while using Jury, Active, Legacy or Unlinked identities. **Staging Controls** stays available throughout the application and uses an internal same-origin link. Game Master and scenario reset controls require the currently selected Commissioner identity. No passwords were rotated. Safari and a standalone Home Screen installation may each need their own initial commissioner sign-in.

The live cloud fixture was deliberately preserved: **lock, version 10, ungraded**, five ordinary score events, and 17.0/17.0/11.5/11.5 standings. The commissioner can preview/confirm its existing evidence when ready; no reset is necessary merely to test initial grading. Expected graded totals 28.0/24.0 and corrected totals 25.0/23.0 were verified in isolated fixtures, not written over the live acceptance state.

## Completed UI changes

| Change | Result |
|---|---|
| Featured leader, regular rows, expanded teams | Display Fantasy and signed Jury Mode contributions alongside the existing total. Jury players can remain first; labels, subdued appearance, rankings and ties are preserved. Ordinary players without Jury points do not gain a zero Jury line. |
| Confirmed player results | Five compact rows show title, own answer, green check/red X/neutral unanswered indicator, points, and every accepted correct outcome when needed. Episode total and Clean Sweep are separate. No answer revision/timestamp or editable questionnaire is displayed in this state. |
| State separation | Before airtime, the existing autosaving form remains. After airtime and before confirmation, locked answers show scoring pending, with no correct answers or accuracy. After confirmation, the results list replaces question controls. |
| Jury question accuracy | Each confirmed row shows correct/answered counts. Unanswered questions do not enter its denominator; zero participation has a neutral message. |
| Explanatory paragraph | Removed the requested independent-scoring/Merge/Clean Sweep paragraph from the player page. The rules and calculations remain unchanged. |
| Commissioner corrections | Confirmed episodes show **Correct Confirmed Results**, current confirmed key/version, four clear correction steps, a required correction reason, signed award changes, and explicit corrected-key confirmation. Initial grading retains its separate presentation. |
| Navigation | Ordinary users no longer see Game Master links. Eligible players retain Jury Mode navigation; noneligible players do not gain it. Direct unauthorized requests remain denied. |
| Staging role switching | The independently authorized operator can switch among all six real Firebase identities without repeating Commissioner login after every switch. Switching signs out the selected identity, signs into the next through Firebase, and reloads to clear private client state. |
| Scenario controls | Selector follows the authoritative loaded scenario after reset while preserving an unsubmitted selection within the same version. Reset confirmation is version-bound. Success redirects to a refreshed same-origin view and gives a clear confirmation. Other views receive a stale notice and a reload button. Existing server version/concurrency protections remain intact. |

## Scoring and result authority

`playerPointContributions` reads the existing authoritative standings total (the displayed context total in UI calls), sums effective direct ledger awards marked `source:'jury'`, and subtracts that Jury amount from the total for the fantasy subtotal. Thus fantasy retains entry bonuses, adjustments, deductions, repeated picks and draft multipliers. Jury points stay unmultiplied. No alternative scoring or ranking algorithm was introduced.

Confirmed correct answers come from the stored, commissioner-confirmed key, never from draft evidence or a newly inferred key. The player response contains only their own answer/result rows, accepted answer labels and anonymous per-question counts. It does not contain another participant's predictions, names, answer selections, timestamps or individual grade records.

The catalog reads the key and grading rows in one read-only Firestore transaction. Results require airtime locking, an existing confirmed key/grade timestamp, and matching owner grade revision/timestamp. Accuracy accepts only confirmed `gradingEligible:true` records for that episode and latest key revision, counts each player once, and counts only questions actually answered. A confirmed correction atomically updates those records using the existing transaction; subsequent catalog reads reflect the new accuracy and points. Draft evidence does not replace existing confirmed results. The centralized visibility function can be further restricted by later spoiler policy; this patch implements no Release B behavior.

Commissioner correction writes are unchanged. The new reason input is required before saving a verified correction and is retained in the existing evidence provenance/audit path. Preview requires saved evidence; confirmation still requires review, the current preview token and an explicit checkbox. Stable award identities, immutable receipts, optimistic revisions and idempotency are preserved. The `JuryStore.mutate` source is identical to the previous staging baseline.

## Independent staging operator authorization

The operator endpoint first verifies the existing commissioner's Firebase token with revocation checking, exact staging UID and verified email. Establishing the longer operator session requires authentication within five minutes. It issues a seven-day, signed, random-nonce proof in a `__Host-` **Secure, HttpOnly, SameSite=Strict, Path=/** cookie. A new random 32-byte signing secret exists only in encrypted staging Preview configuration.

Every operator request validates the signature/expiry and checks the commissioner through Firebase Admin `getUser`, including disabled/deleted/email/verification changes and `tokensValidAfterTime` against the original authentication time. External revocation invalidates the operator proof; no application-maintained revocation metadata is needed. Mutations require same-origin JSON requests. The host check accounts for Next's internal localhost normalization without accepting foreign origins.

The cookie authorizes the tester's staging switch controls, not league commissioner privileges for the selected player. Normal APIs continue verifying that selected real Firebase identity and membership independently. Reset requires **both** a valid operator session and the current verified Commissioner identity. Forged body flags, ordinary player tokens alone and tampered cookies are rejected. No custom user claims or privileged player profiles were created.

**Sign out** affects the selected Firebase identity; **End operator session** separately removes switching authorization. The operator session expires after seven days or commissioner revocation. Staging controls are absent without independently verified operator authority. No new IAM permissions were needed.

Staging routes/components now live in `staging/app/`, outside Next's normal application tree. Only the explicit staging package copies them into `app/` and injects their provider. Normal production builds contain neither these routes nor their client controls. All three staging route probes return 404 in the production build; anonymous asset inspection confirms the exclusion.

## Files changed

- Display and player flow: `app/page.tsx`, `app/draft/team-scores.tsx`, `app/score-contributions.tsx` (new), `app/site-header.tsx`, `app/globals.css`, `app/jury/page.tsx`, `app/jury/client.ts`, `app/jury/results.tsx` (new), `app/admin/jury-manager.tsx`.
- Read-only calculations/API results: `lib/player-points.ts`, `lib/jury-results.ts` (new), `lib/jury-store.ts` (catalog only).
- Staging-only operator/usability: `lib/staging-operator.ts`, `lib/staging-scenario.ts` (new), `lib/staging-fetch.ts`; moved `app/staging/{page,controls}.tsx` and `app/api/staging/route.ts` into `staging/app/`; new `staging/app/staging/{operator-navigation.tsx,staging.css}` and `staging/app/api/staging/operator/route.ts`.
- Packaging and verification: `scripts/package-jury-staging.mjs`, `scripts/inspect-jury-staging-package.mjs`, `scripts/rehearse-jury-firebase.mjs`, `scripts/verify-jury-staging-isolation.mjs`; new `scripts/prepare-jury-ui-checks.mjs`, `scripts/snapshot-jury-staging-ui.mjs`, `scripts/rehearse-jury-ui-results.mjs`, `scripts/verify-jury-ui-{operator,production-assets,reset-navigation,cloud}.mjs`.
- Tests/report: `tests/jury-ui-refinement.test.ts` (16 new cases) and this report. Private/generated evidence remains ignored under `work/jury-ui-refinement/`.

## Actual verification

| Command | Result |
|---|---|
| `node --experimental-strip-types --test tests/*.test.ts` | **378 passed, 0 failed**. |
| `npm run lint` | Passed. |
| `npx tsc --noEmit --incremental false` | Passed. A stale generated dev validator referencing the moved routes was backed up and removed; no source or emulator cache was cleared. Full-source dedicated-config and both fresh build typechecks also passed. |
| `node work/jury-ui-refinement/local-runtime.mjs build` | Production webpack build passed; no staging routes. Local build used fixed demo configuration and an unsynced generated directory. |
| `node work/jury-staging/deployment/build-payload.mjs` | Sanitized staging webpack build passed. Vercel's Linux/Node 22 build also passed. |
| `node work/jury-ui-refinement/local-runtime.mjs jury` | **26 passed**, existing Jury API/browser rehearsal updated for the new results presentation. |
| `node work/jury-ui-refinement/local-runtime.mjs scoring` | **33 passed**, existing scoring-correction rehearsal, including API/direct-Firestore revoked-token rejection. |
| `node work/jury-ui-refinement/local-runtime.mjs security` | **132 passed**, existing authorization/compatibility matrix. Revoked commissioner: API 401, direct GET/PATCH 403. |
| `node work/jury-ui-refinement/local-runtime.mjs ui` | **15 passed**, real API plus desktop/mobile browser tests: 28/24 subtotals, 25/23 downward correction, Clean Sweep removal, anonymous accuracy, initial/correction presentation, navigation and external operator revocation. |
| `node scripts/verify-jury-ui-operator.mjs fantasy-survivor-jury-staging` | **30 passed** through the built staging server on loopback with real existing staging identities. No fixture reset; real memberships/privilege denials retained, forged flags/tampered cookies/cross-origin requests rejected. |
| `node scripts/verify-jury-ui-reset-navigation.mjs fantasy-survivor-jury-staging` | **3 passed** browser presentation checks with mocked reset APIs: selector/success synchronization, other-tab refresh and same-origin navigation. **No real cloud reset.** |
| `node scripts/verify-jury-ui-production-assets.mjs` | **46 anonymous actual assets** scanned; no private league markers, staging controls, staging credentials or public source maps. Three staging routes absent. |
| `node scripts/inspect-jury-staging-package.mjs` | **112 allowlisted source files, 403 inspected source/build files**, zero forbidden private-data/credential/signing-secret matches and zero public source maps. Dry upload: 114 files including generated metadata; `.next`, `.vercel`, `node_modules` excluded. |
| `node scripts/verify-jury-ui-cloud.mjs fantasy-survivor-jury-staging` | **100 passed** after deployment: stable alias and immutable Preview protection, 20 actual observed deployed assets, unauthorized POSTs, and six direct Firestore GET/PATCH denials. No bypass credential used. |
| `STAGING_DEPLOYMENT_FILE=work/jury-ui-refinement/deployment.json node scripts/verify-jury-staging-isolation.mjs fantasy-survivor-jury-staging` | READY Preview, all-deployment protection, zero bypass entries, eleven Preview-only variables, exact unchanged runtime roles/Rules, Spark/no billing account and Vercel Hobby confirmed. |
| `node --experimental-strip-types scripts/snapshot-jury-staging-ui.mjs fantasy-survivor-jury-staging after` | All **39 original documents unchanged**; 41 documents afterward because normal test sign-in created signup records for `staging-active` and `staging-unlinked`. Existing game, predictions, evidence/audits and scores unchanged. |
| `node --experimental-strip-types scripts/verify-jury-remediation-preservation.ts --fixture work/jury-release-a/game-before.json` | Offline original **241 events**, identities, picks and history preserved; matching score SHA-256 `5332c8246a6ee1473036de1f7c1cc890edd81d41c9c292e5b23f32aef5b07a74`. Zero production access. |
| `git diff --check` | Passed, with existing Windows line-ending notices. |

The local rehearsals used a **separate** fixed demo pair: Auth `127.0.0.1:9198`, Firestore `127.0.0.1:8185`, Next `127.0.0.1:3116`. Existing rehearsal scripts were mirrored with only ports/import paths/evidence directories redirected; their fixed project and synthetic credential guards remain. The separate loopback staging server on 3118 exercised real staging authorization without a Vercel bypass. Its backend tests are distinct from the actual protected HTTPS browser walkthrough.

The real HTTPS walkthrough verified commissioner bootstrap; Commissioner → Jury → Active → Unlinked → Commissioner switching without repeated password entry; hidden administrative/ineligible Jury links; unlinked league denial with operator controls retained; locked pending predictions with no results disclosure; and live initial-grading presentation. No grading or scenario reset was performed on the cloud fixture.

Intermediate setup/test failures were resolved before deployment: Next origin normalization; a missing fixture-version header in an unauthorized-mutation test; singular/plural result text and asynchronous navigation assertions; and initial test-fixture/line-ending assumptions. Final runs above pass. Direct stored-password sign-in worked for all six users, so the reported `auth/invalid-credential` error was **not reproduced** and its original cause remains unknown. Credentials were not regenerated.

## Preservation and remaining limits

Branch remains `feature/jury-mode-release-a`, HEAD `5e782a95e267be29eb8c918a83eb323f3f00e05a`. Of 204 starting tracked/untracked source files, 188 remain byte-identical; thirteen received targeted edits and three staging files were moved. No unrelated source changed. Source hashes confirm `lib/scoring.ts`, `lib/jury.ts`, `lib/league.ts`, `lib/score-ledger.ts`, correction/admin stores, authoritative client standings, private seeds and Rules are unchanged. The previous Jury mutation implementation is byte-identical.

No production or old-preview resources were accessed or changed, no production data was copied to staging, no Rules were published, no paid resources were created, and no Git commit/push/merge occurred. Firebase `fantasy-survivor-jury-staging` remains isolated and free with unchanged two-role runtime IAM; the only new cloud secret is the operator signing key. Temporary local checks can be stopped without affecting remote testing.

The commissioner already verified core physical Safari/PWA behavior before this patch. The new screens were verified in Chromium at **390×844** and **1440×1000**, including overflow checks and screenshots. **The changed screens still require physical iPhone acceptance.** No Release B spoiler functionality was added. Small-group inference from anonymous statistics remains the explicitly accepted tradeoff.

## Changed-feature iPhone checklist

1. Open the stable HTTPS address in Safari, sign into Commissioner once, and try Jury → Active → Unlinked → Commissioner. Check the persistent internal **Staging Controls** link and that ordinary identities have no Game Master tab. Unlinked must still be denied league access.
2. When ready, preview/confirm the existing locked fixture. Check **17 + 11 = 28** and **17 + 7 = 24** on featured, regular and expanded cards; keep Jury labels/subdued styling and first place.
3. Review the five-row results: correct/incorrect/neutral unanswered, all valid correct outcomes, points, separate Clean Sweep and per-question participation. Partial Q3/Q4 denominators should count only the participant who answered them.
4. Use **Correct Confirmed Results**, edit evidence, enter a reason, save, preview signed changes and confirm. An idol correction to Q2 should yield **25/23**, remove the full player's Clean Sweep and update question accuracy to **0 of 2**.
5. After preserving any test evidence you need, reset to Open. Check selector/status agreement, success confirmation and the reload prompt in another open view. No stale save should be accepted.
6. Add/replace the Home Screen shortcut using the stable address. Repeat operator switching, internal navigation and the changed results screens in standalone mode. **End operator session** should remove switching authorization.
