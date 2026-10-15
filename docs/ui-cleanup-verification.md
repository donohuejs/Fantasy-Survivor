# Fantasy Survivor 51 UAT cleanup

This document records implementation verification before the approved production rollout. Scope: the seven reported issues only. During implementation, no production writes, recap publication, identity reassignment, push, deployment, rule changes, scoring changes, or draft changes were performed. Deployment and the narrowly scoped Episode 4 repair were subsequently authorized as separate operations, with deployment required to succeed first. Rollout receipts, verified backups and production comparisons are kept in ignored `work/ui-cleanup/release/`.

## Evidence and root causes

Authenticated, read-only production inspection on October 15, 2026 confirmed Season 51, Episode 4 in progress and the draft complete. Raw typed snapshots and private registration details are kept in ignored `work/ui-cleanup/`; they are not committed.

**Issue 2.** `episodes/51-4` is published and its discussion opening has passed, but `discussionSchemaVersion` is absent. At inspection it had **zero comments and zero thread records**. Posting deliberately rejects episodes that are not schema 2. Calendar reservation and manual opening initialize schema 2 only on newly created episode documents; the separate recap-creation path omitted that initialization. Existing legacy episodes are intentionally not migrated by ordinary reads or posts. This combination leaves an otherwise available recap blocked. The local fix initializes threading on new recap documents only after transactional checks find no orphaned comments or threads. Existing historical documents still require explicit owner migration. New drafts without a confirmed opening also no longer acquire an implicit permanent hold; calendar dates and explicit holds remain authoritative. Recap edits merge into episode documents and retain all discussion metadata. Migration now also persists the derived `replyToCommentId`, preserving reply context alongside original parent IDs, text, authors, IDs, timestamps and episode associations.

**Issue 7.** The authoritative profile is **`player-stanzi`**, named Stanzi, draft slot 2. It holds Kristin Flickinger, Angelica “Jelly” Loblack, and Brady Booker (the latter at 1.25×). Stanzi Lowe's signup and that profile have the exact same legacy email. The profile lacks `uid`; the signup lacks `assignedPlayerId`. Draft and discussion access already accept this legacy email relationship, but check-in only searched UID and assigned profile ID. Its generic selector is deliberately disabled after the draft starts, producing the misleading Awaiting Assignment display. Check-in now recognizes the unique existing email association without writing or renaming anything. It reports email access, the historical profile, payment status and three picks. UID conflicts, duplicate email matches and inconsistent assignments require review. The pre-draft permanent-link restriction remains in place. No name matching or post-draft reassignment capability was added.

**Issue 5.** Rob's original idol record is Lost, last updated in Episode 3. Carter already has an active Final 5 Immunity Idol record with the note “Given to him from Rob.” Carter's record was created separately and has a separate lineage; there is no structured transfer link between these records. Existing data supports Carter's active ownership, but does not warrant inventing a transfer or rewriting either history. The management view now shows active records normally and retains every other record, with its existing controls, in collapsed history.

**Issues 1 and 6.** Player navigation was adding every catalog record, including future scheduled episodes. Admin navigation was treating every episode document's `status: draft` as an authored recap. Episodes 5–13 are calendar placeholders: default titles, empty bodies, empty scoring snapshots and empty `updatedAt`. Both ordinary selectors now share availability logic: published recaps, existing scoring/episode activity, polls and discussions whose server opening has passed. Authored future drafts are separately accessible in collapsed Saved future recap drafts; calendar reservations remain stored. Explicit episode-number loading remains available for preparation. No date or episode limit is hardcoded.

**Issues 3 and 4.** The automatic discussion calendar is a native collapsed `details` at the bottom of Recaps & polls. Its calendar review, skipped weeks, time zones and override controls remain mounted. The duplicate read-only Who Has What was removed only from this admin section. Player inventory and Manage Idols & Advantages remain.

## Separate production repair proposal — approval required

Only Episode 4 needs a required data repair. The read-only preview is generated with:

```powershell
node --experimental-strip-types scripts/inspect-ui-cleanup.mjs
```

The script permits only the established production project and existing commissioner CLI account, uses GET operations, handles paginated collections, writes reports only to ignored local storage, and cannot perform a production mutation. `FIREBASE_CLI_PACKAGE` may specify the installed CLI package location. `work/ui-cleanup/episode4-migration-dry-run.json` contains canonical source SHA-256, document update time, counts, validation issues, proposed episode fields and deterministic comment/thread plan. Repeating it against unchanged data produces the same source fingerprint and plan.

After explicit approval, refresh this inspection and the existing owner-only API dry run:

```json
{"action":"migrate","episodeId":"51-4","dryRun":true}
```

Stop for another review if comments, threads, validation issues or relevant episode state changed. The proposed write is the existing owner migration with `dryRun:false`, restricted to `51-4`. With the inspected empty conversation, it adds **`discussionSchemaVersion: 2`** and uses the existing temporary migration lease fields (`migrationToken` and `migrationUntil`, both empty on completion). It does not change the published title, commentary, scoring snapshot, publication status, recap timestamps, opening or override. No comment or thread writes are planned at the inspected state. The migration is resumable and idempotent. Verify marker/readiness and existing recap fields after the approved write; use a separately agreed production smoke-test account/message if live posting verification is desired.

No production identity repair is needed for the check-in display or current access. Stanzi's permanent UID link remains unpromoted. A later request to promote it would require a fresh verified Auth-account check, review of both documents and explicit identity-write approval. No such promotion is included here. No possession repair is proposed.

Deployment/push and the Episode 4 production migration require separate authorization. No new Firebase rules, indexes or environment settings are required by these changes.

## Files and validation

- `lib/community.ts`, `app/episodes/page.tsx`, `app/admin/recap-manager.tsx`: shared episode availability, authored-draft distinction, selectors and removal of duplicate inventory.
- `app/admin/discussion-schedule.tsx`, `app/admin/possession-manager.tsx`, `app/globals.css`: collapsed schedule/history with mobile touch targets.
- `lib/league.ts`, `app/admin/player-signups.tsx`: read-only association diagnosis; existing binding authorization and draft lock unchanged.
- `lib/recap-store.ts`, `app/api/community/route.ts`, `lib/discussion-store.ts`: transactional new-recap initialization, metadata preservation, correct authorization HTTP status and retained migration reply context.
- `tests/ui-cleanup.test.ts`: regressions for all seven issues, historical preservation, explicit migration, authorization and draft-to-publication behavior.
- `scripts/inspect-ui-cleanup.mjs`, `scripts/check-ui-cleanup.mjs`: read-only production evidence and isolated emulator/browser rehearsal.

Run automated tests with `node --experimental-strip-types --test tests/*.test.ts`, lint with `npm run lint`, types with `npx tsc --noEmit --incremental false`, and the production build with `npm run build`.

Local results: **267 automated tests pass**, lint and standalone TypeScript pass, and the production build succeeds. The isolated rehearsal passes **12 API/browser groups** covering both viewports, with no browser exceptions or horizontal overflow. New posts and replies are checked through the real APIs and in the rendered conversation/database. Screenshots were inspected. The production read-only preview was repeated: Episode 4's update time, zero-comment/zero-thread plan and canonical source fingerprint remained identical. Its published recap was never written. Windows sandbox/OneDrive permissions required running the build and loopback services with normal local access; the browser test server used Webpack to avoid a generated Turbopack junction failure. No deployment was involved.

For the integration/browser rehearsal, use the existing portable Java runtime and `work/firebase-rehearsal/firebase.json` to start Auth and Firestore emulators for **`demo-fantasy-scoring`** only. Keep its rules byte-identical to repository `firestore.rules`. Start Next dev on loopback port 3104 with Webpack and the synthetic service-account JSON from the existing rehearsal folder; set the demo public Firebase key/domain/app ID. Then run `scripts/check-ui-cleanup.mjs` with the fixed emulator hosts (`127.0.0.1:8085` and `127.0.0.1:9098`) and demo project environment variables. `PLAYWRIGHT_PACKAGE` and `UI_CLEANUP_BROWSER_EXECUTABLE` optionally point to the locally installed Playwright package and Chrome executable. The script refuses production project/host settings, uses synthetic accounts/data, redirects browser SDK traffic to the emulators, and blocks external browser requests. It exercises the real Next APIs, Firebase rules, and UI at 1440×1000 and 390×844. Its fixture reset deletes only the fixed demo emulator league. Results/screenshots are under ignored `work/ui-cleanup/browser/`.

Remaining limitation: browser mobile checks emulate iPhone dimensions and touch behavior in Chromium, rather than physical-device Safari. Actual production posting stays blocked until the separately approved Episode 4 migration. Existing legacy-email access remains dependent on the verified account email until any separately reviewed permanent UID promotion.
