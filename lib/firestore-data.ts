/** Omit absent optional properties; retain Firestore-native values and every defined field. */
export function firestoreData<T>(value:T):T {
  if(Array.isArray(value))return value.map(item=>firestoreData(item)) as T;
  if(value&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype)return Object.fromEntries(Object.entries(value).filter(([,item])=>item!==undefined).map(([key,item])=>[key,firestoreData(item)])) as T;
  return value;
}
