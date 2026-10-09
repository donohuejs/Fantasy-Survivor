# Discussion architecture audit (2026-10-08)

Recorded before implementation on the discussion redesign branch, based on `815a9f6`.

- Next.js 16 App Router, React 19, strict TypeScript, Firebase Authentication (verified Google identities), Cloud Firestore; Vercel hosts the app. No repository or ancestor AGENTS.md was found. No scheduler or broadcast calendar exists.
- `games/survivor-51` is the single established league root, including future seasons. The public game document contains players, draft, castaway state, score ledger, tribes, possessions and scoring lifecycle. `startEpisode` awards appearance points and `finishEpisode` permits sequential advancement. Discussion code must never write this document or invoke those functions.
- `episodes/{season}-{episode}` currently holds recaps and scoring snapshots. Comments are flat documents in its `comments` subcollection, with original profile ID, author name, text and creation time. `/api/community` performs authenticated transactional writes; the browser reads published recaps and comments directly. Comment access/posting currently requires recap publication.
- The verified owner is fixed to the existing `donohue.js@gmail.com` identity. Other participants require a permanent UID-linked profile or an existing legacy email assignment. Signups are persistent across seasons. The current app is single-league; arbitrary league paths must never be accepted from requests.
- `/episodes` combines recap, live score activity, possessions and polls, with season and episode navigation. Home has draft/poll calls to action and standings. `/admin#recaps-polls` edits recap snapshots independently of scoring. Admin tabs retain mounted forms.
- Firestore browser writes are owner-only for the game, server-only for community resources. Published recaps and polls are public; discussion content will become member-only through an authenticated API, and direct comment reads will be denied. Draft, signup and poll policies must remain intact.
- The visual system uses teal, cream and orange, shared Arial/Georgia fonts, shared rem text sizes, 44px touch controls and wrapping episode navigation.
- Baseline: 178 automated Node tests passed. Tests use pure TypeScript domain logic and some source/layout assertions. Lint is being checked separately. No Java runtime or local Firebase credentials are configured; live service validation must be reported separately from local checks.

## Implementation decisions

Reserve stable episode documents when a Game Master confirms a bounded broadcast calendar. Store IANA-zone-derived UTC openings in those documents; server time decides availability on each request, with no cron or scoring mutation. Keep the existing recap fields and comments in place. Add a materialized thread index (IDs/activity/counts, with canonical text read from comments) for paginated league-wide activity. Add private per-UID settings, watched records and unread thread counters with monotonic comment sequences. Reading acknowledges only the sequence actually delivered, preserving concurrent arrivals. Server responses redact unwatched discussion previews; recap/discussion content requires an intentional per-episode reveal. Use one composer and thread component across recap, Chatter, and Campfire Commentary.

## Phase 2 repair note

Reading no longer performs historical migration. The owner-only discussion API exposes migration inspection and dry-run validation, then runs the existing resumable, deterministic batch migration explicitly. Catalog and feed responses mark an episode as not thread-ready until `discussionSchemaVersion: 2`; legacy comments remain available to the recap path while migration is pending.
