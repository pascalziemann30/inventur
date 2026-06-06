import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ClipboardList, X, Info } from 'lucide-react';
import { format } from 'date-fns';

export default function InventoryForm({ open, onClose, onSave, articles }) {
    const [articleId, setArticleId] = useState('');
    const [countedQuantity, setCountedQuantity] = useState('');
    const [inventoryDate, setInventoryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [inventoryType, setInventoryType] = useState('adhoc');
    const [notes, setNotes] = useState('');

    const selectedArticle = articles.find(a => a.id === articleId);

    const resetForm = () => {
        setArticleId('');
        setCountedQuantity('');
        setInventoryDate(format(new Date(), 'yyyy-MM-dd'));
        setInventoryType('adhoc');
        setNotes('');
    };

    useEffect(() => {
        if (!open) resetForm();
    }, [open]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const inventoryData = {
            article_id: articleId,
            article_name: selectedArticle?.name || '',
            counted_quantity: parseFloat(countedQuantity),
            unit_abbreviation: selectedArticle?.unit_abbreviation || '',
            inventory_date: inventoryDate,
            inventory_type: inventoryType,
            notes,
            previous_stock: selectedArticle?.current_stock || 0,
            difference: parseFloat(countedQuantity) - (selectedArticle?.current_stock || 0)
        };
        onSave(inventoryData, selectedArticle);
        resetForm();
    };

    const inputStyle = {
        border: '0.5px solid var(--border)',
        borderRadius: '8px',
        background: 'var(--muted)',
        padding: '6px 10px',
        fontSize: '12px',
        outline: 'none',
        width: '100%',
        color: 'var(--foreground)',
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col p-0 gap-0">
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b bg-white">
                    <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 32, height: 32, background: '#e8f0e4', borderRadius: 8 }}>
                        <ClipboardList style={{ width: 16, height: 16, color: '#2d4a2d' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Neue Inventur starten</p>
                        <p className="text-xs text-muted-foreground">Session-Informationen eingeben</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-md hover:bg-accent transition-colors text-muted-foreground">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1">

                        {/* Artikel */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">Artikel *</label>
                            <Select value={articleId} onValueChange={setArticleId} required>
                                <SelectTrigger style={{ ...inputStyle, padding: '6px 10px', height: 'auto' }}>
                                    <SelectValue placeholder="Artikel wählen..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {articles.map(article => (
                                        <SelectItem key={article.id} value={article.id}>
                                            {article.name} ({article.current_stock} {article.unit_abbreviation})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Menge + Datum */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground block mb-1">Gezählte Menge *</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number" step="0.01" min="0"
                                        value={countedQuantity}
                                        onChange={(e) => setCountedQuantity(e.target.value)}
                                        placeholder="0"
                                        required
                                        style={inputStyle}
                                        onFocus={e => e.target.style.borderColor = '#2d4a2d'}
                                        onBlur={e => e.target.style.borderColor = 'var(--border)'}
                                    />
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        {selectedArticle?.unit_abbreviation || ''}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground block mb-1">Datum *</label>
                                <input
                                    type="date" value={inventoryDate}
                                    onChange={(e) => setInventoryDate(e.target.value)}
                                    required
                                    style={inputStyle}
                                    onFocus={e => e.target.style.borderColor = '#2d4a2d'}
                                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                                />
                            </div>
                        </div>

                        {/* Hinweis-Box wenn Artikel gewählt */}
                        {selectedArticle && (
                            <div className="flex gap-2 p-3 rounded-lg" style={{ background: '#e8f0e4' }}>
                                <Info style={{ width: 14, height: 14, color: '#2d4a2d', flexShrink: 0, marginTop: 1 }} />
                                <div className="text-xs space-y-1" style={{ color: '#2d4a2d' }}>
                                    <div className="flex justify-between gap-4">
                                        <span>Aktueller Bestand:</span>
                                        <span className="font-medium">{selectedArticle.current_stock} {selectedArticle.unit_abbreviation}</span>
                                    </div>
                                    {countedQuantity && (
                                        <div className="flex justify-between gap-4">
                                            <span>Differenz:</span>
                                            <span className={`font-medium ${parseFloat(countedQuantity) - selectedArticle.current_stock >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                                {(parseFloat(countedQuantity) - selectedArticle.current_stock).toFixed(2)} {selectedArticle.unit_abbreviation}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Inventurart */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">Inventurart</label>
                            <Select value={inventoryType} onValueChange={setInventoryType}>
                                <SelectTrigger style={{ ...inputStyle, padding: '6px 10px', height: 'auto' }}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="weekly">Wöchentlich</SelectItem>
                                    <SelectItem value="monthly">Monatlich</SelectItem>
                                    <SelectItem value="yearly">Jährlich</SelectItem>
                                    <SelectItem value="adhoc">Einzelzählung</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Bemerkungen */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">Bemerkungen</label>
                            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional..." style={inputStyle} />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex gap-2 px-5 py-4 border-t bg-white">
                        <button type="button" onClick={onClose}
                            className="flex-1 text-sm font-medium rounded-lg py-2 transition-colors hover:bg-accent text-muted-foreground"
                            style={{ border: '0.5px solid var(--border)', background: 'transparent' }}>
                            Abbrechen
                        </button>
                        <button type="submit"
                            className="flex-1 text-sm font-medium rounded-lg py-2 text-white transition-colors"
                            style={{ background: '#2d4a2d' }}>
                            Session starten
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}