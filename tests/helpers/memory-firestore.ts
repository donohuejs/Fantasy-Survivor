import type {Firestore} from 'firebase-admin/firestore';

type Data=Record<string,unknown>;
type Filter={field:string;operator:string;value:unknown};
class Snapshot{
  readonly ref:Ref;private value:Data|undefined;
  constructor(ref:Ref,value:Data|undefined){this.ref=ref;this.value=value;}
  get id(){return this.ref.id;}get exists(){return this.value!==undefined;}
  data(){return this.value?structuredClone(this.value):undefined;}
}
class QuerySnapshot{
  readonly docs:Snapshot[];
  constructor(docs:Snapshot[]){this.docs=docs;}
  get size(){return this.docs.length;}get empty(){return this.size===0;}
}
class Query{
  protected db:MemoryFirestore;readonly path:string;private filters:Filter[];private orders:Array<{field:string;direction:string}>;private cap:number;private cursor:unknown[];
  constructor(db:MemoryFirestore,path:string,filters:Filter[]=[],orders:Array<{field:string;direction:string}>=[],cap=Infinity,cursor:unknown[]=[]){this.db=db;this.path=path;this.filters=filters;this.orders=orders;this.cap=cap;this.cursor=cursor;}
  where(field:string,operator:string,value:unknown){return new Query(this.db,this.path,[...this.filters,{field,operator,value}],this.orders,this.cap,this.cursor);}
  orderBy(field:string,direction='asc'){return new Query(this.db,this.path,this.filters,[...this.orders,{field,direction}],this.cap,this.cursor);}
  limit(count:number){return new Query(this.db,this.path,this.filters,this.orders,count,this.cursor);}
  startAfter(...values:unknown[]){return new Query(this.db,this.path,this.filters,this.orders,this.cap,values);}
  evaluate(data:Map<string,Data>){
    let rows=[...data].filter(([path])=>path.startsWith(this.path+'/')&&path.slice(this.path.length+1).indexOf('/')===-1);
    rows=rows.filter(([,row])=>this.filters.every(({field,operator,value})=>{
      const got=row[field];switch(operator){case '==':return got===value;case '>':return compare(got,value)>0;case '<=':return compare(got,value)<=0;default:throw new Error('Unsupported query operator '+operator);}
    })).filter(([,row])=>this.orders.every(order=>row[order.field]!==undefined));
    rows.sort(([leftPath,left],[rightPath,right])=>{for(const order of this.orders){const result=compare(left[order.field],right[order.field])*(order.direction==='desc'?-1:1);if(result)return result;}return leftPath.localeCompare(rightPath);});
    if(this.cursor.length)rows=rows.filter(([,row])=>{for(let index=0;index<this.orders.length;index++){const order=this.orders[index],result=compare(row[order.field],this.cursor[index])*(order.direction==='desc'?-1:1);if(result)return result>0;}return false;});
    return new QuerySnapshot(rows.slice(0,this.cap).map(([path,row])=>new Snapshot(new Ref(this.db,path),row)));
  }
  async get(){this.db.queryReads++;return this.evaluate(this.db.data);}
}
class Collection extends Query{doc(id:string){return new Ref(this.db,this.path+'/'+id);}}
class Ref{
  readonly db:MemoryFirestore;readonly path:string;
  constructor(db:MemoryFirestore,path:string){this.db=db;this.path=path;}
  get id(){return this.path.split('/').at(-1)!;}
  collection(name:string){return new Collection(this.db,this.path+'/'+name);}
  async get(){this.db.documentReads++;return new Snapshot(this,this.db.data.get(this.path));}
  async set(data:Data,options?:{merge:boolean}){this.db.data.set(this.path,options?.merge?{...this.db.data.get(this.path),...structuredClone(data)}:structuredClone(data));this.db.version++;}
}
function compare(left:unknown,right:unknown){if(typeof left==='number'&&typeof right==='number')return left-right;return String(left).localeCompare(String(right));}
class Tx{
  writes:Array<{ref:Ref;data:Data;merge:boolean;create:boolean}>=[];
  private db:MemoryFirestore;private snapshot:Map<string,Data>;
  constructor(db:MemoryFirestore,snapshot:Map<string,Data>){this.db=db;this.snapshot=snapshot;}
  async get(ref:Ref|Query){if(this.writes.length)throw new Error('Firestore reads must precede transaction writes');if(ref instanceof Query){this.db.queryReads++;return ref.evaluate(this.snapshot);}this.db.documentReads++;return new Snapshot(ref,this.snapshot.get(ref.path));}
  async getAll(...refs:Ref[]){if(this.writes.length)throw new Error('Read after write');return refs.map(ref=>new Snapshot(ref,this.snapshot.get(ref.path)));}
  set(ref:Ref,data:Data,options?:{merge:boolean}){this.writes.push({ref,data:structuredClone(data),merge:options?.merge??false,create:false});}
  update(ref:Ref,data:Data){if(!this.snapshot.has(ref.path))throw new Error('Missing update target');this.set(ref,data,{merge:true});}
  create(ref:Ref,data:Data){this.writes.push({ref,data:structuredClone(data),merge:false,create:true});}
}
/** Optimistic retries and the read-before-write rule exercise the real store orchestration. */
export class MemoryFirestore{
  data=new Map<string,Data>();version=0;queryReads=0;documentReads=0;retries=0;
  readonly firestore=this as unknown as Firestore;
  seed(path:string,data:object){this.data.set(path,structuredClone(data) as Data);this.version++;}
  read<T>(path:string){return structuredClone(this.data.get(path)) as T;}
  doc(path:string){return new Ref(this,path);}
  async getAll(...refs:Ref[]){return Promise.all(refs.map(ref=>ref.get()));}
  async runTransaction<T>(callback:(tx:Tx)=>Promise<T>):Promise<T>{
    for(let attempt=0;attempt<100;attempt++){
      const before=this.version,tx=new Tx(this,structuredClone(this.data)),result=await callback(tx);
      if(this.version!==before){this.retries++;continue;}
      for(const write of tx.writes){if(write.create&&this.data.has(write.ref.path))throw new Error('Document already exists');this.data.set(write.ref.path,write.merge?{...this.data.get(write.ref.path),...write.data}:write.data);}
      if(tx.writes.length)this.version++;return result;
    }
    throw new Error('Transaction retry limit reached');
  }
}
