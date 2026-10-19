// Offline review material only. This script has no Firebase, Vercel or network client.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {acceptanceAccounts,acceptanceGame} from './iphone-fixture.ts';
import {juryEligibility} from '../lib/jury.ts';
import {seasonStandings} from '../lib/league.ts';

const workspace=fileURLToPath(new URL('../',import.meta.url));
const branch=execFileSync('git',['branch','--show-current'],{cwd:workspace,encoding:'utf8'}).trim();
assert.equal(branch,'feature/jury-mode-release-a','Prepare staging from the existing feature branch.');
// The existing preview project has earlier users/data and real compatibility possessions.
// This new dedicated project is proposed only; it has not been created or approved for deployment.
const projectId='fantasy-survivor-jury-staging';
const directory=new URL('../work/jury-staging/review/',import.meta.url);
const game=acceptanceGame();
for(const player of game.players)if(player.uid)player.uid=player.uid.replace(/^iphone-/,'staging-');
assert.deepEqual(game.history,[]);
assert(game.players.every(player=>player.id.startsWith('synthetic-')&&player.email.endsWith('@jury.test')));
assert(game.castaways.every(castaway=>castaway.id.startsWith('synthetic-')));
assert(game.draftPicks.every(pick=>pick.id.startsWith('synthetic-')));
assert(game.scoreEvents.every(event=>event.id.startsWith('synthetic-')));
assert.equal(juryEligibility(game,'synthetic-jury').fromEpisode,5);
assert.equal(juryEligibility(game,'synthetic-active').fromEpisode,null);
const standings=seasonStandings(game);
assert.deepEqual(standings.map(player=>player.score),[17,17,11.5,11.5]);

await mkdir(directory,{recursive:true});
await writeFile(new URL('synthetic-game.review.json',directory),JSON.stringify(game,null,2)+'\n');
await writeFile(new URL('vercel-protection.review.json',directory),JSON.stringify({ssoProtection:{deploymentType:'all'}},null,2)+'\n');
await writeFile(new URL('staging.env.example',directory),[
  '# REVIEW ONLY: the cloud staging guard and phone controls are not implemented yet.',
  '# Configure only the NEW staging Vercel project, Preview environment.',
  '# Never import production environment variables or emulator credentials.',
  'JURY_STAGING=1','NEXT_PUBLIC_JURY_STAGING=1',
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID=${projectId}`,
  'NEXT_PUBLIC_FIREBASE_API_KEY=<preview web app value>',
  `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${projectId}.firebaseapp.com`,
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<preview web app value>',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<preview web app value>',
  'NEXT_PUBLIC_FIREBASE_APP_ID=<preview web app value>',
  'STAGING_COMMISSIONER_UID=staging-commissioner',
  'STAGING_COMMISSIONER_EMAIL=commissioner@jury.test',
  '# Server-only, staging runtime service account; never NEXT_PUBLIC_.',
  'FIREBASE_SERVICE_ACCOUNT_JSON=<staging-only secret>',
  'STAGING_FIXTURE_PASSWORDS_JSON=<server-only synthetic account passwords, if required by fixture runner>',
  '# Leave LOCAL_ACCEPTANCE, NEXT_PUBLIC_LOCAL_ACCEPTANCE and both emulator hosts UNSET.',
  '',
].join('\n'));
const review={
  status:'planning-only-not-deployable',branch,
  sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:workspace,encoding:'utf8'}).trim(),
  intendedFirebaseProject:projectId,remoteProjectCreatedByThisTask:false,globalProjectNameAvailabilityVerified:false,deploymentApprovalGranted:false,
  priorPreviewProject:'fantasy-survivor-preview',priorPreviewDisposition:'Preserve all existing users, documents, Rules, keys and settings.',
  intendedVercelProject:'fantasy-survivor-jury-staging',scope:'donohuejs-1066s-projects',nodeVersion:'22.x',
  remoteActionsPerformed:false,credentialsIncluded:false,
  accounts:acceptanceAccounts.map(role=>({uid:`staging-${role}`,email:`${role}@jury.test`,password:'GENERATE PRIVATELY AFTER APPROVAL'})),
  baselineStandings:standings,eligibleFromEpisode:5,
  scenarios:['open','lock','grading','wrong-merge','merge','postmerge'],
  requiredBeforeDeployment:[
    'Commissioner approval for staging resource changes and protected deployments.',
    'Create the separately approved Spark project; do not reuse or reset the existing preview project.',
    'Strict cloud staging guard, synthetic commissioner authority and password sign-in.',
    'Commissioner-only phone scenario controls, with bounded synthetic reset and real airtime.',
    'Sanitized source payload: remove private league seeds, historical records, production owner and all local secrets.',
    'Inspect upload manifest and complete server/client build output before uploading.',
    'Enable Vercel Authentication for all deployments before first upload.',
    'Use a harmless protected bootstrap for the new Vercel project, then explicitly target Preview.',
  ],
};
await writeFile(new URL('readiness.review.json',directory),JSON.stringify(review,null,2)+'\n');
await writeFile(new URL('provisioning.review.json',directory),JSON.stringify({
  status:'proposed-only-no-remote-actions-authorized',
  firebase:{projectId,displayName:'Fantasy Survivor Jury Staging',plan:'Spark',billingAccount:null,
    webAppName:'jury-staging-web',firestore:{databaseId:'(default)',locationId:'nam5',rules:'Deny every direct document read/write; server APIs verify revocation.'},
    authentication:{emailPassword:true,google:false,anonymous:false,syntheticVerifiedAccounts:acceptanceAccounts.length},
    runtimeServiceAccount:{name:'jury-staging-runtime',roles:['roles/datastore.user','roles/firebaseauth.viewer']},
    provisioningIdentity:'Existing authorized owner; no provisioning credential in runtime.',
  },
  vercel:{projectName:review.intendedVercelProject,scope:review.scope,framework:'nextjs',nodeVersion:'22.x',gitIntegration:false,
    authentication:'All Deployments',shareableBypassLinks:false,publicExceptions:false,applicationTarget:'preview',
    firstDeployment:'Protected static placeholder, no private application data, Firebase configuration or secrets.',
  },
  preservedResources:['fantasy-survivor-preview','fantasy-survivor-9da59','Vercel project fantasy-survivor','Current LAN emulators and fixture'],
  deferredPresentation:'Featured leader and leaderboard should distinguish fantasy and aggregate Jury points without revealing prediction answers; separately authorized enhancement only.',
},null,2)+'\n');
console.log(JSON.stringify({status:review.status,directory:fileURLToPath(directory),baselineStandings:standings.map(({name,score})=>({name,score})),eligibleFromEpisode:5,remoteActionsPerformed:false},null,2));
