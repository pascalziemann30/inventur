import {useState} from 'react';
import {createClient} from '@base44/sdk';
import {appParams} from '@/lib/app-params';
import {verifiedAccessCheckResult} from './accessCheckResult.js';
import {inventoryAdminTestClient} from '../counting/testClient.js';
// Used only for the explicitly chosen read-only production access check, never for operational workflows.
const productionReadClient=createClient({appId:appParams.appId,token:appParams.token,functionsVersion:appParams.functionsVersion,serverUrl:'',appBaseUrl:appParams.appBaseUrl,requiresAuth:false,headers:{'X-Data-Env':'prod'}});
const label = state => ({allowed:'erlaubt',denied:'gesperrt',no_sample:'kein Beispieldatensatz',untested:'nicht geprüft',error:'Prüfung fehlgeschlagen',not_probed:'hier nicht geprüft'}[state] || 'nicht bestätigt');
export default function DataAccessCheckPage() {
 const [result,setResult]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const run=async(environment)=>{setBusy(true);setError('');setResult(null);try{const response=await (environment==='prod'?productionReadClient:inventoryAdminTestClient).functions.invoke(environment==='prod'?'verifyInventoryProductionReadAccess':'verifyInventoryAccessV2',{action:'check'});setResult(verifiedAccessCheckResult(response.data,environment));}catch{setError('Prüfung oder angeforderter Datenbereich konnten nicht bestätigt werden. Bitte die aktuelle Prüffassung erneut laden.');}finally{setBusy(false);}};
 return <main className="max-w-4xl mx-auto p-6 space-y-4">
  <h1 className="text-2xl font-semibold">Datenzugriffe prüfen</h1><p>Admin-Prüfung vorhandener Datensätze. Es werden keine Artikel oder Bestände verändert.</p>
  <button className="border rounded-lg p-3" disabled={busy} onClick={()=>run('dev')}>{busy?'Prüfung läuft …':'Testdaten prüfen'}</button>
  <button className="border rounded-lg p-3 ml-2" disabled={busy} onClick={()=>run('prod')}>Produktivdaten: nur Leserechte prüfen</button>
  {error&&<p role="alert">{error}</p>}
  {result&&<><h2 className="font-semibold" role="status">{result.passed?'Leserechte für vorhandene Datensätze bestätigt':'Mindestens eine Datenregel ist noch nicht bestätigt'}</h2>
   <p>Geprüfter Bereich: <strong>{result.data_environment==='prod'?'Produktivdaten':result.data_environment==='dev'?'Testdaten':'nicht bestätigt'}</strong></p>
   <p>{result.tested_models} Tabellen mit vorhandenen Datensätzen geprüft; {result.empty_models} Tabellen ohne Beispieldatensatz.</p>
   <p>Ohne Anmeldung darf kein Beispieldatensatz lesbar sein. Interne Buchungsdaten sind auch für direkte Admin-Abfragen gesperrt und bleiben über geprüfte Serverfunktionen erreichbar.</p>
   <table className="w-full text-sm text-left"><thead><tr><th>Tabelle</th><th>Serverzugriff</th><th>Admin direkt</th><th>Ohne Anmeldung</th></tr></thead><tbody>{result.checks.map(row=><tr key={row.entity}><td>{row.entity}</td><td>{label(row.service_read)}</td><td>{label(row.admin_read)}</td><td>{label(row.anonymous_read)}</td></tr>)}</tbody></table>
   <p>Serverzugriffe wurden separat im Testbereich geprüft. Die Produktivprüfung verwendet ausschließlich die echten Benutzerrechte des Administrators.</p>
   <p>Diese Prüfung liest ausschließlich Daten. Schreibregeln und Tabellen ohne Beispieldatensatz werden zusätzlich anhand des vollständigen Regelwerks geprüft. Ein separates normales Base44-Mitarbeiterkonto wurde hierfür nicht angelegt.</p>
  </>}
 </main>;
}
