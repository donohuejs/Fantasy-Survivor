'use client';

import { missingFirebaseSettings } from '@/lib/firebase';
import { useGame } from './game-provider';
import Link from 'next/link';

export function AuthControls({compact=false}:{compact?:boolean}) {
  const {cloud,user,authLoading,authBusy,login,logout}=useGame();
  if(compact)return <div className="header-account">
    {!cloud?<Link href="/draft" className="header-sign-in">Sign in with Google</Link>:authLoading?<button className="header-sign-in" disabled aria-live="polite">Checking sign-in…</button>:user?<><span className="account-identity" title={user.email??''}><small>Signed in</small><strong>{user.displayName||user.email||'Google account'}</strong></span><button className="header-sign-out" type="button" disabled={authBusy} onClick={logout}>{authBusy?'Signing out…':'Sign out'}</button></>:<button className="header-sign-in" type="button" disabled={authBusy} onClick={login}>{authBusy?'Opening Google…':'Sign in with Google'}</button>}
  </div>;
  if(!cloud)return <section role="alert" className="setup-notice">
    <h2>Firebase setup is incomplete</h2>
    <p>No account is signed in. Google sign-in is unavailable because this deployment is missing:</p>
    <ul>{missingFirebaseSettings.map((name)=><li key={name}><code>{name}</code></li>)}</ul>
    <p>Add these values from your Firebase web app configuration to Vercel → Project Settings → Environment Variables, enable them for Production, and create a new deployment. Do not use a service-account private key.</p>
  </section>;
  if(authLoading)return <p role="status">Checking Google sign-in…</p>;
  return <div className="draft-auth">
    {user?<><span>Signed in as <strong>{user.email || 'an account without an email address'}</strong></span><button type="button" disabled={authBusy} onClick={logout}>{authBusy?'Signing out…':'Sign out'}</button></>:<><span>Choose your Google account to continue.</span><button type="button" disabled={authBusy} onClick={login}>{authBusy?'Opening Google sign-in…':'Sign in with Google'}</button></>}
  </div>;
}
