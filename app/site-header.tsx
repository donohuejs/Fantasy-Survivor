'use client';
import Link from 'next/link';
import {AuthControls} from './auth-controls';
export function SiteHeader({active,subtitle}:{active:string;subtitle:string}){
  return <header className="site-header"><Link className="brand" href="/"><span><strong>Fantasy Survivor 51</strong><small>{subtitle}</small></span></Link><nav aria-label="Main navigation">{[['/','Standings'],['/draft','Draft board'],['/episodes','Episodes'],['/castaways','Castaways'],['/history','All-time'],['/rules','Rules'],['/admin','Game master']].map(([href,label])=><Link key={href} href={href} className={`${href===active?'active ':''}${href==='/admin'?'admin-link':''}`} aria-current={href===active?'page':undefined}>{label}</Link>)}</nav><AuthControls compact/></header>;
}
