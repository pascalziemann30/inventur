import {takeLaunch} from './entryMode.js';
// Imported first by main.jsx: remove the bearer fragment before App/SDK telemetry initializes.
let pending=null;
if(typeof window!=='undefined'&&window.location.pathname==='/InventoryCapture'&&new URLSearchParams(window.location.search).get('workflow')==='entry'){
 pending=takeLaunch(window.location,window.history);
}
export function consumeLaunch(){const value=pending;pending=null;return value;}
