# Jury Mode redesign — Phase D isolated backend contracts

**Date:** 2026-11-18

**Parent:** `feature/jury-mode-review-notices-isolated-2026-11-10`

**Branch:** `feature/jury-mode-approval-contract-isolated-2026-11-18`

**Scope:** Phase D Part 1 only. No route, Firebase adapter, scheduler, provider, production release or live database mutation.

## Delivered

- `lib/jury-approval-contract.ts` defines a transaction-bound approval service and interface for eventual Firestore integration. It obtains Game Master authority through the trusted transaction adapter, never from submitted client data. It recomputes the next episode proposal using authoritative source data and a trusted server clock, checks the requested draft ID and game revision, rejects blocked/expired drafts, and atomically creates the proposed immutable record and audit trail.
- Duplicate approvals for the same already-open draft are idempotent. Conflicting drafts are rejected. No approval advances the season's currentEpisode counter; Jury snapshot creation is a separate concern from normal season progression.
- The same module defines an independently invoked outbox reconciler. It uses the Phase B notice planner to create one pending **in-app + email** intent with per-channel delivery keys. Optional 24h and 6h reminders are not scheduled by default. It stops preparing notices after the episode opens or expires.
- `tests/jury-approval-contract.test.ts` contains a serializable, rollback-capable **synthetic in-memory transaction adapter**. It is deliberately test-only and must never become a live persistence mechanism.

## Verification

- Phase B/C/D focused test set: **26 passed**.
- `npx tsc --noEmit`: **passed**.
- Targeted ESLint on the two new TypeScript files: **passed**.
- The new tests cover authorization, forged acknowledgments, stale revisions, episode drift, expiry, immutable record copying, audit rollback, duplicate/concurrent approvals, two-channel outbox idempotency, reminder thresholds, and stop-on-open.

## Hard safety boundaries

1. **No backend route or production adapter exists.** Nothing here can accept a live request, open Episode 8 or send notifications.
2. The application has an existing JurySnapshot/JuryEpisode Firestore schema and authoritative GameState/JuryConfig eligibility rules. These must be **reconciled with the exact deployed production source**, including the 18 unresolved file differences, before the new contract can write to real records. The Phase D proposed record is *not* a drop-in replacement for those documents.
3. The transaction adapter must make every read and every create-if-absent write atomic, use server-authenticated actor identity and server time, enforce authoritative league access, validate full three-draft-slot eligibility, and prohibit side effects during Firestore transaction retries.
4. The scheduler authorization marker in this pure test contract is **not authentication**. A future server-only invoker must verify scheduler identity independently; no user-facing route may trust a client-supplied marker.
5. In-app recipient selection, verified Game Master email routing, provider delivery, retries, consent/notification preferences, outbox state transitions and actual timetable remain unimplemented.
6. Actual iPhone, emulator, authorization, and deployment tests are still required before any release. Episode 8's current live snapshot and predictions are explicitly out of scope.

## Recommended next step after source recovery

Build a real Firestore adapter against the reconciled release, with emulator tests proving atomicity under contention; map the prepared proposal to the production JurySnapshot validation rules and versioning; only then connect a protected Next.js route and the existing unmounted review panel. Integrate notification delivery separately, with clear per-channel idempotency and send auditing. Obtain explicit release approval.
