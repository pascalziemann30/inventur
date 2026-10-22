import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Truck, Search, X } from 'lucide-react';
import { format } from 'date-fns';

export default function DeliveryForm({ open, onClose, onSave, articles, suppliers }) {
    const [deliveryDate, setDeliveryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [supplierId, setSupplierId] = useState('');
    const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('');
    const [items, setItems] = useState([]);
    const [notes, setNotes] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [priceChanges, setPriceChanges] = useState({});

    const resetForm = () => {
        setDeliveryDate(format(new Date(), 'yyyy-MM-dd'));
        setSupplierId('');
        setDeliveryNoteNumber('');
        setItems([]);
        setNotes('');
        setSearchTerm('');
        setPriceChanges({});
    };

    useEffect(() => {
        if (!open) resetForm();
    }, [open]);

    useEffect(() => {
        if (supplierId) {
            const supplierArticles = articles.filter(a => a.supplier_id === supplierId);
            setItems(supplierArticles.map(article => ({
                article_id: article.id,
                article_name: article.name,
                unit_abbreviation: article.unit_abbreviation,
                quantity: '',
                current_price: article.purchase_price || 0,
                new_price: article.purchase_price || 0,
                update_master_price: false
            })));
        } else {
            setItems([]);
        }
    }, [supplierId, articles]);

    const updateItem = (articleId, field, value) => {
        setItems(items.map(item =>
            item.article_id === articleId ? { ...item, [field]: value } : item
        ));
    };

    const handlePriceChange = (articleId, newPrice) => {
        const item = items.find(i => i.article_id === articleId);
        if (item && parseFloat(newPrice) !== item.current_price) {
            setPriceChanges({ ...priceChanges, [articleId]: true });
        } else {
            const updated = { ...priceChanges };
            delete updated[articleId];
            setPriceChanges(updated);
        }
        updateItem(articleId, 'new_price', parseFloat(newPrice) || 0);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const deliveryItems = items
            .filter(item => item.quantity && parseFloat(item.quantity) > 0)
            .map(item => ({
                article_id: item.article_id,
                article_name: item.article_name,
                quantity: parseFloat(item.quantity),
                unit_abbreviation: item.unit_abbreviation,
                price: item.new_price,
                update_master_price: item.update_master_price
            }));
        if (deliveryItems.length === 0) { alert('Bitte mindestens einen Artikel mit Menge eingeben'); return; }
        const selectedSupplier = suppliers?.find(s => s.id === supplierId);
        onSave({
            delivery_date: deliveryDate,
            supplier_id: supplierId,
            supplier_name: selectedSupplier?.name || '',
            delivery_note_number: deliveryNoteNumber,
            items: deliveryItems,
            notes,
            is_processed: true
        });
        resetForm();
    };

    const filteredItems = searchTerm
        ? items.filter(item => item.article_name.toLowerCase().includes(searchTerm.toLowerCase()))
        : items;

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
            <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b bg-white">
                    <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 32, height: 32, background: '#e8f0e4', borderRadius: 8 }}>
                        <Truck style={{ width: 16, height: 16, color: '#2d4a2d' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Wareneingang erfassen</p>
                        <p className="text-xs text-muted-foreground">Eingang dokumentieren</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-md hover:bg-accent transition-colors text-muted-foreground">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1">
                        {/* Datum + Lieferschein */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground block mb-1">Lieferdatum *</label>
                                <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} required style={inputStyle} />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground block mb-1">Lieferschein-Nr.</label>
                                <input value={deliveryNoteNumber} onChange={(e) => setDeliveryNoteNumber(e.target.value)} placeholder="Optional" style={inputStyle} />
                            </div>
                        </div>

                        {/* Lieferant */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">Lieferant *</label>
                            <Select value={supplierId} onValueChange={setSupplierId} required>
                                <SelectTrigger style={{ ...inputStyle, padding: '6px 10px', height: 'auto' }}>
                                    <SelectValue placeholder="Lieferant wählen..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {suppliers?.filter(s => s.is_active !== false).map(supplier => (
                                        <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {supplierId && (
                            <>
                                {/* Suche */}
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground block mb-1">Artikel suchen</label>
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                        <input
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            placeholder="Artikel durchsuchen..."
                                            style={{ ...inputStyle, paddingLeft: '28px' }}
                                        />
                                    </div>
                                </div>

                                {/* Tabelle */}
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground block mb-1">Gelieferte Artikel</label>
                                    {filteredItems.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-4">Keine Artikel für diesen Lieferanten vorhanden</p>
                                    ) : (
                                        <div className="rounded-lg overflow-hidden" style={{ border: '0.5px solid var(--border)' }}>
                                            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs text-muted-foreground border-b" style={{ background: 'var(--muted)' }}>
                                                <div className="col-span-4">Artikel</div>
                                                <div className="col-span-2 text-right">Menge</div>
                                                <div className="col-span-3 text-right">Preis/Einheit</div>
                                                <div className="col-span-3 text-center">Preis aktualisieren?</div>
                                            </div>
                                            <div className="max-h-80 overflow-y-auto">
                                                {filteredItems.map((item) => {
                                                    const hasPriceChange = priceChanges[item.article_id];
                                                    return (
                                                        <div key={item.article_id}
                                                            className="grid grid-cols-12 gap-2 px-3 py-2 items-center hover:bg-accent transition-colors"
                                                            style={{ borderBottom: '0.5px solid var(--border)', background: hasPriceChange ? '#e8f0e4' : undefined }}
                                                        >
                                                            <div className="col-span-4 text-sm font-medium">{item.article_name}</div>
                                                            <div className="col-span-2">
                                                                <div className="flex items-center gap-1">
                                                                    <input
                                                                        type="number" step="0.01" min="0"
                                                                        value={item.quantity}
                                                                        onChange={(e) => updateItem(item.article_id, 'quantity', e.target.value)}
                                                                        placeholder="0"
                                                                        style={{ ...inputStyle, padding: '4px 6px', textAlign: 'right', width: '60px' }}
                                                                        onFocus={e => e.target.style.borderColor = '#2d4a2d'}
                                                                        onBlur={e => e.target.style.borderColor = 'var(--border)'}
                                                                    />
                                                                    <span className="text-xs text-muted-foreground">{item.unit_abbreviation}</span>
                                                                </div>
                                                            </div>
                                                            <div className="col-span-3">
                                                                <div className="relative">
                                                                    <input
                                                                        type="number" step="0.01" min="0"
                                                                        value={item.new_price}
                                                                        onChange={(e) => handlePriceChange(item.article_id, e.target.value)}
                                                                        style={{
                                                                            ...inputStyle,
                                                                            padding: '4px 20px 4px 6px',
                                                                            textAlign: 'right',
                                                                            borderColor: hasPriceChange ? '#c8d5c0' : 'var(--border)',
                                                                            background: hasPriceChange ? '#e8f0e4' : 'var(--muted)',
                                                                        }}
                                                                        onFocus={e => e.target.style.borderColor = '#2d4a2d'}
                                                                        onBlur={e => e.target.style.borderColor = hasPriceChange ? '#c8d5c0' : 'var(--border)'}
                                                                    />
                                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                                                                </div>
                                                                {hasPriceChange && (
                                                                    <p className="text-xs mt-0.5" style={{ color: '#2d4a2d' }}>
                                                                        Alt: {item.current_price.toFixed(2)}€
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className="col-span-3 flex items-center justify-center">
                                                                {hasPriceChange && (
                                                                    <div className="flex items-center gap-2">
                                                                        <Checkbox
                                                                            checked={item.update_master_price}
                                                                            onCheckedChange={(checked) => updateItem(item.article_id, 'update_master_price', checked)}
                                                                            id={`update-${item.article_id}`}
                                                                            style={{ accentColor: '#2d4a2d' }}
                                                                        />
                                                                        <label htmlFor={`update-${item.article_id}`} className="text-xs cursor-pointer text-muted-foreground">Ja</label>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

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
                        <button type="submit" disabled={!supplierId}
                            className="flex-1 text-sm font-medium rounded-lg py-2 text-white disabled:opacity-40 transition-colors"
                            style={{ background: '#2d4a2d' }}>
                            Lieferung speichern
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}