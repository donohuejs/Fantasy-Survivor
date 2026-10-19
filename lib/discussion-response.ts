// Keep response handling independent of React so interrupted response bodies can be tested.
export async function readDiscussionResponse<T>(response:Response):Promise<T>{
  let result;
  try{result=await response.json();}
  catch(error){
    // Cleanup may abort after headers arrive. Preserve that rejection so a hook
    // cannot install a non-page object as successful state and lose its rows.
    if(error instanceof Error&&error.name==='AbortError')throw error;
    throw new Error(`The server returned HTTP ${response.status} without valid JSON. Retry after refreshing.`);
  }
  if(!response.ok)throw new Error(result.error??'Unable to load or save discussions.');
  return result as T;
}
