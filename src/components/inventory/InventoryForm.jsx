import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold">
                        Inventur erfassen
                    </DialogTitle>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label>Artikel *</Label>
                        <Select value={articleId} onValueChange={setArticleId} required>
                            <SelectTrigger>
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

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="countedQuantity">Gezählte Menge *</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id="countedQuantity"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={countedQuantity}
                                    onChange={(e) => setCountedQuantity(e.target.value)}
                                    placeholder="0"
                                    required
                                />
                                <span className="text-sm text-slate-500 whitespace-nowrap">
                                    {selectedArticle?.unit_abbreviation || ''}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="inventoryDate">Datum *</Label>
                            <Input
                                id="inventoryDate"
                                type="date"
                                value={inventoryDate}
                                onChange={(e) => setInventoryDate(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {selectedArticle && (
                        <div className="bg-slate-50 rounded-lg p-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-600">Aktueller Bestand:</span>
                                <span className="font-medium">{selectedArticle.current_stock} {selectedArticle.unit_abbreviation}</span>
                            </div>
                            {countedQuantity && (
                                <div className="flex justify-between mt-1">
                                    <span className="text-slate-600">Differenz:</span>
                                    <span className={`font-medium ${parseFloat(countedQuantity) - selectedArticle.current_stock >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {(parseFloat(countedQuantity) - selectedArticle.current_stock).toFixed(2)} {selectedArticle.unit_abbreviation}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Inventurart</Label>
                        <Select value={inventoryType} onValueChange={setInventoryType}>
                            <SelectTrigger>
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
                            Inventur speichern
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}