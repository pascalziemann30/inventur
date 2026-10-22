import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Truck, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";

const inventoryTypeLabels = {
    weekly: 'Wöchentlich',
    monthly: 'Monatlich',
    yearly: 'Jährlich',
    initial: 'Anfangsbestand',
    adhoc: 'Einzelzählung'
};

export default function History() {
    const [activeTab, setActiveTab] = useState('inventories');
    const [articleFilter, setArticleFilter] = useState('all');

    const { data: inventories = [] } = useQuery({
        queryKey: ['inventories'],
        queryFn: () => base44.entities.Inventory.list('-inventory_date')
    });

    const { data: deliveries = [] } = useQuery({
        queryKey: ['deliveries'],
        queryFn: () => base44.entities.Delivery.list('-delivery_date')
    });

    const { data: articles = [] } = useQuery({
        queryKey: ['articles'],
        queryFn: () => base44.entities.Article.list()
    });

    const filteredInventories = articleFilter === 'all' 
        ? inventories 
        : inventories.filter(inv => inv.article_id === articleFilter);

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                    <div className="flex items-center gap-4">
                        <Link to={createPageUrl('Dashboard')}>
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                                Historie
                            </h1>
                            <p className="text-sm text-slate-500">
                                Vergangene Inventuren & Lieferungen
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                        <TabsList className="bg-white border border-slate-200">
                            <TabsTrigger value="inventories" className="gap-2">
                                <ClipboardList className="w-4 h-4" />
                                Inventuren ({inventories.length})
                            </TabsTrigger>
                            <TabsTrigger value="deliveries" className="gap-2">
                                <Truck className="w-4 h-4" />
                                Lieferungen ({deliveries.length})
                            </TabsTrigger>
                        </TabsList>

                        {activeTab === 'inventories' && (
                            <Select value={articleFilter} onValueChange={setArticleFilter}>
                                <SelectTrigger className="w-48 bg-white">
                                    <SelectValue placeholder="Alle Artikel" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Alle Artikel</SelectItem>
                                    {articles.map(article => (
                                        <SelectItem key={article.id} value={article.id}>
                                            {article.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    <TabsContent value="inventories">
                        <Card className="bg-white border-slate-200">
                            <CardHeader>
                                <CardTitle className="text-lg">Inventur-Historie</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50">
                                            <TableHead>Datum</TableHead>
                                            <TableHead>Artikel</TableHead>
                                            <TableHead>Art</TableHead>
                                            <TableHead className="text-right">Gezählt</TableHead>
                                            <TableHead className="text-right">Vorher</TableHead>
                                            <TableHead className="text-right">Differenz</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredInventories.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                                                    Keine Inventuren vorhanden
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredInventories.map(inv => (
                                                <TableRow key={inv.id}>
                                                    <TableCell className="font-medium">
                                                        {format(new Date(inv.inventory_date), 'dd.MM.yyyy', { locale: de })}
                                                    </TableCell>
                                                    <TableCell>{inv.article_name}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className="bg-slate-100">
                                                            {inventoryTypeLabels[inv.inventory_type] || inv.inventory_type}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">
                                                        {inv.counted_quantity} {inv.unit_abbreviation}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-slate-500">
                                                        {inv.previous_stock?.toFixed(1) || '-'} {inv.unit_abbreviation}
                                                    </TableCell>
                                                    <TableCell className={`text-right font-mono ${
                                                        inv.difference > 0 ? 'text-emerald-600' : 
                                                        inv.difference < 0 ? 'text-red-600' : 'text-slate-500'
                                                    }`}>
                                                        {inv.difference > 0 ? '+' : ''}{inv.difference?.toFixed(1) || '0'} {inv.unit_abbreviation}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="deliveries">
                        <Card className="bg-white border-slate-200">
                            <CardHeader>
                                <CardTitle className="text-lg">Lieferungen</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50">
                                            <TableHead>Datum</TableHead>
                                            <TableHead>Lieferant</TableHead>
                                            <TableHead>Lieferschein-Nr.</TableHead>
                                            <TableHead>Artikel</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {deliveries.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                                                    Keine Lieferungen vorhanden
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            deliveries.map(del => (
                                                <TableRow key={del.id}>
                                                    <TableCell className="font-medium">
                                                        {format(new Date(del.delivery_date), 'dd.MM.yyyy', { locale: de })}
                                                    </TableCell>
                                                    <TableCell>{del.supplier || '-'}</TableCell>
                                                    <TableCell className="text-slate-500">
                                                        {del.delivery_note_number || '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap gap-1">
                                                            {del.items?.map((item, idx) => (
                                                                <Badge key={idx} variant="outline" className="text-xs">
                                                                    {item.article_name}: {item.quantity} {item.unit_abbreviation}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}