'use client';
import Link from 'next/link';
import {useGame} from './game-provider';
import {AuthControls} from './auth-controls';
export function SiteHeader({active,subtitle}:{active:string;subtitle:string}){
  const {game}=useGame();
  return <header className="site-header"><Link className="brand" href="/"><span className="brand-mark">{game.season.number}</span><span><strong>Fantasy Survivor</strong><small>{subtitle}</small></span></Link><nav aria-label="Main navigation">{[['/','Standings'],['/draft','Draft board'],['/episodes','Episodes'],['/castaways','Castaways'],['/history','All-time'],['/rules','Rules'],['/admin','Game master']].map(([href,label])=><Link key={href} href={href} className={`${href===active?'active ':''}${href==='/admin'?'admin-link':''}`} aria-current={href===active?'page':undefined}>{label}</Link>)}</nav><AuthControls compact/></header>;
}
