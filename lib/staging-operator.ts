// Server-only proof independent of the currently selected synthetic player identity.
import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import type {Auth} from 'firebase-admin/auth';
import {STAGING_COMMISSIONER_UID,stagingCommissioner} from './staging-environment.ts';
export const OPERATOR_COOKIE='__Host-jury-staging-operator';
export const OPERATOR_SECONDS=7*24*60*60;
export function recentOperatorAuthentication(authTime:number,now=Math.floor(Date.now()/1000)){return Number.isSafeInteger(authTime)&&authTime<=now+30&&authTime>=now-300;}
type Proof={uid:string;authTime:number;issuedAt:number;expiresAt:number;nonce:string};
function key(secret:string){if(!/^[A-Za-z0-9_-]{43,}$/.test(secret))throw new Error('Staging operator signing key is unavailable.');return secret;}
export function signOperatorProof(authTime:number,secret:string,now=Math.floor(Date.now()/1000)){
  if(!Number.isSafeInteger(authTime)||authTime>now+30||authTime<1)throw new Error('Invalid operator authentication.');
  const proof:Proof={uid:STAGING_COMMISSIONER_UID,authTime,issuedAt:now,expiresAt:now+OPERATOR_SECONDS,nonce:randomBytes(24).toString('base64url')};
  const body=Buffer.from(JSON.stringify(proof)).toString('base64url');return body+'.'+createHmac('sha256',key(secret)).update(body).digest('base64url');
}
export function readOperatorProof(value:string,secret:string,now=Math.floor(Date.now()/1000)):Proof|null{
  if(value.length>2048)return null;const [body,signature,extra]=value.split('.');if(!body||extra||!signature||!/^[A-Za-z0-9_-]{43}$/.test(signature))return null;
  const expected=createHmac('sha256',key(secret)).update(body).digest();if(!timingSafeEqual(expected,Buffer.from(signature,'base64url')))return null;
  try{const proof=JSON.parse(Buffer.from(body,'base64url').toString()) as Proof;if(proof.uid!==STAGING_COMMISSIONER_UID||!Number.isSafeInteger(proof.authTime)||!Number.isSafeInteger(proof.issuedAt)||!Number.isSafeInteger(proof.expiresAt)||proof.authTime<1||proof.authTime>proof.issuedAt+30||proof.issuedAt>now+30||proof.expiresAt<=now||proof.expiresAt>proof.issuedAt+OPERATOR_SECONDS||typeof proof.nonce!=='string'||proof.nonce.length<20)return null;return proof;}catch{return null;}
}
export async function authorizeOperator(value:string|undefined,secret:string,auth:Pick<Auth,'getUser'>,now=Math.floor(Date.now()/1000)){
  if(!value)return false;const proof=readOperatorProof(value,secret,now);if(!proof)return false;
  try{const user=await auth.getUser(proof.uid);return stagingCommissioner({uid:user.uid,email:user.email??'',verified:user.emailVerified})&&!user.disabled&&Date.parse(user.tokensValidAfterTime??'1970-01-01')/1000<=proof.authTime;}catch{return false;}
}
export function sameOriginOperatorRequest(origin:string|null,expected:string,contentType:string|null){return origin===expected&&contentType?.split(';')[0].trim()==='application/json';}
