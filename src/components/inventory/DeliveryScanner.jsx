import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScanLine, Upload, Loader2, X, Plus, FileText, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';

const normalize = (s) => s?.toLowerCase().trim().replace(/\s+/g, ' ') || '';

export default function DeliveryScanner({ open, onClose, onSave, articles = [], suppliers = [], deliveries = [], outletId, outletName }) {
    const [phase, setPhase] = useState('upload');
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [scanResult, setScanResult] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState('');
    const [editedItems, setEditedItems] = useState([]);
    const [editedSupplier, setEditedSupplier] = useState('');
    const [editedDate, setEditedDate] = useState('');
    const [editedNoteNumber, setEditedNoteNumber] = useState('');
    const [ignoreDuplicate, setIgnoreDuplicate] = useState(false);
    const fileInputRef = useRef(null);

    const isPdf = file?.type === 'application/pdf';

    const handleFileSelect = (selectedFile) => {
        if (!selectedFile) return;
        setFile(selectedFile);
        setError('');
        if (selectedFile.type.startsWith('image/')) {
            setPreview(URL.createObjectURL(selectedFile));
        } else {
            setPreview(null);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const dropped = e.dataTransfer.files[0];
        if (dropped) handleFileSelect(dropped);
    };

    const handleAnalyze = async () => {
        if (!file) return;
        setIsScanning(true);
        setError('');
        setPhase('scanning');

        try {
            // Schritt 1: Datei hochladen und öffentliche URL bekommen
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            if (!file_url) throw new Error('Datei konnte nicht hochgeladen werden');

            // Schritt 2: InvokeLLM mit file_urls + response_json_schema
            const result = await base44.integrations.Core.InvokeLLM({
                prompt: `Du bist ein Experte für Lieferschein-Analyse. 
Analysiere das beigefügte Dokument (Lieferschein, Bestellung oder Rechnung) und extrahiere alle relevanten Daten.
Gib alle Artikel zurück die du findest, inklusive Mengen, Einheiten und Preise.
Wenn das Datum nicht eindeutig ist, verwende das Bestelldatum oder Lieferdatum.
Antworte NUR mit dem strukturierten JSON-Objekt gemäß Schema.`,
                file_urls: [file_url],
                response_json_schema: {
                    type: "object",
                    properties: {
                        lieferant: { type: "string", description: "Name des Lieferanten" },
                        lieferschein_nummer: { type: "string", description: "Lieferschein-, Bestell- oder Rechnungsnummer" },
                        datum: { type: "string", description: "Datum im Format YYYY-MM-DD" },
                        artikel: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    name: { type: "string", description: "Artikelname" },
                                    artikelnummer: { type: "string", description: "Artikelnummer" },
                                    menge: { type: "number", description: "Menge als Zahl" },
                                    einheit: { type: "string", description: "Einheit z.B. ST, KG, L" },
                                    einzelpreis: { type: "number", description: "Preis pro Einheit in Euro" }
                                },
                                required: ["name", "menge"]
                            }
                        },
                        gesamtbetrag: { type: "number", description: "Gesamtbetrag in Euro" }
                    },
                    required: ["lieferant", "artikel"]
                }
            });

            const parsed = typeof result === 'string' ? JSON.parse(result) : result;

            if (!parsed || !parsed.artikel || parsed.artikel.length === 0) {
                throw new Error('Keine Artikel erkannt. Bitte stelle sicher dass das Dokument lesbar ist.');
            }

            // Artikel mit bekannten Items abgleichen
            const matchedItems = parsed.artikel.map(item => {
                const match = articles.find(a =>
                    normalize(a.name).includes(normalize(item.name)) ||
                    normalize(item.name).includes(normalize(a.name))
                );
                return { ...item, match, status: match ? 'known' : 'new' };
            });

            setScanResult(parsed);
            setEditedItems(matchedItems);
            setEditedSupplier(parsed.lieferant || '');
            setEditedDate(parsed.datum || format(new Date(), 'yyyy-MM-dd'));
            setEditedNoteNumber(parsed.lieferschein_nummer || '');
            setIgnoreDuplicate(false);
            setPhase('preview');
        } catch (err) {
            console.error('Scan Fehler:', err);
            setError('Fehler: ' + (err.message || 'Unbekannter Fehler — bitte versuche es erneut.'));
            setPhase('upload');
        } finally {
            setIsScanning(false);
        }
    };

    const isDuplicate = deliveries?.some(d =>
        d.delivery_note_number &&
        editedNoteNumber &&
        d.delivery_note_number === editedNoteNumber
    );

    const newItemsCount = editedItems.filter(i => i.status === 'new').length;

    const handleItemChange = (idx, field, value) => {
        setEditedItems(prev => prev.map((item, i) =>
            i === idx ? { ...item, [field]: value } : item
        ));
    };

    const handleRemoveItem = (idx) => {
        setEditedItems(prev => prev.filter((_, i) => i !== idx));
    };

    const handleAddItem = () => {
        setEditedItems(prev => [...prev, { name: '', menge: 1, einheit: 'Stk', einzelpreis: 0, status: 'new', match: null }]);
    };

    const handleConfirm = () => {
        const matchedSupplier = suppliers.find(s =>
            normalize(s.name).includes(normalize(editedSupplier)) ||
            normalize(editedSupplier).includes(normalize(s.name))
        );

        onSave({
            delivery_date: editedDate,
            supplier_id: matchedSupplier?.id || '',
            supplier_name: editedSupplier,
            delivery_note_number: editedNoteNumber,
            items: editedItems.map(item => ({
                article_id: item.match?.id || null,
                article_name: item.name,
                quantity: parseFloat(item.menge) || 0,
                unit_abbreviation: item.einheit,
                price: parseFloat(item.einzelpreis) || 0,
                update_master_price: false,
                is_new_article: item.status === 'new',
                suggested_category: null
            })),
            notes: 'Gescannt via Lieferschein-Scanner',
            is_processed: true,
            scanned: true
        });
        handleClose();
    };

    const handleClose = () => {
        setPhase('upload');
        setFile(null);
        setPreview(null);
        setScanResult(null);
        setEditedItems([]);
        setError('');
        onClose();
    };

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
                            <div
                                className="border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors"
                                style={{ borderColor: '#c8d5c0', background: 'rgba(232,240,228,0.3)' }}
                                onDrop={handleDrop}
                                onDragOver={(e) => e.preventDefault()}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {file ? (
                                    <div className="space-y-3">
                                        {preview ? (
                                            <img src={preview} alt="Vorschau" className="max-h-48 mx-auto rounded-xl object-contain" />
                                        ) : (
                                            <div className="flex flex-col items-center gap-2">
                                                <FileText className="w-12 h-12" style={{ color: '#2d4a2d' }} />
                                                <p className="text-sm font-medium" style={{ color: '#2d4a2d' }}>{file.name}</p>
                                            </div>
                                        )}
                                        <p className="text-xs text-muted-foreground">Klicken zum Ändern</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Upload className="w-10 h-10 mx-auto" style={{ color: '#2d4a2d' }} />
                                        <p className="font-medium text-sm" style={{ color: '#2d4a2d' }}>Lieferschein hier ablegen</p>
                                        <p className="text-xs text-muted-foreground">Foto (JPG, PNG) oder digitaler Lieferschein (PDF)</p>
                                        <button
                                            className="mt-2 text-xs px-4 py-1.5 rounded-lg border transition-colors"
                                            style={{ borderColor: '#c8d5c0', color: '#2d4a2d' }}
                                            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                        >
                                            Datei auswählen
                                        </button>
                                    </div>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,.pdf"
                                    className="hidden"
                                    onChange={(e) => handleFileSelect(e.target.files[0])}
                                />
                            </div>

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
                                    disabled={!file}
                                    className="px-5 py-2 text-sm rounded-xl font-medium text-white transition-opacity disabled:opacity-40"
                                    style={{ background: '#2d4a2d' }}
                                >
                                    Lieferschein analysieren
                                </button>
                            </div>
                        </div>
                    )}

                    {/* PHASE: SCANNING */}
                    {phase === 'scanning' && (
                        <div className="flex flex-col items-center justify-center py-16 space-y-4">
                            <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#2d4a2d' }} />
                            <p className="font-medium text-sm text-foreground">Lieferschein wird analysiert...</p>
                            <p className="text-xs text-muted-foreground">Die KI liest Artikel, Mengen und Preise aus</p>
                        </div>
                    )}

                    {/* PHASE: PREVIEW */}
                    {phase === 'preview' && (
                        <div className="space-y-4">
                            {/* Duplicate warning */}
                            {isDuplicate && !ignoreDuplicate && (
                                <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-xs font-medium text-amber-700">
                                            Dieser Lieferschein (Nr. {editedNoteNumber}) wurde bereits eingetragen.
                                        </p>
                                        <button
                                            onClick={() => setIgnoreDuplicate(true)}
                                            className="text-xs text-amber-600 underline mt-1"
                                        >
                                            Trotzdem fortfahren
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Info fields */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Lieferant</label>
                                    <input
                                        value={editedSupplier}
                                        onChange={(e) => setEditedSupplier(e.target.value)}
                                        className="w-full text-xs border border-border rounded-lg px-2.5 py-1.5 bg-background outline-none focus:ring-1"
                                        style={{ '--tw-ring-color': '#2d4a2d' }}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Datum</label>
                                    <input
                                        type="date"
                                        value={editedDate}
                                        onChange={(e) => setEditedDate(e.target.value)}
                                        className="w-full text-xs border border-border rounded-lg px-2.5 py-1.5 bg-background outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Lieferschein-Nr.</label>
                                    <input
                                        value={editedNoteNumber}
                                        onChange={(e) => setEditedNoteNumber(e.target.value)}
                                        className="w-full text-xs border border-border rounded-lg px-2.5 py-1.5 bg-background outline-none"
                                    />
                                </div>
                            </div>

                            {/* Article table */}
                            <div className="border border-border rounded-xl overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-border bg-muted">
                                            <th className="text-left px-3 py-2 font-medium text-muted-foreground w-5"></th>
                                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Artikel</th>
                                            <th className="text-right px-3 py-2 font-medium text-muted-foreground w-20">Menge</th>
                                            <th className="text-right px-3 py-2 font-medium text-muted-foreground w-16">Einheit</th>
                                            <th className="text-right px-3 py-2 font-medium text-muted-foreground w-20">Preis</th>
                                            <th className="w-8"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {editedItems.map((item, idx) => (
                                            <tr key={idx} className="border-b border-border last:border-0">
                                                <td className="px-3 py-2">
                                                    <div
                                                        className="w-2 h-2 rounded-full"
                                                        style={{ background: item.status === 'known' ? '#22c55e' : '#f59e0b' }}
                                                        title={item.status === 'known' ? 'Bekannter Artikel' : 'Neuer Artikel'}
                                                    />
                                                </td>
                                                <td className="px-3 py-1.5">
                                                    <input
                                                        value={item.name}
                                                        onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                                                        className="w-full text-xs bg-transparent outline-none border-b border-transparent focus:border-border"
                                                    />
                                                </td>
                                                <td className="px-3 py-1.5">
                                                    <input
                                                        type="number"
                                                        value={item.menge}
                                                        onChange={(e) => handleItemChange(idx, 'menge', e.target.value)}
                                                        className="w-full text-xs text-right bg-transparent outline-none border-b border-transparent focus:border-border"
                                                    />
                                                </td>
                                                <td className="px-3 py-1.5">
                                                    <input
                                                        value={item.einheit}
                                                        onChange={(e) => handleItemChange(idx, 'einheit', e.target.value)}
                                                        className="w-full text-xs text-right bg-transparent outline-none border-b border-transparent focus:border-border"
                                                    />
                                                </td>
                                                <td className="px-3 py-1.5">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={item.einzelpreis}
                                                        onChange={(e) => handleItemChange(idx, 'einzelpreis', e.target.value)}
                                                        className="w-full text-xs text-right bg-transparent outline-none border-b border-transparent focus:border-border"
                                                    />
                                                </td>
                                                <td className="px-2 py-1.5">
                                                    <button
                                                        onClick={() => handleRemoveItem(idx)}
                                                        className="text-muted-foreground hover:text-destructive transition-colors"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="px-3 py-2 border-t border-border">
                                    <button
                                        onClick={handleAddItem}
                                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Artikel hinzufügen
                                    </button>
                                </div>
                            </div>

                            {/* New items hint */}
                            {newItemsCount > 0 && (
                                <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: '#fef3e2', border: '1px solid #e8c8a0' }}>
                                    <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: '#a06020' }} />
                                    <p className="text-xs" style={{ color: '#a06020' }}>
                                        {newItemsCount} neue Artikel werden automatisch angelegt
                                    </p>
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
                                <button
                                    onClick={handleConfirm}
                                    disabled={isDuplicate && !ignoreDuplicate}
                                    className="px-5 py-2 text-sm rounded-xl font-medium text-white transition-opacity disabled:opacity-40"
                                    style={{ background: '#2d4a2d' }}
                                >
                                    Lieferung buchen
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}