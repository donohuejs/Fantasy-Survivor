# Release A uncommitted-file readiness inventory

October 19, 2026. Local `origin/main` and feature HEAD both resolve to `5e782a95e267be29eb8c918a83eb323f3f00e05a`; no fetch or live production inspection was made. All Release A changes remain uncommitted. This inventory describes the complete working-tree difference from that recorded baseline, not a current production-state assertion.

186 files: 60 modified, 126 new. Ignored work evidence, credentials, dependencies and generated builds are excluded. No starting file was deleted during stabilization. The engineering report distinguishes this task from earlier work.

| File | State | Purpose |
| --- | --- | --- |
| `.gitignore` | modified | Repository configuration, dependency/build policy or documentation |
| `README.md` | modified | Repository configuration, dependency/build policy or documentation |
| `app/acceptance/login.tsx` | new | Fixed-demo local acceptance harness; production use refused by environment checks |
| `app/acceptance/page.tsx` | new | Fixed-demo local acceptance harness; production use refused by environment checks |
| `app/admin/admin-tabs.tsx` | modified | Protected application presentation, server-backed read lifecycle or Commissioner workflow |
| `app/admin/jury-evidence-presentation.ts` | new | Release A eligibility, private prediction/results and audited confirmed grading or presentation |
| `app/admin/jury-manager.tsx` | new | Release A eligibility, private prediction/results and audited confirmed grading or presentation |
| `app/admin/jury-predictions.tsx` | new | Release A eligibility, private prediction/results and audited confirmed grading or presentation |
| `app/admin/page.tsx` | modified | Protected application presentation, server-backed read lifecycle or Commissioner workflow |
| `app/admin/recap-manager.tsx` | modified | Protected application presentation, server-backed read lifecycle or Commissioner workflow |
| `app/admin/score-editor.tsx` | modified | Protected application presentation, server-backed read lifecycle or Commissioner workflow |
| `app/admin/scoring-manager.tsx` | modified | Protected application presentation, server-backed read lifecycle or Commissioner workflow |
| `app/admin/tribal-council-manager.tsx` | modified | Protected application presentation, server-backed read lifecycle or Commissioner workflow |
| `app/api/admin/route.ts` | new | Authenticated server API boundary and server-authoritative transactions |
| `app/api/community/route.ts` | modified | Authenticated server API boundary and server-authoritative transactions |
| `app/api/draft/route.ts` | modified | Authenticated server API boundary and server-authoritative transactions |
| `app/api/jury/route.ts` | new | Authenticated server API boundary and server-authoritative transactions |
| `app/api/league/route.ts` | new | Authenticated server API boundary and server-authoritative transactions |
| `app/api/registration/route.ts` | new | Authenticated server API boundary and server-authoritative transactions |
| `app/api/scoring/route.ts` | modified | Authenticated server API boundary and server-authoritative transactions |
| `app/castaways/page.tsx` | modified | Protected application presentation, server-backed read lifecycle or Commissioner workflow |
| `app/community-polls.tsx` | modified | Protected application presentation, server-backed read lifecycle or Commissioner workflow |
| `app/discussion-content.tsx` | modified | Protected application presentation, server-backed read lifecycle or Commissioner workflow |
| `app/discussion-provider.tsx` | modified | Protected application presentation, server-backed read lifecycle or Commissioner workflow |
| `app/draft/team-scores.tsx` | modified | Protected application presentation, server-backed read lifecycle or Commissioner workflow |
| `app/episodes/community-client.ts` | modified | Protected application presentation, server-backed read lifecycle or Commissioner workflow |
| `app/game-provider.tsx` | modified | Protected application presentation, server-backed read lifecycle or Commissioner workflow |
| `app/globals.css` | modified | Protected application presentation, server-backed read lifecycle or Commissioner workflow |
| `app/jury/client.ts` | new | Release A eligibility, private prediction/results and audited confirmed grading or presentation |
| `app/jury/page.tsx` | new | Release A eligibility, private prediction/results and audited confirmed grading or presentation |
| `app/jury/results.tsx` | new | Release A eligibility, private prediction/results and audited confirmed grading or presentation |
| `app/layout.tsx` | modified | Protected application presentation, server-backed read lifecycle or Commissioner workflow |
| `app/league-client.ts` | new | Protected application presentation, server-backed read lifecycle or Commissioner workflow |
| `app/league-gate.tsx` | new | Protected application presentation, server-backed read lifecycle or Commissioner workflow |
| `app/page.tsx` | modified | Protected application presentation, server-backed read lifecycle or Commissioner workflow |
| `app/rules/page.tsx` | modified | Protected application presentation, server-backed read lifecycle or Commissioner workflow |
| `app/score-contributions.tsx` | new | Protected application presentation, server-backed read lifecycle or Commissioner workflow |
| `app/site-header.tsx` | modified | Protected application presentation, server-backed read lifecycle or Commissioner workflow |
| `app/use-visible-polling.ts` | new | Protected application presentation, server-backed read lifecycle or Commissioner workflow |
| `docs/jury-mode-release-a-acceptance-recovery.md` | new | Implementation, audit, acceptance or operating evidence; no runtime deployment input |
| `docs/jury-mode-release-a-audit.md` | new | Implementation, audit, acceptance or operating evidence; no runtime deployment input |
| `docs/jury-mode-release-a-final-ui-webkit.md` | new | Implementation, audit, acceptance or operating evidence; no runtime deployment input |
| `docs/jury-mode-release-a-iphone-acceptance.md` | new | Implementation, audit, acceptance or operating evidence; no runtime deployment input |
| `docs/jury-mode-release-a-leaderboard-fix.md` | new | Implementation, audit, acceptance or operating evidence; no runtime deployment input |
| `docs/jury-mode-release-a-mobile-polish.md` | new | Implementation, audit, acceptance or operating evidence; no runtime deployment input |
| `docs/jury-mode-release-a-navigation-diagnostics.md` | new | Implementation, audit, acceptance or operating evidence; no runtime deployment input |
| `docs/jury-mode-release-a-navigation-fix.md` | new | Implementation, audit, acceptance or operating evidence; no runtime deployment input |
| `docs/jury-mode-release-a-quota-recovery.md` | new | Implementation, audit, acceptance or operating evidence; no runtime deployment input |
| `docs/jury-mode-release-a-readiness-inventory.md` | new | Stabilization/readiness report and complete uncommitted-file inventory; no runtime input |
| `docs/jury-mode-release-a-remote-staging-deployment.md` | new | Implementation, audit, acceptance or operating evidence; no runtime deployment input |
| `docs/jury-mode-release-a-remote-staging-plan.md` | new | Implementation, audit, acceptance or operating evidence; no runtime deployment input |
| `docs/jury-mode-release-a-remote-staging-preflight.md` | new | Implementation, audit, acceptance or operating evidence; no runtime deployment input |
| `docs/jury-mode-release-a-score-labels.md` | new | Implementation, audit, acceptance or operating evidence; no runtime deployment input |
| `docs/jury-mode-release-a-security-remediation.md` | new | Implementation, audit, acceptance or operating evidence; no runtime deployment input |
| `docs/jury-mode-release-a-stabilization-readiness.md` | new | Stabilization/readiness report and complete uncommitted-file inventory; no runtime input |
| `docs/jury-mode-release-a-staging-recovered.md` | new | Implementation, audit, acceptance or operating evidence; no runtime deployment input |
| `docs/jury-mode-release-a-ui-refinement.md` | new | Implementation, audit, acceptance or operating evidence; no runtime deployment input |
| `docs/jury-mode-release-a.md` | new | Implementation, audit, acceptance or operating evidence; no runtime deployment input |
| `eslint.config.mjs` | modified | Repository configuration, dependency/build policy or documentation |
| `firestore.rules` | modified | Repository configuration, dependency/build policy or documentation |
| `lib/acceptance-environment.ts` | new | Fail-closed staging/demo environment guards and synthetic-only helpers; no production bypass |
| `lib/account-access.ts` | new | Server membership/commissioner/revocation authority, typed command store or Auth configuration |
| `lib/admin-command.ts` | new | Server membership/commissioner/revocation authority, typed command store or Auth configuration |
| `lib/admin-store.ts` | new | Server membership/commissioner/revocation authority, typed command store or Auth configuration |
| `lib/community-auth.ts` | modified | Server membership/commissioner/revocation authority, typed command store or Auth configuration |
| `lib/community-authority.ts` | new | Server membership/commissioner/revocation authority, typed command store or Auth configuration |
| `lib/community.ts` | modified | Shared domain types/calculations or server persistence compatibility; covered by existing regression suites |
| `lib/discussion-response.ts` | new | Shared domain types/calculations or server persistence compatibility; covered by existing regression suites |
| `lib/discussion-store.ts` | modified | Shared domain types/calculations or server persistence compatibility; covered by existing regression suites |
| `lib/draft.ts` | modified | Shared domain types/calculations or server persistence compatibility; covered by existing regression suites |
| `lib/firebase-admin.ts` | modified | Server membership/commissioner/revocation authority, typed command store or Auth configuration |
| `lib/firebase.ts` | modified | Server membership/commissioner/revocation authority, typed command store or Auth configuration |
| `lib/firestore-data.ts` | new | Shared domain types/calculations or server persistence compatibility; covered by existing regression suites |
| `lib/game-data.ts` | modified | Shared domain types/calculations or server persistence compatibility; covered by existing regression suites |
| `lib/game-normalization.ts` | new | Shared domain types/calculations or server persistence compatibility; covered by existing regression suites |
| `lib/history-data.ts` | modified | Server-only historical compatibility data or shared history types; no client private seed |
| `lib/jury-public.ts` | new | Release A eligibility, private prediction/results and audited confirmed grading or presentation |
| `lib/jury-results.ts` | new | Release A eligibility, private prediction/results and audited confirmed grading or presentation |
| `lib/jury-store.ts` | new | Release A eligibility, private prediction/results and audited confirmed grading or presentation |
| `lib/jury.ts` | new | Release A eligibility, private prediction/results and audited confirmed grading or presentation |
| `lib/league-access.ts` | new | Server membership/commissioner/revocation authority, typed command store or Auth configuration |
| `lib/league.ts` | modified | Shared domain types/calculations or server persistence compatibility; covered by existing regression suites |
| `lib/legacy-possession-seed.ts` | new | Server-only historical compatibility data or shared history types; no client private seed |
| `lib/player-points.ts` | new | Shared domain types/calculations or server persistence compatibility; covered by existing regression suites |
| `lib/private-league-seed.ts` | new | Server-only historical compatibility data or shared history types; no client private seed |
| `lib/recap-store.ts` | modified | Shared domain types/calculations or server persistence compatibility; covered by existing regression suites |
| `lib/registration-store.ts` | new | Shared domain types/calculations or server persistence compatibility; covered by existing regression suites |
| `lib/request-id.ts` | new | Shared domain types/calculations or server persistence compatibility; covered by existing regression suites |
| `lib/score-correction-store.ts` | modified | Shared domain types/calculations or server persistence compatibility; covered by existing regression suites |
| `lib/score-corrections.ts` | modified | Shared domain types/calculations or server persistence compatibility; covered by existing regression suites |
| `lib/scoring-authority.ts` | new | Server membership/commissioner/revocation authority, typed command store or Auth configuration |
| `lib/staging-environment.ts` | new | Fail-closed staging/demo environment guards and synthetic-only helpers; no production bypass |
| `lib/staging-fetch.ts` | new | Fail-closed staging/demo environment guards and synthetic-only helpers; no production bypass |
| `lib/staging-fixture.ts` | new | Fail-closed staging/demo environment guards and synthetic-only helpers; no production bypass |
| `lib/staging-operator.ts` | new | Fail-closed staging/demo environment guards and synthetic-only helpers; no production bypass |
| `lib/staging-request.ts` | new | Fail-closed staging/demo environment guards and synthetic-only helpers; no production bypass |
| `lib/staging-scenario.ts` | new | Fail-closed staging/demo environment guards and synthetic-only helpers; no production bypass |
| `lib/staging-store.ts` | new | Fail-closed staging/demo environment guards and synthetic-only helpers; no production bypass |
| `lib/visible-polling.ts` | new | Shared domain types/calculations or server persistence compatibility; covered by existing regression suites |
| `next.config.ts` | modified | Repository configuration, dependency/build policy or documentation |
| `scripts/acceptance-health.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/audit-jury-browser.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/audit-jury-release-a.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/check-ui-cleanup.mjs` | modified | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/correct-episode4-recap.mjs` | modified | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/diagnose-jury-webkit.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/diagnose-visible-navigation.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/diagnose-webkit-replacement.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/helpers/jury-browser-observer.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/inspect-jury-staging-package.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/iphone-acceptance.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/iphone-acceptance.ps1` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/iphone-fixture.ts` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/iphone-seed.ts` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/measure-jury-browser-polling.mjs` | new | Local read-usage measurement; no Firebase or deployment input |
| `scripts/measure-jury-read-refresh.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/package-jury-staging.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/prepare-jury-staging.ts` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/prepare-jury-ui-checks.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/preview-jury-activation.ts` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/preview-ori-correction.ts` | modified | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/provision-jury-staging-users.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/rehearse-jury-firebase.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/rehearse-jury-navigation.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/rehearse-jury-staging.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/rehearse-jury-ui-results.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/rehearse-scoring-firebase.mjs` | modified | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/restart-acceptance-app.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/setup-jury-emulators.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/snapshot-jury-staging-ui.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/verify-iphone-acceptance.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/verify-jury-leaderboard.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/verify-jury-navigation-staging.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/verify-jury-remediation-preservation.ts` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/verify-jury-staging-firebase.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/verify-jury-staging-isolation.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/verify-jury-staging-protection.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/verify-jury-staging-revocation.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/verify-jury-ui-cloud.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/verify-jury-ui-operator.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/verify-jury-ui-production-assets.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `scripts/verify-jury-ui-reset-navigation.mjs` | new | Local rehearsal, diagnostics, preservation, packaging or staging-operation tooling; execute only with documented target guards |
| `staging/app/api/staging/diagnostics/route.ts` | new | Separate staging package overlay: independent operator, synthetic scenarios, diagnostics; excluded from production |
| `staging/app/api/staging/operator/route.ts` | new | Separate staging package overlay: independent operator, synthetic scenarios, diagnostics; excluded from production |
| `staging/app/api/staging/route.ts` | new | Separate staging package overlay: independent operator, synthetic scenarios, diagnostics; excluded from production |
| `staging/app/staging/build-info.ts` | new | Separate staging package overlay: independent operator, synthetic scenarios, diagnostics; excluded from production |
| `staging/app/staging/controls.tsx` | new | Separate staging package overlay: independent operator, synthetic scenarios, diagnostics; excluded from production |
| `staging/app/staging/diagnostics.tsx` | new | Separate staging package overlay: independent operator, synthetic scenarios, diagnostics; excluded from production |
| `staging/app/staging/operator-navigation.tsx` | new | Separate staging package overlay: independent operator, synthetic scenarios, diagnostics; excluded from production |
| `staging/app/staging/page.tsx` | new | Separate staging package overlay: independent operator, synthetic scenarios, diagnostics; excluded from production |
| `staging/app/staging/staging.css` | new | Separate staging package overlay: independent operator, synthetic scenarios, diagnostics; excluded from production |
| `tests/acceptance-health.test.ts` | new | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/castaway-leaderboard.test.ts` | modified | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/community.test.ts` | modified | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/discussion-response.test.ts` | new | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/discussions.test.ts` | modified | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/draft-board.test.ts` | modified | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/draft.test.ts` | modified | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/elimination-scoring.test.ts` | modified | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/episodes-navigation.test.ts` | modified | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/helpers/jury-fixture.ts` | new | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/helpers/scoring-fixture.ts` | modified | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/homepage.test.ts` | modified | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/iphone-acceptance.test.ts` | new | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/jury-audit.test.ts` | new | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/jury-browser-diagnostics.test.ts` | new | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/jury-leaderboard.test.ts` | new | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/jury-mobile-polish.test.ts` | new | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/jury-navigation.test.ts` | new | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/jury-score-presentation.test.ts` | new | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/jury-store.test.ts` | new | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/jury-ui-refinement.test.ts` | new | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/jury.test.ts` | new | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/league.test.ts` | modified | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/merge-vote-milestones.test.ts` | modified | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/player-honors.test.ts` | modified | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/possessions.test.ts` | modified | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/registration.test.ts` | modified | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/score-corrections.test.ts` | modified | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/scoring-recipient-tribals.test.ts` | modified | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/scoring.test.ts` | modified | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/security-remediation.test.ts` | new | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/staging-build-diagnostics.test.ts` | new | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/staging.test.ts` | new | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/ui-cleanup.test.ts` | modified | Offline/unit regression fixtures and assertions; excluded from deployment |
| `tests/visible-polling.test.ts` | new | Offline/unit regression fixtures and assertions; excluded from deployment |
