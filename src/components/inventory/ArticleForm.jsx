import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Loader2, Sparkles } from 'lucide-react';

export default function ArticleForm({ open, onClose, onSave, article, categories, units, suppliers, currentUser }) {
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [unitId, setUnitId] = useState('');
    const [supplierId, setSupplierId] = useState('');
    const [supplierName, setSupplierName] = useState('');
    const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
    const [showNewSupplierInput, setShowNewSupplierInput] = useState(false);
    const [newSupplierName, setNewSupplierName] = useState('');
    const [purchasePrice, setPurchasePrice] = useState('');
    const [initialStock, setInitialStock] = useState('');
    const [minStock, setMinStock] = useState('');
    const [notes, setNotes] = useState('');
    const [isDetecting, setIsDetecting] = useState(false);
    const [inventoryIntervals, setInventoryIntervals] = useState([]);

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
            setInventoryIntervals(article.inventory_intervals || []);
        } else {
            resetForm();
        }
    }, [article, open]);

    const resetForm = () => {
        setName('');
        setCategoryId('');
        setUnitId('');
        setSupplierId('');
        setSupplierName('');
        setShowNewSupplierInput(false);
        setNewSupplierName('');
        setPurchasePrice('');
        setInitialStock('');
        setMinStock('');
        setNotes('');
        setInventoryIntervals([]);
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
        
        // Create or get supplier
        let finalSupplierId = supplierId;
        let finalSupplierName = supplierName;
        
        // If new supplier should be created
        if (showNewSupplierInput && newSupplierName.trim()) {
            try {
                const newSupplier = await base44.entities.Supplier.create({
                    name: newSupplierName.trim(),
                    is_active: true
                });
                finalSupplierId = newSupplier.id;
                finalSupplierName = newSupplier.name;
            } catch (error) {
                console.error('Supplier creation failed:', error);
                return;
            }
        } else if (!finalSupplierId) {
            alert('Bitte wählen Sie einen Lieferanten aus');
            return;
        }
        
        const articleData = {
            name,
            category_id: categoryId,
            category_name: selectedCategory?.name || '',
            unit_id: unitId,
            unit_abbreviation: selectedUnit?.abbreviation || '',
            supplier_id: finalSupplierId,
            supplier_name: finalSupplierName,
            purchase_price: parseFloat(purchasePrice) || 0,
            initial_stock: parseFloat(initialStock) || 0,
            current_stock: article ? article.current_stock : (parseFloat(initialStock) || 0),
            min_stock: parseFloat(minStock) || null,
            inventory_intervals: inventoryIntervals,
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

    const intervalOptions = [
        { value: 'weekly', label: 'Wöchentlich' },
        { value: 'monthly', label: 'Monatlich' },
        { value: 'yearly', label: 'Jährlich' }
    ];

    const toggleInterval = (value) => {
        if (inventoryIntervals.includes(value)) {
            setInventoryIntervals(inventoryIntervals.filter(i => i !== value));
        } else {
            setInventoryIntervals([...inventoryIntervals, value]);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="px-6 pt-6 pb-4">
                    <DialogTitle className="text-lg font-semibold">
                        {article ? 'Artikel bearbeiten' : 'Neuer Artikel'}
                    </DialogTitle>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="overflow-y-auto px-6 space-y-4 flex-1">
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
                            {!showNewSupplierInput ? (
                                <>
                                    <div className="relative">
                                        <Input
                                            value={supplierName}
                                            onChange={(e) => {
                                                setSupplierName(e.target.value);
                                                setSupplierId('');
                                                setShowSupplierDropdown(e.target.value.length > 0);
                                            }}
                                            onFocus={() => setShowSupplierDropdown(supplierName.length > 0)}
                                            placeholder="Lieferant suchen..."
                                            required={!showNewSupplierInput}
                                        />
                                        {showSupplierDropdown && suppliers?.filter(s => 
                                            s.is_active !== false && 
                                            s.name.toLowerCase().includes(supplierName.toLowerCase())
                                        ).length > 0 && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-auto">
                                                {suppliers
                                                    .filter(s => s.is_active !== false && s.name.toLowerCase().includes(supplierName.toLowerCase()))
                                                    .map(supplier => (
                                                        <button
                                                            key={supplier.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setSupplierId(supplier.id);
                                                                setSupplierName(supplier.name);
                                                                setShowSupplierDropdown(false);
                                                            }}
                                                            className="w-full px-3 py-2 text-left hover:bg-slate-100 text-sm"
                                                        >
                                                            {supplier.name}
                                                        </button>
                                                    ))
                                                }
                                            </div>
                                        )}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="link"
                                        size="sm"
                                        onClick={() => {
                                            setShowNewSupplierInput(true);
                                            setSupplierId('');
                                            setSupplierName('');
                                        }}
                                        className="h-auto p-0 text-xs text-blue-600"
                                    >
                                        + Neuen Lieferanten anlegen
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Input
                                        value={newSupplierName}
                                        onChange={(e) => setNewSupplierName(e.target.value)}
                                        placeholder="Name des neuen Lieferanten..."
                                        required
                                    />
                                    <Button
                                        type="button"
                                        variant="link"
                                        size="sm"
                                        onClick={() => {
                                            setShowNewSupplierInput(false);
                                            setNewSupplierName('');
                                        }}
                                        className="h-auto p-0 text-xs text-slate-600"
                                    >
                                        ← Zurück zur Auswahl
                                    </Button>
                                </>
                            )}
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
                        <Label>Inventur-Intervalle</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    type="button"
                                    className="w-full justify-between font-normal h-auto min-h-[40px] py-2"
                                >
                                    <div className="flex flex-wrap gap-1">
                                        {inventoryIntervals.length > 0 ? (
                                            inventoryIntervals.map(interval => {
                                                const option = intervalOptions.find(o => o.value === interval);
                                                return (
                                                    <Badge 
                                                        key={interval} 
                                                        variant="secondary" 
                                                        className="text-xs"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleInterval(interval);
                                                        }}
                                                    >
                                                        {option?.label}
                                                        <X className="ml-1 h-3 w-3" />
                                                    </Badge>
                                                );
                                            })
                                        ) : (
                                            <span className="text-slate-500">Intervalle wählen...</span>
                                        )}
                                    </div>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-2" align="start">
                                <div className="max-h-[200px] overflow-y-auto space-y-1">
                                    {intervalOptions.map(option => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => toggleInterval(option.value)}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-slate-100 transition-colors"
                                        >
                                            <div className={`h-4 w-4 border rounded flex items-center justify-center ${
                                                inventoryIntervals.includes(option.value) 
                                                    ? 'bg-slate-900 border-slate-900' 
                                                    : 'border-slate-300'
                                            }`}>
                                                {inventoryIntervals.includes(option.value) && (
                                                    <Check className="h-3 w-3 text-white" />
                                                )}
                                            </div>
                                            <span>{option.label}</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-2 mt-2 pt-2 border-t">
                                    <button
                                        type="button"
                                        onClick={() => setInventoryIntervals(intervalOptions.map(o => o.value))}
                                        className="flex-1 text-xs py-1 text-slate-600 hover:text-slate-900"
                                    >
                                        Alle wählen
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setInventoryIntervals([])}
                                        className="flex-1 text-xs py-1 text-slate-600 hover:text-slate-900"
                                    >
                                        Alle entfernen
                                    </button>
                                </div>
                            </PopoverContent>
                        </Popover>
                        <p className="text-xs text-slate-500">
                            Wählen Sie, bei welchen Inventuren dieser Artikel gezählt werden soll
                        </p>
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
                    </div>

                    <div className="flex gap-3 px-6 py-4 border-t bg-white sticky bottom-0">
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