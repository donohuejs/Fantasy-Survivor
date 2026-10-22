import 'server-only';
import {assertProductionConfiguration} from './production-policy.ts';
const target="production" as const;
export function assertBuild(){assertProductionConfiguration(process.env,target);}
export function assertRuntime(){assertProductionConfiguration(process.env,target,true);}
