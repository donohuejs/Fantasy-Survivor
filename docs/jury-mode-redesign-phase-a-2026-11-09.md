# Jury Mode redesign — Phase A isolated implementation checkpoint

**Date:** 2026-11-09

**Branch:** `feature/jury-mode-admin-redesign-phase-a-2026-11-09`

**Status:** Local engineering work; **not deployed or production-ready**.

## Source provenance and release reconciliation

- GitHub starting commit: `4d1bc1ae4cdac39378670a3f51fd2e12a001f094`.
- Vercel production deployment: `dpl_H5hcgzYvRyDr2UedkddjQKsQKw7D` (`READY`, source: CLI).
- Reported approved release: `88b2bb5eee98b737ec27a39ae6e32179dc99ce4a`; not accessible from GitHub (`not our ref`).
- The Vercel deployment's uploaded-source tree provided 115 source file hashes. Comparing each as SHA-1 of raw bytes with the current GitHub checkout found **97 identical**, **13 changed**, and **5 newly present only in production**.
- All existing application files changed for Phase A (`app/admin/page.tsx`, `lib/admin-navigation.ts`) had **identical** uploaded production-source hashes at the start. The new workspace imports existing Jury Mode functionality but does not alter its persisted actions.
- The 18 differing/missing files include the deployed Jury Mode implementation: `app/admin/jury-manager.tsx`, `app/jury/client.ts`, `lib/jury-store.ts`, `lib/jury.ts`, `lib/jury-results.ts`, and `app/admin/jury-snapshot-form.tsx`, among others. **Phase B–D integration must wait for exact release source recovery**.
- The verified Drive release archives and bundles are DPAPI CurrentUser-encrypted for the original Windows profile. They cannot be decrypted safely in this Linux environment and have not been changed.

## Implemented in this feature branch

1. Dedicated, deep-linkable `#jury-mode` tab, preserving Scoring and all other Game Master tabs.
2. Mobile-friendly read-only dashboard for next episode, explicit `NEEDS_REVIEW` versus `OPEN` status, Eastern deadline display where verified, potential eligibility count and review flags.
3. Existing proven Jury administration form retained in a collapsed Advanced section so no authorization/eligibility/grading workflow is displaced.
4. Refresh after existing Jury API writes, plus an explicit refresh button.
5. Regression tests for tab behavior, fail-closed status, and preservation of the existing Jury setup.

**Not yet built:** automatic proposal creation, approval wizard, durable in-app notifications, mail provider and email delivery, scheduled preparation/reminders, or simplified grading.

## Verification

- `node --experimental-strip-types --test tests/admin-navigation.test.ts tests/jury-admin-status.test.ts tests/jury-workspace.test.ts tests/jury-mobile-polish.test.ts`: **16 passed, 0 failed**.
- `npx tsc --noEmit`: passed.
- Targeted ESLint on new/edited code: passed before the final minor test/update change; rerun before any promotion.
- Broad historical suite: **not a clean pass**. It includes missing local `server-only` resolution, a test requiring an unbuilt `.next/server/app/admin.html`, and an intentional production baseline hash assertion that cannot pass with new source edits. These are reported, not suppressed.

## Required next steps

1. On the original Windows account, recover the verified final-release bundle or source tree into a **new, non-synced, access-controlled** location; do not upload plaintext secrets/archives to GitHub or chat. Recover just the reviewed source files needed for development through an authorized secure transfer.
2. Verify the recovered exact release commit, file hashes, Firestore project identity, and immutable snapshot implementation against the Vercel source inventory.
3. Rebase/transplant Phase A changes onto the real released source; run full lint, typecheck, isolated suite and mobile acceptance.
4. Implement proposed-draft/confirmation backend and notification outbox behind safely isolated staging. Select email provider and verified Game Master recipient with explicit configuration.
5. Do not push to production, send live email, change database/rules, or backfill Episode 7 scores without separate review and authorization.
