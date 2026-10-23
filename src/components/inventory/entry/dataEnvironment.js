// Hosting origin selects transport. A stale preview selection cannot change the public entry.
export function workflowDataEnvironment({origin}){
 return origin==='https://siftcntrl-bestand.base44.app'?'prod':'dev';
}
export function workflowFunctionsVersion({origin,functionsVersion}){
 return workflowDataEnvironment({origin})==='prod'?undefined:functionsVersion;
}
