import React, {useEffect, useState} from 'react';
import {base44} from '@/api/base44Client';
import './counting.css';

/** Actual preview invocation, so the SDK carries this preview's branch/test context.
 * Backend identity, admin check and diagnostic switch remain authoritative.
 */
export default function StorageVerificationPanel() {
    const [access, setAccess] = useState('loading');
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState(null);
    useEffect(() => {
        let active = true;
        base44.auth.me().then(user => {if (active) setAccess(user?.role === 'admin' ? 'admin' : 'denied');})
            .catch(() => {if (active) setAccess('denied');});
        return () => {active = false;};
    }, []);
    const run = async () => {
        setRunning(true); setResult(null);
        try {
            const response = await base44.functions.invoke('verifyBookingStorage', {});
            setResult(response.data);
        } catch (error) {
            setResult({passed:false, error:'PROBE_REQUEST_FAILED', platform_status:error.status ?? error.response?.status ?? null});
        } finally {setRunning(false);}
    };
    return <div className="counting-workspace"><header className="count-top"><div className="count-brand">ShiftCntrl.<small>SPEICHERPRÜFUNG</small></div></header>
        <main className="count-main"><h1>Isolierten Buchungsweg prüfen</h1>
            <p>Diese Diagnose verwendet ausschließlich die eigene Prüftabelle. Sie verändert keine Artikel oder echten Bestände und aktiviert keine Buchungen.</p>
            {access === 'loading' ? <p role="status">Berechtigung wird geprüft …</p> : access === 'denied'
                ? <p role="alert" className="count-error">Eine echte Anmeldung als App-Administrator ist erforderlich.</p>
                : <><aside className="count-preview">Für diese Prüfung muss in der Base44-Vorschau der Testdatenschalter aktiviert sein. Die zusätzliche Serverfreigabe bleibt erforderlich.</aside>
                    <button className="count-primary" disabled={running} onClick={run}>{running ? 'Prüfung läuft …' : 'Speichertest ausführen'}</button>
                    {result && <section aria-label="Prüfergebnis"><h2>{result.passed && result.cleanup_completed ? 'Speichertest bestanden' : 'Speichertest nicht freigegeben'}</h2><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(result,null,2)}</pre></section>}</>}
        </main></div>;
}
