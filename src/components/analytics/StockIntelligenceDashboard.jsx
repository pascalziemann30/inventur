import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingDown, AlertTriangle, Download, X } from 'lucide-react';
import { format, subDays, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { de } from 'date-fns/locale';

import KPICards from './KPICards';
import WasteTimelineChart from './WasteTimelineChart';
import TopWasteChart from './TopWasteChart';
import WasteByReasonChart from './WasteByReasonChart';
import CategoryTreemap from './CategoryTreemap';
import OutletComparisonChart from './OutletComparisonChart';
import AlertsList from './AlertsList';
import ArticleDrilldown from './ArticleDrilldown';

export default function StockIntelligenceDashboard({ currentOutletId, currentOutletName, onClose }) {
    const queryClient = useQueryClient();

    // Date filters
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    
    // Filters
    const [selectedOutlet, setSelectedOutlet] = useState(currentOutletId);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedSupplier, setSelectedSupplier] = useState('all');
    
    // Drilldown
    const [drilldownArticle, setDrilldownArticle] = useState(null);

    // Fetch data
    const { data: outlets = [] } = useQuery({
        queryKey: ['outlets'],
        queryFn: () => base44.entities.Outlet.list()
    });

    const { data: categories = [] } = useQuery({
        queryKey: ['categories'],
        queryFn: () => base44.entities.Category.list()
    });

    const { data: suppliers = [] } = useQuery({
        queryKey: ['suppliers'],
        queryFn: () => base44.entities.Supplier.list()
    });

    // Load waste data
    const { data: allWastes = [] } = useQuery({
        queryKey: ['wastes-analytics', selectedOutlet],
        queryFn: () => {
            if (selectedOutlet === 'all') {
                return base44.entities.Waste.list('-waste_date', 1000);
            }
            return base44.entities.Waste.filter({ outlet_id: selectedOutlet }, '-waste_date', 1000);
        }
    });

    // Load deliveries
    const { data: allDeliveries = [] } = useQuery({
        queryKey: ['deliveries-analytics', selectedOutlet],
        queryFn: () => {
            if (selectedOutlet === 'all') {
                return base44.entities.Delivery.list('-delivery_date', 1000);
            }
            return base44.entities.Delivery.filter({ outlet_id: selectedOutlet }, '-delivery_date', 1000);
        }
    });

    // Load stock movements
    const { data: allMovements = [] } = useQuery({
        queryKey: ['movements-analytics', selectedOutlet],
        queryFn: () => {
            if (selectedOutlet === 'all') {
                return base44.entities.StockMovement.list('-movement_date', 1000);
            }
            return base44.entities.StockMovement.filter({ outlet_id: selectedOutlet }, '-movement_date', 1000);
        }
    });

    // Load outlet items for pricing
    const { data: outletItems = [] } = useQuery({
        queryKey: ['outlet-items-analytics'],
        queryFn: () => base44.entities.OutletItem.list()
    });

    const { data: globalItems = [] } = useQuery({
        queryKey: ['global-items-analytics'],
        queryFn: () => base44.entities.GlobalItem.list()
    });

    // Filter data by date range and filters
    const filteredData = useMemo(() => {
        const start = startOfDay(parseISO(startDate));
        const end = endOfDay(parseISO(endDate));

        const wastes = allWastes.filter(w => {
            const date = parseISO(w.waste_date);
            if (!isWithinInterval(date, { start, end })) return false;
            return true;
        });

        const deliveries = allDeliveries.filter(d => {
            const date = parseISO(d.delivery_date);
            return isWithinInterval(date, { start, end });
        });

        const movements = allMovements.filter(m => {
            const date = parseISO(m.movement_date);
            return isWithinInterval(date, { start, end });
        });

        // Calculate waste items with values
        const wasteItems = [];
        wastes.forEach(waste => {
            (waste.items || []).forEach(item => {
                // Get price
                const outletItem = outletItems.find(oi => oi.id === item.article_id);
                
                // Skip if article doesn't exist anymore
                if (!outletItem) return;
                
                let price = outletItem?.net_purchase_price || 0;
                
                if (!price && outletItem?.global_item_id) {
                    const globalItem = globalItems.find(g => g.id === outletItem.global_item_id);
                    price = globalItem?.default_net_price || 0;
                }

                const value = (item.quantity || 0) * (price || 0);

                // Get category
                const category = outletItem?.global_item_id 
                    ? globalItems.find(g => g.id === outletItem.global_item_id)?.category_name 
                    : null;

                // Apply filters
                if (selectedCategory !== 'all' && category !== selectedCategory) return;
                if (selectedSupplier !== 'all' && item.supplier_name !== selectedSupplier) return;

                wasteItems.push({
                    date: waste.waste_date || '',
                    outlet_id: waste.outlet_id || '',
                    outlet_name: waste.outlet_name || '',
                    article_id: item.article_id || '',
                    article_name: item.article_name || '',
                    supplier_name: item.supplier_name || '',
                    category: category || '',
                    quantity: item.quantity || 0,
                    unit: item.unit_abbreviation || '',
                    price: price || 0,
                    value: value || 0,
                    reason: item.reason || 'Kein Grund angegeben'
                });
            });
        });

        // Calculate delivery value
        let deliveryValue = 0;
        deliveries.forEach(delivery => {
            (delivery.items || []).forEach(item => {
                let price = item.price || 0;
                if (!price && item.article_id) {
                    const outletItem = outletItems.find(oi => oi.id === item.article_id);
                    price = outletItem?.net_purchase_price || 0;
                }
                deliveryValue += (item.quantity || 0) * price;
            });
        });

        return {
            wasteItems,
            deliveries,
            movements,
            deliveryValue
        };
    }, [allWastes, allDeliveries, allMovements, startDate, endDate, selectedCategory, selectedSupplier, outletItems, globalItems]);

    const handleExportHTML = async () => {
        // TODO: Implement HTML export
        alert('HTML Export wird implementiert');
    };

    const handleExportCSV = () => {
        // Generate CSV
        const headers = ['Datum', 'Outlet', 'Artikel', 'Lieferant', 'Kategorie', 'Menge', 'Einheit', 'Einzelpreis', 'Gesamtwert', 'Grund'];
        const rows = filteredData.wasteItems.map(item => [
            item.date || '',
            item.outlet_name || '',
            item.article_name || '',
            item.supplier_name || '',
            item.category || '',
            (item.quantity || 0).toFixed(2),
            item.unit || '',
            (item.price || 0).toFixed(2),
            (item.value || 0).toFixed(2),
            item.reason || ''
        ]);

        let csv = '\ufeff'; // UTF-8 BOM
        csv += headers.join(';') + '\n';
        rows.forEach(row => {
            csv += row.join(';') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `waste-analyse_${startDate}_${endDate}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
            <div className="min-h-screen p-4">
                <div className="max-w-7xl mx-auto bg-white rounded-lg shadow-xl">
                    {/* Header */}
                    <div className="border-b p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                    <BarChart3 className="w-6 h-6" />
                                    Stock Intelligence
                                </h2>
                                <p className="text-sm text-slate-600 mt-1">
                                    Verbrauch & Waste im Überblick
                                </p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={onClose}>
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* Filters */}
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-6">
                            <div>
                                <label className="text-xs text-slate-600 mb-1 block">Von</label>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-600 mb-1 block">Bis</label>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-600 mb-1 block">Outlet</label>
                                <Select value={selectedOutlet} onValueChange={setSelectedOutlet}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={currentOutletId}>
                                            {currentOutletName} (aktuell)
                                        </SelectItem>
                                        <SelectItem value="all">Alle Outlets</SelectItem>
                                        {outlets.filter(o => o.id !== currentOutletId).map(outlet => (
                                            <SelectItem key={outlet.id} value={outlet.id}>
                                                {outlet.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-xs text-slate-600 mb-1 block">Kategorie</label>
                                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Alle Kategorien</SelectItem>
                                        {categories.map(cat => (
                                            <SelectItem key={cat.id} value={cat.name}>
                                                {cat.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-xs text-slate-600 mb-1 block">Lieferant</label>
                                <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Alle Lieferanten</SelectItem>
                                        {suppliers.map(sup => (
                                            <SelectItem key={sup.id} value={sup.name}>
                                                {sup.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Export buttons */}
                        <div className="flex gap-2 mt-4">
                            <Button variant="outline" size="sm" onClick={handleExportCSV}>
                                <Download className="w-4 h-4 mr-2" />
                                CSV Export
                            </Button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        {/* KPIs */}
                        <KPICards data={filteredData} />

                        {/* Charts Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <WasteTimelineChart data={filteredData.wasteItems} />
                            <TopWasteChart 
                                data={filteredData.wasteItems} 
                                onArticleClick={setDrilldownArticle}
                            />
                            <WasteByReasonChart data={filteredData.wasteItems} />
                            <CategoryTreemap 
                                data={filteredData.wasteItems}
                                onCategoryClick={(cat) => setSelectedCategory(cat)}
                            />
                        </div>

                        {/* Outlet Comparison (only when all outlets selected) */}
                        {selectedOutlet === 'all' && (
                            <OutletComparisonChart data={filteredData.wasteItems} deliveryValue={filteredData.deliveryValue} />
                        )}

                        {/* Alerts */}
                        <AlertsList 
                            wasteItems={filteredData.wasteItems}
                            deliveries={filteredData.deliveries}
                            onUpdate={() => {
                                queryClient.invalidateQueries({ queryKey: ['outlet-items-analytics'] });
                                queryClient.invalidateQueries({ queryKey: ['wastes-analytics'] });
                            }}
                        />
                    </div>
                </div>

                {/* Drilldown Panel */}
                {drilldownArticle && (
                    <ArticleDrilldown
                        article={drilldownArticle}
                        wasteItems={filteredData.wasteItems}
                        deliveries={filteredData.deliveries}
                        onClose={() => setDrilldownArticle(null)}
                    />
                )}
            </div>
        </div>
    );
}