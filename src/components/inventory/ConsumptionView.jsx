import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingDown, Truck, AlertTriangle, ArrowRightLeft, Calendar } from 'lucide-react';
import { subDays, subWeeks, subMonths, isAfter, parseISO, format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useOutlet } from '../outlet/OutletContext';

export default function ConsumptionView({ articles }) {
    const { currentOutletId } = useOutlet();
    const [period, setPeriod] = useState('week');
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [customPeriod, setCustomPeriod] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const { data: inventorySessions = [] } = useQuery({
        queryKey: ['inventory-sessions', currentOutletId],
        queryFn: () => base44.entities.InventorySession.filter({ outlet_id: currentOutletId, status: 'completed' }, '-session_date'),
        enabled: !!currentOutletId
    });

    const { data: deliveries = [] } = useQuery({
        queryKey: ['deliveries', currentOutletId],
        queryFn: () => base44.entities.Delivery.filter({ outlet_id: currentOutletId }, '-delivery_date'),
        enabled: !!currentOutletId
    });

    const { data: wastes = [] } = useQuery({
        queryKey: ['wastes', currentOutletId],
        queryFn: () => base44.entities.Waste.filter({ outlet_id: currentOutletId, status: 'applied' }, '-waste_date'),
        enabled: !!currentOutletId
    });

    const { data: transfers = [] } = useQuery({
        queryKey: ['transfers', currentOutletId],
        queryFn: () => base44.entities.OutletTransfer.filter({ status: 'applied' }, '-transfer_date'),
        enabled: !!currentOutletId
    });

    const periodStart = useMemo(() => {
        if (customPeriod && startDate) {
            return parseISO(startDate);
        }
        const now = new Date();
        switch(period) {
            case 'week': return subWeeks(now, 1);
            case 'month': return subMonths(now, 1);
            case 'quarter': return subMonths(now, 3);
            case 'year': return subMonths(now, 12);
            default: return subWeeks(now, 1);
        }
    }, [period, customPeriod, startDate]);

    const periodEnd = useMemo(() => {
        if (customPeriod && endDate) {
            return parseISO(endDate);
        }
        return new Date();
    }, [customPeriod, endDate]);

    const consumptionData = useMemo(() => {
        if (!articles || articles.length === 0) return [];
        
        return articles.map(article => {
            // Inventuren im Zeitraum
            const periodSessions = inventorySessions
                .filter(session => {
                    const sessionDate = parseISO(session.session_date);
                    return isAfter(sessionDate, periodStart) && sessionDate <= periodEnd;
                })
                .sort((a, b) => new Date(a.session_date) - new Date(b.session_date));

            const inventoryEntries = periodSessions.flatMap(session => 
                session.entries?.filter(e => e.article_id === article.id && e.counted_quantity !== null) || []
            );

            // Lieferungen im Zeitraum
            const periodDeliveries = deliveries
                .filter(del => {
                    const deliveryDate = parseISO(del.delivery_date);
                    return isAfter(deliveryDate, periodStart) && deliveryDate <= periodEnd;
                })
                .flatMap(del => del.items?.filter(item => item.article_id === article.id) || []);

            const totalDelivered = periodDeliveries.reduce((sum, item) => sum + (item.quantity || 0), 0);

            // Waste im Zeitraum
            const periodWastes = wastes
                .filter(w => {
                    const wasteDate = parseISO(w.waste_date);
                    return isAfter(wasteDate, periodStart) && wasteDate <= periodEnd;
                })
                .flatMap(w => w.items?.filter(item => item.article_id === article.id) || []);

            const totalWaste = periodWastes.reduce((sum, item) => sum + (item.quantity || 0), 0);

            // Outlet Transfers im Zeitraum
            const transfersOut = transfers
                .filter(t => {
                    const transferDate = parseISO(t.transfer_date);
                    return t.from_outlet_id === currentOutletId && isAfter(transferDate, periodStart) && transferDate <= periodEnd;
                })
                .flatMap(t => t.items?.filter(item => item.article_id === article.id) || []);

            const transfersIn = transfers
                .filter(t => {
                    const transferDate = parseISO(t.transfer_date);
                    return t.to_outlet_id === currentOutletId && isAfter(transferDate, periodStart) && transferDate <= periodEnd;
                })
                .flatMap(t => t.items?.filter(item => item.article_id === article.id) || []);

            const totalTransferOut = transfersOut.reduce((sum, item) => sum + (item.quantity || 0), 0);
            const totalTransferIn = transfersIn.reduce((sum, item) => sum + (item.quantity || 0), 0);

            // Anfangsbestand = älteste Inventur im Zeitraum oder aktueller Bestand als Fallback
            const startStock = inventoryEntries.length > 0 
                ? inventoryEntries[0].last_stock 
                : article.current_stock || 0;

            // Endbestand = neueste Inventur oder aktueller Bestand
            const endStock = inventoryEntries.length > 0 
                ? inventoryEntries[inventoryEntries.length - 1].counted_quantity 
                : article.current_stock || 0;

            // Verbrauch = Anfangsbestand + Lieferungen + Transfers IN - Transfers OUT - Waste - Endbestand (Inventur gezählt)
            const consumption = startStock + totalDelivered + totalTransferIn - totalTransferOut - totalWaste - endStock;

            const hasActivity = totalDelivered > 0 || totalWaste > 0 || totalTransferOut > 0 || totalTransferIn > 0 || inventoryEntries.length > 0;

            return {
                ...article,
                startStock,
                totalDelivered,
                totalWaste,
                totalTransferOut,
                totalTransferIn,
                endStock,
                consumption: Math.max(0, consumption),
                hasInventory: inventoryEntries.length > 0,
                movements: {
                    deliveries: periodDeliveries,
                    wastes: periodWastes,
                    transfersOut,
                    transfersIn
                }
            };
        }).filter(a => a.hasActivity);
    }, [articles, inventorySessions, deliveries, wastes, transfers, periodStart, periodEnd, currentOutletId]);

    const periodLabels = {
        week: 'Letzte Woche',
        month: 'Letzter Monat',
        quarter: 'Letztes Quartal',
        year: 'Letztes Jahr'
    };

    return (
        <Card className="bg-white border-slate-200">
            <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <CardTitle className="text-lg font-semibold">Verbrauchsübersicht</CardTitle>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Select 
                            value={customPeriod ? 'custom' : period} 
                            onValueChange={(val) => {
                                if (val === 'custom') {
                                    setCustomPeriod(true);
                                    setStartDate(format(subMonths(new Date(), 1), 'yyyy-MM-dd'));
                                    setEndDate(format(new Date(), 'yyyy-MM-dd'));
                                } else {
                                    setCustomPeriod(false);
                                    setPeriod(val);
                                }
                            }}
                        >
                            <SelectTrigger className="w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="week">Letzte Woche</SelectItem>
                                <SelectItem value="month">Letzter Monat</SelectItem>
                                <SelectItem value="quarter">Letztes Quartal</SelectItem>
                                <SelectItem value="year">Letztes Jahr</SelectItem>
                                <SelectItem value="custom">Benutzerdefiniert</SelectItem>
                            </SelectContent>
                        </Select>
                        
                        {customPeriod && (
                            <div className="flex gap-2 items-center">
                                <div className="flex flex-col gap-1">
                                    <Label className="text-xs text-slate-500">Von</Label>
                                    <Input 
                                        type="date" 
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-36"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <Label className="text-xs text-slate-500">Bis</Label>
                                    <Input 
                                        type="date" 
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-36"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {consumptionData.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                        <p>Noch keine Verbrauchsdaten für diesen Zeitraum.</p>
                        <p className="text-sm mt-1">Führe Inventuren und Lieferscheine ein, um den Verbrauch zu berechnen.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50">
                                    <TableHead className="font-semibold">Artikel</TableHead>
                                    <TableHead className="text-right font-semibold">Start</TableHead>
                                    <TableHead className="text-right font-semibold">Bewegungen</TableHead>
                                    <TableHead className="text-right font-semibold">Inventur</TableHead>
                                    <TableHead className="text-right font-semibold">Verbrauch</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {consumptionData.map(item => (
                                    <React.Fragment key={item.id}>
                                        <TableRow 
                                            className="hover:bg-slate-50/50 cursor-pointer"
                                            onClick={() => {
                                                const newExpanded = new Set(expandedRows);
                                                if (newExpanded.has(item.id)) {
                                                    newExpanded.delete(item.id);
                                                } else {
                                                    newExpanded.add(item.id);
                                                }
                                                setExpandedRows(newExpanded);
                                            }}
                                        >
                                            <TableCell>
                                                <div className="font-medium">{item.name}</div>
                                                <div className="text-xs text-slate-500">{item.category_name}</div>
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-slate-600">
                                                {item.startStock.toFixed(1)} {item.unit_abbreviation}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex flex-col gap-1 items-end text-xs">
                                                    {item.totalDelivered > 0 && (
                                                        <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                                                            <Truck className="w-3 h-3 mr-1" />
                                                            +{item.totalDelivered.toFixed(1)}
                                                        </Badge>
                                                    )}
                                                    {item.totalTransferIn > 0 && (
                                                        <Badge variant="outline" className="border-blue-200 text-blue-700">
                                                            <ArrowRightLeft className="w-3 h-3 mr-1" />
                                                            +{item.totalTransferIn.toFixed(1)}
                                                        </Badge>
                                                    )}
                                                    {item.totalTransferOut > 0 && (
                                                        <Badge variant="outline" className="border-orange-200 text-orange-700">
                                                            <ArrowRightLeft className="w-3 h-3 mr-1" />
                                                            -{item.totalTransferOut.toFixed(1)}
                                                        </Badge>
                                                    )}
                                                    {item.totalWaste > 0 && (
                                                        <Badge variant="outline" className="border-red-200 text-red-700">
                                                            <AlertTriangle className="w-3 h-3 mr-1" />
                                                            -{item.totalWaste.toFixed(1)}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                {item.hasInventory ? (
                                                    <span className="text-blue-600">{item.endStock.toFixed(1)} {item.unit_abbreviation}</span>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant="secondary" className="bg-slate-800 text-white font-mono">
                                                    <TrendingDown className="w-3 h-3 mr-1" />
                                                    {item.consumption.toFixed(1)} {item.unit_abbreviation}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                        {expandedRows.has(item.id) && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="bg-slate-50/50 p-4">
                                                    <div className="text-xs space-y-2">
                                                        <div className="font-semibold mb-2">Bewegungsdetails:</div>
                                                        {item.movements.deliveries.length > 0 && (
                                                            <div>
                                                                <span className="font-medium text-emerald-700">Lieferungen:</span>
                                                                <span className="ml-2">{item.movements.deliveries.map(d => `+${d.quantity}`).join(', ')} {item.unit_abbreviation}</span>
                                                            </div>
                                                        )}
                                                        {item.movements.transfersIn.length > 0 && (
                                                            <div>
                                                                <span className="font-medium text-blue-700">Transfers (eingehend):</span>
                                                                <span className="ml-2">{item.movements.transfersIn.map(t => `+${t.quantity}`).join(', ')} {item.unit_abbreviation}</span>
                                                            </div>
                                                        )}
                                                        {item.movements.transfersOut.length > 0 && (
                                                            <div>
                                                                <span className="font-medium text-orange-700">Transfers (ausgehend):</span>
                                                                <span className="ml-2">{item.movements.transfersOut.map(t => `-${t.quantity}`).join(', ')} {item.unit_abbreviation}</span>
                                                            </div>
                                                        )}
                                                        {item.movements.wastes.length > 0 && (
                                                            <div>
                                                                <span className="font-medium text-red-700">Waste:</span>
                                                                <span className="ml-2">{item.movements.wastes.map(w => `-${w.quantity}`).join(', ')} {item.unit_abbreviation}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </React.Fragment>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
                
                <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
                    <strong>Formel:</strong> Anfangsbestand + Lieferungen + Transfers IN − Transfers OUT − Waste − Inventur gezählt = Verbrauch
                    <div className="mt-2 flex gap-4 flex-wrap">
                        <div className="flex items-center gap-1">
                            <Truck className="w-3 h-3 text-emerald-600" />
                            <span>Lieferung</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <ArrowRightLeft className="w-3 h-3 text-blue-600" />
                            <span>Transfer IN</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <ArrowRightLeft className="w-3 h-3 text-orange-600" />
                            <span>Transfer OUT</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-red-600" />
                            <span>Waste</span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}