import type {JuryFacts} from '@/lib/jury';

export function evidenceSourceError(source:string){
  return source.trim().length>=10?'':'Add an evidence source of at least 10 characters before saving, such as the broadcast, recap URL, or verified commissioner notes. A correction reason is separate.';
}
export function hasUsefulEvidenceSuggestions(facts:JuryFacts){
  return facts.mergeOccurred!==null||facts.immunityWinnerIds.length>0||facts.councils.length>0||facts.items.length>0;
}
