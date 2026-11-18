# iOS Home Screen Google sign-in — isolated candidate

Date: November 18, 2026. Branch: `fix/ios-pwa-google-auth-2026-11-18`.

**State: locally built and tested; NOT validated on a physical iPhone; NOT authorized for production.**

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

## Staging prerequisites — **do not skip**

1. Select an authorized, **separate** staging application and Firebase project. Do **not** target `fantasy-survivor-9da59` or the existing synthetic Jury fixture. No such new cloud resources are provisioned by this branch.
2. Enable Google Auth for the staging Firebase project and authorize the **exact immutable HTTPS preview hostname** under Firebase Authentication → Authorized domains. Configure the OAuth client with `https://<preview-host>/__/auth/handler` as a permitted redirect URI. Never use a wildcard `vercel.app` domain.
3. Confirm the preview is access-protected and contains no production credentials or game data. The current app's production configuration guard intentionally rejects an unmodified Preview deployment; use a separate sanitized staging build with explicit staging guards, not a regular deployment of this branch to the production Vercel project.
4. Enable `NEXT_PUBLIC_FIREBASE_PWA_REDIRECT=1` only in that protected staging build. Do not enable it in any production deployment before the owner accepts physical iPhone tests.
5. Verify `/__/auth/handler` is being served by a transparent rewrite on the exact preview hostname. A 302 to `firebaseapp.com` is a failure, not a passing proxy check.

## Acceptance on a physical iPhone

| Case | Required outcome |
| --- | --- |
| Safari on staging host | Existing Google popup sign-in continues to work |
| Home Screen initial Google sign-in | Returns to the installed app without the missing-initial-state error |
| Close and reopen icon | Account remains authenticated |
| Sign out and sign in again | New redirect round trip succeeds |
| Refresh and navigate | Account identity and navigation remain correct |
| Desktop Chrome/Safari | Popup flow remains unchanged |
| Unlinked Google account | No access to another player's or Commissioner's league data |

Verify that no registration/score/Jury data or Firebase security configuration in production changed. If iOS returns the callback into Safari rather than the installed app, treat this candidate as failed; do not promote it. Investigate an in-app OAuth/credential-exchange alternative instead.

## Release gate

- Development branch pushes must not initiate auto-deployments to the existing production Vercel project; the branch is explicitly disabled in `vercel.json`.
- Run focused tests, type-check, lint, production-equivalent compile, full synthetic regression suite, and protected iPhone acceptance before proposing a production release.
- Reconcile this branch against the verified source-only production package and its manifest during a separate, authorized release workflow. Do **not** use normal merge-to-main, direct Git auto-deploy, or implicit domain promotion.

### Local verification recorded November 18

- Node 22.23.5: targeted Firebase/PWA tests **12 passed**.
- TypeScript `--noEmit`, ESLint of changed code, and Next.js 16.2.6 webpack production-equivalent build **passed** with synthetic public configuration and no server credential.
- The compiled routes manifest includes the same-origin `/__/auth/:path*` external proxy when the feature flag is on.
- Full synthetic suite with the one **intentionally failing production-package hash assertion** excluded: **460 passed, 1 skipped, 0 failed**. The current `deployment/production-source.json` checksums are for the approved old package and correctly reject changed application files. Do not update them until release reconciliation.
- Cloud OAuth configuration, an independent protected staging deployment, and physical iPhone testing are **pending**; this is not an end-to-end authentication success claim.

Reference: https://firebase.google.com/docs/auth/web/redirect-best-practices
