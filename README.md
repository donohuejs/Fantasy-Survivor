# Fantasy Survivor 51

A standalone Next.js fantasy league application designed for Vercel, with Firebase Authentication and Cloud Firestore for shared game data.

## Features

- Clean Survivor 51 season with 21 castaway profiles and zero starting scores
- Public leaderboard, castaway tracker, rules, teams, and draft board
- Google-protected game-master dashboard
- Three-round draft with a 1.25x blind-pick multiplier
- Weekly scoring actions, player adjustments, automatic totals, and an audit trail
- Local setup mode when Firebase has not yet been connected
- Prominent Google sign-in/sign-out controls in the shared header, outside the mobile scrolling navigation
- Public Episodes page with scoring recaps, owner commentary, linked-player comments, and league polls
- Game Master tabs for Scoring, League setup, Tribe membership, Player check-in, Draft room, and Activity log

Game Master sections have shareable hash links (for example, `/admin#player-check-in`) and support arrow keys, Home, and End. Switching tabs preserves unfinished form entries; changing the season resets the forms. Access checks still guard the entire control room, and Firebase remains the authority for permissions.

## Local development

See [Episode recaps and polls](docs/episode-recaps.md) for the publishing workflow, participation rules, and Firebase deployment changes.

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

Import this directory's GitHub repository into Vercel, keep the seven public settings from `.env.example`, add the private server credential described in [the draft deployment checklist](docs/draft-deployment.md), and deploy. The first administrator write creates the shared `games/survivor-51` document from the clean built-in seed.

## Permanent profiles and future seasons

- Players use Google sign-in on `/draft` and register a display name. Registrations live under `games/survivor-51/signups/{Firebase UID}`. Despite the legacy parent path, this registry persists across seasons.
- Game Master links each account to its **existing league profile** once. The confirmation names the historical profile being linked; do not assign an unrelated person just to fill a slot. New people get a new profile first. Adding a returning historical player's exact old league name reuses their historical profile ID.
- Assignment is transactional, rejects duplicate account/profile links, and removes the email from the public player record. Email stays in the private signup document; UID authenticates subsequent picks. Existing manual-email assignments remain compatible until linked.
- Registered players cannot choose or change their permanent profile assignment. A mistaken identity link needs a deliberate administrator recovery; this release does not expose an account-reassignment shortcut.
- Paid checkboxes track receipts for the current season only. They do not charge players, award points, or prevent drafting.
- At the end of a season, open **Review and lock final standings**. Resolve each tie explicitly, review totals, then confirm. Finalization freezes app scoring and adds one public archive of results to the all-time leaderboard.
- **Open Season N+1** makes an admin-only full backup in `games/survivor-51/archives/N`, keeps public results in `history`, and starts the next season in the existing active document. It preserves profile IDs, UIDs and names; reverses the finalized finish order; clears cast, tribes, scores, draft picks, bonuses and paid flags. Add the new cast and tribes before starting that draft. Custom scoring categories carry forward.
- All existing participants carry forward. New profiles append after the automatic draft order. No automatic season rollover runs in the background.

## Historical import

`lib/history-data.ts` contains 73 player-season results for Seasons 45–50 from `Fantasy Survivor 50.xlsx`, sheet `Avg Finish`, summary ranges A3:G34 and detailed results K21:M94. It includes Anna's Season 46 result from the detailed listing, even though the workbook's summary omits her. Trophy symbols are not part of identity. Imported profile IDs match the existing league roster IDs. Season 49's 93-point tie shares 13th place. Missing seasons are excluded rather than filled with zero. Season 50 totals retain the workbook's full available precision.

The `/history` page aggregates by permanent profile ID (not display name), supports season filtering, and includes newly finalized seasons once only. The initial historical data is bundled with the app; no production import mutation has been run.

## Draft rules and deployment

The draft now resets the castaway pool each round, prevents duplicate two-castaway pairs after rounds one and two, and independently randomizes round three. In round three, the server deals one face-down card per player and displays the rest as discards. Keeping awards 1.25×; swapping awards 1× and releases the original dealt card for later players. Each kept card reveals after two additional keeps, with all remaining cards revealed at completion. Round three allows repeats from the player's earlier rounds.

Hidden card assignments are stored outside the public game document and never returned in draft API responses. The rulebook and draft board describe the new flow. Owner proxy picks use the same validation as player picks.

Before publishing, follow [the private draft deployment checklist](docs/draft-deployment.md): add the server-only credential in Vercel, publish Firestore rules separately, then deploy and rehearse with non-admin test accounts. Existing scores, profiles and payment records are not automatically reset. Old-format active drafts require explicit review.

Validation: `npm run build`, `npm run lint`, and `node --experimental-strip-types --test tests/*.test.ts`. There are 51 passing local tests. Live Firebase/emulator authorization tests are still outstanding; see the deployment checklist for limitations and dependency-audit findings.
