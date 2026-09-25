import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fantasy Survivor',
    short_name: 'Fantasy Survivor',
    description: 'Draft castaways, score every episode, and follow the fantasy leaderboard.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#217082',
    theme_color: '#217082',
    icons: [
      {
        src: '/branding/survivor-51-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/branding/survivor-51-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
