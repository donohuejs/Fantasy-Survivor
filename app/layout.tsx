import type { Metadata } from 'next';
import './globals.css';
import { GameProvider } from './game-provider';
import Script from 'next/script';

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
  return <html lang="en"><body><Script src="https://www.gstatic.com/firebasejs/12.17.1/firebase-app-compat.js" strategy="beforeInteractive"/><Script src="https://www.gstatic.com/firebasejs/12.17.1/firebase-auth-compat.js" strategy="beforeInteractive"/><Script src="https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore-compat.js" strategy="beforeInteractive"/><GameProvider>{children}</GameProvider></body></html>;
}
