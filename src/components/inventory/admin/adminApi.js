import {inventoryAdminClient} from '../counting/testClient.js';
const messages={EXISTING_ARTICLE_REQUIRES_LINK:'Ein Artikel mit dieser Bezeichnung ist bereits vorhanden. Bitte den vorhandenen Artikel bearbeiten oder zuordnen.',DUPLICATE_OFFER:'Diese Lieferanten- und Gebindezuordnung ist bereits vorhanden oder mehrdeutig.',DUPLICATE_REFERENCE_REQUIRES_REVIEW:'Ein Lieferant, eine Kategorie oder eine Einheit ist doppelt. Bitte die vorhandenen Stammdaten klären.',ARTICLE_CHANGED_RELOAD:'Der Artikel wurde zwischenzeitlich geändert. Bitte neu laden und die Eingaben vergleichen.',CATALOG_CHANGED_RELOAD:'Der gespeicherte Arbeitsstand wurde geändert. Bitte neu laden.',CATALOG_OPERATION_PENDING:'Eine Artikeländerung oder ein Import ist noch nicht abgeschlossen. Bitte diesen Vorgang zuerst fortsetzen.',CATALOG_WRITE_UNCERTAIN:'Die Speicherung ist noch nicht sicher bestätigt. Bitte den gespeicherten Vorgang prüfen und fortsetzen; keinen neuen Import starten.',IMPORT_REQUIRES_EMPTY_DESTINATION:'Dieser Import ist nur für einen leeren Artikelbestand vorgesehen. Vorhandene Daten werden nicht überschrieben.',BASE_UNIT_IMMUTABLE:'Die Basiseinheit eines vorhandenen Artikels bleibt erhalten. Für ein anderes Produkt bitte einen eigenen Artikel anlegen.',PRODUCTION_MAIN_RUNTIME_REQUIRED:'Dieser Vorgang steht im Produktivbereich nach der Veröffentlichung bereit.',ARTICLE_GRAPH_INCOMPLETE:'Die Artikelverknüpfungen sind noch nicht vollständig. Der Vorgang bleibt zur Prüfung offen.',AUTHENTICATION_REQUIRED:'Bitte als Administrator anmelden.',ADMIN_REQUIRED:'Dieser Bereich ist nur für Administratoren freigegeben.'};
export async function adminApi(action,input={}){
 try{const {data}=await inventoryAdminClient.functions.invoke('catalogAdmin',{action,...input});return data;}
 catch(error){const code=error.data?.error||error.response?.data?.error;throw Object.assign(new Error(messages[code]||`Änderung nicht bestätigt${code?` (${code})`:''}. Bitte den gespeicherten Stand neu laden.`),{code});}
}
export async function finishCatalogOperation(state,{target_environment,onProgress=()=>{}}={}){
 let current=state;
 for(let i=0;i<1500&&current.operation&&current.operation.status!=='completed';i++){
  onProgress(current);
  current=await adminApi('step',{outlet_id:current.outlet_id,request_id:current.operation.request_id,revision:current.revision,...(target_environment?{target_environment}:{})});
 }
 if(current.operation?.status!=='completed')throw Error('Vorgang noch offen. Bitte den gespeicherten Stand fortsetzen.');onProgress(current);return current;
}
export function workflowLink(workflow,extra={}){
 const params=new URLSearchParams(window.location.search);params.delete('section');params.delete('proposal');params.set('workflow',workflow);
 for(const [key,value]of Object.entries(extra))params.set(key,value);
 return `/InventoryCapture?${params}`;
}
