// Local supervisor and private LAN gateway. No cloud, certificate or firewall operations.
import {spawn} from 'node:child_process';
import {createServer,request as httpRequest} from 'node:http';
import {connect} from 'node:net';
import {networkInterfaces} from 'node:os';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync,createWriteStream,copyFileSync,readdirSync,openSync,closeSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {localAcceptance} from '../lib/acceptance-environment.ts';
import {checkAcceptanceHealth} from './acceptance-health.mjs';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
const dir='work/iphone-acceptance',stateFile=dir+'/settings.json',action=process.argv[2]??'status';
const project='demo-fantasy-scoring',children=[];
function privateIP(ip){return /^192\.168\.\d+\.\d+$/.test(ip)||/^10\.\d+\.\d+\.\d+$/.test(ip)||/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(ip);}
function lanAddress(){const candidates=Object.entries(networkInterfaces()).filter(([name])=>!/(wsl|vethernet|virtual|vpn)/i.test(name)).flatMap(([,list])=>list.filter(n=>n.family==='IPv4'&&!n.internal&&privateIP(n.address)).map(n=>n.address));if(candidates.length!==1)throw Error('Specify trusted Wi-Fi IPv4 address with -Address; candidates: '+candidates.join(', '));return candidates[0];}
function envFor(settings){const service=JSON.parse(readFileSync('work/firebase-rehearsal/server-service-account.json','utf8'));if(service.project_id!==project||!['emulator@'+project+'.iam.gserviceaccount.com','synthetic-server@'+project+'.iam.gserviceaccount.com'].includes(service.client_email))throw Error('Refusing non-synthetic credential.');const env={...process.env,NODE_ENV:'development',LOCAL_ACCEPTANCE:'1',NEXT_PUBLIC_LOCAL_ACCEPTANCE:'1',LOCAL_ACCEPTANCE_HOST:settings.host,NEXT_PUBLIC_FIREBASE_PROJECT_ID:project,GCLOUD_PROJECT:project,GOOGLE_CLOUD_PROJECT:project,FIRESTORE_EMULATOR_HOST:'127.0.0.1:8085',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9098',NEXT_PUBLIC_FIREBASE_API_KEY:'demo-api-key',NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:project+'.firebaseapp.com',NEXT_PUBLIC_FIREBASE_APP_ID:'demo-app-id',NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:'',NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:'',FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify(service)};delete env.GOOGLE_APPLICATION_CREDENTIALS;delete env.FIREBASE_CONFIG;localAcceptance(env);return env;}
function launch(executable,args,env,name){const output=createWriteStream(`${dir}/${name}.log`,{flags:'a'});const child=spawn(executable,args,{env,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.pipe(output);child.stderr.pipe(output);children.push(child);child.on('error',e=>console.error(name+': '+e.message));return child;}
async function waitFor(url,timeout=120000){const start=Date.now();while(Date.now()-start<timeout){try{await fetch(url,{signal:AbortSignal.timeout(1500)});return;}catch{}await new Promise(r=>setTimeout(r,500));}throw Error('Service did not start: '+url);}
async function seed(settings,scenario='open',seconds){const child=spawn(process.execPath,['--experimental-strip-types','scripts/iphone-seed.ts',scenario,...(seconds?[seconds]:[])],{env:envFor(settings),windowsHide:true,stdio:'inherit'});await new Promise((ok,no)=>{child.on('error',no);child.on('exit',code=>code===0?ok():no(Error('Fixture reset failed: '+code)));});}
const equal=(a,b)=>Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const authPaths=new Set(['/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword','/identitytoolkit.googleapis.com/v1/accounts:lookup','/securetoken.googleapis.com/v1/token']);
function gateway(settings){return createServer((req,res)=>{
  const host=settings.host+':3108',url=new URL(req.url??'/',`http://${host}`);
  const reply=(status,body)=>{res.writeHead(status,{'Content-Type':'text/plain','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end(body);};
  if(req.headers.host!==host)return reply(403,'Unexpected test hostname.');
  const remote=req.socket.remoteAddress??'';if(!privateIP(remote)&&remote!=='127.0.0.1')return reply(403,'Private LAN only.');
  if(req.headers.origin&&req.headers.origin!==`http://${host}`)return reply(403,'Cross-origin request denied.');
  if(url.pathname==='/__acceptance/start'&&req.method==='GET'){
    if(!equal(url.searchParams.get('key')??'',settings.accessKey))return reply(401,'Use the private test URL from Windows.');
    res.writeHead(303,{'Location':'/acceptance','Set-Cookie':`juryAcceptance=${settings.accessKey}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});return res.end();
  }
  const cookie=(req.headers.cookie??'').split(';').map(v=>v.trim()).find(v=>v.startsWith('juryAcceptance='))?.slice(15)??'';
  if(!equal(cookie,settings.accessKey))return reply(401,'Use the private test URL from Windows.');
  const isAuth=url.pathname.startsWith('/identitytoolkit.googleapis.com/')||url.pathname.startsWith('/securetoken.googleapis.com/');
  if(isAuth&&(!authPaths.has(url.pathname)||req.method!=='POST'||url.searchParams.get('key')!=='demo-api-key'))return reply(403,'Auth emulator operation denied.');
  if(url.pathname.startsWith('/emulator')||url.pathname.startsWith('/v1/')||url.pathname.startsWith('/__/')||url.pathname.startsWith('/__acceptance/')||url.pathname.startsWith('/_next/webpack-hmr'))return reply(403,'Emulator administration and development controls are not exposed.');
  if(!['GET','HEAD','POST'].includes(req.method??''))return reply(405,'Method denied.');
  if(Number(req.headers['content-length']??0)>50000)return reply(413,'Request too large.');
  const headers={...req.headers,host:isAuth?'127.0.0.1:9098':'127.0.0.1:3106'};delete headers.cookie;delete headers['x-forwarded-host'];delete headers['x-forwarded-for'];
  const upstream=httpRequest({hostname:'127.0.0.1',port:isAuth?9098:3106,path:req.url,method:req.method,headers},response=>{res.writeHead(response.statusCode??502,{...response.headers,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});response.pipe(res);});
  upstream.on('error',()=>{if(!res.headersSent)reply(502,'Local test service unavailable.');else res.destroy();});req.pipe(upstream);
});}
async function control(settings,command){const r=await fetch('http://127.0.0.1:3110/'+command,{method:'POST',headers:{Authorization:'Bearer '+settings.controlKey},signal:AbortSignal.timeout(2000)});if(!r.ok)throw Error('Local supervisor rejected control.');return r.text();}
if(action==='start'){
  mkdirSync(dir,{recursive:true});if((await fetch('http://127.0.0.1:3110/',{signal:AbortSignal.timeout(500)}).catch(()=>null)))throw Error('An acceptance supervisor is already running. Use status or stop.');
  const host=process.argv[3]??lanAddress();if(!privateIP(host)||!Object.values(networkInterfaces()).flat().some(n=>n?.address===host))throw Error('Host must be this computer’s private LAN IPv4 address.');
  await new Promise((ok,no)=>{const c=spawn(process.execPath,['scripts/setup-jury-emulators.mjs'],{windowsHide:true,stdio:'inherit'});c.on('exit',n=>n===0?ok():no(Error('Setup failed')));});
  const settings={project,host,password:randomBytes(12).toString('base64url')+'!',accessKey:randomBytes(24).toString('base64url'),controlKey:randomBytes(24).toString('base64url'),pid:process.pid,startedAt:new Date().toISOString()};
  writeFileSync(stateFile,JSON.stringify(settings,null,2));copyFileSync('firestore.rules','work/firebase-rehearsal/firestore.rules');
  const env=envFor(settings),java=readdirSync('work/firebase-rehearsal/java21').find(n=>existsSync(`work/firebase-rehearsal/java21/${n}/bin/java.exe`));if(!java)throw Error('Local Java 21 runtime is missing.');env.JAVA_HOME=resolve('work/firebase-rehearsal/java21/'+java);const inheritedPath=env.Path??env.PATH??'';delete env.Path;delete env.PATH;env.Path=env.JAVA_HOME+'/bin;'+inheritedPath;
  let stopping=false,publicServer,controls;
  function stop(){if(stopping)return;stopping=true;publicServer?.close();controls?.close();for(const child of children)if(child.pid&&child.exitCode===null&&!child.killed)spawn('C:/Windows/System32/taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});setTimeout(()=>process.exit(0),1500);}
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
  try{
    for(const port of [3106,8085,9098]){const net=await import('node:net');await new Promise((ok,no)=>{const s=net.createServer();s.once('error',()=>no(Error('Port '+port+' is already in use; stop its existing owner first.')));s.listen(port,'127.0.0.1',()=>s.close(ok));});}
    launch(process.execPath,[resolve(process.env.APPDATA,'npm/node_modules/firebase-tools/lib/bin/firebase.js'),'emulators:start','--only','auth,firestore','--project',project,'--config','work/firebase-rehearsal/firebase.json'],env,'emulators');
    await waitFor('http://127.0.0.1:9098/');await waitFor('http://127.0.0.1:8085/');
    launch(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','-p','3106'],env,'next');await waitFor('http://127.0.0.1:3106/api/jury');
    publicServer=gateway(settings);
    publicServer.on('upgrade',(req,socket,head)=>{
      const expectedHost=host+':3108',cookie=(req.headers.cookie??'').split(';').map(v=>v.trim()).find(v=>v.startsWith('juryAcceptance='))?.slice(15)??'';
      if(req.headers.host!==expectedHost||req.headers.origin!==`http://${expectedHost}`||!req.url?.startsWith('/_next/webpack-hmr?')||!equal(cookie,settings.accessKey)){socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');return;}
      const upstream=connect(3106,'127.0.0.1',()=>{const headers={...req.headers,host:'127.0.0.1:3106'};delete headers.cookie;upstream.write(`GET ${req.url} HTTP/1.1\r\n`+Object.entries(headers).map(([k,v])=>`${k}: ${v}`).join('\r\n')+'\r\n\r\n');if(head.length)upstream.write(head);socket.pipe(upstream);upstream.pipe(socket);});upstream.on('error',()=>socket.destroy());socket.on('error',()=>upstream.destroy());socket.on('close',()=>upstream.destroy());
    });
    await new Promise((ok,no)=>{publicServer.once('error',no);publicServer.listen(3108,host,ok);});
    controls=createServer((req,res)=>{if(req.method!=='POST'||req.headers.authorization!=='Bearer '+settings.controlKey){res.writeHead(403);return res.end();}if(req.url==='/stop'){res.end('Stopping local acceptance services.');stop();}else if(req.url==='/status'){res.end(JSON.stringify({project,host,running:true}));}else{res.writeHead(404);res.end();}});await new Promise(ok=>controls.listen(3110,'127.0.0.1',ok));
    await seed(settings);
    for(const path of ['/acceptance','/','/jury','/admin','/draft','/episodes','/history','/rules','/castaways','/chatter','/api/league','/api/registration','/api/admin','/api/discussions','/api/community','/api/scoring','/api/draft'])await fetch('http://127.0.0.1:3106'+path);
    const url=`http://${host}:3108/__acceptance/start?key=${settings.accessKey}`;writeFileSync(dir+'/connection.txt',`Private synthetic test URL: ${url}\nTemporary password for all @jury.test accounts: ${settings.password}\n`);
    console.log(readFileSync(dir+'/connection.txt','utf8'));console.log('Keep this terminal running. Ctrl+C or the stop command stops every child service.');
  }catch(e){console.error(e.message);stop();}
}else{
  if(!existsSync(stateFile))throw Error('Start the acceptance environment first.');const settings=JSON.parse(readFileSync(stateFile,'utf8'));envFor(settings);
  if(action==='stop')console.log(await control(settings,'stop'));
  else if(action==='status'){const state=await control(settings,'status');await checkAcceptanceHealth();console.log(state);console.log('Local services healthy: pages load and anonymous Jury API access is denied.');console.log(readFileSync(dir+'/connection.txt','utf8'));console.log(readFileSync(dir+'/scenario.json','utf8'));}
  else if(action==='restart-app'){
    await control(settings,'status');
    const fd=openSync(dir+'/app-recovery.log','a'),child=spawn(process.execPath,['--experimental-strip-types','scripts/restart-acceptance-app.mjs'],{detached:true,windowsHide:true,stdio:['ignore',fd,fd]});closeSync(fd);child.unref();
    let ready=false;const deadline=Date.now()+120000;
    while(Date.now()<deadline){try{const state=JSON.parse(readFileSync(dir+'/app-recovery.json','utf8'));if(state.helperPid===child.pid&&state.phase==='ready'){await checkAcceptanceHealth();ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
    if(!ready)throw Error('App restart did not become healthy. Inspect work/iphone-acceptance/app-recovery.log and next.log. No fixture reset was requested.');
    console.log('Application-only restart complete. Gateway, emulators, accounts, grading and private URL preserved.');
  }
  else if(action==='reset'){await control(settings,'status');await seed(settings,process.argv[3]??'open',process.argv[4]);}
  else if(action==='verify'){await control(settings,'status');const child=spawn(process.execPath,['--experimental-strip-types','scripts/verify-iphone-acceptance.mjs'],{env:envFor(settings),stdio:'inherit',windowsHide:true});child.on('exit',n=>process.exitCode=n??1);}
  else throw Error('Use start, status, restart-app, reset, verify or stop.');
}
