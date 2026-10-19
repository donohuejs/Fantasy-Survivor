import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins:process.env.LOCAL_ACCEPTANCE==='1'&&process.env.LOCAL_ACCEPTANCE_HOST?[process.env.LOCAL_ACCEPTANCE_HOST]:[],
  productionBrowserSourceMaps:false,
  // Firebase Admin and Firestore use Node-native dependencies. Keep them
  // external to the Next server bundle so Vercel loads the complete SDK at
  // runtime instead of trying to bundle its dependency graph.
  serverExternalPackages: ['firebase-admin','@google-cloud/firestore'],
};

export default nextConfig;
