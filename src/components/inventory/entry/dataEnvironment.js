// Only the published inventory origin selects production. URL parameters cannot opt into it.
export function workflowDataEnvironment({origin,functionsVersion}){
 return origin==='https://siftcntrl-bestand.base44.app'&&!(typeof functionsVersion==='string'&&functionsVersion.startsWith('branch:'))?'prod':'dev';
}
