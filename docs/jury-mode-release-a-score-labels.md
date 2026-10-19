# Jury Mode Release A — targeted leaderboard labels and visibility

Deployed to https://fantasy-survivor-jury-staging.vercel.app on the existing protected staging project. Preview `dpl_Hs8gq2yP131EEMap6679BBzvwoiy` is READY; its immutable address is https://fantasy-survivor-jury-staging-gw9myxvjg.vercel.app. No production deployment or Git checkpoint occurred.

The shared score breakdown now reads **Castaway Total** and **Jury Points**, and renders only when the caller's existing `playerInJuryMode` status is active. Featured, regular and expanded cards already use this component and the same eligibility helper. An active player receives only the existing authoritative total, including when a Jury ledger award happens to exist. Eliminating the last slot during the current episode does not activate the breakdown early. Activated Jury players can still see zero Jury Points. Badges, subdued styling, first place, ranking and total formatting are unchanged.

Calculation is unchanged: **Castaway Total = authoritative standings total − effective Jury ledger awards**. Bonuses, deductions, draft multipliers, repeated picks and award corrections retain their existing treatment. No scoring, eligibility, award, transaction or authorization code changed.

Changed files:

- `app/score-contributions.tsx`: two labels and the visibility condition.
- `tests/jury-score-presentation.test.ts`: 15 focused rendered-component cases across all three layouts, using real eligibility and scoring with synthetic fixtures. Covers active totals, one surviving original slot with an existing award, Jury first place and 17 + 11 = 28, no activation during final elimination, and zero Jury awards.
- `tests/jury-ui-refinement.test.ts`: updated the existing component label assertion.
- `scripts/rehearse-jury-ui-results.mjs`: assert the exact labels and absence of active-player breakdowns in browser regression checks.
- This report.

Verification actually run:

| Command | Result |
|---|---|
| `node --experimental-strip-types --test tests/*.test.ts` | **393 passed, 0 failed**, including the 15 new layout cases. |
| `npm run lint` | Passed. |
| `npx tsc --noEmit --incremental false` | Passed. |
| `node scripts/prepare-jury-ui-checks.mjs --refresh` then `node work/jury-ui-refinement/local-runtime.mjs build` | Normal application production build passed in the existing unsynced demo directory. |
| `node work/jury-ui-refinement/local-runtime.mjs ui` | **15 passed** in disposable local demo emulators: real grading 28/24, downward correction 25/23, labels, total-only active rows and team cards, privacy and authorization; browser checks at **390×844 and 1440×1000**, no horizontal overflow or uncaught runtime errors. |
| `node scripts/verify-jury-ui-production-assets.mjs` | **46 anonymous assets** inspected; no protected data, staging credentials, public source maps or staging controls. Staging routes absent from the normal build. |
| `node scripts/package-jury-staging.mjs --refresh` then `node work/jury-staging/deployment/build-payload.mjs` | Sanitized staging build passed. Vercel's Node 22 build also passed. |
| `node scripts/inspect-jury-staging-package.mjs` | **112 allowlisted source files / 403 source and build files** inspected, zero forbidden content and zero public source maps. |
| `vercel deploy --target preview --project prj_QHqT5XrfpsbdSKO3CavYwe7C7bcG --yes --cwd C:/Users/donoh/AppData/Local/Temp/fantasy-jury-staging-Gh9mzo --scope donohuejs-1066s-projects --json` | READY protected staging Preview; no Production target or Git integration. Existing staging alias rebound after verifying protection. |
| `node work/jury-score-labels/verify-cloud.mjs fantasy-survivor-jury-staging` | **104 passed**: anonymous routes/assets on alias and immutable deployment, 22 actual observed deployed assets, unauthorized POSTs and six direct Firestore GET/PATCH denials. No protection bypass used. |
| `STAGING_DEPLOYMENT_FILE=work/jury-score-labels/deployment.json node scripts/verify-jury-staging-isolation.mjs fantasy-survivor-jury-staging` | All-deployment Vercel Authentication, zero bypass credentials, unchanged protective Rules/IAM and 11 Preview-only variables; isolated Firebase remains free tier with no billing account, Vercel Hobby. Checked before and after deployment. |
| `node --experimental-strip-types work/jury-score-labels/snapshot.mjs fantasy-survivor-jury-staging after` | **All 41 staging documents byte-canonically unchanged; no documents added.** No fixture reset, grading, credential rotation or cloud data modification. |
| `git diff --check` | Passed, with existing Windows line-ending notices. |

The live HTTPS walkthrough verified all three presentations at desktop and 390px width through the existing normal Vercel-authenticated session. The unchanged cloud fixture remains **lock/version 10, ungraded**, with 17/17/11.5/11.5 standings and five ordinary events. Its activated Jury players display 17 Castaway Total + 0 Jury Points; active and legacy players display only 11.5 total. Expected 28/24 grading totals were verified locally without changing this cloud state.

Of 222 starting source files, 219 remain byte-identical; only the three existing files listed above changed, with the new tests and this report added. Branch remains `feature/jury-mode-release-a`, HEAD `5e782a95e267be29eb8c918a83eb323f3f00e05a`. All earlier uncommitted work remains. No production/older-preview access, Rules publication, secrets change, paid resource, push, commit, merge or Release B work occurred.

Physical iPhone follow-up: reload the stable staging address in Safari/PWA; check total-only active cards and the two new labels on activated Jury cards across Standings and Teams & Scores. Physical Safari acceptance of this small patch remains with the commissioner.
