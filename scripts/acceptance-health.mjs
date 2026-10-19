// Process reachability alone is not readiness: reject 500s and incorrect authentication behavior.
export async function checkAcceptanceHealth(request=fetch){
  for(const [url,expected] of [
    ['http://127.0.0.1:9098/',200],
    ['http://127.0.0.1:8085/',200],
    ['http://127.0.0.1:3106/',200],
    ['http://127.0.0.1:3106/api/jury',401],
  ]){const response=await request(url,{signal:AbortSignal.timeout(5000)});if(response.status!==expected)throw new Error(`Acceptance environment is unhealthy: ${url} returned HTTP ${response.status}; expected ${expected}. Use restart-app for an application-only restart.`);await response.body?.cancel();}
}
