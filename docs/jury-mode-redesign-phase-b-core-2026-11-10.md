# Jury Mode redesign — Phase B/C pure core checkpoint

**Date:** 2026-11-10

**Parent:** `feature/jury-mode-admin-redesign-phase-a-2026-11-09`

**Branch:** `feature/jury-mode-draft-core-2026-11-10`

**Status:** Pure logic prototype with unit coverage, intentionally not connected to the live game or approved for deployment.

## Confirmed owner update

The Game Master reported that Episode 8 Jury Mode was opened successfully using the existing interface. Do not modify or retroactively replace its immutable snapshot, saved predictions, or deadline.

## Implemented

The new `lib/jury-preparation.ts` exports three side-effect-free operations:

- `prepareJuryDraft`: creates a deterministic, content-addressed, unapproved proposal from an explicit authorized-source snapshot. It includes active roster and tribe suggestions, the next episode, merge question format, and verified eligible player IDs. Unresolved history/roster/airtime becomes an actionable blocker, not invented provenance.
- `validateJuryDraftApproval`: rejects unsigned/unconfirmed intent, stale revisions, expired airtime, and incomplete acknowledgments. It returns a validated intent only. A future authenticated Firestore transaction must perform the actual opening; client-supplied role booleans must never be trusted.
- `planJuryApprovalNotice`: creates stable outbox keys for one logical confirmation request delivered through **both in-app and email**. Optional 24h/6h reminder windows are configurable proposals, not active schedules. It cannot deliver mail, persist records, or approve predictions.

The source mapping is intentionally external. An integration adapter must read the exact release's authoritative game/scoring/calendar records, compute eligibility from all three original draft picks, and transactionally persist the proposed version. The 18 unresolved production source differences described in the Phase A checkpoint remain a hard gate.

## Tests and safety

- New synthetic preparation tests cover deterministic proposals, role denial, revision mismatch, Eastern time/DST validation, merge format, roster/eligibility blockers, duplicate notices, reminder windows and expiration.
- `node --experimental-strip-types --test tests/jury-preparation.test.ts tests/jury-admin-status.test.ts`: 12 passed, zero failed.
- `npx tsc --noEmit` and targeted ESLint: passed.
- No production writes, mail sends, cron installation, deployment, snapshot mutation or historical corrections were attempted.

## Remaining implementation phases

1. Restore and verify the exact production release source from the original Windows recovery context.
2. Build and test an authenticated, revision-aware draft persistence and approval endpoint with Firestore emulator transactions.
3. Add durable notification outbox, Game Master-only inbox, verified email provider/recipient and scheduled reconciliation. Obtain approval for the final reminder cadence.
4. Build the short mobile verification/approval wizard and grading flow against the recovered API contracts.
5. Stage, test and obtain explicit go/no-go before any production release.
