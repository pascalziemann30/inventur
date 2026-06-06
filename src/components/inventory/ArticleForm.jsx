import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, X, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Loader2, Sparkles } from 'lucide-react';
import { checkDuplicates } from './duplicateUtils';
import { ExactDuplicateDialog, SimilarArticlesDialog } from './DuplicateCheckDialogs';

export default function ArticleForm({ open, onClose, onSave, article, categories, units, suppliers, currentUser, outletId, outletName, isAggregator, allArticles = [] }) {
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

    const [showExactDuplicateDialog, setShowExactDuplicateDialog] = useState(false);
    const [showSimilarDialog, setShowSimilarDialog] = useState(false);
    const [exactDuplicate, setExactDuplicate] = useState(null);
    const [similarArticles, setSimilarArticles] = useState([]);
    const [pendingArticleData, setPendingArticleData] = useState(null);

    useEffect(() => {
        if (article) {
            setName(article.name || '');
            setCategoryId(article.category_id || '');
            setUnitId(article.unit_id || '');
            setSupplierId(article.supplier_id || '');
            setSupplierName(article.supplier_name || '');
            setPurchasePrice(article.purchase_price?.toString() || '');
            setInitialStock(article.current_stock?.toString() || '');
            setMinStock(article.min_stock?.toString() || '');
            setNotes(article.notes || '');
            setInventoryIntervals(article.inventory_intervals || []);
        } else {
            resetForm();
        }
    }, [article, open]);

    const resetForm = () => {
        setName(''); setCategoryId(''); setUnitId(''); setSupplierId(''); setSupplierName('');
        setShowNewSupplierInput(false); setNewSupplierName(''); setPurchasePrice('');
        setInitialStock(''); setMinStock(''); setNotes(''); setInventoryIntervals([]);
    };

    const detectCategoryAndUnit = async (articleName) => {
        if (!articleName.trim()) return;
        setIsDetecting(true);
        const nameLower = articleName.toLowerCase();
        let detectedCategory = null;
        for (const cat of categories) {
            if (cat.keywords?.some(keyword => nameLower.includes(keyword.toLowerCase()))) {
                detectedCategory = cat; break;
            }
        }
        if (!detectedCategory) detectedCategory = categories.find(c => c.name === 'Sonstiges');
        if (detectedCategory && !categoryId) setCategoryId(detectedCategory.id);
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
            if (suggestedUnit) setUnitId(suggestedUnit.id);
        }
        setIsDetecting(false);
    };

    const handleNameBlur = () => { detectCategoryAndUnit(name); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const selectedCategory = categories.find(c => c.id === categoryId);
        const selectedUnit = units.find(u => u.id === unitId);
        let finalSupplierId = supplierId;
        let finalSupplierName = supplierName;
        if (showNewSupplierInput && newSupplierName.trim()) {
            try {
                const existingSupplier = suppliers.find(s => s.name.trim().toLowerCase() === newSupplierName.trim().toLowerCase());
                if (existingSupplier) {
                    finalSupplierId = existingSupplier.id;
                    finalSupplierName = existingSupplier.name;
                } else {
                    const newSupplier = await base44.entities.Supplier.create({ name: newSupplierName.trim(), is_active: true });
                    finalSupplierId = newSupplier.id;
                    finalSupplierName = newSupplier.name;
                }
            } catch (error) {
                console.error('Supplier creation failed:', error);
                alert('Fehler beim Erstellen des Lieferanten');
                return;
            }
        } else if (!finalSupplierId) {
            alert('Bitte wählen Sie einen Lieferanten aus');
            return;
        }
        const articleData = {
            name, category_id: categoryId, category_name: selectedCategory?.name || '',
            unit_id: unitId, unit_abbreviation: selectedUnit?.abbreviation || '',
            supplier_id: finalSupplierId, supplier_name: finalSupplierName,
            purchase_price: parseFloat(purchasePrice) || 0,
            initial_stock: parseFloat(initialStock) || 0,
            current_stock: article ? article.current_stock : (parseFloat(initialStock) || 0),
            min_stock: parseFloat(minStock) || null,
            inventory_intervals: inventoryIntervals, notes, is_active: true
        };
        if (!article && !isAggregator && allArticles && allArticles.length > 0) {
            const duplicateCheck = checkDuplicates(articleData, allArticles, outletId, article?.id);
            if (duplicateCheck) {
                if (duplicateCheck.type === 'exact') {
                    setExactDuplicate(duplicateCheck.duplicate);
                    setShowExactDuplicateDialog(true);
                    return;
                } else if (duplicateCheck.type === 'similar') {
                    setSimilarArticles(duplicateCheck.articles);
                    setPendingArticleData(articleData);
                    setShowSimilarDialog(true);
                    return;
                }
            }
        }
        saveArticle(articleData);
    };

    const saveArticle = (articleData) => {
        if (article && article.purchase_price !== parseFloat(purchasePrice)) {
            onSave(articleData, { priceChanged: true, oldPrice: article.purchase_price, newPrice: parseFloat(purchasePrice) });
        } else {
            onSave(articleData);
        }
        resetForm();
    };

    const handleProceedWithSimilar = () => {
        setShowSimilarDialog(false);
        if (pendingArticleData) { saveArticle(pendingArticleData); setPendingArticleData(null); }
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

    if (isAggregator && !article) {
        return (
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-md p-0 gap-0">
                    <div className="flex items-center gap-3 px-5 py-4 border-b bg-white">
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-foreground">Artikel-Anlage nicht möglich</p>
                        </div>
                        <button onClick={onClose} className="p-1 rounded-md hover:bg-accent text-muted-foreground">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="px-5 py-4 space-y-2 text-sm text-muted-foreground">
                        <p>Im Aggregator-Outlet „{outletName}" können keine Artikel angelegt werden.</p>
                        <p>Bitte wechseln Sie zu einem normalen Outlet, um Artikel zu erstellen.</p>
                    </div>
                    <div className="flex px-5 py-4 border-t">
                        <button onClick={onClose} className="flex-1 text-sm font-medium rounded-lg py-2 text-white" style={{ background: '#2d4a2d' }}>Schließen</button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <>
            <ExactDuplicateDialog
                open={showExactDuplicateDialog}
                onClose={() => { setShowExactDuplicateDialog(false); setExactDuplicate(null); }}
                duplicate={exactDuplicate}
            />
            <SimilarArticlesDialog
                open={showSimilarDialog}
                onClose={() => { setShowSimilarDialog(false); setSimilarArticles([]); setPendingArticleData(null); }}
                onProceed={handleProceedWithSimilar}
                similarArticles={similarArticles}
            />

            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col p-0 gap-0">
                    {/* Header */}
                    <div className="flex items-center gap-3 px-5 py-4 border-b bg-white">
                        <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 32, height: 32, background: '#e8f0e4', borderRadius: 8 }}>
                            <Plus style={{ width: 16, height: 16, color: '#2d4a2d' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">
                                {article ? 'Artikel bearbeiten' : 'Neuer Artikel'}
                            </p>
                            <p className="text-xs text-muted-foreground">{outletName} · Bestand erweitern</p>
                        </div>
                        <button onClick={onClose} className="p-1 rounded-md hover:bg-accent transition-colors text-muted-foreground">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                        <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1">

                            {/* Artikelname */}
                            <div>
                                <label className="text-xs font-medium text-muted-foreground block mb-1">Artikelname *</label>
                                <div className="relative">
                                    <input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        onBlur={handleNameBlur}
                                        placeholder="z.B. Kaffeebohnen, Hafermilch..."
                                        required
                                        style={{ ...inputStyle, paddingRight: '32px' }}
                                        onFocus={e => e.target.style.borderColor = '#2d4a2d'}
                                        onBlur2={e => e.target.style.borderColor = 'var(--border)'}
                                    />
                                    {isDetecting && (
                                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                                    )}
                                </div>
                                <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#2d4a2d' }}>
                                    <Sparkles className="w-3 h-3" />
                                    Kategorie & Einheit werden automatisch erkannt
                                </p>
                            </div>

                            {/* Kategorie + Einheit */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground block mb-1">Kategorie</label>
                                    <Select value={categoryId} onValueChange={setCategoryId}>
                                        <SelectTrigger style={{ ...inputStyle, padding: '6px 10px', height: 'auto' }}>
                                            <SelectValue placeholder="Wählen..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories.map(cat => (
                                                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground block mb-1">Einheit *</label>
                                    <Select value={unitId} onValueChange={setUnitId} required>
                                        <SelectTrigger style={{ ...inputStyle, padding: '6px 10px', height: 'auto' }}>
                                            <SelectValue placeholder="Wählen..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {units.map(unit => (
                                                <SelectItem key={unit.id} value={unit.id}>{unit.name} ({unit.abbreviation})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Lieferant + Preis */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground block mb-1">Lieferant *</label>
                                    {!showNewSupplierInput ? (
                                        <>
                                            <div className="relative">
                                                <input
                                                    value={supplierName}
                                                    onChange={(e) => {
                                                        setSupplierName(e.target.value);
                                                        setSupplierId('');
                                                        setShowSupplierDropdown(e.target.value.length > 0);
                                                    }}
                                                    onFocus={() => setShowSupplierDropdown(supplierName.length > 0)}
                                                    placeholder="Lieferant suchen..."
                                                    required={!showNewSupplierInput}
                                                    style={inputStyle}
                                                    onFocus2={e => e.target.style.borderColor = '#2d4a2d'}
                                                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                                                />
                                                {showSupplierDropdown && suppliers?.filter(s =>
                                                    s.is_active !== false &&
                                                    s.name.toLowerCase().includes(supplierName.toLowerCase())
                                                ).length > 0 && (
                                                    <div className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-lg max-h-48 overflow-auto" style={{ border: '0.5px solid var(--border)' }}>
                                                        {suppliers
                                                            .filter(s => s.is_active !== false && s.name.toLowerCase().includes(supplierName.toLowerCase()))
                                                            .map(supplier => (
                                                                <button
                                                                    key={supplier.id}
                                                                    type="button"
                                                                    onClick={() => { setSupplierId(supplier.id); setSupplierName(supplier.name); setShowSupplierDropdown(false); }}
                                                                    className="w-full px-3 py-2 text-left hover:bg-accent text-xs transition-colors"
                                                                >
                                                                    {supplier.name}
                                                                </button>
                                                            ))}
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => { setShowNewSupplierInput(true); setSupplierId(''); setSupplierName(''); }}
                                                className="text-xs mt-1 font-medium transition-colors hover:opacity-70"
                                                style={{ color: '#2d4a2d', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                                            >
                                                + Neuen Lieferanten anlegen
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <input
                                                value={newSupplierName}
                                                onChange={(e) => setNewSupplierName(e.target.value)}
                                                placeholder="Name des neuen Lieferanten..."
                                                required
                                                style={inputStyle}
                                                onFocus={e => e.target.style.borderColor = '#2d4a2d'}
                                                onBlur={e => e.target.style.borderColor = 'var(--border)'}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => { setShowNewSupplierInput(false); setNewSupplierName(''); }}
                                                className="text-xs mt-1 text-muted-foreground hover:text-foreground transition-colors"
                                                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                                            >
                                                ← Zurück zur Auswahl
                                            </button>
                                        </>
                                    )}
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-muted-foreground block mb-1">Einkaufspreis (Netto) *</label>
                                    <div className="relative">
                                        <input
                                            type="number" step="0.01" min="0"
                                            value={purchasePrice}
                                            onChange={(e) => setPurchasePrice(e.target.value)}
                                            placeholder="0.00"
                                            required
                                            style={{ ...inputStyle, paddingRight: '24px' }}
                                            onFocus={e => e.target.style.borderColor = '#2d4a2d'}
                                            onBlur={e => e.target.style.borderColor = 'var(--border)'}
                                        />
                                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                                    </div>
                                    {article && article.purchase_price && parseFloat(purchasePrice) !== article.purchase_price && (
                                        <p className="text-xs mt-0.5 text-amber-600">
                                            Alt: {article.purchase_price.toFixed(2)}€ → Neu: {parseFloat(purchasePrice || 0).toFixed(2)}€
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Anfangs- + Mindestbestand */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground block mb-1">Anfangsbestand</label>
                                    <input type="number" step="0.01" min="0" value={initialStock} onChange={(e) => setInitialStock(e.target.value)} placeholder="0" style={inputStyle}
                                        onFocus={e => e.target.style.borderColor = '#2d4a2d'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground block mb-1">Mindestbestand</label>
                                    <input type="number" step="0.01" min="0" value={minStock} onChange={(e) => setMinStock(e.target.value)} placeholder="Optional" style={inputStyle}
                                        onFocus={e => e.target.style.borderColor = '#2d4a2d'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                                </div>
                            </div>

                            {/* Inventur-Intervalle */}
                            <div>
                                <label className="text-xs font-medium text-muted-foreground block mb-1">Inventur-Intervalle</label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button
                                            type="button"
                                            className="w-full flex items-center justify-between text-left transition-colors hover:border-foreground"
                                            style={{ ...inputStyle, padding: '6px 10px', minHeight: '36px' }}
                                        >
                                            <div className="flex flex-wrap gap-1 flex-1">
                                                {inventoryIntervals.length > 0 ? (
                                                    inventoryIntervals.map(interval => {
                                                        const option = intervalOptions.find(o => o.value === interval);
                                                        return (
                                                            <span
                                                                key={interval}
                                                                className="inline-flex items-center gap-1 text-xs rounded px-1.5 py-0.5 font-medium"
                                                                style={{ background: '#e8f0e4', color: '#2d4a2d' }}
                                                                onClick={(e) => { e.stopPropagation(); toggleInterval(interval); }}
                                                            >
                                                                {option?.label}
                                                                <X className="h-2.5 w-2.5" />
                                                            </span>
                                                        );
                                                    })
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">Intervalle wählen...</span>
                                                )}
                                            </div>
                                            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-2" align="start">
                                        <div className="space-y-1">
                                            {intervalOptions.map(option => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => toggleInterval(option.value)}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
                                                >
                                                    <div className="h-4 w-4 border rounded flex items-center justify-center flex-shrink-0" style={{
                                                        background: inventoryIntervals.includes(option.value) ? '#2d4a2d' : 'transparent',
                                                        borderColor: inventoryIntervals.includes(option.value) ? '#2d4a2d' : 'var(--border)'
                                                    }}>
                                                        {inventoryIntervals.includes(option.value) && (
                                                            <Check className="h-3 w-3 text-white" />
                                                        )}
                                                    </div>
                                                    <span>{option.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex gap-2 mt-2 pt-2 border-t">
                                            <button type="button" onClick={() => setInventoryIntervals(intervalOptions.map(o => o.value))}
                                                className="flex-1 text-xs py-1 transition-colors hover:opacity-70" style={{ color: '#2d4a2d', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                Alle wählen
                                            </button>
                                            <button type="button" onClick={() => setInventoryIntervals([])}
                                                className="flex-1 text-xs py-1 text-muted-foreground hover:text-foreground transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                                Alle entfernen
                                            </button>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <p className="text-xs mt-1 text-muted-foreground">
                                    Wählen Sie, bei welchen Inventuren dieser Artikel gezählt werden soll
                                </p>
                            </div>

                            {/* Notizen */}
                            <div>
                                <label className="text-xs font-medium text-muted-foreground block mb-1">Notizen</label>
                                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional..." style={inputStyle}
                                    onFocus={e => e.target.style.borderColor = '#2d4a2d'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex gap-2 px-5 py-4 border-t bg-white sticky bottom-0">
                            <button type="button" onClick={onClose}
                                className="flex-1 text-sm font-medium rounded-lg py-2 transition-colors hover:bg-accent text-muted-foreground"
                                style={{ border: '0.5px solid var(--border)', background: 'transparent' }}>
                                Abbrechen
                            </button>
                            <button type="submit"
                                className="flex-1 text-sm font-medium rounded-lg py-2 text-white transition-colors"
                                style={{ background: '#2d4a2d' }}>
                                {article ? 'Speichern' : 'Hinzufügen'}
                            </button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}