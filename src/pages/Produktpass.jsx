import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { RefreshCw, BookOpen, Tag } from 'lucide-react';
import { useOutlet } from '@/components/outlet/OutletContext';

export default function Produktpass() {
    const { currentOutletId } = useOutlet();
    const queryClient = useQueryClient();
    const [selectedId, setSelectedId] = useState(null);

    const { data: outletItems = [] } = useQuery({
        queryKey: ['outlet-items', currentOutletId],
        queryFn: () => base44.entities.OutletItem.filter({ outlet_id: currentOutletId }),
        enabled: !!currentOutletId,
    });

    const { data: allArticles = [] } = useQuery({
        queryKey: ['articles-all'],
        queryFn: () => base44.entities.Article.list(),
    });

    const finishedProducts = useMemo(
        () => allArticles.filter(a => a.is_finished_product === true && a.is_active !== false),
        [allArticles]
    );

    const rawMaterialsMap = useMemo(() => {
        const map = {};
        allArticles.forEach(a => { map[a.id] = a; });
        return map;
    }, [allArticles]);

    const selected = useMemo(
        () => finishedProducts.find(a => a.id === selectedId) || null,
        [finishedProducts, selectedId]
    );

    const computedCost = useMemo(() => {
        if (!selected?.recipe_items?.length) return 0;
        return selected.recipe_items.reduce((sum, ri) => {
            const raw = rawMaterialsMap[ri.article_id];
            const price = raw?.purchase_price || 0;
            return sum + ri.quantity * price;
        }, 0);
    }, [selected, rawMaterialsMap]);

    const sellingPrice = selected?.selling_price || 0;
    const margin = sellingPrice - computedCost;
    const marginPct = sellingPrice > 0 ? (margin / sellingPrice) * 100 : null;

    const inputStyle = {
        border: '0.5px solid var(--border)',
        borderRadius: '8px',
        background: 'var(--muted)',
        padding: '6px 10px',
        fontSize: '13px',
        outline: 'none',
        color: 'var(--foreground)',
        width: '100%',
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="bg-white border-b border-border sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="flex items-center justify-center rounded-lg" style={{ width: 32, height: 32, background: '#e8f0e4' }}>
                            <BookOpen style={{ width: 16, height: 16, color: '#2d4a2d' }} />
                        </div>
                        <div>
                            <p className="text-base font-semibold text-foreground">Produktpass</p>
                            <p className="text-xs text-muted-foreground">Rezepturen & Kalkulation</p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            queryClient.invalidateQueries({ queryKey: ['articles-all'] });
                            queryClient.invalidateQueries({ queryKey: ['outlet-items', currentOutletId] });
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        style={{ border: '0.5px solid var(--border)' }}
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Aktualisieren
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
                {finishedProducts.length === 0 ? (
                    <div className="rounded-xl p-8 text-center" style={{ border: '1px solid #c8d5c0', background: '#e8f0e4' }}>
                        <BookOpen className="w-8 h-8 mx-auto mb-3" style={{ color: '#2d4a2d' }} />
                        <p className="text-sm font-medium" style={{ color: '#2d4a2d' }}>Keine Fertigprodukte angelegt.</p>
                        <p className="text-xs mt-1" style={{ color: '#2d4a2d' }}>Lege zuerst einen Artikel als Fertigprodukt an.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-5">
                        {/* Produktliste */}
                        <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">Fertigprodukte</p>
                            {finishedProducts.map(product => {
                                const cost = product.recipe_items?.reduce((sum, ri) => {
                                    const raw = rawMaterialsMap[ri.article_id];
                                    return sum + ri.quantity * (raw?.purchase_price || 0);
                                }, 0) || 0;
                                const isActive = selectedId === product.id;
                                return (
                                    <div
                                        key={product.id}
                                        onClick={() => setSelectedId(product.id)}
                                        className="rounded-xl p-4 cursor-pointer transition-all"
                                        style={{
                                            border: isActive ? '1.5px solid #2d4a2d' : '1px solid var(--border)',
                                            background: isActive ? '#e8f0e4' : 'var(--card)',
                                        }}
                                    >
                                        <p className="text-sm font-medium text-foreground leading-tight">{product.name}</p>
                                        <div className="flex items-center gap-3 mt-1.5">
                                            {product.selling_price > 0 && (
                                                <span className="text-xs text-muted-foreground">
                                                    VK {product.selling_price.toFixed(2)} €
                                                </span>
                                            )}
                                            {cost > 0 && (
                                                <span className="text-xs" style={{ color: '#2d4a2d' }}>
                                                    WE {cost.toFixed(2)} €
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Detail */}
                        <div>
                            {!selected ? (
                                <div className="rounded-xl p-10 text-center text-sm text-muted-foreground" style={{ border: '1px dashed var(--border)' }}>
                                    Wähle ein Fertigprodukt aus der Liste
                                </div>
                            ) : (
                                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #c8d5c0' }}>
                                    {/* Produktinfo */}
                                    <div className="px-5 py-4" style={{ background: '#e8f0e4', borderBottom: '1px solid #c8d5c0' }}>
                                        <p className="text-lg font-semibold" style={{ color: '#2d4a2d' }}>{selected.name}</p>
                                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                            {selected.category_name && (
                                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#c8d5c0', color: '#2d4a2d' }}>
                                                    {selected.category_name}
                                                </span>
                                            )}
                                            {selected.unit_abbreviation && (
                                                <span className="text-xs text-muted-foreground">/ {selected.unit_abbreviation}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="px-5 py-5 space-y-6 bg-white">
                                        {/* Rezeptur */}
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">Rezeptur</p>
                                            {(!selected.recipe_items || selected.recipe_items.length === 0) ? (
                                                <p className="text-sm text-muted-foreground">Keine Rezeptur hinterlegt.</p>
                                            ) : (
                                                <div className="space-y-1.5">
                                                    {selected.recipe_items.map((ri, idx) => {
                                                        const raw = rawMaterialsMap[ri.article_id];
                                                        const cost = ri.quantity * (raw?.purchase_price || 0);
                                                        return (
                                                            <div key={idx} className="grid items-center gap-3" style={{ gridTemplateColumns: '1fr 70px 40px 70px' }}>
                                                                <span className="text-sm">{ri.article_name}</span>
                                                                <span className="text-sm font-medium text-right">{ri.quantity}</span>
                                                                <span className="text-xs text-muted-foreground">{ri.unit_abbreviation}</span>
                                                                {raw?.purchase_price ? (
                                                                    <span className="text-xs text-right" style={{ color: '#2d4a2d' }}>{cost.toFixed(2)} €</span>
                                                                ) : (
                                                                    <span className="text-xs text-muted-foreground text-right">–</span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                    <div className="flex items-center justify-between border-t border-border pt-2 mt-2">
                                                        <span className="text-xs text-muted-foreground">Wareneinsatz gesamt</span>
                                                        <span className="text-sm font-semibold" style={{ color: '#2d4a2d' }}>{computedCost.toFixed(2)} €</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Kalkulation */}
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">Kalkulation</p>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-muted-foreground">Verkaufspreis</span>
                                                    <span className="text-sm font-medium">{sellingPrice > 0 ? `${sellingPrice.toFixed(2)} €` : '–'}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-muted-foreground">Wareneinsatz</span>
                                                    <span className="text-sm font-medium">{computedCost.toFixed(2)} €</span>
                                                </div>
                                                {sellingPrice > 0 && (
                                                    <>
                                                        <div className="border-t border-border pt-2 flex items-center justify-between">
                                                            <span className="text-sm font-medium">Marge</span>
                                                            <span className="text-sm font-semibold" style={{ color: margin >= 0 ? '#2d4a2d' : 'hsl(var(--destructive))' }}>
                                                                {margin >= 0 ? '+' : ''}{margin.toFixed(2)} €
                                                            </span>
                                                        </div>
                                                        {marginPct !== null && (
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-sm text-muted-foreground">Marge %</span>
                                                                <span className="text-sm font-semibold" style={{ color: marginPct >= 0 ? '#2d4a2d' : 'hsl(var(--destructive))' }}>
                                                                    {marginPct.toFixed(1)} %
                                                                </span>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Allergene & Labels */}
                                        {((selected.allergens?.length > 0) || (selected.labels?.length > 0)) && (
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">Allergene & Labels</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {selected.allergens?.map((a, i) => (
                                                        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                                            {a}
                                                        </span>
                                                    ))}
                                                    {selected.labels?.map((l, i) => (
                                                        <span key={i} className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: '#e8f0e4', color: '#2d4a2d', border: '1px solid #c8d5c0' }}>
                                                            <Tag className="w-3 h-3" />
                                                            {l}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}