import React, { useState, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Trash2, RotateCcw, Info } from 'lucide-react';

export default function WasteForm({ open, onClose, onSave, articles, categories }) {
    const [wasteDate, setWasteDate] = useState(new Date().toISOString().split('T')[0]);
    const [activeTab, setActiveTab] = useState('rohstoffe');
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [globalReason, setGlobalReason] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [quantities, setQuantities] = useState({});

    const categoryArticles = useMemo(() => {
        if (!selectedCategoryId) return [];
        return articles.filter(a =>
            a.category_id === selectedCategoryId &&
            a.is_active !== false &&
            !a.is_finished_product
        );
    }, [selectedCategoryId, articles]);

    const finishedProducts = useMemo(() => {
        return articles.filter(a =>
            a.is_finished_product === true &&
            a.is_active !== false
        );
    }, [articles]);

    const filteredArticles = useMemo(() => {
        const base = activeTab === 'fertigprodukte' ? finishedProducts : categoryArticles;
        if (!searchTerm) return base;
        return base.filter(a => a.name?.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [activeTab, categoryArticles, finishedProducts, searchTerm]);

    const selectedItems = useMemo(() => {
        return filteredArticles
            .filter(article => quantities[article.id] && parseFloat(quantities[article.id]) > 0)
            .map(article => ({
                article_id: article.id,
                article_name: article.name,
                quantity: parseFloat(quantities[article.id]),
                unit_abbreviation: article.unit_abbreviation,
                reason: globalReason
            }));
    }, [filteredArticles, quantities, globalReason]);

    const handleQuantityChange = (articleId, value) => {
        setQuantities(prev => ({ ...prev, [articleId]: value }));
    };

    const handleReset = () => {
        setQuantities({});
        setGlobalReason('');
        setSearchTerm('');
    };

    const resetForm = () => {
        setWasteDate(new Date().toISOString().split('T')[0]);
        setActiveTab('rohstoffe');
        setSelectedCategoryId('');
        setGlobalReason('');
        setSearchTerm('');
        setQuantities({});
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (activeTab === 'rohstoffe' && !selectedCategoryId) {
            alert('Bitte Kategorie auswählen');
            return;
        }
        if (selectedItems.length === 0) {
            alert('Bitte mindestens einen Artikel mit Menge > 0 eingeben');
            return;
        }
        if (!globalReason.trim()) {
            alert('Bitte Grund angeben');
            return;
        }

        const wasteItems = [];
        selectedItems.forEach(item => {
            const article = articles.find(a => a.id === item.article_id);
            wasteItems.push(item);

            if (article?.is_finished_product && article?.recipe_items?.length > 0) {
                article.recipe_items.forEach(recipeItem => {
                    const totalQty = recipeItem.quantity * item.quantity;
                    wasteItems.push({
                        article_id: recipeItem.article_id,
                        article_name: recipeItem.article_name,
                        quantity: totalQty,
                        unit_abbreviation: recipeItem.unit_abbreviation,
                        reason: globalReason,
                        is_derived_from_finished_product: true,
                        parent_product_name: article.name
                    });
                });
            }
        });

        onSave({ waste_date: wasteDate, items: wasteItems, notes: '', status: 'draft' });
        resetForm();
    };

    const inputStyle = {
        border: '0.5px solid var(--border)',
        borderRadius: '8px',
        background: 'var(--muted)',
        padding: '6px 10px',
        fontSize: '13px',
        outline: 'none',
        width: '100%',
        color: 'var(--foreground)',
    };

    const showTable = activeTab === 'fertigprodukte' || !!selectedCategoryId;

    // Precompute derived items for preview
    const previewRows = useMemo(() => {
        const rows = [];
        selectedItems.forEach(item => {
            const article = articles.find(a => a.id === item.article_id);
            rows.push({ ...item, article });
            if (article?.is_finished_product && article?.recipe_items?.length > 0) {
                article.recipe_items.forEach(ri => {
                    rows.push({
                        _derived: true,
                        article_name: ri.article_name,
                        quantity: ri.quantity * item.quantity,
                        unit_abbreviation: ri.unit_abbreviation,
                    });
                });
            }
        });
        return rows;
    }, [selectedItems, articles]);

    const totalProductionCost = useMemo(() => {
        return selectedItems.reduce((sum, item) => {
            const article = articles.find(a => a.id === item.article_id);
            if (article?.production_cost) return sum + article.production_cost * item.quantity;
            return sum;
        }, 0);
    }, [selectedItems, articles]);

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b bg-white flex-shrink-0">
                    <div className="flex-shrink-0 flex items-center justify-center rounded-lg" style={{ width: 32, height: 32, background: '#fef3e2', borderRadius: 8 }}>
                        <Trash2 style={{ width: 16, height: 16, color: '#a06020' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Waste erfassen</p>
                        <p className="text-xs text-muted-foreground">Verlust dokumentieren</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1">

                        {/* ZEILE 1: Datum + Grund */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Datum *</label>
                                <input
                                    type="date"
                                    value={wasteDate}
                                    onChange={(e) => setWasteDate(e.target.value)}
                                    required
                                    style={inputStyle}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Grund *</label>
                                <input
                                    value={globalReason}
                                    onChange={(e) => setGlobalReason(e.target.value)}
                                    placeholder="z.B. abgelaufen, Bruch..."
                                    required
                                    style={inputStyle}
                                    onFocus={e => e.target.style.borderColor = '#a06020'}
                                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                                />
                            </div>
                        </div>

                        {/* ZEILE 2: Tab-Pills */}
                        <div className="flex gap-2">
                            {[
                                { key: 'rohstoffe', label: 'Rohstoffe' },
                                { key: 'fertigprodukte', label: 'Fertigprodukte' }
                            ].map(tab => {
                                const active = activeTab === tab.key;
                                return (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => {
                                            setActiveTab(tab.key);
                                            setQuantities({});
                                            setSearchTerm('');
                                            setSelectedCategoryId('');
                                        }}
                                        className="rounded-full px-4 py-1.5 text-xs font-medium transition-colors"
                                        style={active
                                            ? { background: '#e8f0e4', border: '1px solid #c8d5c0', color: '#2d4a2d' }
                                            : { background: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--muted-foreground)' }
                                        }
                                    >
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* ZEILE 3: Filter */}
                        {activeTab === 'rohstoffe' ? (
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Kategorie *</label>
                                <Select
                                    value={selectedCategoryId}
                                    onValueChange={(value) => {
                                        setSelectedCategoryId(value);
                                        setSearchTerm('');
                                        setQuantities({});
                                    }}
                                >
                                    <SelectTrigger style={{ ...inputStyle, padding: '6px 10px', height: 'auto' }}>
                                        <SelectValue placeholder="Kategorie wählen..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories?.map(cat => (
                                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <div className="flex items-start gap-2 rounded-lg p-3" style={{ background: '#e8f0e4', border: '1px solid #c8d5c0' }}>
                                <Info style={{ width: 16, height: 16, color: '#2d4a2d', flexShrink: 0, marginTop: 1 }} />
                                <p className="text-xs" style={{ color: '#2d4a2d' }}>
                                    Rohstoffe werden beim Buchen automatisch anteilig abgezogen.
                                </p>
                            </div>
                        )}

                        {/* Artikel-Tabelle */}
                        {showTable && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Artikel erfassen</p>
                                    <button
                                        type="button"
                                        onClick={handleReset}
                                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                        Zurücksetzen
                                    </button>
                                </div>

                                {/* Suche */}
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                    <input
                                        placeholder="Artikel suchen..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ ...inputStyle, paddingLeft: '28px' }}
                                    />
                                </div>

                                {/* Tabelle */}
                                <div className="rounded-lg overflow-hidden" style={{ border: '0.5px solid var(--border)' }}>
                                    {filteredArticles.length > 0 ? (
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted hover:bg-muted">
                                                    <TableHead className="text-xs text-muted-foreground w-8">#</TableHead>
                                                    <TableHead className="text-xs text-muted-foreground">Artikel</TableHead>
                                                    <TableHead className="text-xs text-muted-foreground w-32">Menge *</TableHead>
                                                    <TableHead className="text-xs text-muted-foreground w-20">Einheit</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredArticles.map((article, index) => {
                                                    const hasQuantity = quantities[article.id] && parseFloat(quantities[article.id]) > 0;
                                                    return (
                                                        <TableRow
                                                            key={article.id}
                                                            style={hasQuantity ? { background: '#fef3e2' } : {}}
                                                        >
                                                            <TableCell className="text-xs text-muted-foreground">{index + 1}</TableCell>
                                                            <TableCell>
                                                                <p className="text-sm font-medium">{article.name}</p>
                                                                {article.is_finished_product && (
                                                                    <div className="flex gap-1.5 mt-0.5">
                                                                        {article.production_cost > 0 && (
                                                                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#fef3e2', color: '#a06020' }}>
                                                                                Wareneinsatz: {article.production_cost.toFixed(2)} €
                                                                            </span>
                                                                        )}
                                                                        {article.selling_price > 0 && (
                                                                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#e8f0e4', color: '#2d4a2d' }}>
                                                                                VK: {article.selling_price.toFixed(2)} €
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={quantities[article.id] || ''}
                                                                    onChange={(e) => handleQuantityChange(article.id, e.target.value)}
                                                                    placeholder="0"
                                                                    style={{ ...inputStyle, padding: '4px 8px', width: '100px' }}
                                                                    onFocus={e => e.target.style.borderColor = '#a06020'}
                                                                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                                                                />
                                                            </TableCell>
                                                            <TableCell className="text-sm text-muted-foreground">{article.unit_abbreviation}</TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    ) : (
                                        <div className="p-8 text-center text-sm text-muted-foreground">
                                            {searchTerm
                                                ? 'Keine Artikel gefunden'
                                                : activeTab === 'fertigprodukte'
                                                    ? 'Keine Fertigprodukte vorhanden'
                                                    : 'Diese Kategorie hat keine Artikel'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Vorschau */}
                        {selectedItems.length > 0 && (
                            <div className="rounded-xl p-4 space-y-3" style={{ background: '#fef3e2', border: '1px solid #e8c8a0' }}>
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold" style={{ color: '#a06020' }}>
                                        Zur Buchung — {selectedItems.length} Artikel
                                    </p>
                                    {globalReason && (
                                        <span className="text-xs rounded-md px-2 py-0.5" style={{ background: '#e8c8a0', color: '#a06020' }}>
                                            Grund: {globalReason}
                                        </span>
                                    )}
                                </div>
                                <div className="rounded-lg overflow-hidden bg-white" style={{ border: '0.5px solid #e8c8a0' }}>
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent" style={{ background: 'transparent' }}>
                                                <TableHead className="text-xs text-muted-foreground">Artikel</TableHead>
                                                <TableHead className="text-xs text-muted-foreground text-right">Menge</TableHead>
                                                <TableHead className="text-xs text-muted-foreground w-20">Einheit</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewRows.map((row, idx) => (
                                                row._derived ? (
                                                    <TableRow key={`derived-${idx}`} className="hover:bg-transparent">
                                                        <TableCell className="text-xs text-muted-foreground pl-6 py-1">
                                                            ↳ {row.article_name}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-muted-foreground text-right py-1">
                                                            -{row.quantity % 1 === 0 ? row.quantity : row.quantity.toFixed(3)}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-muted-foreground py-1">{row.unit_abbreviation}</TableCell>
                                                    </TableRow>
                                                ) : (
                                                    <TableRow key={row.article_id}>
                                                        <TableCell className="text-sm font-medium">{row.article_name}</TableCell>
                                                        <TableCell className="text-sm text-right font-medium">{row.quantity}</TableCell>
                                                        <TableCell className="text-sm text-muted-foreground">{row.unit_abbreviation}</TableCell>
                                                    </TableRow>
                                                )
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                {totalProductionCost > 0 && (
                                    <div className="flex justify-between items-center pt-1">
                                        <span className="text-xs font-medium" style={{ color: '#a06020' }}>Wareneinsatz</span>
                                        <span className="text-sm font-semibold" style={{ color: '#a06020' }}>{totalProductionCost.toFixed(2)} €</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex gap-2 px-5 py-4 border-t bg-white flex-shrink-0">
                        <button
                            type="button"
                            onClick={() => { onClose(); resetForm(); }}
                            className="flex-1 text-sm font-medium rounded-lg py-2 transition-colors hover:bg-accent text-muted-foreground"
                            style={{ border: '0.5px solid var(--border)', background: 'transparent' }}
                        >
                            Abbrechen
                        </button>
                        <button
                            type="submit"
                            disabled={selectedItems.length === 0 || !globalReason.trim()}
                            className="flex-1 text-sm font-medium rounded-lg py-2 text-white transition-colors disabled:opacity-40"
                            style={{ background: '#a06020' }}
                        >
                            Waste buchen ({selectedItems.length})
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}