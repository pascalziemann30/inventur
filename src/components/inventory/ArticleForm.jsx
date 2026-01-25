import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from '@/api/base44Client';
import { Loader2, Sparkles } from 'lucide-react';

export default function ArticleForm({ open, onClose, onSave, article, categories, units, suppliers, currentUser }) {
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [unitId, setUnitId] = useState('');
    const [supplierId, setSupplierId] = useState('');
    const [supplierName, setSupplierName] = useState('');
    const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
    const [purchasePrice, setPurchasePrice] = useState('');
    const [initialStock, setInitialStock] = useState('');
    const [minStock, setMinStock] = useState('');
    const [notes, setNotes] = useState('');
    const [isDetecting, setIsDetecting] = useState(false);

    useEffect(() => {
        if (article) {
            setName(article.name || '');
            setCategoryId(article.category_id || '');
            setUnitId(article.unit_id || '');
            setSupplierId(article.supplier_id || '');
            setSupplierName(article.supplier_name || '');
            setPurchasePrice(article.purchase_price?.toString() || '');
            setInitialStock(article.initial_stock?.toString() || '');
            setMinStock(article.min_stock?.toString() || '');
            setNotes(article.notes || '');
        } else {
            resetForm();
        }
    }, [article, open]);

    const resetForm = () => {
        setName('');
        setCategoryId('');
        setUnitId('');
        setSupplierId('');
        setPurchasePrice('');
        setInitialStock('');
        setMinStock('');
        setNotes('');
    };

    const detectCategoryAndUnit = async (articleName) => {
        if (!articleName.trim()) return;
        
        setIsDetecting(true);
        
        const nameLower = articleName.toLowerCase();
        
        // Kategorie erkennen
        let detectedCategory = null;
        for (const cat of categories) {
            if (cat.keywords?.some(keyword => nameLower.includes(keyword.toLowerCase()))) {
                detectedCategory = cat;
                break;
            }
        }
        
        if (!detectedCategory) {
            detectedCategory = categories.find(c => c.name === 'Sonstiges');
        }
        
        if (detectedCategory && !categoryId) {
            setCategoryId(detectedCategory.id);
        }

        // Einheit erkennen basierend auf Artikelname
        if (!unitId) {
            let suggestedUnit = null;
            
            if (nameLower.includes('milch') || nameLower.includes('saft') || nameLower.includes('sirup') || nameLower.includes('öl')) {
                suggestedUnit = units.find(u => u.abbreviation === 'l');
            } else if (nameLower.includes('kaffee') || nameLower.includes('tee') || nameLower.includes('zucker') || nameLower.includes('mehl')) {
                suggestedUnit = units.find(u => u.abbreviation === 'kg');
            } else if (nameLower.includes('becher') || nameLower.includes('serviette') || nameLower.includes('deckel')) {
                suggestedUnit = units.find(u => u.abbreviation === 'Stk');
            } else if (nameLower.includes('flasche')) {
                suggestedUnit = units.find(u => u.abbreviation === 'Fl');
            } else if (nameLower.includes('packung') || nameLower.includes('pack')) {
                suggestedUnit = units.find(u => u.abbreviation === 'Pkg');
            } else if (nameLower.includes('karton')) {
                suggestedUnit = units.find(u => u.abbreviation === 'Krt');
            } else {
                suggestedUnit = units.find(u => u.abbreviation === 'Stk');
            }
            
            if (suggestedUnit) {
                setUnitId(suggestedUnit.id);
            }
        }
        
        setIsDetecting(false);
    };

    const handleNameBlur = () => {
        detectCategoryAndUnit(name);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const selectedCategory = categories.find(c => c.id === categoryId);
        const selectedUnit = units.find(u => u.id === unitId);
        const selectedSupplier = suppliers.find(s => s.id === supplierId);
        
        const articleData = {
            name,
            category_id: categoryId,
            category_name: selectedCategory?.name || '',
            unit_id: unitId,
            unit_abbreviation: selectedUnit?.abbreviation || '',
            supplier_id: supplierId,
            supplier_name: selectedSupplier?.name || '',
            purchase_price: parseFloat(purchasePrice) || 0,
            initial_stock: parseFloat(initialStock) || 0,
            current_stock: article ? article.current_stock : (parseFloat(initialStock) || 0),
            min_stock: parseFloat(minStock) || null,
            notes,
            is_active: true
        };

        // Track price change if editing and price changed
        if (article && article.purchase_price !== parseFloat(purchasePrice)) {
            onSave(articleData, {
                priceChanged: true,
                oldPrice: article.purchase_price,
                newPrice: parseFloat(purchasePrice)
            });
        } else {
            onSave(articleData);
        }
        
        resetForm();
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold">
                        {article ? 'Artikel bearbeiten' : 'Neuer Artikel'}
                    </DialogTitle>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Artikelname *</Label>
                        <div className="relative">
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onBlur={handleNameBlur}
                                placeholder="z.B. Kaffeebohnen, Hafermilch..."
                                required
                                className="pr-10"
                            />
                            {isDetecting && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
                            )}
                        </div>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Kategorie & Einheit werden automatisch erkannt
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Kategorie</Label>
                            <Select value={categoryId} onValueChange={setCategoryId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Wählen..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map(cat => (
                                        <SelectItem key={cat.id} value={cat.id}>
                                            {cat.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Einheit *</Label>
                            <Select value={unitId} onValueChange={setUnitId} required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Wählen..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {units.map(unit => (
                                        <SelectItem key={unit.id} value={unit.id}>
                                            {unit.name} ({unit.abbreviation})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Lieferant *</Label>
                            <Select value={supplierId} onValueChange={setSupplierId} required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Wählen..." />
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

                        <div className="space-y-2">
                            <Label htmlFor="purchasePrice">Einkaufspreis (Netto) *</Label>
                            <div className="relative">
                                <Input
                                    id="purchasePrice"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={purchasePrice}
                                    onChange={(e) => setPurchasePrice(e.target.value)}
                                    placeholder="0.00"
                                    required
                                    className="pr-8"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">€</span>
                            </div>
                            {article && article.purchase_price && parseFloat(purchasePrice) !== article.purchase_price && (
                                <p className="text-xs text-amber-600">
                                    Alt: {article.purchase_price.toFixed(2)}€ → Neu: {parseFloat(purchasePrice || 0).toFixed(2)}€
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="initialStock">Anfangsbestand</Label>
                            <Input
                                id="initialStock"
                                type="number"
                                step="0.01"
                                min="0"
                                value={initialStock}
                                onChange={(e) => setInitialStock(e.target.value)}
                                placeholder="0"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="minStock">Mindestbestand</Label>
                            <Input
                                id="minStock"
                                type="number"
                                step="0.01"
                                min="0"
                                value={minStock}
                                onChange={(e) => setMinStock(e.target.value)}
                                placeholder="Optional"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notizen</Label>
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
                            {article ? 'Speichern' : 'Hinzufügen'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}