# Release A — isolated iPhone acceptance environment

Recovery note: [Application-only recovery and response correction](jury-mode-release-a-acceptance-recovery.md) documents the later Windows development-file lock and discussion-request fix. If the app fails while the emulator fixture must be preserved, use `restart-app` below; do not use `stop`/`start` or reset the fixture.

Prepared October 16, 2026. **Ready for Safari testing; PWA requires additional setup.** Windows Chrome verified the actual Wi-Fi URL with synthetic accounts. Physical iPhone/Safari acceptance has not occurred. Do not use the live website for these tests.

Branch: `feature/jury-mode-release-a`. HEAD: `5e782a95e267be29eb8c918a83eb323f3f00e05a`. The implementation, seven audit fixes and security remediation remain uncommitted. Their reports were reviewed; no previous iPhone environment was found. Existing demo credentials, Java runtime, emulator configuration, proposed Rules and browser tools were reused.

## Start and connect

Use PowerShell in the repository directory. The environment may already be running; check first:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\iphone-acceptance.ps1 status
```

If stopped:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\iphone-acceptance.ps1 start
```

Keep the startup terminal open and the computer awake. Startup prepares the fixed demo environment, loads the open fixture, precompiles the relevant routes, and prints the private test URL and temporary password. Allow roughly a minute for a cold start. Use a second PowerShell terminal for status/reset/stop commands.

Connect the iPhone to the same **trusted home Wi-Fi** as this computer. Open the complete printed URL in Safari. The verified address for this session is `192.168.1.96`, port **3108**. The URL includes a private access key; `http://192.168.1.96:3108/` alone deliberately returns 401 until the key sets the test cookie. The current complete URL/password are in ignored `work/iphone-acceptance/connection.txt`; `status` prints them. They rotate on restart. Use only the printed temporary password, never a real account password.

Choose **Synthetic Jury player** and enter the temporary password. Normal “Sign in with Google” buttons in this guarded local mode open `/acceptance`, the same test sign-in screen. Sign out using the normal application button; reopen `/acceptance` to choose another synthetic identity.

| Selector | Account | Access |
| --- | --- | --- |
| Synthetic Jury player | `jury@jury.test` | Active UID-linked profile, eligible from Episode 5 |
| Synthetic active player | `active@jury.test` | Active UID-linked profile with surviving picks; no Jury entry |
| Synthetic commissioner | `commissioner@jury.test` | Commissioner APIs and grading |
| Synthetic legacy-email player | `legacy@jury.test` | Active profile linked by the supported email association |
| Synthetic unlinked account | `unlinked@jury.test` | Verified account, no league access |

The grading fixtures also contain a second eligible **Synthetic Clean Sweep Player**, with an emulator account `complete@jury.test`. Its predictions are prepared through authenticated APIs for the commissioner to review. You can independently complete all five questions as the main Jury player in the open fixture.

Sign-in uses `signInWithEmailAndPassword`, real emulator-issued verified Firebase tokens, SDK persistence, normal registration, revocation checks, active-profile membership and server commissioner checks. No browser user/token is injected. Real Google OAuth/account-picker behavior remains untested; email/password is a test-only provider, not a production authentication change.

## Reset/select a scenario

Close other test tabs or finish pending saves before a reset. Reset intentionally deletes **only the synthetic demo league**, including its prior scores, predictions and audit records, then creates a fresh independent fixture. Reload the phone afterward and sign in again if requested. Never run other emulator rehearsals concurrently against this environment.

```powershell
# A–D, H: empty questionnaires, deadline 24 hours after reset
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\iphone-acceptance.ps1 reset -Scenario open

# E: three answers already saved; actual deadline 180 seconds after reset
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\iphone-acceptance.ps1 reset -Scenario lock -Seconds 180

# F–G: prepared partial and complete answers, locked by the real server clock
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\iphone-acceptance.ps1 reset -Scenario grading

# D: wrong Merge guess with independently correct castaway answers
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\iphone-acceptance.ps1 reset -Scenario wrong-merge

# D: correct Merge, still pre-merge Q1 weighting
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\iphone-acceptance.ps1 reset -Scenario merge

# D: separate Episode 6 snapshot, after an actual Episode 5 merge
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\iphone-acceptance.ps1 reset -Scenario postmerge
```

`grading`, `wrong-merge` and `merge` take about 20 seconds: they create a future immutable snapshot, approve activation, save predictions through the real APIs before airtime, and wait for that real deadline. They do not rewrite a snapshot or change system clocks. `lock` returns immediately after preparation; `status` displays its canonical UTC airtime, also displayed in New York time on the questionnaire. The minimum supported lock duration is 15 seconds. Open/postmerge fixtures expire after 24 hours; reset if necessary.

## Commissioner test order

1. **H — signed out.** After opening the private gateway URL, visit `/rules` and `/castaways`. Expect public rules and all 21 original castaways, with no eliminations/ownership/current tribes/points. Open `/`, `/draft`, `/episodes`, `/history`, `/chatter` and `/jury` directly: expect the sign-in gate. The private LAN access key grants entry to the test server only; it does not grant league membership.
2. **A — eligibility/navigation.** Reset `open`, sign in as Jury player, and find **Jury Mode** in the normal navigation. Open Episode 5. Expect five questions. Its three original slots are Cinder/Echo/Echo: Cinder quit in Episode 3, Echo was voted out in Episode 4. Both names and all league profiles are invented. Active/legacy players have Dusk/Fern/Gale, including a 1.25× third slot; they cannot submit Jury answers. The unlinked account cannot see league information.
3. **B — partial autosave.** As Jury player, choose Q1 **Synthetic Amber**, Q2 **Nothing**, Q5 **Synthetic Dusk**. Wait for each Saved confirmation. Leave Q3/Q4 blank. Navigate to Rules and back, refresh, close Safari, reopen, and return. Expect exactly three saved answers, with Q3/Q4 still unanswered. There is no final Submit action.
4. **C — edits.** Before airtime, change Q2 to Idol, wait for Saved, refresh, and verify Idol remains selected. Try another tab or slow/interrupted Wi-Fi. Confirm newer saved answers remain visible and stale conflicts/errors require refresh/retry. Device time changes must never grant permission to save late.
5. **D — options and phase.** In `open`, Amber limits Q4/Q5 to Dusk/Fern; Merge permits Dusk/Fern/Gale/Halo. If switching from Merge back to a tribe with an out-of-tribe saved answer, first change that castaway answer to Nobody, as the existing application instructs. In `wrong-merge`, preview grading as commissioner: partial = **6**, complete = **8**; Q4 still earns 1 and Q5 earns 5 despite wrong Merge. In `merge`, preview partial = **7**, Clean Sweep = **11**, with Merge worth 1. In `postmerge`, Episode 6 Q1 asks individual immunity for **+3**. Merge/postmerge outcomes include the required standard council and vote records; supplied Jury tallies do not replace them.
6. **E — airtime.** Reset `lock`, then immediately sign in as Jury player. Q1/Q2/Q5 are already saved. Edit one before the printed deadline, then wait until after it (the display may take its 15-second refresh interval). Try editing a saved answer and answering Q3. Expect denial/disabled controls and three answers retained. Refresh/reopen: still locked. For an offline attempt, disconnect Wi-Fi, attempt a change, wait past airtime, reconnect, then Retry: the server must reject it. Do not reset this fixture during the boundary test.
7. **F — grading.** Reset `grading`, sign in as commissioner, then **Game master → Scoring → Jury Mode**. Review the immutable Episode 5 snapshot, private predictions and evidence: Amber council; Dusk 4 counted votes, Fern 1; Dusk voted out; no item plays. Preview all five answers, check the confirmation checkbox, and apply grading. Expect **7** for the three-answer player and **11**, including exactly +2 Clean Sweep, for the complete player. Both start with **17** ordinary points, so standings become **24** and **28**. Jury awards are direct player points and receive no 1.25× multiplier.
8. **G — correction.** On that same graded fixture, add an unsuccessful idol play for the synthetic council and record a correction reason, then save verified evidence. Preview/confirm again. Expected Jury awards fall from **7 → 6** and **11 → 8** (the latter loses Q2 and Clean Sweep). Standings become **23** and **25**. There must still be exactly one aggregate Jury award per player/episode; the five ordinary seed score events stay unchanged. Generic scoring Edit/Undo must direct Jury corrections back to Jury grading.
9. **Existing workflows.** On a fresh `open` fixture, use commissioner controls to start Episode 5, award an ordinary score, finish it and author/publish a synthetic recap without grading Jury. Check draft ownership, the existing synthetic Episode 4 recap, comments and the synthetic poll as a player. Test normal navigation/scrolling and no horizontal overflow. These are synthetic writes only; reset afterward.
10. **H — privacy/account switching.** Sign out from Jury, use browser Back, and verify answers are gone. Sign in as active/legacy player; prior Jury answers must not appear. Open Game master: ordinary players must be denied. As commissioner, private submissions are visible; as Jury player, only that player's submission is visible.
11. **I — PWA deferred.** Do not mark installed-PWA acceptance complete from this HTTP setup or Chrome screenshots. Record the iPhone results separately, including iOS version, Safari behavior and any failures. Clear synthetic browser data after testing if desired.

## Network, HTTPS and PWA limits

The current gateway URL was reached successfully from Windows Chrome through the **Wi-Fi IP**, not localhost. This does not prove reachability from a second device. Windows reports the Wi-Fi profile as **Public**. Existing inbound Node.js rules cover the running `C:\Program Files\nodejs\node.exe`; no firewall rules or profile settings were changed. If the phone cannot connect, first check same Wi-Fi, guest-network/client isolation, VPN, computer sleep and address changes. `ipconfig` shows the Wi-Fi IPv4 address. Startup discovers a single private physical-adapter IPv4 address; if ambiguous, use `start -Address <verified-Wi-Fi-IP>`. A changed address requires restart and the newly printed URL.

Do not disable the firewall. If an additional rule proves necessary, stop and obtain approval for a narrow inbound TCP 3108 rule scoped to the trusted home subnet/device; do not open emulator ports or all Public networks.

HTTP supports this limited synthetic Safari rehearsal; Windows verified Firebase persistence and autosaving on an insecure LAN origin. `crypto.randomUUID` requires a secure context, so client request IDs now have a UUID-v4 fallback using `crypto.getRandomValues`, with no gameplay/authentication changes. The HTTP traffic is unencrypted: use a trusted LAN and only the temporary synthetic credentials. Do not enter real Google credentials into the test form.

For a genuine secure-context Home Screen rehearsal, additional work/user actions are required: a local HTTPS reverse proxy at the same private origin; a certificate with the actual IP/hostname in its SAN; secure storage of its private key on Windows; explicit installation and full trust of the issuing test CA on the iPhone; and confirmation of `window.isSecureContext`, same-origin Auth proxying and standalone-mode persistence. Any trust installation is a manual commissioner action. This task created/installed **no TLS certificates** and changed **no iPhone trust settings**. Simply bypassing a Safari certificate warning does not establish those prerequisites. The existing app has a manifest and icons but no service worker; offline behavior is not promised.

The [Firebase Auth emulator documentation](https://firebase.google.com/docs/emulator-suite/connect_auth) describes SDK connection and emulator-only tokens. [Secure-context requirements](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts) explain the HTTP/PWA limitation. [Apple's web application guidance](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html) describes Home Screen standalone configuration. Real Safari/Home Screen behavior remains a physical-device test.

A private remote alternative would need nonproduction app hosting, isolated Auth/database services, nonproduction secrets, access restrictions and possibly paid hosting. Never expose raw emulators through a public tunnel. LAN Safari testing works on Windows, so no remote alternative was created or needed. Any tunnel, remote staging, persistent firewall change or certificate trust installation requires separate approval.

## Services, isolation and controls

| Service | Binding | Phone exposure |
| --- | --- | --- |
| Acceptance HTTP gateway | Verified Wi-Fi IPv4, TCP 3108 | Private access-key cookie required; expected Host/Origin checks |
| Next.js webpack dev | `127.0.0.1:3106` | Gateway only; authenticated development HMR forwarded for hydration |
| Firebase Auth emulator | `127.0.0.1:9098` | Only password sign-in, own-account lookup and token refresh via narrow same-origin proxy |
| Firestore emulator | `127.0.0.1:8085` | No database proxy; direct Rules deny every browser read/write |
| Supervisor controls | `127.0.0.1:3110` | No gateway route; separate ignored control key |
| Emulator hub/logging/Firestore websocket | Loopback 4405/4505/9150 | No gateway route; emulator UI disabled |

The fixed project is **`demo-fantasy-scoring`**. Launcher, fixture reset and server guard require that project, both exact loopback emulator hosts and a known synthetic service-account identity. Inherited cloud credential selectors are removed; the generated demo credential is passed only to server processes. Public Firebase configuration is dummy/demo-only. Misconfigured acceptance mode throws instead of falling back to production. Runtime fixture data includes no real league profiles, history, picks, scores or recaps. Authenticated league reads omit the real historical compatibility seeds in this guarded mode. Original castaway profiles/public rules remain available as required.

The commissioner email override exists only when the full server guard succeeds, outside production. A client flag or request body cannot grant that authority. Production owner verification and all revocation checks remain in place. Direct Firestore Rules were not relaxed or published.

```powershell
# Rehearse automatically on Windows; this resets every fixture and ends at fresh open
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\iphone-acceptance.ps1 verify

# Stop the supervisor and its exact child process trees
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\iphone-acceptance.ps1 stop
```

For an application failure with valuable in-memory test data, use an application-only restart instead:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\iphone-acceptance.ps1 restart-app
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\iphone-acceptance.ps1 status
```

This preserves the existing gateway, Auth/Firestore processes, test accounts, private URL/password and grading records. It verifies the Next process ancestry before stopping only that application tree. The replacement app monitor exits when the original supervisor stops. `status` now checks expected HTTP statuses, including actual page success and anonymous API denial; HTTP 500 is a failure, even if a process is listening.

Ctrl+C in the startup terminal also stops the environment. The stop command was verified to close its listeners. Ignored logs/evidence are in `work/iphone-acceptance/`: `next.log`, `emulators.log`, `scenario.json`, `verification.json`, screenshots, `unit-tests.txt` and `production-check.json`. `settings.json`/`connection.txt` contain temporary synthetic access information; keep them local. No permanent secret or private key was placed in client assets or a committed file.

## Verification and preservation

- Full unit command `node --experimental-strip-types --test tests/*.test.ts`: **347 passed, 0 failed**, including four new isolation/fixture/HTTP UUID tests. A focused Release A/scoring/registration run also passed **118** tests.
- `npm run lint` and `npx tsc --noEmit`: passed.
- `npm run build`: passed after retrying with permission to clean generated build output. It is a local build, not deployment.
- Focused LAN browser/emulator rehearsal: **16 passed, 0 failed**. Real sign-in, three-answer saves, edits/navigation/reload/persistence, filtering, UID/legacy/unlinked/noneligible access, logout/account switching, real airtime rejection, actual commissioner grading UI, downward correction, Merge fixtures, postmerge Q1, revoked-token API **401** and direct Firestore GET/PATCH **403**, protected client assets and blocked emulator administration. Evidence is recorded in `verification.json`.
- Separate normal production preview: guarded test sign-in does not render and carries Next's not-found marker; Next streamed it with HTTP 200, so the check verifies content rather than assuming status 404. Anonymous league/registration APIs return 401; public rules/cast return 200. All **27** public build text assets were anonymously downloaded and checked for historical-score/owner/private-key markers; no browser source maps were present. That preview server was stopped.
- Intermediate checks caught missing authenticated HMR forwarding (hydration stalled), first-load dev reload races (routes are now precompiled), missing postmerge standard outcomes (fixture corrected), and a test expecting non-streamed 404. These were setup/harness issues; no gameplay validation was weakened. Sandbox cleanup/network restrictions required local tool escalation, with no persistent system changes.
- No physical iPhone, Safari, real Google OAuth or installed-PWA testing is claimed. No full security/API/correction audit was repeated; the historical 132/14/26/33 report counts remain historical evidence.
- No production read or write occurred. Existing real identities, picks, recaps and all 241 original live score events were untouched. Core scoring/Jury/league/ledger source preservation is checked against prior review hashes; the seven fixes remain covered by the suite. No Rules publication, migration, activation, commit, push, PR, merge or deployment occurred. Release B was not implemented.

## Files changed for this setup

- Added: `app/acceptance/page.tsx`, `app/acceptance/login.tsx`, `lib/acceptance-environment.ts`, `lib/request-id.ts`, `scripts/iphone-acceptance.ps1`, `scripts/iphone-acceptance.mjs`, `scripts/iphone-fixture.ts`, `scripts/iphone-seed.ts`, `scripts/verify-iphone-acceptance.mjs`, `tests/iphone-acceptance.test.ts`, this guide.
- Guarded local mode: `lib/firebase.ts`, `lib/firebase-admin.ts`, `lib/community-authority.ts`, `app/api/league/route.ts`, `app/game-provider.tsx`, `app/league-gate.tsx`, `next.config.ts`.
- Mechanical secure-random request-ID calls only: `app/admin/jury-manager.tsx`, `app/admin/recap-manager.tsx`, `app/admin/score-editor.tsx`, `app/admin/scoring-manager.tsx`, `app/admin/tribal-council-manager.tsx`, `app/discussion-content.tsx`, `app/jury/page.tsx`, plus provider calls listed above.
- Ignored generated fixtures/settings/logs/screenshots are under `work/iphone-acceptance/`; Next also regenerates its ignored `next-env.d.ts`. No dependencies were added and no existing environment file was overwritten.

The final handoff states whether the acceptance supervisor is still running and supplies that session's exact URL/password. Stop after physical acceptance; this preparation does not authorize release preparation or production changes.
