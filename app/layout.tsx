import type { Metadata } from 'next';
import './globals.css';
import { GameProvider } from './game-provider';

export const metadata: Metadata = {
  title: 'Fantasy Survivor 51',
  description: 'Draft castaways, score every episode, and follow the fantasy leaderboard.',
  openGraph: {
    title: 'Fantasy Survivor 51',
    description: 'Outwit. Outdraft. Outscore.',
  },
  twitter: {
    card: 'summary',
    title: 'Fantasy Survivor 51',
    description: 'Outwit. Outdraft. Outscore.',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><GameProvider>{children}</GameProvider></body></html>;
}
