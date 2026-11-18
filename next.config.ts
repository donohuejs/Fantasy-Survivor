import {assertProductionConfiguration} from './lib/production-policy.ts';
import {firebaseAuthHelperHost} from './lib/pwa-auth.ts';
assertProductionConfiguration(process.env,"production");
import type { NextConfig } from 'next';

const authHelperHost=process.env.NEXT_PUBLIC_FIREBASE_PWA_REDIRECT==='1'
  ?firebaseAuthHelperHost(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN)
  :undefined;

const nextConfig: NextConfig = {
  outputFileTracingRoot:process.cwd(),
  allowedDevOrigins:process.env.LOCAL_ACCEPTANCE==='1'&&process.env.LOCAL_ACCEPTANCE_HOST?[process.env.LOCAL_ACCEPTANCE_HOST]:[],
  productionBrowserSourceMaps:false,
  // Firebase Admin and Firestore use Node-native dependencies. Keep them
  // external to the Next server bundle so Vercel loads the complete SDK at
  // runtime instead of trying to bundle its dependency graph.
  serverExternalPackages: ['firebase-admin','@google-cloud/firestore'],
  // Firebase's OAuth helper stays on the app origin for iOS standalone PWAs.
  // Next.js rewrites are transparent proxies, not 302 redirects.
  async rewrites(){return authHelperHost?[
    {source:'/__/auth/:path*',destination:`https://${authHelperHost}/__/auth/:path*`},
  ]:[];},
};

export default nextConfig;
