export const adminTabs=[
  {id:'scoring',label:'Scoring'},
  {id:'league-setup',label:'League setup'},
  {id:'tribe-membership',label:'Tribe membership'},
  {id:'player-check-in',label:'Player check-in'},
  {id:'draft-room',label:'Draft room'},
  {id:'activity-log',label:'Activity log'},
] as const;
export type AdminTabId=typeof adminTabs[number]['id'];
export function tabFromHash(hash:string):AdminTabId{
  return adminTabs.find(tab=>'#'+tab.id===hash)?.id??'scoring';
}
export function tabForKey(current:AdminTabId,key:string):AdminTabId|null{
  const index=adminTabs.findIndex(tab=>tab.id===current);
  if(key==='Home')return adminTabs[0].id;
  if(key==='End')return adminTabs[adminTabs.length-1].id;
  if(key==='ArrowRight')return adminTabs[(index+1)%adminTabs.length].id;
  if(key==='ArrowLeft')return adminTabs[(index+adminTabs.length-1)%adminTabs.length].id;
  return null;
}
