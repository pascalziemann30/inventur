import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export default function DeliveryForm({ open, onClose, onSave, articles, suppliers }) {
    const [deliveryDate, setDeliveryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [supplierId, setSupplierId] = useState('');
    const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('');
    const [items, setItems] = useState([{ article_id: '', quantity: '' }]);
    const [notes, setNotes] = useState('');

    const resetForm = () => {
        setDeliveryDate(format(new Date(), 'yyyy-MM-dd'));
        setSupplierId('');
        setDeliveryNoteNumber('');
        setItems([{ article_id: '', quantity: '' }]);
        setNotes('');
    };

    useEffect(() => {
        if (!open) resetForm();
    }, [open]);

    const addItem = () => {
        setItems([...items, { article_id: '', quantity: '' }]);
    };

    const removeItem = (index) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const updateItem = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        const deliveryItems = items
            .filter(item => item.article_id && item.quantity)
            .map(item => {
                const article = articles.find(a => a.id === item.article_id);
                return {
                    article_id: item.article_id,
                    article_name: article?.name || '',
                    quantity: parseFloat(item.quantity),
                    unit_abbreviation: article?.unit_abbreviation || ''
                };
            });

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

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold">
                        Lieferschein erfassen
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
                        <Label htmlFor="supplier">Lieferant</Label>
                        <Input
                            id="supplier"
                            value={supplier}
                            onChange={(e) => setSupplier(e.target.value)}
                            placeholder="z.B. Metro, Händler XY..."
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label>Gelieferte Artikel *</Label>
                            <Button type="button" variant="outline" size="sm" onClick={addItem}>
                                <Plus className="w-4 h-4 mr-1" /> Artikel
                            </Button>
                        </div>
                        
                        <div className="space-y-2">
                            {items.map((item, index) => {
                                const selectedArticle = articles.find(a => a.id === item.article_id);
                                return (
                                    <div key={index} className="flex gap-2 items-start">
                                    <div className="flex-1">
                                        <Select 
                                            value={item.article_id} 
                                            onValueChange={(val) => updateItem(index, 'article_id', val)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Artikel..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {articles
                                                    .filter(a => !supplierId || a.supplier_id === supplierId)
                                                    .map(article => (
                                                    <SelectItem key={article.id} value={article.id}>
                                                        {article.name} ({article.supplier_name})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                        <div className="w-24">
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                                placeholder="Menge"
                                            />
                                        </div>
                                        <span className="text-sm text-slate-500 pt-2 w-10">
                                            {selectedArticle?.unit_abbreviation || ''}
                                        </span>
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="icon"
                                            onClick={() => removeItem(index)}
                                            disabled={items.length === 1}
                                            className="text-slate-400 hover:text-red-500"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

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
                        <Button type="submit" className="flex-1 bg-slate-900 hover:bg-slate-800">
                            Lieferung speichern
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}