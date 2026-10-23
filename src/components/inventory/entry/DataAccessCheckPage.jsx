import {useState} from 'react';
import {inventoryAdminTestClient} from '../counting/testClient.js';
export default function DataAccessCheckPage() {
 const [result,setResult]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const run=async()=>{setBusy(true);setError('');setResult(null);try{const response=await inventoryAdminTestClient.functions.invoke('verifyInventoryAccess',{action:'check'});setResult(response.data);}catch{setError('Prüfung nicht erreichbar oder keine Administratorberechtigung.');}finally{setBusy(false);}};
 return <main className="max-w-4xl mx-auto p-6 space-y-4">
  <h1 className="text-2xl font-semibold">Datenzugriffe prüfen</h1><p>Admin-Prüfung mit vorhandenen Testdaten. Es werden keine Artikel oder Bestände verändert.</p>
  <button className="border rounded-lg p-3" disabled={busy} onClick={run}>{busy?'Prüfung läuft …':'Zugriffsprüfung starten'}</button>
  {error&&<p role="alert">{error}</p>}
  {result&&<><h2 className="font-semibold" role="status">{result.passed?'Leserechte für vorhandene Testdatensätze bestätigt':'Mindestens eine Datenregel ist noch nicht bestätigt'}</h2>
   <p>{result.tested_models} Tabellen mit vorhandenen Testdaten geprüft; {result.empty_models} Tabellen ohne Beispieldatensatz.</p>
   <p>Ohne Anmeldung darf kein Beispieldatensatz lesbar sein. Interne Buchungsdaten sind auch für direkte Admin-Abfragen gesperrt und bleiben über geprüfte Serverfunktionen erreichbar.</p>
   <table className="w-full text-sm text-left"><thead><tr><th>Tabelle</th><th>Serverzugriff</th><th>Admin direkt</th><th>Ohne Anmeldung</th></tr></thead><tbody>{result.checks.map(row=><tr key={row.entity}><td>{row.entity}</td><td>{row.service_read}</td><td>{row.admin_read}</td><td>{row.anonymous_read}</td></tr>)}</tbody></table>
   <p>Diese Prüfung liest ausschließlich Daten. Schreibregeln und Tabellen ohne Beispieldatensatz werden zusätzlich anhand des vollständigen Regelwerks geprüft. Ein separates normales Base44-Mitarbeiterkonto wurde hierfür nicht angelegt.</p>
  </>}
 </main>;
}
