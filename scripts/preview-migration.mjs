import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const execFileAsync = promisify(execFile);

const EXPECTED_PROJECT = 'fantasy-survivor-preview';
const EXPECTED_PREVIEW_HOST = 'fantasy-survivor-git-codex-isla-5e978f-donohuejs-1066s-projects.vercel.app';
const ownerEmail = 'donohue.js@gmail.com';

function fail(message) {
  console.error(`Preview migration check stopped: ${message}`);
  process.exitCode = 1;
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? '' : String(process.argv[index + 1] ?? '').trim();
}

async function main() {
  const project = argument('--project');
  const previewUrl = argument('--preview-url').replace(/\/$/, '');
  const serviceAccountPath = argument('--service-account');
  const apiKey = argument('--api-key');
  const action = argument('--action') || 'dry-run';
  if (project !== EXPECTED_PROJECT) return fail(`use --project ${EXPECTED_PROJECT}; no other project is allowed`);
  if (!previewUrl) return fail('provide --preview-url for the Preview deployment');
  let url;
  try { url = new URL(previewUrl); } catch { return fail('provide a valid Preview URL'); }
  if (url.hostname !== EXPECTED_PREVIEW_HOST) return fail(`the URL must be the isolated Preview host ${EXPECTED_PREVIEW_HOST}`);
  if (!serviceAccountPath) return fail('provide --service-account with the downloaded preview JSON file');
  if (!apiKey) return fail('provide --api-key from the Preview Firebase web config');
  if (!['status', 'dry-run', 'migrate'].includes(action)) return fail('use --action status, dry-run, or migrate');
  if (action === 'migrate' && process.env.PREVIEW_MIGRATION_CONFIRM !== 'I_UNDERSTAND_THIS_IS_TEST') return fail('set PREVIEW_MIGRATION_CONFIRM=I_UNDERSTAND_THIS_IS_TEST before a test migration write');

  let service;
  try { service = JSON.parse(await readFile(serviceAccountPath, 'utf8')); }
  catch (error) { return fail(`could not read the service-account JSON (${error instanceof Error ? error.message : 'unknown error'})`); }
  if (service.project_id !== EXPECTED_PROJECT) return fail('the service-account project_id does not match the preview project');
  if (!service.client_email || !service.private_key) return fail('the service-account JSON is missing required fields');

  const app = getApps().find(item => item.name === 'preview-migration') ?? initializeApp({ credential: cert(service), projectId: EXPECTED_PROJECT }, 'preview-migration');
  const auth = getAuth(app);
  const owner = await auth.getUserByEmail(ownerEmail);
  const customToken = await auth.createCustomToken(owner.uid);
  const exchange = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const exchanged = await exchange.json();
  if (!exchange.ok || typeof exchanged.idToken !== 'string') return fail(`Firebase token exchange failed (${exchanged.error?.message ?? exchange.status})`);

  const endpoint = action === 'status' ? `${previewUrl}/api/discussions?view=migration&episodeId=51-3` : `${previewUrl}/api/discussions`;
  const body = JSON.stringify({ action: 'migrate', episodeId: '51-3', dryRun: action === 'dry-run' });
  const args = ['curl', '--url', endpoint, '-H', `Authorization: Bearer ${exchanged.idToken}`];
  if (action !== 'status') args.push('-X', 'POST', '-H', 'Content-Type: application/json', '-d', body);
  let stdout;
  try {
    const executable = process.platform === 'win32' ? 'cmd.exe' : 'vercel';
    const commandArgs = process.platform === 'win32' ? ['/d', '/s', '/c', 'vercel.cmd', ...args] : args;
    ({ stdout } = await execFileAsync(executable, commandArgs, { maxBuffer: 1024 * 1024 }));
  } catch (error) {
    const detail = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr).trim() : '';
    const message = error instanceof Error ? error.message : 'Vercel CLI request failed';
    return fail(`${detail || message}. Make sure the Vercel CLI is installed and logged in.`);
  }
  let result;
  try {
    const lines = stdout.split(/\r?\n/);
    const jsonLine = lines.findIndex(line => line.trim().startsWith('{'));
    result = JSON.parse((jsonLine >= 0 ? lines.slice(jsonLine).join('\n') : stdout).trim());
  }
  catch { return fail(`Vercel returned a non-JSON response: ${stdout.trim().slice(0, 240)}`); }
  console.log(JSON.stringify({ action, result }, null, 2));
}

main().catch(error => fail(error instanceof Error ? error.message : 'unexpected migration check failure'));
