# Private draft deployment checklist

The app remains on **Vercel**, with Google sign-in and data in **Firebase**. The new Vercel server endpoint validates draft turns and deals cards. No Firebase Cloud Functions deployment is required.

## 1. Add the private server credential

This is **not** the Firebase web-app configuration previously entered into Vercel.

1. Open the Firebase console for project `fantasy-survivor-9da59`.
2. Open the gear menu → **Project settings** → **Service accounts** → **Firebase Admin SDK**.
3. Choose **Generate new private key** and save the downloaded JSON securely.
4. In the Vercel project, open **Settings → Environment Variables**.
5. Add **FIREBASE_SERVICE_ACCOUNT_JSON**, selecting **Production**. Paste the entire JSON file contents, including the outer braces, as its value. Use Vercel's sensitive-value setting where available.
6. Keep the existing public Firebase variables. The JSON's `project_id` must match `NEXT_PUBLIC_FIREBASE_PROJECT_ID`.
7. Redeploy after adding the variable; existing deployments will not acquire it automatically.

**Never** give this variable a `NEXT_PUBLIC_` prefix, commit the JSON to GitHub, place it in the public folder, or send it in chat/screenshots. It gives the server privileged Firebase access. If exposed, revoke the key in Google Cloud IAM and generate a replacement. If your organization disables key creation, do not disable that policy; arrange a supported server identity instead.

Only enable this credential in trusted deployments. Do not share the production key with untrusted preview branches or fork builds.

Official reference: [Firebase Admin SDK setup](https://firebase.google.com/docs/admin/setup).

## 2. Publish the updated Firestore rules

In **Firestore Database → Rules**, replace the rules with this repository's `firestore.rules` and publish.

The changes:

- Spectators can still read the public game and standings.
- Players can still register and read their own signup.
- The owner can still assign profiles, mark payments, and score actions.
- Players can no longer write draft picks directly to the public game document. They use the protected website endpoint.
- The hidden deck at `games/survivor-51/draftPrivate/active` is inaccessible to **all browser accounts**, including the game master's. Only the server's Admin SDK can read it.

**Publish these rules before starting a new-format draft.** Leaving the old rules active permits old clients to bypass the new turn checks. Vercel deployment does not publish Firebase rules.

Prefer a quiet setup window: publishing the rules temporarily prevents an old website version from submitting picks until the new version is live. Do not deploy mid-draft.

## 3. Publish and rehearse safely

After the website is deployed:

1. Sign in as the owner and verify existing profiles and payment marks.
2. Verify a non-admin account can sign in and see its assigned profile, but cannot use Game Master controls.
3. Rehearse the full draft in a **separate Firebase test project** with test accounts and the same rules before draft night. Do not add rehearsal picks to the real league just to test the connection.
4. Confirm R1 order, R2 snake order, independently randomized R3 order, unavailable selections, and duplicate-pair rejection.
5. In R3, keep one card, swap another, have a later player select the discarded original, and verify only additional **keeps** advance reveal timing. Finish the round and verify the last hidden cards reveal.
6. Test two tabs submitting the same turn. Only the first request should succeed; the other should report that the draft changed.
7. Verify direct browser reads of `draftPrivate/active` and direct non-admin game writes fail.

Each start saves a fresh run ID and private deal atomically. Requests carry the season, run, revision, and current pick to prevent stale tabs and replayed decisions from advancing the wrong turn. Reloading does not reshuffle.

## Existing drafts and recovery

- Existing setup data is preserved. The new deal is created only when the owner explicitly starts the draft.
- An already-started old-format draft is not silently migrated or erased. Review it with the owner before deciding how to proceed.
- The existing **Reset clean season** control deletes current-season picks, scores, and entry bonuses. **Do not use it merely to fix deployment/configuration problems.**
- Undo pauses the draft and is available before the blind deal is exposed. Once round three opens, undo is disabled because exposed information cannot be made secret again.
- Any remaining kept cards reveal at round completion; this is the implemented end-of-round convention.
- Local setup mode without Firebase uses browser storage and simulates an owner. It does **not** provide private multiplayer storage and is not a production security test.

## Verification status

- 51 local automated tests pass, including 19 draft-specific tests for dealing, swaps, reveals, repeated picks, account authorization, stale requests, undo, and deck conservation.
- Production build and lint pass.
- Live Firebase authorization, real Google accounts, and deployed Vercel server credentials still need the staging rehearsal above. Firebase emulator testing was not completed: Java is absent and the attempt to obtain the test runtime was blocked by the execution approval system. No live Firebase data was changed.
- A dependency audit also reported advisories in existing Next.js/React dependencies and indirect Firebase Admin dependencies. Those are not covered by the passing gameplay tests; review dependency updates before public launch.
