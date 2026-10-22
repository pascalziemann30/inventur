import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Calendar } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export default function WasteOverview({ wastes = [], suppliers = [] }) {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    const [fromDate, setFromDate] = useState(sevenDaysAgo.toISOString().split('T')[0]);
    const [toDate, setToDate] = useState(today.toISOString().split('T')[0]);
    const [supplierFilter, setSupplierFilter] = useState('all');

    // Flatten waste items with date
    const wasteItems = useMemo(() => {
        const items = [];
        wastes.forEach(waste => {
            if (waste.status === 'applied') {
                waste.items?.forEach(item => {
                    items.push({
                        ...item,
                        waste_date: waste.waste_date,
                        waste_id: waste.id
                    });
                });
            }
        });
        return items;
    }, [wastes]);

    // Filter by date range and supplier
    const filteredItems = useMemo(() => {
        return wasteItems.filter(item => {
            const itemDate = new Date(item.waste_date);
            const from = new Date(fromDate);
            const to = new Date(toDate);
            
            const matchesDate = itemDate >= from && itemDate <= to;
            const matchesSupplier = supplierFilter === 'all' || item.supplier_name === supplierFilter;
            
            return matchesDate && matchesSupplier;
        });
    }, [wasteItems, fromDate, toDate, supplierFilter]);

    // Group by article and calculate totals
    const articleSummary = useMemo(() => {
        const summary = {};
        filteredItems.forEach(item => {
            const key = item.article_id;
            if (!summary[key]) {
                summary[key] = {
                    article_name: item.article_name,
                    supplier_name: item.supplier_name,
                    unit_abbreviation: item.unit_abbreviation,
                    total_quantity: 0,
                    count: 0
                };
            }
            summary[key].total_quantity += item.quantity;
            summary[key].count += 1;
        });
        return Object.values(summary);
    }, [filteredItems]);

    // Get unique suppliers from waste items
    const wasteSuppliers = useMemo(() => {
        const supplierNames = new Set(wasteItems.map(item => item.supplier_name).filter(Boolean));
        return Array.from(supplierNames);
    }, [wasteItems]);

    const totalWasteQuantity = filteredItems.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    Waste-Auswertung
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Filter Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
                    <div className="space-y-2">
                        <Label className="flex items-center gap-1 text-xs">
                            <Calendar className="w-3 h-3" />
                            Von
                        </Label>
                        <Input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="flex items-center gap-1 text-xs">
                            <Calendar className="w-3 h-3" />
                            Bis
                        </Label>
                        <Input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs">Lieferant</Label>
                        <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Alle Lieferanten</SelectItem>
                                {wasteSuppliers.map(supplier => (
                                    <SelectItem key={supplier} value={supplier}>
                                        {supplier}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="text-xs text-slate-600 mb-1">Gesamt Vorgänge</div>
                        <div className="text-2xl font-bold text-orange-700">{filteredItems.length}</div>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="text-xs text-slate-600 mb-1">Verschiedene Artikel</div>
                        <div className="text-2xl font-bold text-orange-700">{articleSummary.length}</div>
                    </div>
                </div>

                {/* Article Summary Table */}
                {articleSummary.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Zusammenfassung nach Artikel</h4>
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Artikel</TableHead>
                                        <TableHead className="hidden sm:table-cell">Lieferant</TableHead>
                                        <TableHead className="text-right">Gesamt Menge</TableHead>
                                        <TableHead className="text-right">Vorgänge</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {articleSummary
                                        .sort((a, b) => b.total_quantity - a.total_quantity)
                                        .map((item, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell>
                                                    <div className="font-medium text-sm">{item.article_name}</div>
                                                    <div className="text-xs text-slate-500 sm:hidden">
                                                        {item.supplier_name}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm text-slate-600 hidden sm:table-cell">
                                                    {item.supplier_name}
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {item.total_quantity.toFixed(2)} {item.unit_abbreviation}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Badge variant="secondary">{item.count}x</Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}

                {/* Detailed Items Table */}
                {filteredItems.length > 0 ? (
                    <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Einzelne Vorgänge</h4>
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Datum</TableHead>
                                        <TableHead>Artikel</TableHead>
                                        <TableHead className="hidden sm:table-cell">Lieferant</TableHead>
                                        <TableHead className="text-right">Menge</TableHead>
                                        <TableHead>Grund</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredItems
                                        .sort((a, b) => new Date(b.waste_date) - new Date(a.waste_date))
                                        .map((item, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell className="text-sm">
                                                    {new Date(item.waste_date).toLocaleDateString('de-DE')}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-medium text-sm">{item.article_name}</div>
                                                    <div className="text-xs text-slate-500 sm:hidden">
                                                        {item.supplier_name}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm text-slate-600 hidden sm:table-cell">
                                                    {item.supplier_name}
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {item.quantity} {item.unit_abbreviation}
                                                </TableCell>
                                                <TableCell className="text-sm text-slate-600 max-w-xs truncate">
                                                    {item.reason}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-500">
                        <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                        <p>Keine Waste-Vorgänge im ausgewählten Zeitraum</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}