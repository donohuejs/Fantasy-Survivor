import assert from 'node:assert/strict';
import test from 'node:test';
import {firebaseAuthHelperHost,sameOriginPwaAuthDomain,type BrowserAuthContext} from '../lib/pwa-auth.ts';

const iosStandalone:BrowserAuthContext={
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_6 like Mac OS X)',
  platform:'iPhone',maxTouchPoints:5,navigatorStandalone:true,
  displayModeStandalone:true,protocol:'https:',hostname:'fantasy-survivor-auth-preview.vercel.app',
};

test('iOS Home Screen redirects only with the explicit preview feature enabled',()=>{
  assert.equal(sameOriginPwaAuthDomain(iosStandalone,true),'fantasy-survivor-auth-preview.vercel.app');
  assert.equal(sameOriginPwaAuthDomain(iosStandalone,false),undefined);
});
test('regular Safari keeps working with popup sign-in',()=>{
  assert.equal(sameOriginPwaAuthDomain({...iosStandalone,navigatorStandalone:false,displayModeStandalone:false},true),undefined);
});
test('standalone desktop and Android do not change their Google login flow',()=>{
  assert.equal(sameOriginPwaAuthDomain({...iosStandalone,userAgent:'Chrome (Android 15)',platform:'Linux armv8l',navigatorStandalone:false},true),undefined);
  assert.equal(sameOriginPwaAuthDomain({...iosStandalone,userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:0},true),undefined);
});
test('iPad desktop-class user agent is recognized when touch input is present',()=>{
  assert.equal(sameOriginPwaAuthDomain({...iosStandalone,userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X)',platform:'MacIntel',maxTouchPoints:5},true),iosStandalone.hostname);
});
test('insecure or malformed origins cannot start same-origin OAuth',()=>{
  assert.equal(sameOriginPwaAuthDomain({...iosStandalone,protocol:'http:'},true),undefined);
  assert.equal(sameOriginPwaAuthDomain({...iosStandalone,hostname:'localhost'},true),undefined);
  assert.equal(sameOriginPwaAuthDomain({...iosStandalone,hostname:'foo/bad'},true),undefined);
});
test('auth helper rewrites only to a valid Firebase Hosting domain',()=>{
  assert.equal(firebaseAuthHelperHost('fantasy-survivor-9da59.firebaseapp.com'),'fantasy-survivor-9da59.firebaseapp.com');
  assert.equal(firebaseAuthHelperHost('evil.firebaseapp.com.attacker.test'),undefined);
  assert.equal(firebaseAuthHelperHost('https://fantasy-survivor-9da59.firebaseapp.com'),undefined);
  assert.equal(firebaseAuthHelperHost(undefined),undefined);
});
