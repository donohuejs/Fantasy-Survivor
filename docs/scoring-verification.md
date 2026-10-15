# Scoring correction verification

Predeployment checks are complete. The commissioner has authorized deployment and the two specific corrections described below, subject to verified backups and comparisons with the expected production state before each write. Deployment and production execution are recorded separately after completion.

## Isolated authentication and rules rehearsal — passed

The real Firebase Auth emulator and Firestore emulator ran locally for the fixed project `demo-fantasy-scoring`. Firestore used an exact copy of the repository's security rules, SHA-256 `0f00f92771bcec8d9151460e6854ca8a9ad135c74a47fb36a0f0039f436d8005`. Auth listened at `127.0.0.1:9098`, Firestore at `127.0.0.1:8085`, and the actual Next.js scoring API at `127.0.0.1:3102`.

The server used a locally generated synthetic RSA service-account credential for the demo project. The rehearsal guard refuses other project IDs or non-loopback emulator/API hosts. No production credentials or production snapshots were loaded into these services. A portable Java 21 runtime and Firestore emulator 1.22.0 were downloaded into ignored `work/firebase-rehearsal/`; no system-wide Java installation was performed.

All **33 integration checks** passed:

- Anonymous users, an unverified owner, and a verified member with forged `admin`/`commissioner` custom claims were denied direct game create/update/delete, direct audit reads/writes/deletes, private recap reads/writes, and scoring preview/save/history API access.
- These denied requests left the authoritative synthetic game, recap, and audit data unchanged.
- A verified commissioner could update the game through Firestore and read the draft recap. Direct recap writes and all direct audit operations remained denied even to the commissioner, as required by the existing server-mediated architecture.
- The actual API rejected invalid, wrong-project, expired, disabled-user and revoked credentials. It ignored client-provided role fields and spoofed custom claims.
- Commissioner preview wrote nothing and flagged a saved recap discrepancy. Save corrected only the intended award, applied fantasy multipliers, preserved unknown fields and the entire saved recap, and created an audit receipt.
- Repeating an identical request returned its receipt without another change; reusing an ID with different contents failed. Complete undo affected the remaining six awards once; a new repeated undo failed.
- Two concurrent API edits produced one success and one stale-review rejection, with exactly one corresponding audit receipt.

Detailed local evidence: `work/firebase-rehearsal/results.json`. This tests emulator-issued identities and the actual verification/rules/API paths; real Google OAuth browser sign-in and deployed-environment behavior still belong to the authorized production verification step. Firebase recommends demo projects for isolation ([emulator connection guidance](https://firebase.google.com/docs/emulator-suite/connect_firestore)).

## Authenticated production recap inspection — separately approved correction

The existing commissioner Firebase CLI session performed an authenticated **GET only** of:

`projects/fantasy-survivor-9da59/databases/(default)/documents/games/survivor-51/episodes/51-4`

No Firebase custom token was minted, no production user was created or signed in through Firebase Authentication, and no production document was written. The OAuth access credential remained in memory. A repeated read returned the same document update time: **2026-10-15T02:45:14.518548Z**.

The saved recap exists, is a **private draft**, and contains four stored scoring actions. Its Toka immunity action is:

- ID: `e0c90d3b-786b-47bd-9fbc-261c5d65329b:cast-thien-an`.
- Label: `Win tribal immunity`; tribe: `Toka`; points: `2`.
- Seven recipients: Thien An, Brady Booker, Carter Krull, Kristin Flickinger, Maggie Nestor, Mike Pinsky, and **Ori Jean-Charles**.

The erroneous Ori award therefore exists both in the authoritative scoring ledger and in this persisted recap snapshot. Ori also appears in an unrelated showmance comment in the prose; that mention should remain.

**Separately authorized correction:** remove only `Ori Jean-Charles` from the recipients of that existing Toka action inside `episodes/51-4.actions`. Keep the six legitimate recipients at +2 and preserve the other three actions, prose, title, draft publication state, schedule, discussion metadata and historical timestamps. The inspected action has no stored recipient-count or aggregate-total fields: six recipients at two points derives a total of 12. No new scoring event or broad migration is needed. The guarded one-off script patches only `actions` with an update-time precondition; it never saves through the broad recap editor or regenerates the snapshot.

The existing recap editor explicitly captures current ledger scoring when the commissioner saves/publishes. That is an alternative deliberate workflow, but it may refresh more snapshot content than just Ori; it is **not** included in the approved scope of the ledger correction. The active-season public Episodes page already derives displayed scores from the live ledger, so it will show the corrected six-recipient award without rewriting the stored draft.

Read-only evidence: `work/episode4-recap-inspection.json`, with the raw snapshot in ignored `work/production-episode4-authenticated-readonly.json`.

## Code finding and local fix

The first local implementation automatically refreshed a recap during a scoring correction. That conflicts with the follow-up instruction to report historical snapshot changes separately. The automatic recap write has been removed.

The API now reads a saved recap, reports whether its scoring will differ from the proposed ledger, and preserves every recap field on save. The review screen explicitly says the saved draft/published snapshot remains unchanged and directs the commissioner to review it separately. Regression tests cover unchanged published and draft snapshots, already-correct snapshots, and recap edits made between scoring preview and save. The emulator integration test also confirms the stored snapshot remains unchanged after both a correction and undo.

Additional/updated files for this verification: `lib/score-correction-store.ts`, `lib/score-corrections.ts`, `app/admin/score-editor.tsx`, `tests/score-correction-store.test.ts`, `scripts/rehearse-scoring-firebase.mjs`, `scripts/inspect-episode4-recap.mjs`, `scripts/preview-ori-correction.ts`, `README.md`, and the scoring documentation. No changes to the production authentication architecture or emulator bypass were introduced.

Local validation: **256 automated tests**, **33 emulator integration checks**, ESLint, TypeScript/production build, and the desktop/mobile checks documented in `docs/scoring-corrections.md`. Four additional tests cover the narrowly scoped recap patch, preservation of other fields, stale-state rejection, and repeat execution.

## Authorization boundary

The security rehearsal passed. The recap inspection found an additional persisted copy of the scoring error, so the condition of “both checks pass without new issues” is not satisfied without acknowledging this separate finding.

The proposed ledger correction remains unchanged: reverse only `e0c90d3b-786b-47bd-9fbc-261c5d65329b:cast-ori`, preserve the six +2 awards and Ori's Savu membership, and expect Ori 13, Katie Wernsing 58.25, ZACK ZODA 55.75, and chad bond 51 if the authoritative records still match the dry run. The scoring transaction will write only the ledger/revision and one immutable audit receipt. It will **not** write the recap.

The commissioner subsequently explicitly authorized commit, push, deployment, the ledger Edit correction and the separate private recap correction. Recoverable raw typed Firestore backups of the complete game and recap, plus the seven affected awards, were written to ignored local storage. Every backup was checked by readback/hash, and a ZIP recovery rehearsal verified its extracted data against the manifest. Before each production write, compare the current records against those verified backups and use the transaction/version precondition. Stop on unexpected changes; do not expand the authorized scope. Credentials and production backups are excluded from Git.

## Repeating the checks

Start local Auth/Firestore emulators with the rules in `work/firebase-rehearsal/firebase.json`, project `demo-fantasy-scoring`, and the portable Java runtime. Run Next dev on port 3102 with emulator-only variables and the generated synthetic server credential. Then:

```powershell
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8085'
$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9098'
$env:NEXT_PUBLIC_FIREBASE_PROJECT_ID='demo-fantasy-scoring'
node --experimental-strip-types scripts/rehearse-scoring-firebase.mjs
```

For the read-only production inspection, provide the installed Firebase CLI package path through `FIREBASE_CLI_PACKAGE` and run `node scripts/inspect-episode4-recap.mjs`. The script permits only the exact production Episode 4 document and requires the existing commissioner CLI account.

To include the authenticated recap finding in the offline scoring preview:

```powershell
node --experimental-strip-types scripts/preview-ori-correction.ts --snapshot work/production-scoring-readonly.json --recap-snapshot work/production-episode4-authenticated-readonly.json
```
