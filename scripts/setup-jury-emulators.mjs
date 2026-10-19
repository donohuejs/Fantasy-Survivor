// Offline setup for the fixed demo project. Generates an unusable-in-production RSA credential.
import {generateKeyPairSync} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync,copyFileSync} from 'node:fs';
const dir='work/firebase-rehearsal',project='demo-fantasy-scoring';
mkdirSync(dir,{recursive:true});
const credential=dir+'/server-service-account.json';
if(existsSync(credential)){
  if(JSON.parse(readFileSync(credential,'utf8')).project_id!==project)throw Error('Refusing to overwrite a credential for another project.');
}else{
  const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
  writeFileSync(credential,JSON.stringify({project_id:project,client_email:'emulator@'+project+'.iam.gserviceaccount.com',private_key:privateKey},null,2));
}
const config=dir+'/firebase.json';
if(!existsSync(config))writeFileSync(config,JSON.stringify({firestore:{rules:'firestore.rules'},emulators:{singleProjectMode:true,auth:{host:'127.0.0.1',port:9098},firestore:{host:'127.0.0.1',port:8085},hub:{host:'127.0.0.1',port:4405},logging:{host:'127.0.0.1',port:4505},ui:{enabled:false}}},null,2));
const existing=JSON.parse(readFileSync(config,'utf8'));
for(const [service,port] of [['auth',9098],['firestore',8085]])if(existing.emulators?.[service]?.host!=='127.0.0.1'||existing.emulators?.[service]?.port!==port)throw Error('Existing emulator configuration differs; review it instead of overwriting it.');
copyFileSync('firestore.rules',dir+'/firestore.rules');
console.log('Prepared synthetic demo credentials and the exact proposed rules. No cloud services contacted.');
