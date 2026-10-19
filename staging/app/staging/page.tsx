import {notFound} from 'next/navigation';
import {requireCloudStaging} from '@/lib/staging-environment';
import {StagingControls} from './controls';
export const dynamic='force-dynamic';
export default function StagingPage(){if(process.env.JURY_STAGING!=='1')notFound();requireCloudStaging();return <StagingControls/>;}
