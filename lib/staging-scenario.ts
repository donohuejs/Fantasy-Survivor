export function selectedStagingScenario(state:{version:number;scenario:string}|null,selection:{version:number;value:string}){
  return selection.version===state?.version?selection.value:['open','lock','grading','wrong-merge','merge','postmerge'].includes(state?.scenario??'')?state!.scenario:'grading';
}
