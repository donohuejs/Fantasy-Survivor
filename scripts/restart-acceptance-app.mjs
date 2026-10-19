// Restart only Next.js, preserving the running gateway, emulators, keys and fixture.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,createWriteStream} from 'node:fs';
import {execFileSync,spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {localAcceptance} from '../lib/acceptance-environment.ts';
import {checkAcceptanceHealth} from './acceptance-health.mjs';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
const dir='work/iphone-acceptance',settings=JSON.parse(readFileSync(dir+'/settings.json','utf8')),service=JSON.parse(readFileSync('work/firebase-rehearsal/server-service-account.json','utf8'));assert.equal(settings.project,'demo-fantasy-scoring');
const env={...process.env,NODE_ENV:'development',LOCAL_ACCEPTANCE:'1',NEXT_PUBLIC_LOCAL_ACCEPTANCE:'1',LOCAL_ACCEPTANCE_HOST:settings.host,NEXT_PUBLIC_FIREBASE_PROJECT_ID:settings.project,NEXT_PUBLIC_FIREBASE_API_KEY:'demo-api-key',NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:settings.project+'.firebaseapp.com',NEXT_PUBLIC_FIREBASE_APP_ID:'demo-app-id',NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:'',NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:'',GCLOUD_PROJECT:settings.project,GOOGLE_CLOUD_PROJECT:settings.project,FIRESTORE_EMULATOR_HOST:'127.0.0.1:8085',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9098',FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify(service)};delete env.GOOGLE_APPLICATION_CREDENTIALS;delete env.FIREBASE_CONFIG;assert(localAcceptance(env));
async function supervisor(){const r=await fetch('http://127.0.0.1:3110/status',{method:'POST',headers:{Authorization:'Bearer '+settings.controlKey},signal:AbortSignal.timeout(2000)});assert.equal(r.status,200);const status=await r.json();assert.equal(status.project,settings.project);assert.equal(status.host,settings.host);}
await supervisor();
// Enumerate only the owner of the fixed Next port and its ancestors. Never stop unrelated Node apps.
const ps=String.raw`$ErrorActionPreference='Stop'; $c=Get-NetTCPConnection -State Listen -LocalPort 3106; if(@($c).Count -ne 1){throw 'Expected one Next listener'}; $id=$c.OwningProcess; $rows=@(); for($i=0;$i -lt 8 -and $id;$i++){ $p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$id); if(!$p){break}; $rows+= [pscustomobject]@{pid=$p.ProcessId;parent=$p.ParentProcessId;command=$p.CommandLine;executable=$p.ExecutablePath}; $id=$p.ParentProcessId }; ConvertTo-Json -InputObject $rows -Compress`;
const chain=JSON.parse(execFileSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-Command',ps],{encoding:'utf8',windowsHide:true}));
let owner=settings.pid;if(readFileSafe(dir+'/app-recovery.json')){const prior=JSON.parse(readFileSafe(dir+'/app-recovery.json'));if(chain.some(p=>p.pid===prior.helperPid))owner=prior.helperPid;}
const target=chain.find(p=>p.parent===owner&&/node_modules[\\/]next[\\/]dist[\\/]bin[\\/]next.*dev.*3106/.test(p.command));assert(target&&chain.some(p=>p.pid===owner),'Refusing to stop an unrecognized application process');assert.equal(target.executable.toLowerCase(),process.execPath.toLowerCase());
execFileSync('C:/Windows/System32/taskkill.exe',['/PID',String(target.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
console.log('Stopped only Next.js process tree '+target.pid+'. Gateway and emulators remain running.');
const output=createWriteStream(dir+'/next.log',{flags:'a'});output.write('\n--- Controlled application-only restart '+new Date().toISOString()+' ---\n');
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','-p','3106'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.pipe(output);child.stderr.pipe(output);
const recovery={helperPid:process.pid,nextPid:child.pid,supervisorPid:settings.pid,restartedAt:new Date().toISOString()};
writeFileSync(dir+'/app-recovery.json',JSON.stringify({...recovery,phase:'starting'},null,2));
let stopping=false;function stop(){if(stopping)return;stopping=true;clearInterval(watch);if(child.pid&&child.exitCode===null)spawn('C:/Windows/System32/taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});setTimeout(()=>process.exit(0),1200);}
const watch=setInterval(()=>supervisor().catch(stop),2000);process.on('SIGINT',stop);process.on('SIGTERM',stop);child.on('error',e=>{console.error(e.message);stop();});
const deadline=Date.now()+120000;let ready=false;while(Date.now()<deadline&&child.exitCode===null){try{await checkAcceptanceHealth();ready=true;break;}catch{}await new Promise(r=>setTimeout(r,500));}
if(!ready){writeFileSync(dir+'/app-recovery.json',JSON.stringify({...recovery,phase:'failed'},null,2));console.error('Application did not become healthy; inspect next.log. No fixture reset was performed.');stop();}else {writeFileSync(dir+'/app-recovery.json',JSON.stringify({...recovery,phase:'ready'},null,2));console.log('Application healthy. Existing private URL, credentials and emulator data preserved.');}
function readFileSafe(path){try{return readFileSync(path,'utf8');}catch{return '';}}
