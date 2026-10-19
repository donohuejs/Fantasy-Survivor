'use client';
import {usePathname} from 'next/navigation';
import Link from 'next/link';
import {useGame} from './game-provider';
import {AuthControls} from './auth-controls';

export function LeagueGate({children}:{children:React.ReactNode}){
  const path=usePathname(),{cloud,user,authLoading,leagueAccess,leagueError}=useGame();
  if(!cloud&&process.env.NODE_ENV!=='production'||path==='/rules'||path==='/castaways'||path==='/admin'||(path==='/acceptance'&&process.env.NODE_ENV!=='production'&&process.env.NEXT_PUBLIC_LOCAL_ACCEPTANCE==='1'))return children;
  if(authLoading||leagueAccess==='loading')return <main className="loading-screen">Loading your league…</main>;
  if(!user||leagueAccess!=='authorized')return <main className="inner-page"><section className="panel jury-access"><h1>{!user?'Sign in to your league.':'League access pending.'}</h1><p>{!user?'Standings, teams, recaps, and discussions are available to authorized league participants.':leagueError||'The game master must link your account in Player check-in.'}</p><AuthControls/><p><Link href="/rules">Fantasy Survivor rules</Link> · <Link href="/castaways">Original season cast</Link></p></section></main>;
  return children;
}
