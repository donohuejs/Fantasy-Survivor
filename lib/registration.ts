import type {PlayerSignup} from './league';

export type RegistrationIdentity={uid:string;email:string|null;displayName:string|null;emailVerified:boolean};
export function automaticRegistration(user:RegistrationIdentity,existing:PlayerSignup|null,createdAt:string):PlayerSignup{
  if(!user.uid||!user.email?.trim())throw new Error('Your Google account needs an email address. Sign out and choose your Google account again.');
  if(!user.emailVerified)throw new Error('Your Google email is not verified. Sign out and sign in again after verifying it.');
  if(existing){
    if(existing.uid!==user.uid)throw new Error('This registration needs review by the game master.');
    // Never replace an existing chosen name, creation date or permanent assignment.
    return existing;
  }
  const email=user.email.trim().toLowerCase();
  const name=(user.displayName?.trim()||email.split('@')[0]||'League player').slice(0,50);
  return {uid:user.uid,name,email,createdAt};
}
export type RegistrationState={owner:string;status:'registering'|'registered'|'error';signup?:PlayerSignup;error:string};
export function registrationForAccount(state:RegistrationState|null,uid:string|undefined){
  if(!uid)return {status:'idle' as const,error:'',signup:undefined};
  if(state?.owner!==uid)return {status:'registering' as const,error:'',signup:undefined};
  return {status:state.status,error:state.error,signup:state.signup};
}
export function registrationErrorMessage(error:unknown){
  const code=typeof error==='object'&&error!==null&&'code' in error?String(error.code):'';
  if(code==='permission-denied')return 'Firebase did not allow the registration. Ask the game master to check the published signup rules, then retry.';
  if(code==='unavailable'||code==='deadline-exceeded')return 'Your connection could not reach the league. Check your connection, then retry.';
  return error instanceof Error?error.message:'Your registration could not be saved. Please retry.';
}
