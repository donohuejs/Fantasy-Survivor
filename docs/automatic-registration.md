# Automatic Google registration

Google sign-in now registers the player automatically from any page. No separate name form or **Join the league** button is required.

- New records use the verified Google email, Google display name (falling back to the email's local name), Firebase UID, and creation time.
- The record is created in a transaction at the existing `games/survivor-51/signups/{uid}` path. Retrying, restoring a session, or signing in from multiple tabs does not create duplicate registrations.
- Existing registration records are read, not rewritten. Nicknames, original creation times and permanent league assignments remain intact.
- Registration does not add a new roster slot or confer game-master access. The owner still links the account to the correct historical league profile and draft slot in **Player check-in**.
- Previously signed-in players who never joined are registered when they next open or refresh the updated site. This does not import every historical Firebase Auth user in the background.
- A visible banner says registration is in progress. A write failure or timeout is shown separately from sign-in success, with a retry button. A success message is shown only after the registration transaction completes.
- Account switches and sign-out hide status belonging to the previous account, and stale callbacks are ignored.

## Deployment and verification

Deploy the website update. **No new Firebase rules or environment variables are required**: the existing rules already permit a verified account to create its own signup document with these fields.

After deployment, test on any public page with a new Google account. Confirm the registered/waiting message and the corresponding row in Game Master → Player check-in. Also test an existing linked player and a previously signed-in but unregistered player after refreshing. Existing assignments must remain unchanged.

Local tests cover identity validation, naming fallbacks, repeat-sign-in preservation, no automatic slot assignment, account-scoped status and error messages. Actual Firestore transactions and live Google sign-in still need the above account test. No production accounts or signup records were modified during development.
