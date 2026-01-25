import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Search } from 'lucide-react';
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
            // Load all articles from this supplier
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
            item.article_id === articleId 
                ? { ...item, [field]: value }
                : item
        ));
    };

    const handlePriceChange = (articleId, newPrice) => {
        const item = items.find(i => i.article_id === articleId);
        if (item && parseFloat(newPrice) !== item.current_price) {
            setPriceChanges({
                ...priceChanges,
                [articleId]: true
            });
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

        if (deliveryItems.length === 0) {
            alert('Bitte mindestens einen Artikel mit Menge eingeben');
            return;
        }

        const selectedSupplier = suppliers?.find(s => s.id === supplierId);
        
        const deliveryData = {
            delivery_date: deliveryDate,
            supplier: selectedSupplier?.name || '',
            delivery_note_number: deliveryNoteNumber,
            items: deliveryItems,
            notes,
            is_processed: true
        };

        onSave(deliveryData);
        resetForm();
    };

    const filteredItems = searchTerm
        ? items.filter(item => item.article_name.toLowerCase().includes(searchTerm.toLowerCase()))
        : items;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold">
                        Wareneingang erfassen
                    </DialogTitle>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="deliveryDate">Lieferdatum *</Label>
                            <Input
                                id="deliveryDate"
                                type="date"
                                value={deliveryDate}
                                onChange={(e) => setDeliveryDate(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="deliveryNoteNumber">Lieferschein-Nr.</Label>
                            <Input
                                id="deliveryNoteNumber"
                                value={deliveryNoteNumber}
                                onChange={(e) => setDeliveryNoteNumber(e.target.value)}
                                placeholder="Optional"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Lieferant *</Label>
                        <Select value={supplierId} onValueChange={setSupplierId} required>
                            <SelectTrigger>
                                <SelectValue placeholder="Lieferant wählen..." />
                            </SelectTrigger>
                            <SelectContent>
                                {suppliers?.filter(s => s.is_active !== false).map(supplier => (
                                    <SelectItem key={supplier.id} value={supplier.id}>
                                        {supplier.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {supplierId && (
                        <>
                            <div className="space-y-2">
                                <Label>Artikel suchen</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Artikel durchsuchen..."
                                        className="pl-9"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label>Gelieferte Artikel</Label>
                                
                                {filteredItems.length === 0 ? (
                                    <p className="text-sm text-slate-500 text-center py-4">
                                        Keine Artikel für diesen Lieferanten vorhanden
                                    </p>
                                ) : (
                                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                                        <div className="bg-slate-50 grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-slate-600 border-b">
                                            <div className="col-span-4">Artikel</div>
                                            <div className="col-span-2 text-right">Menge</div>
                                            <div className="col-span-3 text-right">Preis/Einheit</div>
                                            <div className="col-span-3 text-center">Preis aktualisieren?</div>
                                        </div>
                                        <div className="max-h-96 overflow-y-auto">
                                            {filteredItems.map((item) => {
                                                const hasPriceChange = priceChanges[item.article_id];
                                                return (
                                                    <div key={item.article_id} className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-slate-100 items-center hover:bg-slate-50">
                                                        <div className="col-span-4">
                                                            <div className="font-medium text-sm">{item.article_name}</div>
                                                        </div>
                                                        <div className="col-span-2">
                                                            <div className="flex items-center gap-1">
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={item.quantity}
                                                                    onChange={(e) => updateItem(item.article_id, 'quantity', e.target.value)}
                                                                    placeholder="0"
                                                                    className="text-right h-8"
                                                                />
                                                                <span className="text-xs text-slate-500 w-10">{item.unit_abbreviation}</span>
                                                            </div>
                                                        </div>
                                                        <div className="col-span-3">
                                                            <div className="relative">
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={item.new_price}
                                                                    onChange={(e) => handlePriceChange(item.article_id, e.target.value)}
                                                                    className={`text-right pr-6 h-8 ${hasPriceChange ? 'border-amber-400 bg-amber-50' : ''}`}
                                                                />
                                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">€</span>
                                                            </div>
                                                            {hasPriceChange && (
                                                                <p className="text-xs text-amber-600 mt-0.5">
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
                                                                    />
                                                                    <Label htmlFor={`update-${item.article_id}`} className="text-xs cursor-pointer">
                                                                        Ja
                                                                    </Label>
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

                    <div className="space-y-2">
                        <Label htmlFor="notes">Bemerkungen</Label>
                        <Input
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Optional..."
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                            Abbrechen
                        </Button>
                        <Button type="submit" className="flex-1 bg-slate-900 hover:bg-slate-800" disabled={!supplierId}>
                            Lieferung speichern
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}