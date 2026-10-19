# Acceptance environment recovery

October 16, 2026. Branch `feature/jury-mode-release-a`; HEAD `5e782a95e267be29eb8c918a83eb323f3f00e05a`. Work remains uncommitted. **The same private URL is ready for the commissioner’s iPhone retest.**

## Failures and root causes

Direct Next requests to `/`, `/rules` and `/api/jury`, and a gateway request to `/`, returned **HTTP 500**, body `Internal Server Error`. The gateway was forwarding Next's failure correctly. Auth and Firestore were still running.

The exact server exception was:

```text
EBUSY: resource busy or locked, open
C:\Users\donoh\OneDrive\Documents\ChatGPT\Fantasy Survivor 2\.next\dev\types\app\layout.ts
errno: -4082; syscall: open
```

This occurred during development compilation, before route/component execution, and affected public pages as well as APIs. The generated file had Windows `Archive, ReparsePoint` attributes and was readable by the time it was inspected. Its location is OneDrive-managed; the specific process holding the earlier lock was not identified, so OneDrive is a possible source rather than a proven lock owner. No leaderboard-rendering exception explained the server's HTTP 500s. The development server remained failed after the file became readable; restarting only Next restored normal responses without deleting or rebuilding its cache.

The original `status` command also treated any HTTP response as healthy, including 500. This explained the misleading “running/reachable” report. Health now requires **200** from both emulator root endpoints and the app page, and **401** from the anonymous Jury API.

During post-restart browser verification, a separate existing client exception reproduced:

```text
TypeError: Cannot read properties of undefined (reading 'map')
CampfireCommentary — threads.rows.map(...)
```

`discussionRequest` swallowed errors from `response.json()`, substituting an error object. If a request was aborted **after HTTP 200 headers arrived**, `response.ok` remained true and the error object was returned as a successful thread page. `useThreads` installed it as state without `rows`, causing the entire standings page to crash. This was a response-lifecycle defect, independent of Jury labels/scoring. Two deterministic tests failed against the old response handling. It is now corrected: aborts propagate unchanged, and invalid JSON rejects rather than becoming successful state. Existing hook error/abort handling can preserve or recover the list.

## Recovery and bounded changes

- Restarted only the verified Next.js process tree on loopback port 3106. The existing gateway/supervisor and Auth/Firestore emulator processes were never stopped.
- No fixture reset, regrading, snapshot rewrite, account update, revocation, credential generation, URL rotation, cache deletion, firewall change or production access occurred.
- Added `scripts/restart-acceptance-app.mjs`, exposed through `restart-app` in the existing PowerShell/Node launcher. It verifies process ancestry and the fixed demo environment before stopping only Next. Its monitor ties the replacement app to the existing supervisor's lifetime.
- Added `scripts/acceptance-health.mjs` and corrected the launcher's `status` check.
- Changed `app/discussion-provider.tsx` to use the small tested parser in `lib/discussion-response.ts`. No changes to the leaderboard correction, eligibility/grading/scoring engines, fixture seed, standings calculations or proposed Rules.
- Added `tests/acceptance-health.test.ts` and `tests/discussion-response.test.ts`; updated the iPhone guide with safe recovery commands.

The first new readiness probe assumed Firestore's root would return 404; the actual emulator returns 200. That expectation was corrected and the application-only restart was repeated. A preservation comparison also needed JSON normalization because the Admin SDK returns `UserInfo` class instances; serialized account records were identical. Neither harness adjustment changed emulator contents.

## Actual verification

| Check | Result |
| --- | --- |
| Application-only restart and stricter status command | Passed; same gateway, emulators and URL |
| Full unit command `node --experimental-strip-types --test tests/*.test.ts` | **356 passed, 0 failed** |
| Focused health/discussion/homepage/Jury regressions | **21 passed, 0 failed** |
| `npm run lint`; `npx tsc --noEmit` | Passed |
| Existing non-resetting leaderboard browser check | **6 passed** at 393px, 520px and 1440px; labels, subdued colors, ranks, totals and team cards verified |
| Forced malformed-200 browser response and normal refresh recovery | **2 passed**, zero page errors; standings/featured Jury cards remain usable |
| Direct/root and private gateway page requests | HTTP **200**; protected anonymous Jury API **401** |
| Post-restart generated-file lock errors | None observed |
| Final browser traces | Zero runtime errors |

The leaderboard browser command was `node --experimental-strip-types scripts/verify-jury-leaderboard.mjs verify`. It does not reset or grade. The interruption check only intercepts one browser's discussion response; the real database is not altered. No production build or full audit was needed for this recovery. No physical Safari test is claimed for this repair.

Before/after comparisons covered **all 20 documents** under the synthetic league, **all six account identities/statuses/providers and token-revocation timestamps**, plus hashes of settings, connection URL/password, scenario metadata and the synthetic service-account file. These match exactly. The document SHA-256 before and after is:

`b0a9ee01c91b86d3c4198d3ee56c6e1bcd9256a81126f128d2c801c248d42392`

The existing graded scores remain:

- Synthetic Clean Sweep Player: **17 fantasy + 11 Jury = 28.0**, rank 1 and still featured.
- Synthetic Jury Player: **17 fantasy + 7 Jury = 24.0**, rank 2.
- Synthetic Active/Legacy Players: **11.5 each**, surviving castaways, no Jury label.

Ignored evidence is under `work/acceptance-recovery/`; normal app/restart logs remain in `work/iphone-acceptance/next.log` and `app-recovery.log`. Source hashes confirm the preceding leaderboard correction and grading fixture script were preserved.

## Handoff

Keep using the existing private test URL and password; neither changed. Reload Safari to obtain the corrected client. The gateway, Next app and emulators remain running. Windows Chrome verifies the site, including mobile-width layouts. The commissioner must confirm the physical iPhone result.

If a Windows generated-file lock recurs, the non-resetting command is:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\iphone-acceptance.ps1 restart-app
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\iphone-acceptance.ps1 status
```

No production changes, commits, pushes, deployments, merges, PRs or Rules publication occurred. Stopped before release.
