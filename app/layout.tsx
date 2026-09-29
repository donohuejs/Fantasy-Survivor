import type { Metadata, Viewport } from 'next';
import './globals.css';
import { GameProvider } from './game-provider';
import { CommunityPollProvider } from './community-polls';

export const metadata: Metadata = {
  title: 'Fantasy Survivor',
  description: 'Draft castaways, score every episode, and follow the fantasy leaderboard.',
  openGraph: {
    title: 'Fantasy Survivor',
    description: 'Outwit. Outdraft. Outscore.',
  },
  twitter: {
    card: 'summary',
    title: 'Fantasy Survivor',
    description: 'Outwit. Outdraft. Outscore.',
  },
};

export const viewport: Viewport = {
  themeColor: '#217082',
  colorScheme: 'light',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><GameProvider><CommunityPollProvider>{children}</CommunityPollProvider></GameProvider></body></html>;
}
