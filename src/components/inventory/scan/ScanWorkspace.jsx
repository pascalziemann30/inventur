import {useEffect,useRef,useState} from 'react';
import {scanFields} from '../../../../base44/shared/inventory/deliveryScan.js';
import '../counting/counting.css';
import '../delivery/deliveryReview.css';
import './scan.css';
const labels={original_name:'Belegbezeichnung',supplier_article_number:'Artikelnummer',purchase_unit_code:'Einkaufseinheit',purchase_quantity:'Liefermenge',net_purchase_price:'Netto je Einkaufsgebinde (€)'};
export default function ScanWorkspace({scan,api,onScan,onDraft,outletId,supplierId,readOnly=false}){
    const [busy,setBusy]=useState(false),[error,setError]=useState(''),[lines,setLines]=useState([]),[reference,setReference]=useState(''),[date,setDate]=useState('');
    const [documentChecked,setDocumentChecked]=useState(false),[netChecked,setNetChecked]=useState(false);
    const fileInput=useRef(null),cameraInput=useRef(null);
    useEffect(()=>{
        const source=scan?.frozen_review || scan?.reads?.[0];
        setLines((source?.lines || []).map(row=>({...row,checked:!!scan?.frozen_review})));
        setReference(source?.document_reference || '');setDate(source?.delivery_date || '');setDocumentChecked(false);setNetChecked(false);
    },[scan]);
    const locked=readOnly || busy || ['committing','committed'].includes(scan?.status);
    const run=async action=>{setBusy(true);setError('');try{await action();}catch(cause){setError(cause.message);}finally{setBusy(false);}};
    const upload=async event=>{
        const file=event.target.files?.[0];event.target.value='';if(!file)return;
        if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type) || file.size>10*1024*1024){setError('Bitte JPG, PNG, WebP oder PDF bis 10 MB wählen. HEIC gegebenenfalls zuvor als JPEG exportieren.');return;}
        await run(async()=>onScan(await api('upload',{file,outlet_id:outletId,supplier_id:supplierId})));
    };
    const change=(id,key,value)=>{setLines(rows=>rows.map(row=>row.id===id?{...row,[key]:value,checked:false,edited:true}:row));setDocumentChecked(false);};
    const submit=()=>run(async()=>{const result=await api('commit',{id:scan.id,revision:scan.revision,review:{delivery_date:date,document_reference:reference,document_checked:documentChecked,prices_net_checked:netChecked,lines:lines.map(row=>({id:row.id,...Object.fromEntries(scanFields.map(key=>[key,row[key]])),checked:row.checked}))}});onDraft(result.draft_id);});
    return <section className="scan-workspace">
        <div className="count-title"><div><p className="count-eyebrow">WARENEINGANG · BELEG ERFASSEN</p><h1>Beleg scannen</h1><p>Foto oder Datei → gegenlesen → Artikel zuordnen → ausdrücklich buchen.</p></div></div>
        {error && <p role="alert" className="count-error">{error}</p>}
        {busy && <p role="status" className="count-preview">Vorgang läuft … Die zwei Lesungen können etwas dauern. Diese Seite bitte geöffnet lassen.</p>}
        {!scan && <div className="scan-upload"><h2>Foto oder Datei auswählen</h2><p>Fotografiere den Beleg vollständig, gerade und bei gutem Licht. Kleine Schrift muss beim Vergrößern lesbar sein. Für mehrere Seiten vorerst eine gemeinsame PDF verwenden.</p><div className="delivery-actions"><button className="count-primary" disabled={locked || !outletId || !supplierId} onClick={()=>cameraInput.current.click()}>Foto machen</button><button className="count-confirm" disabled={locked || !outletId || !supplierId} onClick={()=>fileInput.current.click()}>Datei hochladen</button></div><p>JPG, PNG, WebP oder PDF · bis 10 MB · bis 20 Seiten / 100 Positionen. Auf dem iPad wird die Rückkamera angefragt; der Dateiupload bleibt als Alternative verfügbar.</p><input ref={cameraInput} aria-label="Beleg fotografieren" type="file" accept="image/*" capture="environment" onChange={upload} hidden/><input ref={fileInput} aria-label="Belegdatei auswählen" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={upload} hidden/></div>}
        {scan && <>
            <div className="count-preview"><strong>{scan.file_name} · {scan.outlet_name} · {scan.supplier_name}</strong><span>Private Ablage. Keine automatische Artikelanlage, keine Bestandsänderung durch den Scan.</span></div>
            <div className="scan-layout"><aside className="scan-source"><h2>Originalbeleg</h2>{scan.mime==='application/pdf'?<iframe referrerPolicy="no-referrer" title="Originalbeleg PDF" src={scan.source_url}/>:<a href={scan.source_url} target="_blank" rel="noreferrer"><img src={scan.source_url} alt="Hochgeladener Originalbeleg zum Gegenlesen"/></a>}<button className="count-confirm" disabled={busy} onClick={()=>run(async()=>onScan(await api('get',{id:scan.id})))}>Original und gespeicherten Stand neu laden</button><p>Der Originallink läuft nach fünf Minuten ab; bei Bedarf neu laden. Nicht gespeicherte Korrekturen werden dabei verworfen.</p></aside>
            <div>
                {['uploaded','failed','analyzing'].includes(scan.status) && <section className="scan-upload"><h2>{scan.status==='failed'?'Erkennung nicht abgeschlossen':'Beleg auslesen'}</h2>{scan.error && <p className="delivery-warning">{scan.error==='SCAN_RETAKE_REQUIRED'?'Der Beleg ist nicht zuverlässig lesbar oder kein passender Beleg. Bitte ein neues, scharfes Foto verwenden.':'Keine vollständige Lesung gespeichert. Bitte Original prüfen und erneut versuchen.'}</p>}<p>Zwei getrennte Lesungen vergleichen Positionen und Belegkopf. Übereinstimmung ist keine Garantie: Deine Gegenprüfung bleibt erforderlich.</p><button className="count-primary" disabled={locked} onClick={()=>run(async()=>onScan(await api('analyze',{id:scan.id,revision:scan.revision})))}>{scan.status==='analyzing'?'Status prüfen / nach fünf Minuten erneut lesen':'Jetzt auslesen und gegenlesen'}</button></section>}
                {scan.reads?.length>0 && <>
                    <section className="scan-header"><h2>Belegkopf prüfen</h2><p>Gelesener Lieferant: <strong>{scan.reads[0].supplier_name || 'nicht erkannt'}</strong> · ausgewählt: <strong>{scan.supplier_name}</strong></p><p>{scan.reads[0].pages} gelesene Seiten · {scan.reads[0].lines.length} Positionen · Preisbasis {scan.reads[0].price_basis==='net'?'netto':scan.reads[0].price_basis==='gross'?'brutto – Nettowerte manuell prüfen':'unklar – Nettowerte manuell prüfen'}</p>
                    {scan.reads.some(read=>read.quality==='limited') && <p className="delivery-warning">Bildqualität eingeschränkt. Alle Seiten auf fehlende oder abgeschnittene Positionen prüfen; bei Zweifeln neu fotografieren.</p>}
                    {scan.reads.flatMap((read,i)=>read.warnings.map((warning,j)=><p className="delivery-warning" key={`${i}:${j}`}>Lesung {i+1}: {warning}</p>))}
                    {!!scan.comparison?.warnings.length && <p className="delivery-warning">Die Lesungen weichen bei Belegkopf, Seiten- oder Positionszahl ab. Beide Lesungen und sämtliche Originalseiten vergleichen.</p>}
                    <label>Belegreferenz<input aria-label="Gegenprüfung Belegreferenz" value={reference} disabled={locked} onChange={e=>{setReference(e.target.value);setDocumentChecked(false);}}/></label><label>Lieferdatum<input aria-label="Gegenprüfung Lieferdatum" type="date" value={date} disabled={locked} onChange={e=>{setDate(e.target.value);setDocumentChecked(false);}}/></label></section>
                    {lines.map((line,index)=>{
                        const diagnosis=line.edited?null:scan.review?.lines.find(row=>row.line_id===line.id),other=scan.reads[1]?.lines[index];
                        return <article key={line.id} className="delivery-line"><div className="delivery-line-title"><strong>Position {index+1} · Seite {line.page || 'manuell'}</strong><span>{diagnosis?.match==='matched'?'Vorhandener Artikel gefunden – noch nicht zugeordnet':diagnosis?.candidates.length?'Ähnliche vorhandene Artikel prüfen':'Zuordnung noch offen'}</span></div><p className="scan-raw">Originallesung: {line.source_text || 'manuell ergänzt'}</p>{!!scan.comparison?.lines[index]?.disagreements.length && <p className="delivery-warning">Abweichende Lesungen – diese Position besonders prüfen.</p>}
                            <div className="delivery-fields">{scanFields.map(field=><label key={field}>{labels[field]}<input aria-label={`${labels[field]} ${line.id}`} value={line[field]} disabled={locked} onChange={e=>change(line.id,field,e.target.value)}/></label>)}</div>
                            {diagnosis?.candidates.length>0 && <p>Vorschläge: {diagnosis.candidates.map(row=>`${row.name} (${row.supplier_article_number} / ${row.purchase_unit_code})`).join(' · ')}</p>}
                            <details><summary>Zweite Lesung vergleichen</summary><p>{other?.source_text || 'Keine entsprechende Zeile in der Kontrolllesung'}</p>{other && <p>{other.original_name} · {other.supplier_article_number} · {other.purchase_quantity} {other.purchase_unit_code} · {other.net_purchase_price || 'kein Nettopreis'} €</p>}</details>
                            <label className="delivery-check"><input type="checkbox" checked={line.checked} disabled={locked} onChange={e=>setLines(rows=>rows.map(row=>row.id===line.id?{...row,checked:e.target.checked}:row))}/>Bezeichnung, Nummer, Menge, Gebinde und Nettopreis mit dem Original verglichen</label>
                        </article>;
                    })}
                    <details className="scan-header"><summary>Vollständige Kontrolllesung · auch zusätzliche Zeilen prüfen</summary>{scan.reads[1]?.lines.map((line,i)=><p key={i}>Seite {line.page}: {line.source_text} · {line.purchase_quantity} {line.purchase_unit_code} · {line.net_purchase_price} €</p>)}</details>
                    <button className="count-confirm" disabled={locked || lines.length>=100} onClick={()=>{setLines(rows=>[...rows,{id:crypto.randomUUID(),...Object.fromEntries(scanFields.map(field=>[field,''])),checked:false}]);setDocumentChecked(false);}}>Fehlende Position ergänzen</button>
                    <section className="delivery-booking"><h2>Gegenprüfung abschließen</h2><label className="delivery-check"><input type="checkbox" disabled={locked} checked={netChecked} onChange={e=>setNetChecked(e.target.checked)}/>Preise sind geprüfte Nettopreise je Einkaufsgebinde; fehlende Preise bleiben offen</label><label className="delivery-check"><input type="checkbox" disabled={locked} checked={documentChecked} onChange={e=>setDocumentChecked(e.target.checked)}/>Lieferant, Referenz, Datum und alle Originalseiten vollständig geprüft; zusätzliche oder wiederholte Positionen berücksichtigt</label><p>Die Übernahme erstellt nur einen Lieferentwurf. Artikelzuordnung und Bestandsbuchung werden danach gesondert bestätigt.</p><button className="count-primary" disabled={locked || !documentChecked || !netChecked || !reference.trim() || !date || lines.some(row=>!row.checked || !row.original_name.trim())} onClick={submit}>Geprüft als Lieferentwurf übernehmen</button>{scan.status==='committing' && <button className="count-confirm" disabled={readOnly || busy} onClick={submit}>Gleiche Übernahme fortsetzen</button>}{scan.draft_id && <button className="count-confirm" onClick={()=>onDraft(scan.draft_id)}>Gespeicherten Lieferentwurf öffnen</button>}</section>
                </>}
            </div></div>
        </>}
    </section>;
}
