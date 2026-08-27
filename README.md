# Fantasy Survivor 51

A standalone Next.js fantasy league application designed for Vercel, with Firebase Authentication and Cloud Firestore for shared game data.

## Features

- Clean Survivor 51 season with 21 castaway profiles and zero starting scores
- Public leaderboard, castaway tracker, rules, teams, and draft board
- Google-protected game-master dashboard
- Three-round draft with a 1.25x blind-pick multiplier
- Weekly scoring actions, player adjustments, automatic totals, and an audit trail
- Local setup mode when Firebase has not yet been connected

## Local development

1. Run `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Add the Firebase web-app configuration values.
4. Run `npm run dev`.

Without Firebase values, the app runs in local setup mode and stores changes in the browser. This is useful for testing but not for production.

## Firebase setup

1. Create a Firebase project and Web App.
2. Enable Cloud Firestore.
3. Enable Google in Authentication > Sign-in method.
4. Deploy `firestore.rules` with the Firebase CLI.
5. Add both the Vercel domain and custom domain to Firebase Authentication's authorized domains.

## Vercel deployment

Import this directory's GitHub repository into Vercel, add the seven values from `.env.example`, and deploy. The first administrator write creates the shared `games/survivor-51` document from the clean built-in seed.
