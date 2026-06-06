import React, { useState, useRef } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScanLine, Upload, Loader2, X, Plus, FileText, AlertTriangle, Lightbulb, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';

// ─── Hilfsfunktionen ───────────────────────────────────────────────────────────

const normalize = (str) => {
    if (!str) return '';
    return str
        .toLowerCase()
        .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
        .replace(/gmbh|co\.|kg|&|ltd|llc|inc/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
};

const similarity = (a, b) => {
    const na = normalize(a);
    const nb = normalize(b);
    if (!na || !nb) return 0;
    if (na === nb) return 100;
    if (na.includes(nb) || nb.includes(na)) return 90;
    const wordsA = na.split(' ').filter(w => w.length > 2);
    const wordsB = nb.split(' ').filter(w => w.length > 2);
    if (wordsA.length === 0 || wordsB.length === 0) return 0;
    const common = wordsA.filter(w => wordsB.some(wb => wb.includes(w) || w.includes(wb)));
    return Math.round((common.length / Math.max(wordsA.length, wordsB.length)) * 100);
};

const findArticleMatch = (scannedName, scannedArtikelNr, existingArticles) => {
    if (scannedArtikelNr) {
        const byNr = existingArticles.find(a =>
            a.notes?.includes(scannedArtikelNr) ||
            normalize(a.artikelnummer) === normalize(scannedArtikelNr)
        );
        if (byNr) return { article: byNr, matchType: 'exact', score: 100 };
    }
    let bestMatch = null;
    let bestScore = 0;
    for (const article of existingArticles) {
        const score = similarity(scannedName, article.name || article.display_name);
        if (score > bestScore) {
            bestScore = score;
            bestMatch = article;
        }
    }
    if (bestScore >= 85) return { article: bestMatch, matchType: 'exact', score: bestScore };
    if (bestScore >= 60) return { article: bestMatch, matchType: 'similar', score: bestScore };
    return { article: null, matchType: 'new', score: 0 };
};

// ─── Komponente ────────────────────────────────────────────────────────────────

export default function DeliveryScanner({ open, onClose, onSave, articles = [], suppliers = [], deliveries = [], outletId, outletName }) {
    const [phase, setPhase] = useState('upload');
    const [files, setFiles] = useState([]);
    const [scanResult, setScanResult] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState('');
    const [error, setError] = useState('');
    const [matchedItems, setMatchedItems] = useState([]);
    const fileInputRef = useRef(null);

    const handleFileSelect = (e) => {
        const newFiles = Array.from(e.target.files || []);
        setFiles(prev => {
            const filtered = newFiles.filter(nf =>
                !prev.some(pf => pf.name === nf.name && pf.size === nf.size)
            );
            return [...prev, ...filtered];
        });
        setError('');
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const droppedFiles = Array.from(e.dataTransfer.files || []);
        setFiles(prev => {
            const filtered = droppedFiles.filter(nf =>
                !prev.some(pf => pf.name === nf.name && pf.size === nf.size)
            );
            return [...prev, ...filtered];
        });
    };

    const handleAnalyze = async () => {
        if (files.length === 0) return;
        setIsScanning(true);
        setError('');
        setPhase('scanning');

        try {
            const allArtikel = [];
            let lieferant = null;
            let datum = null;
            let lieferscheinNr = null;
            let gesamtbetrag = 0;

            for (let i = 0; i < files.length; i++) {
                const currentFile = files[i];
                setScanProgress(`Seite ${i + 1} von ${files.length} wird analysiert...`);

                const { file_url } = await base44.integrations.Core.UploadFile({ file: currentFile });
                if (!file_url) continue;

                const result = await base44.integrations.Core.InvokeLLM({
                    prompt: `Du bist ein präziser OCR-Spezialist für Lieferscheine und Rechnungen aus der Gastronomie und Lebensmittelbranche.
Analysiere NUR Seite ${i + 1} dieses Dokuments.
Lies den Text EXAKT so wie er steht - erfinde KEINE Artikel.
${i > 0 ? 'WICHTIG: Lieferant, Datum und Lieferscheinnummer wurden bereits von Seite 1 erfasst. Fokussiere dich auf die Artikel auf dieser Seite.' : ''}
Einheiten: ST, KG, L, KT, GL, BD, SC, Beutel, Packung. Mengen und Preise exakt ablesen.`,
                    file_urls: [file_url],
                    response_json_schema: {
                        type: "object",
                        properties: {
                            lieferant: { type: "string" },
                            lieferschein_nummer: { type: "string" },
                            datum: { type: "string" },
                            artikel: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        name: { type: "string" },
                                        artikelnummer: { type: "string" },
                                        menge: { type: "number" },
                                        einheit: { type: "string" },
                                        einzelpreis: { type: "number" }
                                    },
                                    required: ["name", "menge"]
                                }
                            },
                            gesamtbetrag: { type: "number" }
                        }
                    }
                });

                const parsed = typeof result === 'string' ? JSON.parse(result) : result;

                if (i === 0) {
                    lieferant = parsed.lieferant;
                    datum = parsed.datum;
                    lieferscheinNr = parsed.lieferschein_nummer;
                    gesamtbetrag = parsed.gesamtbetrag || 0;
                }

                if (parsed.artikel && parsed.artikel.length > 0) {
                    for (const artikel of parsed.artikel) {
                        const alreadyExists = allArtikel.some(a =>
                            normalize(a.name) === normalize(artikel.name)
                        );
                        if (!alreadyExists) allArtikel.push(artikel);
                    }
                }
            }

            if (allArtikel.length === 0) {
                throw new Error('Keine Artikel erkannt. Bitte prüfe die Dateiqualität.');
            }

            const mergedResult = { lieferant, lieferschein_nummer: lieferscheinNr, datum, artikel: allArtikel, gesamtbetrag };

            // Duplikat-Prüfung
            if (lieferscheinNr && deliveries) {
                const isDup = deliveries.some(d =>
                    d.delivery_note_number &&
                    normalize(d.delivery_note_number) === normalize(lieferscheinNr)
                );
                if (isDup) {
                    setError(`⚠ Lieferschein Nr. ${lieferscheinNr} wurde bereits gebucht! Bitte prüfe ob das ein Duplikat ist.`);
                }
            }

            // Artikel matchen
            const matched = allArtikel.map(item => {
                const { article, matchType, score } = findArticleMatch(item.name, item.artikelnummer, articles);
                const priceChanged = article && item.einzelpreis > 0 &&
                    Math.abs((article.purchase_price || article.net_purchase_price || 0) - item.einzelpreis) > 0.01;
                return {
                    scannedName: item.name,
                    scannedArtikelNr: item.artikelnummer || null,
                    menge: item.menge || 0,
                    einheit: item.einheit || 'Stk',
                    preis: item.einzelpreis || 0,
                    matchType,
                    matchScore: score,
                    matchedArticle: article || null,
                    userDecision: matchType === 'exact' ? 'accept' : null,
                    priceChanged,
                    oldPrice: article ? (article.purchase_price || article.net_purchase_price || 0) : 0,
                    updatePrice: false
                };
            });

            setScanResult(mergedResult);
            setMatchedItems(matched);
            setPhase('preview');
        } catch (err) {
            console.error('Scan Fehler:', err);
            setError('Fehler: ' + (err.message || 'Unbekannter Fehler — bitte versuche es erneut.'));
            setPhase('upload');
        } finally {
            setIsScanning(false);
            setScanProgress('');
        }
    };

    const pendingSimilar = matchedItems.filter(i => i.matchType === 'similar' && i.userDecision === null).length;

    const handleDecision = (idx, decision) => {
        setMatchedItems(prev => prev.map((item, i) =>
            i === idx ? { ...item, userDecision: decision } : item
        ));
    };

    const handleItemChange = (idx, field, value) => {
        setMatchedItems(prev => prev.map((item, i) =>
            i === idx ? { ...item, [field]: value } : item
        ));
    };

    const handleConfirm = () => {
        const finalItems = matchedItems.map(item => ({
            article_id: (item.matchType === 'exact' || item.userDecision === 'accept')
                ? item.matchedArticle?.id
                : null,
            article_name: item.scannedName,
            quantity: parseFloat(item.menge) || 0,
            unit_abbreviation: item.einheit,
            price: parseFloat(item.preis) || 0,
            update_master_price: item.updatePrice || false,
            is_new_article: item.matchType === 'new' || item.userDecision === 'reject',
            artikelnummer: item.scannedArtikelNr
        }));

        onSave({
            delivery_date: scanResult?.datum || format(new Date(), 'yyyy-MM-dd'),
            supplier_id: '',
            supplier_name: scanResult?.lieferant || '',
            delivery_note_number: scanResult?.lieferschein_nummer || '',
            items: finalItems,
            notes: 'Gescannt via Lieferschein-Scanner',
            is_processed: true,
            scanned: true
        });
        handleClose();
    };

    const handleClose = () => {
        setPhase('upload');
        setFiles([]);
        setScanResult(null);
        setMatchedItems([]);
        setError('');
        onClose();
    };

    // Gruppen für Vorschau
    const exactItems = matchedItems.filter(i => i.matchType === 'exact');
    const similarItems = matchedItems.filter(i => i.matchType === 'similar');
    const newItems = matchedItems.filter(i => i.matchType === 'new' || i.userDecision === 'reject');

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
                {/* Header */}
                <div className="flex items-center gap-3 p-5 border-b border-border">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#e8f0e4', border: '1px solid #c8d5c0' }}>
                        <ScanLine className="w-5 h-5" style={{ color: '#2d4a2d' }} />
                    </div>
                    <div>
                        <p className="font-semibold text-sm text-foreground">Lieferschein scannen</p>
                        <p className="text-xs text-muted-foreground">Foto oder PDF hochladen</p>
                    </div>
                </div>

                <div className="p-5">
                    {/* PHASE: UPLOAD */}
                    {phase === 'upload' && (
                        <div className="space-y-4">
                            {/* Drop-Zone (nur wenn noch keine Dateien) */}
                            {files.length === 0 && (
                                <div
                                    className="border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors"
                                    style={{ borderColor: '#c8d5c0', background: 'rgba(232,240,228,0.3)' }}
                                    onDrop={handleDrop}
                                    onDragOver={(e) => e.preventDefault()}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <div className="space-y-2">
                                        <Upload className="w-10 h-10 mx-auto" style={{ color: '#2d4a2d' }} />
                                        <p className="font-medium text-sm" style={{ color: '#2d4a2d' }}>Lieferschein hier ablegen</p>
                                        <p className="text-xs text-muted-foreground">Foto (JPG, PNG) oder digitaler Lieferschein (PDF) — auch mehrere Seiten möglich</p>
                                        <button
                                            className="mt-2 text-xs px-4 py-1.5 rounded-lg border transition-colors"
                                            style={{ borderColor: '#c8d5c0', color: '#2d4a2d' }}
                                            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                        >
                                            Datei auswählen
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Datei-Kacheln */}
                            {files.length > 0 && (
                                <div
                                    className="rounded-2xl p-3 space-y-2"
                                    style={{ border: '1px solid #c8d5c0', background: 'rgba(232,240,228,0.2)' }}
                                    onDrop={handleDrop}
                                    onDragOver={(e) => e.preventDefault()}
                                >
                                    <div className="flex flex-wrap gap-2">
                                        {files.map((f, idx) => (
                                            <div key={idx} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-[#c8d5c0] text-xs max-w-[200px]">
                                                {f.type.startsWith('image/') ? (
                                                    <img src={URL.createObjectURL(f)} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: '#e8f0e4' }}>
                                                        <FileText className="w-4 h-4" style={{ color: '#2d4a2d' }} />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate" style={{ color: '#2d4a2d' }}>{f.name}</p>
                                                    <p className="text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</p>
                                                </div>
                                                <button
                                                    onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                                                    className="text-muted-foreground hover:text-destructive flex-shrink-0"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs transition-colors"
                                            style={{ border: '1px dashed #c8d5c0', color: '#2d4a2d' }}
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            Weitere Seite
                                        </button>
                                    </div>
                                </div>
                            )}

                            <input
                                ref={fileInputRef}
                                id="file-input"
                                type="file"
                                accept="image/*,.pdf"
                                multiple
                                className="hidden"
                                onChange={handleFileSelect}
                            />

                            {/* Foto-Tipps */}
                            {files.some(f => f.type.startsWith('image/')) && (
                                <div className="rounded-xl p-3 text-xs space-y-1.5" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                                    <div className="flex items-center gap-1.5 font-medium" style={{ color: '#92400e' }}>
                                        <Lightbulb className="w-3.5 h-3.5" />
                                        Tipps für bessere Erkennung:
                                    </div>
                                    <ul className="space-y-1 pl-1" style={{ color: '#78350f' }}>
                                        <li>📐 Dokument gerade und von oben fotografieren</li>
                                        <li>💡 Gute Beleuchtung, kein Blitz direkt auf das Papier</li>
                                        <li>🔍 Gesamtes Dokument im Bild — nicht abschneiden</li>
                                        <li>📄 PDF-Upload ist zuverlässiger als Foto</li>
                                    </ul>
                                </div>
                            )}

                            {error && (
                                <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-xs">
                                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                    {error}
                                </div>
                            )}

                            <div className="flex justify-end gap-2">
                                <button onClick={handleClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                    Abbrechen
                                </button>
                                <button
                                    onClick={handleAnalyze}
                                    disabled={files.length === 0}
                                    className="px-5 py-2 text-sm rounded-xl font-medium text-white transition-opacity disabled:opacity-40"
                                    style={{ background: '#2d4a2d' }}
                                >
                                    {files.length > 1 ? `${files.length} Seiten analysieren` : 'Lieferschein analysieren'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* PHASE: SCANNING */}
                    {phase === 'scanning' && (
                        <div className="flex flex-col items-center justify-center py-16 space-y-4">
                            <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#2d4a2d' }} />
                            <p className="font-medium text-sm text-foreground">{scanProgress || 'Wird analysiert...'}</p>
                            <p className="text-xs text-muted-foreground">Die KI liest Artikel, Mengen und Preise aus</p>
                        </div>
                    )}

                    {/* PHASE: PREVIEW */}
                    {phase === 'preview' && scanResult && (
                        <div className="space-y-4">
                            {/* Foto-Warnung */}
                            {files.some(f => f.type.startsWith('image/')) && (
                                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-700">
                                        Bitte sorgfältig prüfen: Bei Fotos kann die Erkennung ungenau sein.
                                        Kontrolliere alle Artikel, Mengen und Preise bevor du buchst.
                                    </p>
                                </div>
                            )}

                            {/* Duplikat-Fehler */}
                            {error && (
                                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
                                    <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-500" />
                                    {error}
                                </div>
                            )}

                            {/* Lieferant / Datum / Nr. */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Lieferant</label>
                                    <p className="text-xs font-medium text-foreground border border-border rounded-lg px-2.5 py-1.5 bg-muted">{scanResult.lieferant || '—'}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Datum</label>
                                    <p className="text-xs font-medium text-foreground border border-border rounded-lg px-2.5 py-1.5 bg-muted">{scanResult.datum || '—'}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Lieferschein-Nr.</label>
                                    <p className="text-xs font-medium text-foreground border border-border rounded-lg px-2.5 py-1.5 bg-muted">{scanResult.lieferschein_nummer || '—'}</p>
                                </div>
                            </div>

                            {/* SEKTION A — Bekannte Artikel */}
                            {exactItems.length > 0 && (
                                <div className="rounded-xl overflow-hidden" style={{ background: '#e8f0e4', border: '1px solid #c8d5c0' }}>
                                    <div className="flex items-center gap-2 px-3 py-2 border-b border-[#c8d5c0]">
                                        <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#2d4a2d' }} />
                                        <p className="text-xs font-semibold" style={{ color: '#2d4a2d' }}>Bekannte Artikel — werden direkt gebucht</p>
                                    </div>
                                    <table className="w-full text-xs">
                                        <tbody>
                                            {exactItems.map((item, idx) => {
                                                const globalIdx = matchedItems.indexOf(item);
                                                return (
                                                    <React.Fragment key={idx}>
                                                        <tr className="border-b border-[#c8d5c0] last:border-0">
                                                            <td className="px-3 py-2 font-medium" style={{ color: '#2d4a2d' }}>
                                                                {item.matchedArticle?.name || item.scannedName}
                                                            </td>
                                                            <td className="px-3 py-2 text-right w-20">
                                                                <input
                                                                    type="number"
                                                                    value={item.menge}
                                                                    onChange={(e) => handleItemChange(globalIdx, 'menge', e.target.value)}
                                                                    className="w-full text-right bg-transparent outline-none text-xs"
                                                                    style={{ color: '#2d4a2d' }}
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2 text-right w-16 text-[#2d4a2d]">{item.einheit}</td>
                                                            <td className="px-3 py-2 text-right w-20">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={item.preis}
                                                                    onChange={(e) => handleItemChange(globalIdx, 'preis', e.target.value)}
                                                                    className="w-full text-right bg-transparent outline-none text-xs"
                                                                    style={{ color: '#2d4a2d' }}
                                                                />
                                                            </td>
                                                        </tr>
                                                        {item.priceChanged && (
                                                            <tr className="border-b border-[#c8d5c0] last:border-0">
                                                                <td colSpan={4} className="px-3 pb-2">
                                                                    <div className="flex items-center gap-3 p-2 rounded-lg bg-amber-50 border border-amber-200">
                                                                        <p className="text-xs text-amber-700 flex-1">
                                                                            Preis geändert: alt {item.oldPrice.toFixed(2)} € → neu {parseFloat(item.preis).toFixed(2)} €
                                                                        </p>
                                                                        <label className="flex items-center gap-1.5 text-xs text-amber-700 cursor-pointer whitespace-nowrap">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={item.updatePrice}
                                                                                onChange={(e) => handleItemChange(globalIdx, 'updatePrice', e.target.checked)}
                                                                                className="w-3 h-3"
                                                                            />
                                                                            Preis aktualisieren?
                                                                        </label>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* SEKTION B — Ähnliche Artikel */}
                            {similarItems.length > 0 && (
                                <div className="rounded-xl overflow-hidden bg-amber-50 border border-amber-200">
                                    <div className="flex items-center gap-2 px-3 py-2 border-b border-amber-200">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                        <p className="text-xs font-semibold text-amber-700">Bitte prüfen — mögliche Übereinstimmungen</p>
                                    </div>
                                    <div className="divide-y divide-amber-100">
                                        {similarItems.map((item, idx) => {
                                            const globalIdx = matchedItems.indexOf(item);
                                            return (
                                                <div key={idx} className="px-3 py-3 space-y-2">
                                                    <div className="flex items-center gap-2 text-xs flex-wrap">
                                                        <span className="font-medium text-foreground">Gescannt: „{item.scannedName}"</span>
                                                        <span className="text-muted-foreground">könnte sein:</span>
                                                        <span className="font-medium text-amber-800">„{item.matchedArticle?.name}"</span>
                                                        <span className="text-amber-500 text-[10px]">({item.matchScore}% Übereinstimmung)</span>
                                                    </div>
                                                    {item.userDecision === null && (
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleDecision(globalIdx, 'accept')}
                                                                className="text-xs px-3 py-1 rounded-lg font-medium transition-colors"
                                                                style={{ background: '#e8f0e4', border: '1px solid #c8d5c0', color: '#2d4a2d' }}
                                                            >
                                                                ✓ Ja, das ist derselbe Artikel
                                                            </button>
                                                            <button
                                                                onClick={() => handleDecision(globalIdx, 'reject')}
                                                                className="text-xs px-3 py-1 rounded-lg font-medium transition-colors bg-white border border-amber-200 text-amber-700 hover:bg-amber-100"
                                                            >
                                                                + Nein, neu anlegen
                                                            </button>
                                                        </div>
                                                    )}
                                                    {item.userDecision === 'accept' && (
                                                        <p className="text-xs text-green-700">✓ Wird als bekannter Artikel gebucht</p>
                                                    )}
                                                    {item.userDecision === 'reject' && (
                                                        <p className="text-xs text-muted-foreground">+ Wird als neuer Artikel angelegt</p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* SEKTION C — Neue Artikel */}
                            {newItems.length > 0 && (
                                <div className="rounded-xl overflow-hidden bg-muted border border-border">
                                    <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                                        <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                                        <p className="text-xs font-semibold text-muted-foreground">Neue Artikel — werden automatisch angelegt</p>
                                    </div>
                                    <table className="w-full text-xs">
                                        <tbody>
                                            {newItems.map((item, idx) => {
                                                const globalIdx = matchedItems.indexOf(item);
                                                return (
                                                    <tr key={idx} className="border-b border-border last:border-0">
                                                        <td className="px-3 py-2">
                                                            <input
                                                                value={item.scannedName}
                                                                onChange={(e) => handleItemChange(globalIdx, 'scannedName', e.target.value)}
                                                                className="w-full text-xs bg-transparent outline-none border-b border-transparent focus:border-border"
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2 w-20">
                                                            <input
                                                                type="number"
                                                                value={item.menge}
                                                                onChange={(e) => handleItemChange(globalIdx, 'menge', e.target.value)}
                                                                className="w-full text-xs text-right bg-transparent outline-none border-b border-transparent focus:border-border"
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2 w-16">
                                                            <input
                                                                value={item.einheit}
                                                                onChange={(e) => handleItemChange(globalIdx, 'einheit', e.target.value)}
                                                                className="w-full text-xs text-right bg-transparent outline-none border-b border-transparent focus:border-border"
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2 w-20">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={item.preis}
                                                                onChange={(e) => handleItemChange(globalIdx, 'preis', e.target.value)}
                                                                className="w-full text-xs text-right bg-transparent outline-none border-b border-transparent focus:border-border"
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Footer */}
                            <div className="flex justify-between items-center pt-2">
                                <button
                                    onClick={() => setPhase('upload')}
                                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    ← Zurück
                                </button>
                                <div className="flex items-center gap-3">
                                    {pendingSimilar > 0 && (
                                        <p className="text-xs text-amber-600">{pendingSimilar} Artikel noch nicht entschieden</p>
                                    )}
                                    <button
                                        onClick={handleConfirm}
                                        disabled={pendingSimilar > 0}
                                        className="px-5 py-2 text-sm rounded-xl font-medium text-white transition-opacity disabled:opacity-40"
                                        style={{ background: '#2d4a2d' }}
                                    >
                                        Lieferung buchen
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}