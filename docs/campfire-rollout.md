# Campfire Commentary backend rollout

This runbook applies to the server-backed Campfire Commentary implementation. It keeps legacy flat comments in place and treats threaded migration as an explicit Game Master operation.

## Migration and verification

The discussion API never migrates while serving a catalog, feed, recap, or conversation. A verified Game Master can inspect migration state with:

```text
GET /api/discussions?view=migration
GET /api/discussions?view=migration&episodeId=51-3
```

The response reports `pending`, `in-progress`, `ready`, `blocked`, or `missing`, plus comment and thread counts and validation issues. A dry run validates the historical rows without writing anything:

```json
{"action":"migrate","episodeId":"51-3","dryRun":true}
```

After reviewing the dry-run result, the same request with `dryRun:false` performs a resumable migration. It only merges derived thread fields into existing comment documents, creates deterministic `discussionThreads` documents, and sets `discussionSchemaVersion: 2` after all batches complete. It never deletes or replaces the original comment ID, author, text, timestamp, or episode record. Finalization rechecks every comment so a legacy client adding a row during migration leaves the episode pending for another run. A failed batch clears the lease when possible; a later run safely resumes from the unchanged legacy rows and deterministic IDs.

## Compatibility matrix

| Application | Legacy rules | Proposed rules in `firestore.rules` |
| --- | --- | --- |
| Restored production application (direct comment reads) | Works as before | **Breaks:** direct comment reads are denied |
| New Campfire Commentary application (server API) | Functions through Admin SDK, but legacy direct access remains permitted | Intended final state: server API works and discussion paths are denied to browsers |

Do not publish the proposed rules while the restored application is active. The new application must be deployed and smoke-tested first. The short transition while old rules remain is intentional: it keeps a Vercel rollback possible, although the old rules must not be treated as the final security posture.

## Safe rollout order

1. In a Firebase test project or emulator, load representative `51-3` flat comments, deploy the rules and indexes, run the dry run, run migration, and verify feed, Chatter, recap, unread, spoiler, edit/delete, and reply behavior.
2. Confirm the production service-account configuration and deploy the additive Firestore indexes. Index deployment does not revoke legacy reads.
3. Build the repair branch and deploy it to a Vercel Preview connected to the test project. Verify missing-index, authentication, authorization, configuration, empty-feed, and migrated Episode 51-3 responses.
4. Run a production dry run through the owner-only API. Review the counts and issues before allowing writes. Execute the explicit migration for each approved historical episode; do not run it from a normal member read.
5. Deploy the repaired application to Vercel while the legacy rules remain active. Smoke-test Campfire Commentary, Chatter, Episode Recap, automatic opening, unread tracking, spoiler protection, and scoring independence.
6. Publish the proposed `firestore.rules` only after the new application is serving successfully. Verify that browser reads and writes to comments, thread indexes, schedules, private discussion state, and private ballots are denied while public recaps and polls retain their intended access.

## Rollback

If the repaired application fails before the rules cutover, roll Vercel back to the known working deployment; the legacy rules remain compatible. If failure occurs after the proposed rules are published, restore the prior compatible rules first, verify the legacy direct-read path, and only then roll Vercel back. Keep the pre-cutover rules and Vercel deployment identifiers recorded together.

Production index deployment, production migration, Firebase rule publication, and Vercel deployment require separate approval and verification. No production state is changed by local tests or by this branch.
