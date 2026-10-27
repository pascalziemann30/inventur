import {checkNativeAdmin} from '../../auth/adminAccess.js';
import {inventoryAdminClient,inventoryAdminSessionClient} from '../counting/testClient.js';
const messages={ADMIN_PASSWORD_INCORRECT:'Das Passwort stimmt nicht. Bitte erneut versuchen.',ADMIN_PASSWORD_REQUIRED:'Bitte mit dem Admin-Passwort anmelden.',ADMIN_PASSWORD_NOT_CONFIGURED:'Das Admin-Passwort muss einmalig geschützt hinterlegt werden.',ADMIN_LOGIN_PAUSED:'Zu viele Anmeldeversuche. Bitte nach fünf Minuten erneut versuchen.',ADMIN_LOGIN_RETRY:'Die Anmeldung wurde gleichzeitig bearbeitet. Bitte erneut versuchen.',ADMIN_LOGIN_UNAVAILABLE:'Die Anmeldung ist gerade nicht erreichbar. Bitte erneut versuchen.',ORIGIN_FORBIDDEN:'Diese Adresse ist für die Administration nicht freigegeben.',DATA_ENV_REQUIRED:'Die Administration ist in dieser Umgebung nicht erreichbar.'};
export async function adminSessionApi(action,input={}){
 try{
  // The editor already supplies a native app administrator session. Verify that
  // identity directly before depending on the separate password-session endpoint.
  if(action==='context'&&(await checkNativeAdmin(inventoryAdminClient.auth)).status==='allowed')return {authenticated:true,method:'native'};
  return(await inventoryAdminSessionClient.functions.invoke('adminSession',{action,...input})).data;
 }
 catch(error){const code=error?.data?.error||error?.response?.data?.error;throw Object.assign(new Error(messages[code]||`Der Admin-Zugang konnte gerade nicht bestätigt werden${code?` (${code})`:''}.`),{code});}
}