// Node tests execute synthetic server stores. Keep React's normal runtime while
// treating the bundler-only server boundary marker as empty in this test process.
// Production source and Next's server-only enforcement are unchanged.
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,nextResolve){
  if(specifier==='server-only')return {url:'data:text/javascript,export {};',shortCircuit:true};
  return nextResolve(specifier,context);
}});
