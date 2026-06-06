import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { X, Plus, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
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

    // Fertigprodukt
    const [isFinishedProduct, setIsFinishedProduct] = useState(false);
    const [recipeItems, setRecipeItems] = useState([]);
    const [recipeSearch, setRecipeSearch] = useState('');
    const [showRecipeDropdown, setShowRecipeDropdown] = useState(false);
    const [sellingPrice, setSellingPrice] = useState('');

    // New category inline
    const [showNewCategory, setShowNewCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    // Duplicate detection
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
            setIsFinishedProduct(article.is_finished_product || false);
            setRecipeItems(article.recipe_items || []);
            setSellingPrice(article.selling_price?.toString() || '');
        } else {
            resetForm();
        }
    }, [article, open]);

    const resetForm = () => {
        setName(''); setCategoryId(''); setUnitId(''); setSupplierId(''); setSupplierName('');
        setShowNewSupplierInput(false); setNewSupplierName(''); setPurchasePrice('');
        setInitialStock(''); setMinStock(''); setNotes(''); setInventoryIntervals([]);
        setIsFinishedProduct(false); setRecipeItems([]); setRecipeSearch(''); setSellingPrice('');
        setShowRecipeDropdown(false);
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

    // Wareneinsatz-Berechnung
    const productionCost = recipeItems.reduce((sum, item) => {
        return sum + (item.quantity * (item.purchase_price || 0));
    }, 0);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (isFinishedProduct) {
            if (recipeItems.length === 0) {
                toast.error('Bitte mindestens einen Rohstoff hinzufügen');
                return;
            }
        }

        const selectedCategory = categories.find(c => c.id === categoryId);
        const selectedUnit = units.find(u => u.id === unitId);
        let finalSupplierId = supplierId;
        let finalSupplierName = supplierName;

        if (!isFinishedProduct) {
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
        }

        const articleData = {
            name,
            category_id: categoryId,
            category_name: isFinishedProduct ? (categories.find(c => c.name === 'Fertigprodukte')?.name || 'Fertigprodukte') : (selectedCategory?.name || ''),
            unit_id: unitId,
            unit_abbreviation: selectedUnit?.abbreviation || '',
            supplier_id: finalSupplierId,
            supplier_name: finalSupplierName,
            purchase_price: isFinishedProduct ? productionCost : (parseFloat(purchasePrice) || 0),
            initial_stock: parseFloat(initialStock) || 0,
            current_stock: article ? article.current_stock : (parseFloat(initialStock) || 0),
            min_stock: isFinishedProduct ? null : (parseFloat(minStock) || null),
            inventory_intervals: isFinishedProduct ? [] : inventoryIntervals,
            notes,
            is_active: true,
            is_finished_product: isFinishedProduct,
            recipe_items: isFinishedProduct ? recipeItems : [],
            selling_price: isFinishedProduct ? (parseFloat(sellingPrice) || 0) : undefined,
            production_cost: isFinishedProduct ? productionCost : undefined,
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
        if (!isFinishedProduct && article && article.purchase_price !== parseFloat(purchasePrice)) {
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

    // Recipe helpers
    const filteredRecipeArticles = recipeSearch.trim().length > 0
        ? allArticles.filter(a =>
            a.name?.toLowerCase().includes(recipeSearch.toLowerCase()) &&
            a.id !== article?.id &&
            !a.is_finished_product &&
            !recipeItems.find(r => r.article_id === a.id)
        )
        : [];

    const addRecipeItem = (a) => {
        setRecipeItems([...recipeItems, {
            article_id: a.id,
            article_name: a.name,
            unit_abbreviation: a.unit_abbreviation || '',
            quantity: 1,
            purchase_price: a.purchase_price || 0
        }]);
        setRecipeSearch('');
        setShowRecipeDropdown(false);
    };

    const updateRecipeQuantity = (articleId, qty) => {
        setRecipeItems(recipeItems.map(r => r.article_id === articleId ? { ...r, quantity: parseFloat(qty) || 0 } : r));
    };

    const removeRecipeItem = (articleId) => {
        setRecipeItems(recipeItems.filter(r => r.article_id !== articleId));
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

    const SectionLabel = ({ children }) => (
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">{children}</p>
    );

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
                    <div className="flex items-center gap-3 px-5 py-4 border-b bg-white flex-shrink-0">
                        <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 32, height: 32, background: '#e8f0e4', borderRadius: 8 }}>
                            <Plus style={{ width: 16, height: 16, color: '#2d4a2d' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">
                                {article ? 'Artikel bearbeiten' : 'Neuer Artikel'}
                            </p>
                            <p className="text-xs text-muted-foreground">{outletName} · Bestand erweitern</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                        <div className="overflow-y-auto px-5 py-4 space-y-5 flex-1">

                            {/* ── SEKTION 1: Grundinformation ── */}
                            <div className="bg-muted border border-border rounded-xl p-4 space-y-3">
                                <SectionLabel>Grundinformation</SectionLabel>

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
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground block mb-1">Kategorie</label>
                                        {isFinishedProduct ? (
                                            <p className="text-xs text-muted-foreground px-2 py-2 bg-muted rounded-lg border border-border">
                                                Kategorie: Fertigprodukte (automatisch)
                                            </p>
                                        ) : (
                                            <>
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
                                                {!showNewCategory ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowNewCategory(true)}
                                                        className="text-xs mt-1 transition-colors hover:opacity-70"
                                                        style={{ color: '#2d4a2d', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                                                    >
                                                        + Neue Kategorie anlegen
                                                    </button>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 mt-1.5">
                                                        <input
                                                            value={newCategoryName}
                                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                                            placeholder="Kategoriename..."
                                                            style={{ ...inputStyle, flex: 1 }}
                                                            onFocus={e => e.target.style.borderColor = '#2d4a2d'}
                                                            onBlur={e => e.target.style.borderColor = 'var(--border)'}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                if (!newCategoryName.trim()) return;
                                                                const created = await base44.entities.Category.create({ name: newCategoryName.trim() });
                                                                categories.push(created);
                                                                setCategoryId(created.id);
                                                                setNewCategoryName('');
                                                                setShowNewCategory(false);
                                                                toast.success('Kategorie angelegt');
                                                            }}
                                                            className="text-xs px-2.5 py-1 rounded-lg text-white whitespace-nowrap"
                                                            style={{ background: '#2d4a2d', border: 'none', cursor: 'pointer' }}
                                                        >
                                                            Anlegen
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => { setShowNewCategory(false); setNewCategoryName(''); }}
                                                            className="text-xs text-muted-foreground hover:text-foreground"
                                                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}
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

                                {/* Fertigprodukt Toggle */}
                                <div className="flex items-center justify-between rounded-xl p-3 bg-muted border border-border">
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Fertigprodukt</p>
                                        <p className="text-xs text-muted-foreground">Enthält Rohstoffe aus dem Bestand</p>
                                    </div>
                                    <Switch
                                        checked={isFinishedProduct}
                                        onCheckedChange={(val) => {
                                            setIsFinishedProduct(val);
                                            if (val) {
                                                const fpCat = categories.find(c => c.name === 'Fertigprodukte');
                                                setCategoryId(fpCat?.id || '');
                                            }
                                        }}
                                        className={isFinishedProduct ? '[&>span]:bg-white' : ''}
                                        style={isFinishedProduct ? { background: '#2d4a2d' } : {}}
                                    />
                                </div>
                            </div>

                            {/* ── SEKTION 2: Rezeptur (nur wenn Fertigprodukt) ── */}
                            {isFinishedProduct && (
                                <div className="space-y-3">
                                    <SectionLabel>Rezeptur — Rohstoffe</SectionLabel>
                                    <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--muted)', border: '1px solid #c8d5c0' }}>

                                        {/* Einträge */}
                                        {recipeItems.map((item) => (
                                            <div key={item.article_id} className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr 70px 45px 28px' }}>
                                                <div className="text-sm text-foreground bg-card rounded-md px-2 py-1.5 truncate" style={{ border: '0.5px solid var(--border)' }}>
                                                    {item.article_name}
                                                </div>
                                                <input
                                                    type="number" step="0.001" min="0.001"
                                                    value={item.quantity}
                                                    onChange={(e) => updateRecipeQuantity(item.article_id, e.target.value)}
                                                    style={{ ...inputStyle, padding: '4px 6px', textAlign: 'right', background: 'var(--card)', width: '70px' }}
                                                    onFocus={e => e.target.style.borderColor = '#2d4a2d'}
                                                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                                                />
                                                <span className="text-xs text-muted-foreground text-center">{item.unit_abbreviation}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeRecipeItem(item.article_id)}
                                                    className="w-7 h-7 flex items-center justify-center rounded-md hover:text-destructive text-muted-foreground transition-colors"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}

                                        {/* Suchfeld */}
                                        <div className="relative">
                                            <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ border: '1px dashed #c8d5c0' }}>
                                                <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                                <input
                                                    value={recipeSearch}
                                                    onChange={(e) => { setRecipeSearch(e.target.value); setShowRecipeDropdown(e.target.value.length > 0); }}
                                                    onFocus={() => recipeSearch.length > 0 && setShowRecipeDropdown(true)}
                                                    onBlur={() => setTimeout(() => setShowRecipeDropdown(false), 150)}
                                                    placeholder="Rohstoff suchen und hinzufügen..."
                                                    style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', width: '100%', color: 'var(--foreground)' }}
                                                />
                                            </div>
                                            {showRecipeDropdown && filteredRecipeArticles.length > 0 && (
                                                <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-sm max-h-40 overflow-y-auto">
                                                    {filteredRecipeArticles.map(a => (
                                                        <button
                                                            key={a.id}
                                                            type="button"
                                                            onMouseDown={() => addRecipeItem(a)}
                                                            className="w-full px-3 py-2 text-left hover:bg-accent text-xs transition-colors flex items-center justify-between"
                                                        >
                                                            <span>{a.name}</span>
                                                            <span className="text-muted-foreground ml-2">{a.unit_abbreviation}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            {showRecipeDropdown && recipeSearch.trim().length > 0 && filteredRecipeArticles.length === 0 && (
                                                <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-sm">
                                                    <p className="px-3 py-2 text-xs text-muted-foreground">Keine Rohstoffe gefunden</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Wareneinsatz */}
                                        {recipeItems.length > 0 && (
                                            <div className="flex justify-between items-center pt-2 mt-1" style={{ borderTop: '1px solid #c8d5c0' }}>
                                                <span className="text-xs font-medium" style={{ color: '#2d4a2d' }}>Wareneinsatz (berechnet)</span>
                                                <span className="text-sm font-semibold" style={{ color: '#2d4a2d' }}>{productionCost.toFixed(2)} €</span>
                                            </div>
                                        )}

                                        {recipeItems.length === 0 && (
                                            <p className="text-xs text-amber-600 text-center py-1">Bitte mindestens einen Rohstoff hinzufügen</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── SEKTION 3: Preise ── */}
                            <div className="bg-muted border border-border rounded-xl p-4 space-y-3">
                                <SectionLabel>Preise</SectionLabel>

                                {isFinishedProduct ? (
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground block mb-1">Verkaufspreis pro Stück</label>
                                        <div className="relative">
                                            <input
                                                type="number" step="0.01" min="0"
                                                value={sellingPrice}
                                                onChange={(e) => setSellingPrice(e.target.value)}
                                                placeholder="0.00"
                                                style={{ ...inputStyle, paddingRight: '24px' }}
                                                onFocus={e => e.target.style.borderColor = '#2d4a2d'}
                                                onBlur={e => e.target.style.borderColor = 'var(--border)'}
                                            />
                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Lieferant */}
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
                                                            onFocus={() => setShowSupplierDropdown(true)}
                                                                            placeholder="Lieferant suchen..."
                                                                            required={!isFinishedProduct && !showNewSupplierInput}
                                                                            style={inputStyle}
                                                                            onBlur={e => { e.target.style.borderColor = 'var(--border)'; setTimeout(() => setShowSupplierDropdown(false), 150); }}
                                                                        />
                                                                        {showSupplierDropdown && (() => {
                                                                            const filtered = suppliers?.filter(s =>
                                                                                s.is_active !== false &&
                                                                                (supplierName === '' || s.name.toLowerCase().includes(supplierName.toLowerCase()))
                                                                            ) || [];
                                                                            return filtered.length > 0 ? (
                                                                                <div className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-lg max-h-48 overflow-y-auto" style={{ border: '0.5px solid var(--border)' }}>
                                                                                    <p className="text-xs text-muted-foreground px-3 py-1 border-b border-border">
                                                                                        {supplierName === '' ? `Alle Lieferanten (${filtered.length})` : `Suchergebnisse (${filtered.length})`}
                                                                                    </p>
                                                                                    {filtered.map(supplier => (
                                                                                        <button
                                                                                            key={supplier.id}
                                                                                            type="button"
                                                                                            onMouseDown={() => { setSupplierId(supplier.id); setSupplierName(supplier.name); setShowSupplierDropdown(false); }}
                                                                                            className="w-full px-3 py-2 text-left hover:bg-accent text-xs transition-colors"
                                                                                        >
                                                                                            {supplier.name}
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            ) : null;
                                                                        })()}
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

                                        {/* Einkaufspreis */}
                                        <div>
                                            <label className="text-xs font-medium text-muted-foreground block mb-1">Einkaufspreis (Netto) *</label>
                                            <div className="relative">
                                                <input
                                                    type="number" step="0.01" min="0"
                                                    value={purchasePrice}
                                                    onChange={(e) => setPurchasePrice(e.target.value)}
                                                    placeholder="0.00"
                                                    required={!isFinishedProduct}
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
                                )}
                            </div>

                            {/* ── SEKTION 4: Bestand (nur wenn kein Fertigprodukt) ── */}
                            {!isFinishedProduct && (
                                <div className="bg-muted border border-border rounded-xl p-4 space-y-3">
                                    <SectionLabel>Bestand</SectionLabel>
                                    <div className="grid grid-cols-2 gap-3">
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
                                </div>
                            )}

                            {/* ── SEKTION 5: Inventur-Intervalle (nur wenn kein Fertigprodukt) ── */}
                            {!isFinishedProduct && (
                                <div className="bg-muted border border-border rounded-xl p-4 space-y-3">
                                    <SectionLabel>Inventur-Intervalle</SectionLabel>
                                    <div className="flex flex-wrap gap-2">
                                        {intervalOptions.map(option => {
                                            const active = inventoryIntervals.includes(option.value);
                                            return (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => toggleInterval(option.value)}
                                                    className="rounded-full px-3 py-1 text-xs transition-colors"
                                                    style={active
                                                        ? { background: '#e8f0e4', color: '#2d4a2d', border: '1px solid #c8d5c0', fontWeight: 500 }
                                                        : { background: 'var(--card)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }
                                                    }
                                                >
                                                    {option.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* ── SEKTION 6: Notizen ── */}
                            <div className="bg-muted border border-border rounded-xl p-4 space-y-3">
                                <SectionLabel>Notizen</SectionLabel>
                                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional..." style={inputStyle}
                                    onFocus={e => e.target.style.borderColor = '#2d4a2d'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex gap-2 px-5 py-4 border-t bg-white sticky bottom-0 flex-shrink-0">
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