import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingDown, Euro, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, parseISO, format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function Analytics() {
    const [periodType, setPeriodType] = useState('month');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());

    const { data: articles = [] } = useQuery({
        queryKey: ['articles'],
        queryFn: () => base44.entities.Article.list()
    });

    const { data: inventories = [] } = useQuery({
        queryKey: ['inventories'],
        queryFn: () => base44.entities.Inventory.list('-inventory_date')
    });

    const { data: deliveries = [] } = useQuery({
        queryKey: ['deliveries'],
        queryFn: () => base44.entities.Delivery.list('-delivery_date')
    });

    const { data: priceHistory = [] } = useQuery({
        queryKey: ['price-history'],
        queryFn: () => base44.entities.PriceHistory.list('-change_date')
    });

    const analysisData = useMemo(() => {
        const year = parseInt(selectedYear);
        const month = parseInt(selectedMonth);
        
        let periodStart, periodEnd;
        
        if (periodType === 'month') {
            periodStart = startOfMonth(new Date(year, month - 1));
            periodEnd = endOfMonth(new Date(year, month - 1));
        } else {
            periodStart = startOfYear(new Date(year, 0));
            periodEnd = endOfYear(new Date(year, 0));
        }

        const periodInventories = inventories.filter(inv => 
            isWithinInterval(parseISO(inv.inventory_date), { start: periodStart, end: periodEnd })
        );

        const periodDeliveries = deliveries.filter(del =>
            isWithinInterval(parseISO(del.delivery_date), { start: periodStart, end: periodEnd })
        );

        const results = articles.map(article => {
            const articleInventories = periodInventories
                .filter(inv => inv.article_id === article.id)
                .sort((a, b) => new Date(a.inventory_date) - new Date(b.inventory_date));

            const articleDeliveries = periodDeliveries
                .flatMap(del => del.items?.filter(item => item.article_id === article.id) || []);

            const startStock = articleInventories.length > 0 
                ? articleInventories[0].counted_quantity 
                : article.initial_stock || 0;

            const endStock = articleInventories.length > 0
                ? articleInventories[articleInventories.length - 1].counted_quantity
                : article.current_stock || 0;

            const totalDelivered = articleDeliveries.reduce((sum, item) => sum + (item.quantity || 0), 0);

            const consumption = Math.max(0, startStock + totalDelivered - endStock);

            // Get price at end of period (or current price)
            const relevantPriceChanges = priceHistory.filter(ph => 
                ph.article_id === article.id && 
                parseISO(ph.change_date) <= periodEnd
            ).sort((a, b) => new Date(b.change_date) - new Date(a.change_date));

            const periodPrice = relevantPriceChanges.length > 0 
                ? relevantPriceChanges[0].new_price 
                : article.purchase_price || 0;

            const consumptionValue = consumption * periodPrice;
            const deliveryValue = totalDelivered * periodPrice;

            return {
                ...article,
                startStock,
                endStock,
                totalDelivered,
                consumption,
                periodPrice,
                consumptionValue,
                deliveryValue
            };
        }).filter(a => a.consumption > 0 || a.totalDelivered > 0);

        const totalConsumptionValue = results.reduce((sum, a) => sum + a.consumptionValue, 0);
        const totalDeliveryValue = results.reduce((sum, a) => sum + a.deliveryValue, 0);

        return {
            items: results.sort((a, b) => b.consumptionValue - a.consumptionValue),
            totalConsumptionValue,
            totalDeliveryValue
        };
    }, [articles, inventories, deliveries, priceHistory, periodType, selectedYear, selectedMonth]);

    const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());
    const months = [
        { value: '1', label: 'Januar' },
        { value: '2', label: 'Februar' },
        { value: '3', label: 'März' },
        { value: '4', label: 'April' },
        { value: '5', label: 'Mai' },
        { value: '6', label: 'Juni' },
        { value: '7', label: 'Juli' },
        { value: '8', label: 'August' },
        { value: '9', label: 'September' },
        { value: '10', label: 'Oktober' },
        { value: '11', label: 'November' },
        { value: '12', label: 'Dezember' }
    ];

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                    <div className="flex items-center gap-4">
                        <Link to={createPageUrl('Settings')}>
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                                Auswertungen
                            </h1>
                            <p className="text-sm text-slate-500">
                                Einkaufs- und Verbrauchsanalyse
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                {/* Controls */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex flex-wrap gap-4">
                            <Select value={periodType} onValueChange={setPeriodType}>
                                <SelectTrigger className="w-32">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="month">Monat</SelectItem>
                                    <SelectItem value="year">Jahr</SelectItem>
                                </SelectContent>
                            </Select>

                            {periodType === 'month' && (
                                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                    <SelectTrigger className="w-36">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {months.map(m => (
                                            <SelectItem key={m.value} value={m.value}>
                                                {m.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}

                            <Select value={selectedYear} onValueChange={setSelectedYear}>
                                <SelectTrigger className="w-24">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {years.map(y => (
                                        <SelectItem key={y} value={y}>
                                            {y}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-red-100 rounded-lg">
                                    <TrendingDown className="w-6 h-6 text-red-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-600">Verbrauch (Wert)</p>
                                    <p className="text-2xl font-bold text-slate-900">
                                        {analysisData.totalConsumptionValue.toFixed(2)} €
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-emerald-100 rounded-lg">
                                    <Package className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-600">Einkauf (Wert)</p>
                                    <p className="text-2xl font-bold text-slate-900">
                                        {analysisData.totalDeliveryValue.toFixed(2)} €
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-100 rounded-lg">
                                    <Euro className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-600">Artikel</p>
                                    <p className="text-2xl font-bold text-slate-900">
                                        {analysisData.items.length}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Detailed Table */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Detailansicht</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50">
                                    <TableHead className="font-semibold">Artikel</TableHead>
                                    <TableHead className="text-right font-semibold">Verbrauch</TableHead>
                                    <TableHead className="text-right font-semibold">Einkauf</TableHead>
                                    <TableHead className="text-right font-semibold">Preis/Einheit</TableHead>
                                    <TableHead className="text-right font-semibold">Verbrauchswert</TableHead>
                                    <TableHead className="text-right font-semibold">Einkaufswert</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {analysisData.items.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                                            Keine Daten für diesen Zeitraum
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    analysisData.items.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <div className="font-medium">{item.name}</div>
                                                <div className="text-xs text-slate-500">{item.category_name}</div>
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                {item.consumption.toFixed(1)} {item.unit_abbreviation}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-emerald-600">
                                                {item.totalDelivered.toFixed(1)} {item.unit_abbreviation}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-slate-600">
                                                {item.periodPrice.toFixed(2)} €
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-semibold text-red-600">
                                                {item.consumptionValue.toFixed(2)} €
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-emerald-600">
                                                {item.deliveryValue.toFixed(2)} €
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}