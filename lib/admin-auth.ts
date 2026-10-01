export function assertGameMaster(isAdmin:boolean){
  if(!isAdmin)throw new Error('Only the game master can change scoring or tribes.');
}
