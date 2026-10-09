import { readFile } from 'node:fs/promises';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const EXPECTED_PROJECT = 'fantasy-survivor-preview';
const CONFIRMATION = 'I_UNDERSTAND_THIS_IS_TEST';
const ownerEmail = 'donohue.js@gmail.com';

function fail(message) {
  console.error(`Preview seed stopped: ${message}`);
  process.exitCode = 1;
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? '' : String(process.argv[index + 1] ?? '').trim();
}

function isoDaysFrom(now, days) {
  return new Date(now.getTime() + days * 86400000).toISOString();
}

function datePart(iso) {
  return iso.slice(0, 10);
}

function previewGame(memberEmail) {
  return {
    season: {
      id: 'season-51',
      name: 'Survivor 51 Preview',
      number: 51,
      currentEpisode: 3,
      episodeStarted: false,
      episodeStatus: 'not-started',
      entryFee: 10,
      eliminationScoringEffectiveEpisode: 4,
    },
    players: [{
      id: 'player-preview-member',
      name: 'Preview Member',
      email: memberEmail,
      entryBonus: 0,
      priorFinish: 1,
      draftSlot: 1,
      active: true,
    }],
    castaways: [],
    draftPicks: [],
    scoreEvents: [],
    possessions: [],
    tribalCouncilResolutions: [],
    tribalCouncils: [],
    tribalAttendance: [],
    tribalVotes: [],
    history: [],
    tribes: [],
    categories: [],
    draft: { status: 'setup', currentPick: 0, turns: [] },
    draftOrderVersion: 2,
  };
}

function episode({ id, episode, now, opensAt, broadcastDate, status, title, body, discussionSchemaVersion }) {
  return {
    id,
    season: 51,
    episode,
    status,
    title,
    body,
    actions: [],
    createdAt: now,
    updatedAt: now,
    publishedAt: status === 'published' ? now : '',
    discussionOpensAt: opensAt,
    broadcastDate,
    discussionVersion: `preview-${id}`,
    ...(discussionSchemaVersion === undefined ? {} : { discussionSchemaVersion }),
  };
}

async function seed() {
  const project = argument('--project');
  const serviceAccountPath = argument('--service-account');
  const memberEmail = argument('--member-email').toLowerCase();
  if (project !== EXPECTED_PROJECT) return fail(`use --project ${EXPECTED_PROJECT}; no other project is allowed`);
  if (process.env.PREVIEW_SEED_CONFIRM !== CONFIRMATION) return fail(`set PREVIEW_SEED_CONFIRM=${CONFIRMATION} for this test-only write`);
  if (!serviceAccountPath) return fail('provide --service-account with the downloaded preview JSON file');
  if (!memberEmail || !memberEmail.includes('@')) return fail('provide --member-email for the second Google test account');
  if (memberEmail === ownerEmail) return fail('the member test account must be different from the owner account');

  let service;
  try {
    service = JSON.parse(await readFile(serviceAccountPath, 'utf8'));
  } catch (error) {
    return fail(`could not read the service-account JSON (${error instanceof Error ? error.message : 'unknown error'})`);
  }
  if (service.project_id !== EXPECTED_PROJECT) return fail('the service-account project_id does not match the preview project');
  if (!service.client_email || !service.private_key) return fail('the service-account JSON is missing required fields');

  const app = getApps().find(item => item.name === 'preview-seed') ?? initializeApp({
    credential: cert(service),
    projectId: EXPECTED_PROJECT,
  }, 'preview-seed');
  const db = getFirestore(app);
  const root = db.doc('games/survivor-51');
  const marker = root.collection('previewSeed').doc('metadata');
  const [existingRoot, existingMarker] = await Promise.all([root.get(), marker.get()]);
  if (existingRoot.exists && !existingMarker.exists) return fail('games/survivor-51 already exists without this seed marker; refusing to overwrite it');

  const nowDate = new Date();
  const now = nowDate.toISOString();
  const past = isoDaysFrom(nowDate, -14);
  const future = isoDaysFrom(nowDate, 14);
  const game = existingRoot.exists ? existingRoot.data() : previewGame(memberEmail);
  const players = Array.isArray(game?.players) ? [...game.players] : [];
  const memberIndex = players.findIndex(player => player?.id === 'player-preview-member');
  const member = previewGame(memberEmail).players[0];
  if (memberIndex < 0) players.push(member);
  else players[memberIndex] = { ...players[memberIndex], ...member };

  await root.set({ ...game, players, season: { ...(game?.season ?? previewGame(memberEmail).season), currentEpisode: 3, number: 51 } }, { merge: true });
  const episode3 = episode({ id: '51-3', episode: 3, now: past, opensAt: past, broadcastDate: datePart(past), status: 'published', title: 'Synthetic Episode 3', body: 'A fictional recap used only for Preview verification.' });
  const episode4 = episode({ id: '51-4', episode: 4, now, opensAt: now, broadcastDate: datePart(now), status: 'draft', title: 'Episode 4 pending recap', body: '', discussionSchemaVersion: 2 });
  const episode5 = episode({ id: '51-5', episode: 5, now, opensAt: future, broadcastDate: datePart(future), status: 'draft', title: 'Future scheduled episode', body: '', discussionSchemaVersion: 2 });
  const episodeRefs = [root.collection('episodes').doc('51-3'), root.collection('episodes').doc('51-4'), root.collection('episodes').doc('51-5')];
  await Promise.all([episodeRefs[0].set(episode3, { merge: true }), episodeRefs[1].set(episode4, { merge: true }), episodeRefs[2].set(episode5, { merge: true })]);
  await root.collection('discussionSchedules').doc('51').set({
    season: 51,
    weekday: nowDate.getUTCDay(),
    localTime: '18:00',
    timeZone: 'America/New_York',
    startDate: datePart(past),
    firstEpisode: 3,
    episodeCount: 3,
    skippedDates: [],
    overrides: [],
    updatedAt: now,
  }, { merge: true });

  const comments = [
    { id: 'preview-comment-root', authorId: 'player-preview-member', authorName: 'Preview Member', text: 'Synthetic legacy parent comment for Episode 3.', createdAt: isoDaysFrom(nowDate, -13), parentId: null },
    { id: 'preview-comment-reply', authorId: 'commissioner', authorName: 'Game master', text: 'Synthetic reply to verify threaded migration.', createdAt: isoDaysFrom(nowDate, -12), parentId: 'preview-comment-root' },
    { id: 'preview-comment-second-root', authorId: 'commissioner', authorName: 'Game master', text: 'A second fictional parent conversation.', createdAt: isoDaysFrom(nowDate, -11), parentId: null },
  ];
  const commentCollection = episodeRefs[0].collection('comments');
  for (const comment of comments) {
    const ref = commentCollection.doc(comment.id);
    if (!(await ref.get()).exists) await ref.create(comment);
  }
  await marker.set({ schemaVersion: 1, projectId: EXPECTED_PROJECT, memberEmail, seededAt: now }, { merge: true });
  console.log(`Preview seed complete for ${EXPECTED_PROJECT}.`);
  console.log('Created games/survivor-51, Episodes 51-3/4/5, schedule 51, and three legacy Episode 3 comments.');
  console.log('Episode 51-3 remains un-migrated so the owner-only dry run can be verified next.');
}

seed().catch(error => {
  fail(error instanceof Error ? error.message : 'unexpected seed failure');
});
