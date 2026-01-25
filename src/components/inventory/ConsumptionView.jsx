import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { subDays, subWeeks, subMonths, isAfter, parseISO } from 'date-fns';

export default function ConsumptionView({ articles, inventories, deliveries }) {
    const [period, setPeriod] = useState('week');

    const periodStart = useMemo(() => {
        const now = new Date();
        switch(period) {
            case 'week': return subWeeks(now, 1);
            case 'month': return subMonths(now, 1);
            case 'quarter': return subMonths(now, 3);
            case 'year': return subMonths(now, 12);
            default: return subWeeks(now, 1);
        }
    }, [period]);

    const consumptionData = useMemo(() => {
        return articles.map(article => {
            // Finde die älteste Inventur im Zeitraum als Startpunkt
            const periodInventories = inventories
                .filter(inv => inv.article_id === article.id && isAfter(parseISO(inv.inventory_date), periodStart))
                .sort((a, b) => new Date(a.inventory_date) - new Date(b.inventory_date));

            // Wareneingänge im Zeitraum
            const periodDeliveries = deliveries
                .filter(del => isAfter(parseISO(del.delivery_date), periodStart))
                .flatMap(del => del.items?.filter(item => item.article_id === article.id) || []);

            const totalDelivered = periodDeliveries.reduce((sum, item) => sum + (item.quantity || 0), 0);

            // Anfangsbestand = älteste Inventur im Zeitraum oder initial_stock
            const startStock = periodInventories.length > 0 
                ? periodInventories[0].counted_quantity 
                : article.initial_stock || 0;

            // Endbestand = aktueller Bestand
            const endStock = article.current_stock || 0;

            // Verbrauch = Anfangsbestand + Lieferungen - Endbestand
            const consumption = startStock + totalDelivered - endStock;

            return {
                ...article,
                startStock,
                totalDelivered,
                endStock,
                consumption: Math.max(0, consumption)
            };
        }).filter(a => a.consumption > 0 || a.totalDelivered > 0);
    }, [articles, inventories, deliveries, periodStart]);

    const periodLabels = {
        week: 'Letzte Woche',
        month: 'Letzter Monat',
        quarter: 'Letztes Quartal',
        year: 'Letztes Jahr'
    };

    return (
        <Card className="bg-white border-slate-200">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold">Verbrauchsübersicht</CardTitle>
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="week">Letzte Woche</SelectItem>
                            <SelectItem value="month">Letzter Monat</SelectItem>
                            <SelectItem value="quarter">Letztes Quartal</SelectItem>
                            <SelectItem value="year">Letztes Jahr</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                {consumptionData.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                        <p>Noch keine Verbrauchsdaten für diesen Zeitraum.</p>
                        <p className="text-sm mt-1">Führe Inventuren und Lieferscheine ein, um den Verbrauch zu berechnen.</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50">
                                <TableHead className="font-semibold">Artikel</TableHead>
                                <TableHead className="text-right font-semibold">Start</TableHead>
                                <TableHead className="text-right font-semibold">+ Lieferung</TableHead>
                                <TableHead className="text-right font-semibold">= Aktuell</TableHead>
                                <TableHead className="text-right font-semibold">Verbrauch</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {consumptionData.map(item => (
                                <TableRow key={item.id} className="hover:bg-slate-50/50">
                                    <TableCell>
                                        <div className="font-medium">{item.name}</div>
                                        <div className="text-xs text-slate-500">{item.category_name}</div>
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-slate-600">
                                        {item.startStock.toFixed(1)} {item.unit_abbreviation}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-emerald-600">
                                        +{item.totalDelivered.toFixed(1)} {item.unit_abbreviation}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        {item.endStock.toFixed(1)} {item.unit_abbreviation}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Badge variant="secondary" className="bg-slate-100 text-slate-700 font-mono">
                                            <TrendingDown className="w-3 h-3 mr-1" />
                                            {item.consumption.toFixed(1)} {item.unit_abbreviation}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
                
                <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
                    <strong>Formel:</strong> Anfangsbestand + Wareneingang − Aktueller Bestand = Verbrauch
                </div>
            </CardContent>
        </Card>
    );
}