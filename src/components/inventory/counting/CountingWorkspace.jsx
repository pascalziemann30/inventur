import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Check, ChevronRight, Clock3, Search, SkipForward, Undo2, AlertCircle} from 'lucide-react';
import {countProgress, evaluateCount, resolveEntry, unitsFor} from './countModel.js';
import {createDraftQueue} from './draftQueue.js';
import './counting.css';

const number = value => new Intl.NumberFormat('de-DE', {maximumFractionDigits: 6}).format(value);
const statusLabels = {open: 'Noch offen', counted: 'Gezählt', skipped: 'Übersprungen'};

function CountCard({entry, onChange, disabled}) {
    const [values, setValues] = useState(entry.values || {});
    const [error, setError] = useState(null);
    const result = evaluateCount(entry, values);
    let units;
    try { units = unitsFor(entry); } catch (cause) {
        return <article className="count-card"><h2>{entry.article_name}</h2><p role="alert">{cause.message} Bitte vom Admin prüfen lassen.</p>
            <button disabled={disabled || entry.status === 'skipped'} onClick={() => onChange(resolveEntry(entry, 'skip'))}>Ausdrücklich überspringen</button></article>;
    }
    const changeValue = (code, value) => {
        const updated = {...values, [code]: value};
        setValues(updated);
        setError(null);
        // Every edit is a new unconfirmed count; expected stock is hidden again.
        onChange({...resolveEntry(entry, 'reopen'), values: updated});
    };
    const count = () => {
        try { onChange(resolveEntry(entry, 'count', values)); setError(null); }
        catch (cause) { setError(cause.message); }
    };
    const counted = entry.status === 'counted';
    return <article className={`count-card count-card--${entry.status}`} aria-label={entry.article_name}>
        <div className="count-card-heading"><div><p className="count-category">{entry.category_name || 'Artikel'}</p><h2>{entry.article_name}</h2></div>
            <span className={`count-badge count-badge--${entry.status}`}>{counted && <Check size={13}/>} {statusLabels[entry.status]}</span></div>
        {entry.status === 'skipped' ? <div className="count-skipped"><p>Der bisherige Bestand bleibt erhalten.</p>
            <button className="count-link" disabled={disabled} onClick={() => {setValues({}); onChange({...resolveEntry(entry, 'reopen'), values: {}});}}><Undo2 size={15}/> Wieder aufnehmen</button></div>
            : <>
                <div className="count-inputs">{units.map((unit, index) => <React.Fragment key={unit.code}>
                    {index > 0 && <span className="count-plus" aria-hidden="true">+</span>}
                    <label className="count-field"><span>{unit.label}</span><input type="text" inputMode={unit.whole_numbers_only ? 'numeric' : 'decimal'}
                        aria-label={`${entry.article_name}: ${unit.label}`} value={values[unit.code] ?? ''} placeholder="—" disabled={disabled}
                        onChange={event => changeValue(unit.code, event.target.value)}
                        onKeyDown={event => {if (event.key === 'Enter') {event.preventDefault(); count();}}}/>
                        <small>{number(unit.base_quantity)} {entry.unit_abbreviation} je {unit.label}</small></label>
                </React.Fragment>)}</div>
                <div className="count-result"><span>Gezählte Gesamtmenge</span><strong>{result.quantity === null ? '—' : `${number(result.quantity)} ${entry.unit_abbreviation}`}</strong></div>
                {(error || result.error) && <p className="count-error" role="alert">{error || result.error}</p>}
                {counted && <div className="count-comparison"><span>Erwartet: {number(entry.last_stock)} {entry.unit_abbreviation}</span>
                    <span>Differenz: {number(entry.counted_quantity - entry.last_stock)} {entry.unit_abbreviation}</span></div>}
                <div className="count-card-actions"><button className="count-link" disabled={disabled} onClick={() => {setValues({}); onChange(resolveEntry(entry, 'skip'));}}><SkipForward size={15}/> Überspringen</button>
                    <button className="count-confirm" disabled={disabled || counted || result.quantity === null || !!result.error} onClick={count}>
                        {counted ? <><Check size={16}/> Erfasst</> : <>Menge bestätigen <ChevronRight size={16}/></>}</button></div>
            </>}
    </article>;
}

/** Backend-neutral view. Supply an authenticated CAS adapter before integrating into live routes.
 * Mount with key=session.id so drafts from different sessions cannot share a write queue.
 */
export default function CountingWorkspace({initialEntries, initialRevision = 0, outletName, title = 'Monatsinventur',
    saveDraft, completeSession, preview = false}) {
    const [entries, setEntries] = useState(() => structuredClone(initialEntries));
    const entriesRef = useRef(entries);
    const [saveState, setSaveState] = useState({status: 'saved'});
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [confirm, setConfirm] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [completionError, setCompletionError] = useState(null);
    const dialogRef = useRef(null);
    const queueRef = useRef(null);
    if (!queueRef.current) queueRef.current = createDraftQueue({save: saveDraft, initialRevision, onState: setSaveState});
    const progress = countProgress(entries);
    const visible = useMemo(() => entries.filter(entry => (filter === 'all' || entry.status === filter)
        && entry.article_name.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de'))), [entries, search, filter]);
    const unsaved = saveState.status !== 'saved';
    useEffect(() => {
        if (!unsaved) return;
        const preventLoss = event => {event.preventDefault(); event.returnValue = '';};
        window.addEventListener('beforeunload', preventLoss);
        return () => window.removeEventListener('beforeunload', preventLoss);
    }, [unsaved]);
    useEffect(() => {
        if (!confirm) return;
        dialogRef.current?.showModal();
    }, [confirm]);
    const changeEntry = updated => {
        const next = entriesRef.current.map(entry => entry.article_id === updated.article_id ? updated : entry);
        entriesRef.current = next;
        setEntries(next);
        queueRef.current.enqueue(next);
    };
    const finish = async () => {
        setProcessing(true);
        setCompletionError(null);
        try {
            await queueRef.current.flush();
            if (!countProgress(entriesRef.current).canComplete) throw new Error('Bitte zuerst alle Artikel zählen oder ausdrücklich überspringen.');
            if (!completeSession) throw new Error('Der geprüfte Abschlussweg ist noch nicht verbunden.');
            await completeSession();
            setCompleted(true);
            setConfirm(false);
        } catch (cause) {setCompletionError(cause.message || 'Der Abschluss konnte nicht bestätigt werden.');}
        finally {setProcessing(false);}
    };
    return <div className="counting-workspace">
        <header className="count-top"><div className="count-brand">ShiftCntrl<span>.</span><small>INVENTUR</small></div><span className="count-outlet">{outletName}</span></header>
        <main className="count-main">
            {preview && <aside className="count-preview"><strong>Bedienvorschau mit Beispieldaten</strong><span>Keine Verbindung zu Artikeln oder Beständen. Speicherung nur in diesem Vorschaufenster.</span></aside>}
            <div className="count-title"><div><p className="count-eyebrow">BESTAND AUFNEHMEN</p><h1>{title}</h1><p>Erst zählen. Danach mit dem erwarteten Bestand vergleichen.</p></div>
                <div role="status" className={`count-save count-save--${saveState.status}`}>{saveState.status === 'saved' ? <Check size={16}/> : <Clock3 size={16}/>}
                    {saveState.status === 'saved' ? preview ? 'Vorschau gespeichert' : 'Zwischenstand gespeichert' : saveState.status === 'saving' ? 'Wird gespeichert …' : 'Nicht gespeichert'}
                    {saveState.status === 'error' && <button onClick={() => queueRef.current.retry()}>Erneut versuchen</button>}</div></div>
            {saveState.status === 'error' && <div className="count-error" role="alert"><AlertCircle size={18}/> {saveState.error?.message} Deine Eingaben bleiben im Fenster erhalten. Vor dem Schließen erneut speichern.</div>}
            {completed ? <section className="count-completed" role="status"><Check size={36}/><h2>{preview ? 'Vorschau abgeschlossen' : 'Inventur abgeschlossen'}</h2>
                <p>{progress.counted} gezählt · {progress.skipped} ausdrücklich übersprungen</p>{preview && <p>Es wurde kein echter Bestand verändert.</p>}</section> : <>
                <section className="count-progress" aria-label="Zählfortschritt"><div><strong>{progress.counted + progress.skipped}<span> / {progress.total}</span></strong><p>Artikel bearbeitet</p></div>
                    <div className="count-progress-track" role="progressbar" aria-label="Bearbeitete Artikel" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.counted + progress.skipped}><span style={{width: `${progress.total ? (progress.counted + progress.skipped) / progress.total * 100 : 0}%`}}/></div>
                    <p>{progress.open} offen · {progress.skipped} übersprungen</p></section>
                <div className="count-tools"><label className="count-search"><Search size={17}/><input aria-label="Artikel suchen" placeholder="Artikel suchen …" value={search} onChange={event => setSearch(event.target.value)}/></label>
                    <div className="count-filters" role="group" aria-label="Artikel filtern">{[['all','Alle'],['open','Offen'],['counted','Gezählt'],['skipped','Übersprungen']].map(([value,label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div></div>
                <div className="count-list">{visible.map(entry => <CountCard key={entry.article_id} entry={entry} onChange={changeEntry} disabled={processing || confirm}/>)}
                    {!visible.length && <p className="count-empty">{progress.total ? 'Keine Artikel in dieser Ansicht.' : 'Für diesen Zählrhythmus sind noch keine Artikel eingerichtet.'}</p>}</div>
                <p className="count-footnote">Leer bedeutet noch offen. Mit 0 bestätigst du „nicht vorhanden“. Übersprungene Artikel behalten ihren bisherigen Bestand.</p>
                <footer className="count-bottom"><span>{progress.open ? `${progress.open} Artikel noch offen` : 'Alle Artikel bearbeitet'}</span><button className="count-primary" disabled={!progress.canComplete || unsaved || processing || !completeSession} onClick={() => setConfirm(true)}>{preview ? 'Vorschau abschließen' : 'Inventur abschließen'} <ChevronRight size={18}/></button></footer>
            </>}
        </main>
        {confirm && <dialog ref={dialogRef} className="count-modal" aria-labelledby="count-complete-title" onCancel={event => {event.preventDefault(); if (!processing) setConfirm(false);}}>
            <h2 id="count-complete-title">{preview ? 'Vorschau abschließen?' : 'Inventur abschließen?'}</h2><p>{progress.counted} gezählte Artikel werden {preview ? 'in der Vorschau bestätigt' : 'als neuer Bestand übernommen'}. {progress.skipped} übersprungene Artikel behalten ihren bisherigen Bestand.</p>
            {completionError && <p role="alert" className="count-error">{completionError}</p>}<div><button autoFocus disabled={processing} onClick={() => setConfirm(false)}>Weiter zählen</button><button className="count-primary" disabled={processing} onClick={finish}>{processing ? 'Wird abgeschlossen …' : 'Abschluss bestätigen'}</button></div>
        </dialog>}
    </div>;
}
