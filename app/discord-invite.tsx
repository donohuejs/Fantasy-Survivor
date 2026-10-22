'use client';
import Image from 'next/image';
import {useGame} from './game-provider';
import styles from './discord-invite.module.css';

export function DiscordInvite(){
  const {game,user,loading,authLoading,authBusy,leagueAccess}=useGame();
  const player=user&&game.players.find(p=>p.active!==false&&(p.uid?p.uid===user.uid:Boolean(p.email)&&p.email.toLowerCase()===user.email?.toLowerCase()));
  if(!player||loading||authLoading||authBusy||leagueAccess!=='authorized')return null;
  return <a className={styles.invite} href="https://discord.gg/PweZ7dNTYZ" target="_blank" rel="noopener noreferrer" aria-label="Join us on our Discord (opens in a new tab)">
    <Image src="/branding/discord-clyde-white.svg" alt="" width={24} height={18} aria-hidden="true"/>
    <span>Join us on our Discord</span>
  </a>;
}
