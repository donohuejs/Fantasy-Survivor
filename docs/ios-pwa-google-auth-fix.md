# iOS Home Screen Google sign-in — release review candidate

Date: November 18, 2026. Branch: `fix/ios-pwa-google-auth-2026-11-18`.

**State: isolated Google login test PASSED on a physical iPhone; local auth patch built and tested; real-game release BLOCKED until its newer serving source is reconciled; NOT authorized for production.**

## Reproduction and diagnosis

- Owner report: Google sign-in in the installed iPhone Home Screen app reaches the Firebase `/__/auth/handler` page and displays `Unable to process request due to missing initial state`.
- Owner report: direct Safari navigation to `https://fantasy-survivor-theta.vercel.app` and Google sign-in succeeds; reopening the installed icon fails again.
- The retained production source and `main` already use `signInWithPopup`, with Firebase JS SDK `12.18.0` and a separate `firebaseapp.com` authentication host. Merely changing to popups is not a fix.
- The last successful production deployment predates November's isolated Jury Mode work. No Jury staging attempt is evidence of a production authentication change.

## Candidate change

Follow Firebase's official *Option 3: Proxy auth requests to firebaseapp.com* for a non-Firebase-hosted app, together with a standalone-iOS-only redirect path:

1. When `NEXT_PUBLIC_FIREBASE_PWA_REDIRECT=1`, Next rewrites `/__/auth/:path*` to the **validated** configured Firebase Hosting auth helper domain. Requests are transparently proxied; there is no browser redirect to the upstream helper host.
2. On an HTTPS iPhone/iPad in installed standalone mode, Firebase initializes with `authDomain` set to the current site hostname and uses `signInWithRedirect`. On reload, `getRedirectResult` runs once per Auth instance; the existing `onAuthStateChanged` and server-verified membership rules remain unchanged.
3. In normal Safari, Chrome, desktop, and Android, the existing popup sign-in path is unchanged. The flag is off by default.

No changes to Firebase Rules, profiles, registration, scoring, Jury Mode, server tokens, or Firestore data are included.

## Isolated staging evidence — November 18

An entirely separate Firebase project (`fantasy-survivor-auth-fix-test`) and access-protected Vercel project (`fantasy-survivor-auth-test`) were created for a **Google login-only test page** at `https://fantasy-survivor-auth-test.vercel.app`. The staging Google provider and OAuth redirect URI `https://fantasy-survivor-auth-test.vercel.app/__/auth/handler` were authorized. The helper path returned HTTP 200 through the same-host reverse proxy. No league reads, game APIs, player records, scoring writes, or Jury Mode access exist in this harness.

The owner reported these actual iPhone outcomes:

| Test | Result |
| --- | --- |
| Safari Google sign-in | PASS — successful Google login shown in Safari |
| Installed Home Screen icon Google sign-in | PASS — returned to the installed app as signed in |
| Close and reopen installed icon | PASS — login persisted |
| Sign out and sign in again | PASS — owner confirmed successful repeat |

This proves the isolated same-origin redirect approach in the owner's iPhone environment. It **does not** independently prove that the full game, its registration API, player-to-UID membership, navigation, or live Firebase project will behave identically. All of those remain separate release gates.

## Current serving release differs from the protected historical package

The November 18 read-only Vercel alias lookup showed `fantasy-survivor-theta.vercel.app` currently serving **`dpl_H5hcgzYvRyDr2UedkddjQKsQKw7D`**, a READY CLI production deployment dated October 23, 2026. It is **newer** than the October 22 deployment `dpl_HhFiTj5Zix6bWELxu9BuQ5EUqcUR` recorded in `deployment/production-source.json`.

The live deployment source listing contains **115** source files versus the historical manifest's **110**. The observed file paths and SHA-1 identifiers are preserved in `deployment/serving-source-2026-11-18.json` for future source verification. All 110 historical paths are still present. Comparing their SHA-1 source identifiers shows **13 existing files changed**, including Jury-related components/stores, Episodes, Discussions, rules-page presentation, and global styles; **five live files are new**:

- `app/admin/jury-snapshot-form.tsx`
- `app/jury/prediction-episode.tsx`
- `lib/jury-airtime.ts`
- `lib/jury-q3-audit.ts`
- `lib/jury-questions.ts`

The four existing files changed by this auth fix matched the historical version in the serving release **before** applying the auth patch. That makes the change itself portable, but the historical 111-file package would omit or replace newer live code. **Do not deploy or promote that package.**

Before a real-game release, obtain the complete, checksum-verified **115-file serving source** (the available Vercel source-content tool truncates some larger files), layer only the four modified auth inputs and one new helper onto it, produce a new **116-file** approved source manifest, then rerun compilation and game/Jury regression tests. Do not approximate missing live source with older Git files. This reconciliation is a hard stop, independent of the passing auth-only staging test.

## Full-game acceptance for the eventual production release

| Case | Required outcome |
| --- | --- |
| Safari on the real-game host | Existing Google popup sign-in continues to work |
| Home Screen initial Google sign-in | Returns to the installed app without the missing-initial-state error |
| Close and reopen icon | Account remains authenticated |
| Sign out and sign in again | New redirect round trip succeeds |
| Refresh and navigate | Account identity and navigation remain correct |
| Desktop Chrome/Safari | Popup flow remains unchanged |
| Unlinked Google account | No access to another player's or Commissioner's league data |

Verify that no registration/score/Jury data or Firebase security configuration in production changed. If iOS returns the callback into Safari rather than the installed app, treat this candidate as failed; do not promote it. Investigate an in-app OAuth/credential-exchange alternative instead.

## Release gate — no production changes yet

- Development branch pushes must not initiate auto-deployments to the existing production Vercel project; the branch is explicitly disabled in `vercel.json`.
- The historical, protected production manifest at `deployment/production-source.json` remains unchanged. The separate review-only delta at `deployment/ios-pwa-auth-candidate.json` pins exactly **four changed inputs** (`app/game-provider.tsx`, `lib/firebase.ts`, `next.config.ts`, `vercel.json`) and **one new input** (`lib/pwa-auth.ts`) atop that 110-file package. **This is a historical-baseline verification artifact, not a deployable representation of the current serving game.** No unrelated application, API, or security-rule input may drift in the eventual live-based candidate.
- `node scripts/package-ios-auth-candidate.mjs` verifies all **111** historical candidate inputs without producing or deploying anything. The `--package` path **now refuses to create even a temporary source bundle** because the currently serving release is newer. Packaging must remain blocked until live source reconciliation. The approved baseline packaging script must also continue to reject the modified files; do not silently overwrite the baseline manifest.
- The historical-baseline auth candidate digest is `20ccc8d06670eb899fb9972da184567129f37ad7fb2763e615a5df5361ddebdf`. It **must not** be used as the release checksum for the newer serving deployment.
- Run focused tests, type-check, lint, a production-equivalent compile, and the full synthetic regression suite before requesting release approval. After a separately authorized real-game release, repeat the physical iPhone checks and test refresh/navigation, unlinked-member denials, assigned profile identity, and signed-in game/Jury navigation.
- **Before deployment**, explicitly authorize the real game's exact serving hostname `fantasy-survivor-theta.vercel.app` in the production Firebase Auth authorized-domain list (if not already there), and `https://fantasy-survivor-theta.vercel.app/__/auth/handler` in the correct **production** Google OAuth web client's Authorized redirect URIs. This is different from the staging Firebase project and cannot be inferred from its passing test.
- Enable `NEXT_PUBLIC_FIREBASE_PWA_REDIRECT=1` in the real game's **Vercel Production build environment**, not only at runtime. Confirm the compiled external rewrite on the protected production candidate URL, confirm the callback stays on that host, and rehearse a rollback to the **current serving deployment** (`dpl_H5hcgzYvRyDr2UedkddjQKsQKw7D`). This code flag is OFF by default.
- Production Firebase/GCP configuration changes, Vercel environment changes, a real-game production deployment (`--prod --skip-domain`), and promotion of the serving alias all require **separate explicit authorization**. Do **not** use normal merge-to-main, direct Git auto-deploy, or implicit domain promotion.
- Keep the existing Jury Mode staging project, the real-game Firebase Auth user identities, Firestore Rules, scores, registration records, predictions, and league data untouched.

### Local verification recorded November 18

- Node 22.23.5: TypeScript `--noEmit`, full ESLint and Next.js 16.2.6 webpack production-equivalent build **passed** with synthetic public configuration, the PWA flag enabled, and no server credential.
- The compiled routes manifest includes a transparent `/__/auth/:path*` external rewrite to `fantasy-survivor-9da59.firebaseapp.com`, and no matching HTTP redirect. This is a build verification only, not proof of a live production proxy.
- Full synthetic suite, including historical candidate integrity, blocked packaging, and the newer live-source inventory comparison, with the one **intentionally rejecting baseline hash assertion** skipped: **463 passed, 1 skipped, 0 failed**. The baseline checksum assertion correctly rejects the auth patch; do not mutate the baseline manifest to hide the rejection.
- Protected auth-only staging and physical iPhone login tests passed as reported above. Current live-source reconciliation, a real-game production cutover, and end-to-end game-account verification remain pending; no production changes were made.

Reference: https://firebase.google.com/docs/auth/web/redirect-best-practices
