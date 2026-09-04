# Episode recaps, comments, and league polls

## Game Master workflow

1. Record the episode's actions in **Scoring**, using the correct episode number. Tribe awards will be grouped into one recap item with the recipients listed.
2. Player score adjustments also have an optional episode field. Leave it empty only for adjustments that do not belong to an episode. Older untagged adjustments are not retroactively assigned an episode.
3. Open **Recaps & polls**, load the episode, and write a title and color commentary.
4. Preview the scoring summary, then choose **Save private draft** or **Publish recap**.
5. After correcting or adding scores later, choose **Update recap & scoring** to capture the new scoring snapshot. Recap publication never awards points or changes the leaderboard.
6. View the published episode on **Episodes**. Players can comment beneath it. While signed in as the owner, use **Remove comment** to moderate. Removal is permanent and asks for confirmation.

Drafts are private to the owner. Commentary is plain text with paragraph breaks, not executable HTML. Switching Game Master tabs preserves unsaved form state. Switching episodes asks you to save first; drafts are not autosaved. Concurrent edits are rejected rather than silently overwriting another editor's changes.

Published recaps contain spoilers and are readable without signing in. Each publication stores the episode's scoring snapshot, including original action names, recipient names, points and notes. Snapshots are explicit, not silently recalculated every time someone opens a recap.

## Comments

- A verified Google account linked to a league profile is required to comment. The owner can also comment as Game Master.
- Comments show the league profile name, never the account email.
- Players can remove their own comments; the owner can remove any comment. Editing other players' comments is not supported.
- Comments are plain text, up to 2,000 characters, with a short server-enforced posting cooldown.
- Retried requests reuse an ID to avoid duplicate posts.
- Recent comments update live; readers can load older comments.
- Unpublishing a recap also hides its comments from public reads. The comments are retained for republishing.

## Polls

- The owner can open a league-wide poll or attach one to a published episode.
- Each poll has 2–6 distinct options. Its question and options cannot be edited after opening; close a mistaken poll and create a new one.
- Each linked league profile gets one vote and may change its selection while the poll is open. Account verification and profile linkage are checked on the server.
- Totals are public and update live. Individual ballots are not exposed in public Firestore reads; the authenticated API returns only the caller's own selection.
- Closing a poll stops further votes. Polls from an earlier season also reject votes after the active season changes, even if they were not manually closed.
- Polls do not automatically alter scoring, settle ties, or declare a binding outcome. The owner interprets the result and applies any game changes separately.

## Storage and season rollover

All data remains in the existing Firebase project under the legacy league root `games/survivor-51`:

- `episodes/{season}-{episode}`: recap and scoring snapshot.
- `episodes/{id}/comments/{id}`: public comments on published recaps.
- `polls/{id}`: questions, options, status and aggregate counts.
- `polls/{id}/votes/{profileId}`: private ballots, server access only.
- `communityPrivate/{uid}`: server-only posting cooldown.

Recaps, comments and polls are independent of the active game document, so season rollover preserves them. The Episodes page includes a season selector. Resetting current-season scores does not erase old published snapshots: explicitly update or unpublish affected recaps.

## Deploying this update

1. Publish this repository's updated **firestore.rules** in Firebase. These rules add the recap, comment, poll and private-ballot paths while preserving existing draft protection and player registration rules.
2. Deploy the new website code to Vercel.
3. This uses the same **FIREBASE_SERVICE_ACCOUNT_JSON** already required for the private draft server. No new credential, hosting provider, or Firebase Cloud Function is needed.
4. Rehearse with an owner, a linked non-admin account, and an unlinked account in a separate test project. Verify draft privacy, own-comment removal, moderation, one vote per profile, changing a vote, closed-poll rejection, and that direct Firestore writes/private-ballot reads are denied.

Local validation covers pure scoring-summary, publication-version, membership, input, and vote-count logic, plus compilation and lint. It does not prove deployed Firebase rules or real Google sign-in work: those checks still require the test-project rehearsal. No production recaps, comments, polls, scores, or player profiles were created or changed during development.
