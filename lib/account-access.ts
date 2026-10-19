type Account={uid:string;emailVerified:boolean}|null;
type Access={uid:string;status:string;commissioner?:boolean};

/** A previous account or an unconfirmed request cannot supply current privileges. */
export function commissionerAccessForAccount(account:Account,access:Access){
  return Boolean(account?.emailVerified&&access.uid===account.uid&&access.status==='authorized'&&access.commissioner===true);
}
