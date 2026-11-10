# Jury Mode redesign — Phase C isolated review and notices

**Date:** 2026-11-10

**Parent:** `feature/jury-mode-draft-core-2026-11-10`

**Branch:** `feature/jury-mode-review-notices-isolated-2026-11-10`

**Status:** Implementation checkpoint only. **Not integrated, deployed, or approved to open episodes.**

## Owner-approved boundaries

- Episode 8 is already open in the existing Jury Mode. Do not reopen it, replace its immutable snapshot, change saved predictions or deadline, or send retrospective notices.
- The exact live production source still has 18 unresolved content differences relative to the available GitHub baseline. The original Windows backup context is needed before modifying the live behavior.
- The work remains on a separate feature branch, with no production data access, no environment configuration changes, and no automatic external deliveries.

## Implemented

- `app/admin/jury-review-panel.tsx` and its scoped CSS: a mobile-first, **unmounted** Game Master review component. It shows the proposal's episode, Eastern deadline and provenance, eligible player count, pre/post-merge format, roster/tribe counts, and blockers. It requires one deliberate acknowledgement and accepts an optional audit note.
- The confirmation UI requires an injected `onConfirm` adapter; without one, its action is disabled and clearly marked as a preview. It never grants its own Game Master authority or writes an episode. It avoids resubmitting a previously accepted draft until the caller supplies an updated authoritative state.
- `lib/jury-review.ts`: pure view-summary, expiration gate, and approval-request preparation functions. Requests include draft ID and game revision to support future server-side compare-and-swap checks, and never contain client-proclaimed authorization.
- `lib/jury-notifications.ts`: pure rendering of one approval intent into **separately keyed in-app and email** messages. The renderer accepts only the expected ready draft and dual-channel intent, sanitizes league labels, escapes HTML, and requires the canonical `https://<trusted-origin>/admin#jury-mode` destination. No provider, recipient resolution, inbox/outbox persistence, timers or mail dispatch are connected.
- `tests/jury-review-notifications.test.ts`: synthetic tests for review acknowledgement, blockers/expiration, stale notices, trusted URLs, HTML/header injection, channel-specific keys and isolation.

## Validation

- Focused Phase B + Phase C test files: **17 passed, 0 failed**.
- TypeScript `npx tsc --noEmit`: **passed**.
- Targeted ESLint: **passed**.
- Broader `node --test tests/jury*.test.ts`: **78 passed**, **1 skipped**, **5 unable to load** due to missing `server-only` package in this standalone Node test context. Those 5 failures do not establish application regressions; rerun under the correct test setup before staging.
- No actual mobile-browser or screen-reader acceptance pass has been performed on this new unmounted component.

## Required before a working release

1. Reconcile the exact production source and explicitly confirm all live Firestore and admin contracts.
2. Build an authenticated server adapter that verifies Game Master role, recomputes the proposal from current authoritative data, checks the draft ID/revision, and persists the immutable episode snapshot in a single transaction.
3. Wire the panel only after the server adapter and access control have tests; reject duplicate confirmations and stale sessions on the server.
4. Design a durable outbox and delivery adapter with verified Game Master in-app inbox and email address, per-channel idempotency, send auditing, retries, and approved reminder schedule. No prior Episode 8 notices.
5. Validate the mobile UI, actual iPhone Safari and accessibility paths, end-to-end dry-run in nonproduction, staging security, build and test; obtain explicit production release approval.

**Deployment note:** Vercel's Git integration may automatically attempt a preview build on a feature-branch push. Known Firebase environment restrictions caused earlier feature-branch previews to fail without affecting production. A future preview failure is not evidence that these isolated modules were deployed or that the live site changed.
