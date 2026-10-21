import {useRef,useState} from 'react';
import {reviewDeliveryLines} from '../../../../base44/shared/inventory/deliveryReview.js';
import {deliveryExamples} from './reviewExamples.js';
import '../counting/counting.css';
import './deliveryReview.css';

const labels={matched:'Artikel erkannt',ambiguous:'Doppelte Einkaufszuordnung',invalid:'Stammdaten prüfen',needs_assignment:'Zuordnung prüfen',unknown:'Neuer Artikelvorschlag'};
const messages={SUPPLIER_NUMBER_MISSING:'Artikelnummer fehlt – der Name allein bestätigt keinen Artikel.',PURCHASE_UNIT_MISSING:'Einkaufseinheit fehlt.',
    DUPLICATE_SUPPLIER_IDENTITY:'Mehrere Einkaufszuordnungen mit gleicher Nummer und Einheit. Admin muss die Dublette klären.',
    OFFER_NOT_APPROVED:'Einkaufszuordnung noch nicht freigegeben.',GLOBAL_ITEM_MISSING:'Produktverknüpfung fehlt.',UNIQUE_OUTLET_ITEM_REQUIRED:'Standortartikel fehlt oder ist doppelt.',
    ARTICLE_SUPPLIER_LINK_MISMATCH:'Lieferant und Standortartikel passen nicht zusammen.',BASE_UNIT_MISMATCH:'Bestandseinheit widerspricht der Einkaufszuordnung.',
    OFFER_REVISION_REQUIRED:'Prüfstand der Einkaufszuordnung fehlt.',CONVERSION_REQUIRED:'Gebindeinhalt nicht bestätigt.',POSSIBLE_REPEATED_LINE:'Dieser Artikel steht mehrmals auf dem Beleg. Wiederholung oder getrennte Positionen prüfen.',
    POSITIVE_PURCHASE_QUANTITY_REQUIRED:'Gültige positive Liefermenge und Umrechnung erforderlich.',POSITIVE_RECEIPT_PRICE_REQUIRED:'Positiver Nettopreis je Einkaufsgebinde fehlt. Kostenlose Ware benötigt einen gesonderten Nachweis.',
    DESCRIPTION_CHECK_REQUIRED:'Bezeichnung weicht vom zugeordneten Artikel ab. Sorte und Größe vergleichen.',RECEIPT_PRICE_DIFFERS:'Belegpreis weicht ab. Er gilt nur für diese Lieferung; Stammpreis bleibt unverändert.'};
const number=value=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:6}).format(value);

export default function DeliveryReviewWorkspace({initialLines,reviewLines,preview=false}) {
    const [lines,setLines]=useState(()=>initialLines || (preview ? deliveryExamples().lines : []));
    const [result,setResult]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
    const [filter,setFilter]=useState('all');
    const [scenario,setScenario]=useState('everyday');
    const version=useRef(0);
    const change=(id,field,value)=>{version.current++;setResult(null);setError('');setLines(current=>current.map(line=>line.id===id?{...line,[field]:value}:line));};
    const loadScenario=value=>{version.current++;setScenario(value);setLines(deliveryExamples(value).lines);setResult(null);setError('');};
    const check=async()=>{
        const current=++version.current;setBusy(true);setError('');
        try {
            if (!reviewLines && !preview) throw new Error('Review connection required');
            const answer=reviewLines ? await reviewLines(structuredClone(lines))
                : reviewDeliveryLines({...deliveryExamples(scenario),lines});
            if(version.current===current)setResult(answer);
        }catch{if(version.current===current)setError('Prüfung nicht abgeschlossen. Eingaben bleiben erhalten. Bitte erneut prüfen.');}
        finally{setBusy(false);}
    };
    const visible=lines.filter(line=>filter==='all' || result?.lines.find(item=>item.line_id===line.id)?.match!=='matched'
        || result?.lines.find(item=>item.line_id===line.id)?.issues.length);
    return <div className="counting-workspace delivery-workspace">
        <header className="count-top"><div className="count-brand">Shift<span>Cntrl</span><small>INVENTUR & BESTAND</small></div><span className="count-outlet">Kuno15 · {preview?'Vorschau':'Lieferungsprüfung'}</span></header>
        <main className="count-main">
            <div className="count-preview"><strong>{preview?'Bedienvorschau mit erfundenen Testdaten':'Prüfphase'}</strong><span>Diese Ansicht prüft Positionen. Sie bucht keinen Bestand, legt keine Artikel an und speichert keine Lieferung.{preview?' Änderungen gehen beim Neuladen verloren.':''}</span></div>
            <div className="count-title"><div><p className="count-eyebrow">WARENEINGANG · SCHRITT 2 VON 3</p><h1>Lieferung prüfen</h1><p>Erst Artikel und Gebinde zuordnen, dann die geklärten Positionen buchen.</p></div><a href="/counting-preview.html" className="count-link">Zur Zählvorschau</a></div>
            {preview && <div className="count-filters delivery-scenarios" aria-label="Testfall wählen">{[['everyday','9 bekannt · 1 neu'],['conflicts','Dubletten & offene Angaben']].map(([value,label])=><button key={value} aria-pressed={scenario===value} onClick={()=>loadScenario(value)}>{label}</button>)}</div>}
            <div className="delivery-summary" aria-live="polite"><div><strong>{lines.length}</strong><span>Positionen</span></div><div><strong>{result?.summary.matched ?? '–'}</strong><span>Artikel erkannt</span></div><div><strong>{result ? result.lines.filter(line=>line.match!=='matched' || line.issues.length).length:'–'}</strong><span>Hinweise prüfen</span></div><p>Erkannt bedeutet noch nicht freigegeben. Auch eindeutige Zuordnungen brauchen eine Bestätigung.</p></div>
            <div className="count-tools"><div className="count-filters">{[['all','Alle Positionen'],['open','Mit Prüfbedarf']].map(([value,label])=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)} disabled={!result}>{label}</button>)}</div><button className="count-primary" onClick={check} disabled={busy}>{busy?'Prüfung läuft …':'Positionen prüfen'}</button></div>
            {error && <p role="alert" className="count-error">{error}</p>}
            <section className="delivery-lines" aria-label="Lieferpositionen">{visible.map(line=>{
                const diagnosis=result?.lines.find(item=>item.line_id===line.id);
                return <article className="delivery-line" key={line.id}>
                    <div className="delivery-line-title"><span className="count-eyebrow">POSITION {lines.indexOf(line)+1}</span><span className={`delivery-status delivery-status--${diagnosis?.match || 'open'}`}>{diagnosis?labels[diagnosis.match]:'Noch ungeprüft'}</span></div>
                    <label className="delivery-name">Belegbezeichnung<input aria-label={`Bezeichnung ${line.id}`} value={line.original_name} onChange={e=>change(line.id,'original_name',e.target.value)}/></label>
                    <div className="delivery-fields">{[['supplier_article_number','Artikelnummer'],['purchase_unit_code','Einkaufseinheit'],['purchase_quantity','Liefermenge'],['net_purchase_price','Netto / Gebinde (€)']].map(([field,label])=><label key={field}>{label}<input aria-label={`${label} ${line.id}`} inputMode={['purchase_quantity','net_purchase_price'].includes(field)?'decimal':'text'} value={line[field] ?? ''} onChange={e=>change(line.id,field,e.target.value)}/></label>)}</div>
                    {diagnosis && <div className="delivery-diagnosis">
                        {diagnosis.base_quantity!==null && <p className="delivery-conversion">{line.purchase_quantity} {line.purchase_unit_code} = <strong>{number(diagnosis.base_quantity)} {diagnosis.candidates[0]?.unit_abbreviation}</strong>{diagnosis.net_base_unit_price!==null && <span> · {number(diagnosis.net_base_unit_price)} € netto / Basiseinheit</span>}</p>}
                        {diagnosis.issues.map(issue=><p key={issue} className="delivery-warning">{messages[issue] || 'Angabe muss geprüft werden.'}</p>)}
                        {diagnosis.proposal_required && <p className="delivery-proposal">Kein zugeordneter Artikel gefunden. Mitarbeiter können im folgenden Arbeitsschritt einen Vorschlag erfassen; der Admin prüft und gibt ihn frei. Diese Position bleibt bis dahin offen.</p>}
                        {!!diagnosis.candidates.length && <details><summary>{diagnosis.match==='matched'?'Zuordnung ansehen':`${diagnosis.candidate_count} mögliche Zuordnungen ansehen`}</summary>{diagnosis.candidates.map(candidate=><div className="delivery-candidate" key={candidate.supplier_item_id}><strong>{candidate.name}</strong><span>Art. {candidate.supplier_article_number} · {candidate.purchase_unit_code} · {candidate.purchase_unit_label}</span><span>{candidate.base_quantity_per_purchase===null?'Gebindeinhalt offen':`1 Einkaufsgebinde = ${number(candidate.base_quantity_per_purchase)} ${candidate.unit_abbreviation}`}</span></div>)}{diagnosis.candidates_truncated && <p>Weitere Kandidaten vorhanden. Suche muss vor einer Zuordnung eingegrenzt werden.</p>}</details>}
                    </div>}
                </article>;
            })}</section>
            <p className="count-footnote">Unbekannte oder mehrdeutige Positionen bleiben separat offen. Die spätere Buchung der geklärten Positionen muss unabhängig davon möglich sein. Belegscan, Freigabe und Buchung werden im nächsten Schritt angebunden.</p>
        </main>
    </div>;
}
