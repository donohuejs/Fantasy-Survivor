import {notFound} from 'next/navigation';
import {localAcceptance} from '@/lib/acceptance-environment';
import {AcceptanceLogin} from './login';
export const dynamic='force-dynamic';
export default function AcceptancePage(){if(!localAcceptance())notFound();return <AcceptanceLogin/>;}
