import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { RefreshCw, BookOpen, Tag, Upload, X, ChevronDown, ChevronRight } from 'lucide-react';
import { useOutlet } from '@/components/outlet/OutletContext';

// ─── CSV PARSE HELPERS ───────────────────────────────────────────────────────

function parseCsvRow(row) {
    return row.match(/(".*?"|[^,]+)(?=,|$)/g)?.map(cell =>
        cell.replace(/^"|"$/g, '').trim()
    ) || [];
}

function parseLightspeedCsv(text, finishedProducts) {
    const lines = text.split('\n');
    const products = [];
    let currentCategory = '';

    // skip header (line 0)
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        const cols = parseCsvRow(line);
        if (cols.length < 21) continue;

        const rawName = cols[0] || '';
        const sku = cols[1] || '';
        const transBetrag = cols[19] || '0';
        const transMenge = cols[20] || '0';

        // Category: no leading spaces, no SKU
        if (!rawName.startsWith(' ') && !sku) {
            const catName = rawName.trim();
            if (catName && catName !== 'Verzehrtyp') {
                currentCategory = catName;
            }
            continue;
        }

        // Real product: exactly 4 leading spaces, has SKU
        const leadingSpaces = rawName.match(/^( *)/)[1].length;
        if (leadingSpaces < 4 || !sku) continue;

        const name = rawName.trim();
        const qty = parseFloat(transMenge) || 0;
        const revenue = parseFloat(transBetrag.replace(',', '.')) || 0;

        if (qty <= 0) continue;
        if (name.includes('(enthalten)')) continue;

        products.push({ name, sku, quantity_sold: qty, revenue, category: currentCategory });
    }

    // Match with finished products
    const normalize = (str) => str.toLowerCase().trim()
        .replace(/\s+/g, ' ')
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');

    const matched = [];
    const unmatched = [];

    products.forEach(p => {
        const pNorm = normalize(p.name);
        const fp = finishedProducts.find(f => {
            const fNorm = normalize(f.name);
            return pNorm === fNorm || pNorm.includes(fNorm) || fNorm.includes(pNorm);
        });
        if (fp) {
            const productionCost = fp.production_cost || 0;
            matched.push({ ...p, finishedProduct: fp, wareneinsatz: p.quantity_sold * productionCost });
        } else {
            unmatched.push(p);
        }
    });

    return { matched, unmatched };
}

function parsePeriodFromFilename(filename) {
    const match = filename.match(/(\d{8})_(\d{8})/);
    if (!match) return '';
    const fmt = (s) => `${s.slice(6, 8)}.${s.slice(4, 6)}.${s.slice(0, 4)}`;
    return `${fmt(match[1])} – ${fmt(match[2])}`;
}

// ─── SUBCOMPONENTS ───────────────────────────────────────────────────────────

function SummaryKachel({ label, value }) {
    return (
        <div className="bg-muted border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-lg font-semibold text-foreground">{value}</p>
        </div>
    );
}

function VerkaufsdatenTab({ finishedProducts }) {
    const [csvData, setCsvData] = useState(null);
    const [csvFileName, setCsvFileName] = useState('');
    const [csvPeriod, setCsvPeriod] = useState('');
    const [matchedProducts, setMatchedProducts] = useState([]);
    const [unmatchedProducts, setUnmatchedProducts] = useState([]);
    const [unmatchedOpen, setUnmatchedOpen] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);

    const handleFile = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const { matched, unmatched } = parseLightspeedCsv(text, finishedProducts);
            setCsvData(true);
            setCsvFileName(file.name);
            setCsvPeriod(parsePeriodFromFilename(file.name));
            setMatchedProducts(matched);
            setUnmatchedProducts(unmatched);
        };
        reader.readAsText(file, 'UTF-8');
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file?.name.endsWith('.csv')) handleFile(file);
    };

    const handleReset = () => {
        setCsvData(null);
        setCsvFileName('');
        setCsvPeriod('');
        setMatchedProducts([]);
        setUnmatchedProducts([]);
        setUnmatchedOpen(false);
    };

    const totalRevenue = matchedProducts.reduce((s, p) => s + p.revenue, 0)
        + unmatchedProducts.reduce((s, p) => s + p.revenue, 0);
    const totalQty = matchedProducts.reduce((s, p) => s + p.quantity_sold, 0)
        + unmatchedProducts.reduce((s, p) => s + p.quantity_sold, 0);
    const totalWareneinsatz = matchedProducts.reduce((s, p) => s + p.wareneinsatz, 0);

    const sortedMatched = [...matchedProducts].sort((a, b) => b.revenue - a.revenue);

    if (!csvData) {
        return (
            <div className="max-w-xl mx-auto py-8">
                <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className="rounded-2xl p-10 text-center transition-colors"
                    style={{
                        border: `2px dashed ${dragOver ? '#2d4a2d' : '#c8d5c0'}`,
                        background: dragOver ? '#e8f0e4' : 'var(--muted)',
                    }}
                >
                    <Upload className="w-8 h-8 mx-auto mb-3" style={{ color: '#2d4a2d' }} />
                    <p className="text-sm font-medium text-foreground mb-1">Lightspeed CSV hier ablegen</p>
                    <p className="text-xs text-muted-foreground mb-5">Product Breakdown Export aus Lightspeed</p>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-accent"
                        style={{ border: '1px solid #c8d5c0', color: '#2d4a2d', background: 'white' }}
                    >
                        Datei auswählen
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => handleFile(e.target.files[0])}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-foreground">{csvFileName}</p>
                    {csvPeriod && <p className="text-xs text-muted-foreground">{csvPeriod}</p>}
                </div>
                <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    style={{ border: '0.5px solid var(--border)' }}
                >
                    <X className="w-3.5 h-3.5" />
                    Neu laden
                </button>
            </div>

            {/* Kacheln */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SummaryKachel label="Gesamtumsatz" value={`${totalRevenue.toFixed(2)} €`} />
                <SummaryKachel label="Verkaufte Artikel" value={totalQty.toFixed(0)} />
                <SummaryKachel label="Fertigprodukte gematcht" value={matchedProducts.length} />
                <SummaryKachel label="Geschätzter Wareneinsatz" value={`${totalWareneinsatz.toFixed(2)} €`} />
            </div>

            {/* Gematchte Produkte */}
            <div>
                <p className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: '#2d4a2d' }}>
                    Verkaufte Fertigprodukte
                </p>
                {sortedMatched.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Keine Fertigprodukte gematcht.</p>
                ) : (
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #c8d5c0' }}>
                        <table className="w-full text-sm">
                            <thead>
                                <tr style={{ background: '#e8f0e4', borderBottom: '1px solid #c8d5c0' }}>
                                    <th className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: '#2d4a2d' }}>Produkt</th>
                                    <th className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: '#2d4a2d' }}>Kategorie</th>
                                    <th className="text-right px-4 py-2.5 text-xs font-medium" style={{ color: '#2d4a2d' }}>Verkauft</th>
                                    <th className="text-right px-4 py-2.5 text-xs font-medium" style={{ color: '#2d4a2d' }}>Umsatz</th>
                                    <th className="text-right px-4 py-2.5 text-xs font-medium" style={{ color: '#2d4a2d' }}>Wareneinsatz</th>
                                    <th className="text-right px-4 py-2.5 text-xs font-medium" style={{ color: '#2d4a2d' }}>Marge</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedMatched.map((p, i) => {
                                    const marge = p.revenue - p.wareneinsatz;
                                    return (
                                        <tr key={i} className="border-t border-border hover:bg-muted/50 transition-colors">
                                            <td className="px-4 py-2.5 font-medium text-foreground">{p.name}</td>
                                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{p.category}</td>
                                            <td className="px-4 py-2.5 text-right">{p.quantity_sold}</td>
                                            <td className="px-4 py-2.5 text-right">{p.revenue.toFixed(2)} €</td>
                                            <td className="px-4 py-2.5 text-right text-xs">{p.wareneinsatz.toFixed(2)} €</td>
                                            <td className="px-4 py-2.5 text-right font-semibold text-xs" style={{ color: marge >= 0 ? '#2d4a2d' : 'hsl(var(--destructive))' }}>
                                                {marge >= 0 ? '+' : ''}{marge.toFixed(2)} €
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Nicht gematchte Produkte */}
            {unmatchedProducts.length > 0 && (
                <div>
                    <button
                        onClick={() => setUnmatchedOpen(o => !o)}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {unmatchedOpen
                            ? <ChevronDown className="w-4 h-4" />
                            : <ChevronRight className="w-4 h-4" />}
                        Nicht zugeordnete Produkte ({unmatchedProducts.length})
                    </button>
                    {unmatchedOpen && (
                        <div className="mt-3 space-y-2">
                            <p className="text-xs text-muted-foreground">
                                Diese Produkte sind in Lightspeed, aber nicht als Fertigprodukt angelegt.
                            </p>
                            <div className="rounded-xl overflow-hidden border border-border">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-muted border-b border-border">
                                            <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Produkt</th>
                                            <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Kategorie</th>
                                            <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Verkauft</th>
                                            <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Umsatz</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {unmatchedProducts.map((p, i) => (
                                            <tr key={i} className="border-t border-border hover:bg-muted/50 transition-colors">
                                                <td className="px-4 py-2 text-muted-foreground">{p.name}</td>
                                                <td className="px-4 py-2 text-xs text-muted-foreground">{p.category}</td>
                                                <td className="px-4 py-2 text-right text-muted-foreground">{p.quantity_sold}</td>
                                                <td className="px-4 py-2 text-right text-muted-foreground">{p.revenue.toFixed(2)} €</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function Produktpass() {
    const { currentOutletId } = useOutlet();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('produktpass');
    const [selectedId, setSelectedId] = useState(null);

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
            return sum + ri.quantity * (raw?.purchase_price || 0);
        }, 0);
    }, [selected, rawMaterialsMap]);

    const sellingPrice = selected?.selling_price || 0;
    const margin = sellingPrice - computedCost;
    const marginPct = sellingPrice > 0 ? (margin / sellingPrice) * 100 : null;

    const tabStyle = (key) => activeTab === key
        ? { background: '#e8f0e4', border: '1px solid #c8d5c0', color: '#2d4a2d' }
        : { background: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--muted-foreground)' };

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
                {/* Tab Pills */}
                <div className="flex gap-2 mb-6">
                    {[
                        { key: 'produktpass', label: 'Produktpass' },
                        { key: 'verkaufsdaten', label: 'Verkaufsdaten' },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
                            style={tabStyle(tab.key)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* TAB: Produktpass */}
                {activeTab === 'produktpass' && (
                    finishedProducts.length === 0 ? (
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
                    )
                )}

                {/* TAB: Verkaufsdaten */}
                {activeTab === 'verkaufsdaten' && (
                    <VerkaufsdatenTab finishedProducts={finishedProducts} />
                )}
            </div>
        </div>
    );
}