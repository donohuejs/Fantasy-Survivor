'use client';
// Staging copy only: capture a fixture version per page load, rejecting old-tab writes after reset.
if(typeof window!=='undefined'&&process.env.NEXT_PUBLIC_JURY_STAGING==='1'){
  const original=window.fetch.bind(window);let version:string|null=null;
  window.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
    const url=new URL(input instanceof Request?input.url:String(input),window.location.href),method=init?.method??(input instanceof Request?input.method:'GET');
    if(url.origin!==window.location.origin||!url.pathname.startsWith('/api/'))return original(input,init);
    const headers=new Headers(init?.headers??(input instanceof Request?input.headers:undefined));
    if(method!=='GET'&&headers.has('Authorization')&&!url.pathname.startsWith('/api/staging')){
      if(!version){const status=await original('/api/staging',{headers:{Authorization:headers.get('Authorization')!},cache:'no-store'});const body=await status.json();if(!status.ok)throw new Error(body.error??'Synthetic scenario unavailable.');version=String(body.state.version);}
      headers.set('x-jury-staging-fixture',version);
    }
    const response=await original(input,{...init,headers});
    if(!version&&method==='GET'&&url.pathname==='/api/league'&&response.ok){try{const body=await response.clone().json();if(Number.isSafeInteger(body.game?.stagingFixture?.version))version=String(body.game.stagingFixture.version);}catch{/* The caller retains normal response/abort handling. */}}
    if(response.status===409){try{const body=await response.clone().json();if(typeof body.error==='string'&&body.error.includes('synthetic scenario changed'))window.dispatchEvent(new Event('staging-stale'));}catch{/* Retain the original error response. */}}
    return response;
  };
}
