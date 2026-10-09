# Episode recaps, Campfire Commentary, and league polls

## Game Master workflow

1. Record the episode's actions in **Scoring**, using the correct episode number. Tribe awards will be grouped into one recap item with the recipients listed.
2. Player score adjustments also have an optional episode field. Leave it empty only for adjustments that do not belong to an episode. Older untagged adjustments are not retroactively assigned an episode.
3. Open **Recaps & polls**, load the episode, and write a title and color commentary.
4. Preview the scoring summary, then choose **Save private draft** or **Publish recap**.
5. After correcting or adding scores later, choose **Update recap & scoring** to capture the new scoring snapshot. Recap publication never awards points or changes the leaderboard.
6. View the episode on **Episodes**. Players can start or continue Campfire Commentary beneath the recap, even while the recap is still pending. While signed in as the owner, use **Delete** to moderate; deletion keeps a tombstone so replies and the conversation history remain coherent.

### Automatic discussion calendar

Open **Recaps & polls → Automatic episode discussions** and confirm the season's broadcast weekday, local time, IANA time zone, first date, episode count, skipped weeks, and any individual overrides. The calendar reserves stable `season-episode` records with UTC opening timestamps. The server compares those timestamps with its trusted clock whenever a member loads the app, so no cron job is required and opening a discussion never starts scoring, awards points, advances the scoring episode, resolves Tribal Council, or changes the leaderboard.

The Game Master can open, hold, or reschedule one discussion without creating a second episode record. A held discussion keeps its comments and scoring association. The calendar can be confirmed while earlier episodes remain unscored; each discussion opens independently.

Drafts are private to the owner. Commentary is plain text with paragraph breaks, not executable HTML. Switching Game Master tabs preserves unsaved form state. Switching episodes asks you to save first; drafts are not autosaved. Concurrent edits are rejected rather than silently overwriting another editor's changes.

Published recaps contain spoilers and are readable without signing in. Each publication stores the episode's scoring snapshot, including original action names, recipient names, points and notes. Snapshots are explicit, not silently recalculated every time someone opens a recap.

## Campfire Commentary

- **Chatter** is the dedicated all-episode discussion tab. **Campfire Commentary** is the Home preview showing three most-recently-active parent threads; one thread occupies one position regardless of reply count.
- Episodes, Chatter, and Campfire Commentary use the same `episodes/{season}-{episode}/comments/{commentId}` documents and `discussionThreads` index. A post from either entry point is visible through the other after the normal refresh.
- A verified Google account linked to a league profile is required to read or post. The owner can moderate as Game Master. Server authorization controls every read, post, edit, delete, watched state, spoiler preference, and read acknowledgement.
- Conversations have one parent, up to two visible reply levels, and then flatten deeper replies into the conversation list. Direct reply context is retained without unlimited visual nesting. Threads sort by most-recent activity; replies sort chronologically.
- Comments show the league profile name, never the account email. Players can edit or delete their own comments; the owner can moderate any comment. Deleted comments become tombstones so surviving replies remain attached.
- Comments are plain text, up to 2,000 characters, with a server-enforced cooldown. Retried requests reuse a client-generated ID to avoid duplicate posts. Historical flat comments are migrated in resumable batches without changing authors, text, timestamps, IDs, or episode associations.
- The Home page previews are never treated as read. Opening a conversation acknowledges only the reply sequence actually delivered, so a concurrent arrival remains unread. Chatter provides per-user **Unread**, per-thread indicators, personal-reply emphasis, and **Mark all read**.
- Optional **Hide spoilers for unwatched episodes** is stored per account. Players can mark episodes watched or intentionally reveal a single episode. Hidden server responses omit comment text, author context, recap text, notification copy, and accessibility previews.

## Polls

- The owner can open a league-wide poll or attach one to a published episode.
- Each poll has 2–6 distinct options. Its question and options cannot be edited after opening; close a mistaken poll and create a new one.
- Each linked league profile gets one vote and may change its selection while the poll is open. Account verification and profile linkage are checked on the server.
- Totals are public and update live. Individual ballots are not exposed in public Firestore reads; the authenticated API returns only the caller's own selection.
- Closing a poll stops further votes. Polls from an earlier season also reject votes after the active season changes, even if they were not manually closed.
- Polls do not automatically alter scoring, settle ties, or declare a binding outcome. The owner interprets the result and applies any game changes separately.

## Storage and season rollover

All data remains in the existing Firebase project under the legacy league root `games/survivor-51`:

- `episodes/{season}-{episode}`: recap, scoring snapshot, stable discussion opening, and migration marker.
- `episodes/{id}/comments/{id}`: canonical parent/reply comments, including deletion tombstones.
- `discussionThreads/{episodeId}__{rootCommentId}`: materialized activity and reply-count index.
- `discussionSchedules/{season}`: confirmed broadcast calendar and overrides.
- `discussionUsers/{uid}` and child `threads`/`episodes`: private spoiler, watched, unread, and read-sequence state.
- `polls/{id}`: questions, options, status and aggregate counts.
- `polls/{id}/votes/{profileId}`: private ballots, server access only.
- `communityPrivate/{uid}`: server-only posting cooldown.

Recaps, comments, discussion indexes, and polls are independent of the active game document, so season rollover preserves them. The Episodes page includes a season selector. Resetting current-season scores does not erase old snapshots or conversations. Publishing a recap later attaches to the reserved episode record and preserves its existing discussion.

## Deploying this update

1. Follow [`docs/campfire-rollout.md`](campfire-rollout.md). In particular, do not publish the restrictive **firestore.rules** while the restored application still reads comments directly from Firestore.
2. Deploy the additive **firestore.indexes.json** first, validate the explicit migration in a test project, and run the owner-only dry run before any production migration.
3. Deploy the repaired website code to Vercel while the legacy rules remain compatible, smoke-test it, and publish the restrictive rules only after the new code is serving successfully.
4. This uses the same **FIREBASE_SERVICE_ACCOUNT_JSON** already required for the private draft server. No new credential, hosting provider, or Firebase Cloud Function is needed.
5. Rehearse with an owner, a linked non-admin account, and an unlinked account in a separate test project. Verify calendar openings across a daylight-saving change, two open unscored episodes, draft privacy, own-comment edit/delete, moderation, reply ordering, unread/read races, spoiler reveal, one vote per profile, changing a vote, closed-poll rejection, and that direct Firestore discussion writes/reads/private-ballot reads are denied.

Local validation covers pure scoring-summary, publication-version, membership, input, and vote-count logic, plus the Campfire Commentary calendar, migration, threading, unread, spoiler, authorization, pagination, concurrency, TypeScript, lint, and production build checks. It does not prove deployed Firebase rules or real Google sign-in work: those checks still require the test-project rehearsal. No production recaps, comments, polls, scores, or player profiles were created or changed during development.
