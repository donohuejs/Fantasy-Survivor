'use client';
import Image from 'next/image';
import Link from 'next/link';
import {AuthControls} from './auth-controls';
export function SiteHeader({active,subtitle}:{active:string;subtitle:string}){
  return <header className="site-header"><Link className="brand" href="/"><Image className="brand-logo" src="/branding/survivor-51-main.jpg" width={48} height={48} alt="Survivor 51"/><span><strong>Fantasy Survivor</strong><small>{subtitle}</small></span></Link><nav aria-label="Main navigation">{[['/','Standings'],['/draft','Draft board'],['/episodes','Episodes'],['/castaways','Castaways'],['/history','All-time'],['/rules','Rules'],['/admin','Game master']].map(([href,label])=><Link key={href} href={href} className={`${href===active?'active ':''}${href==='/admin'?'admin-link':''}`} aria-current={href===active?'page':undefined}>{label}</Link>)}</nav><AuthControls compact/></header>;
}
