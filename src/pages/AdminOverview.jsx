import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Package, Search, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AdminOverview() {
    const [selectedOutletId, setSelectedOutletId] = useState('all');
    const [sortBy, setSortBy] = useState('value');
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');

    const { data: outlets = [] } = useQuery({
        queryKey: ['outlets'],
        queryFn: () => base44.entities.Outlet.list()
    });

    const { data: outletStocks = [] } = useQuery({
        queryKey: ['outlet-stocks'],
        queryFn: () => base44.entities.OutletStock.list()
    });

    const { data: articles = [] } = useQuery({
        queryKey: ['articles'],
        queryFn: () => base44.entities.Article.list()
    });

    const { data: categories = [] } = useQuery({
        queryKey: ['categories'],
        queryFn: () => base44.entities.Category.list()
    });

    // Calculate aggregated data
    const aggregatedData = useMemo(() => {
        const dataMap = new Map();

        outletStocks.forEach(stock => {
            if (selectedOutletId !== 'all' && stock.outlet_id !== selectedOutletId) {
                return;
            }

            const article = articles.find(a => a.id === stock.article_id);
            if (!article) return;

            const key = stock.article_id;
            if (!dataMap.has(key)) {
                dataMap.set(key, {
                    article_id: stock.article_id,
                    article_name: stock.article_name,
                    category_name: article.category_name,
                    supplier_name: article.supplier_name,
                    unit_abbreviation: stock.unit_abbreviation,
                    purchase_price: article.purchase_price || 0,
                    total_quantity: 0,
                    outlets: []
                });
            }

            const entry = dataMap.get(key);
            entry.total_quantity += (stock.on_hand_quantity || 0);
            entry.outlets.push({
                outlet_id: stock.outlet_id,
                outlet_name: stock.outlet_name,
                quantity: stock.on_hand_quantity || 0
            });
        });

        return Array.from(dataMap.values()).map(item => ({
            ...item,
            total_value: item.total_quantity * item.purchase_price
        }));
    }, [outletStocks, articles, selectedOutletId]);

    // Filter by search and category
    const filteredData = useMemo(() => {
        return aggregatedData.filter(item => {
            const matchesSearch = !searchTerm || 
                item.article_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesCategory = categoryFilter === 'all' || 
                item.category_name === categoryFilter;
            
            return matchesSearch && matchesCategory;
        });
    }, [aggregatedData, searchTerm, categoryFilter]);

    // Sort data
    const sortedData = useMemo(() => {
        const data = [...filteredData];
        switch (sortBy) {
            case 'value':
                return data.sort((a, b) => b.total_value - a.total_value);
            case 'quantity':
                return data.sort((a, b) => b.total_quantity - a.total_quantity);
            case 'name':
                return data.sort((a, b) => a.article_name.localeCompare(b.article_name));
            case 'category':
                return data.sort((a, b) => (a.category_name || '').localeCompare(b.category_name || ''));
            default:
                return data;
        }
    }, [filteredData, sortBy]);

    const totalValue = sortedData.reduce((sum, item) => sum + item.total_value, 0);
    const totalArticles = sortedData.length;
    const totalQuantity = sortedData.reduce((sum, item) => sum + item.total_quantity, 0);

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to={createPageUrl('Dashboard')}>
                            <Button variant="ghost" size="sm">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Zurück
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                                Zentrale Übersicht
                            </h1>
                            <p className="text-slate-600 mt-1">
                                Bestände und Werte über alle Outlets
                            </p>
                        </div>
                    </div>
                    <Building2 className="w-8 h-8 text-slate-400" />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-600">
                                Gesamtwert
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-slate-900">
                                €{totalValue.toFixed(2)}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-600">
                                Artikel gesamt
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-slate-900">
                                {totalArticles}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-600">
                                Gesamtmenge
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-slate-900">
                                {totalQuantity.toFixed(0)}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                {outlets.filter(o => o.is_active !== false).length} Outlets
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label>Outlet Filter</Label>
                                <Select value={selectedOutletId} onValueChange={setSelectedOutletId}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Alle Outlets</SelectItem>
                                        {outlets.filter(o => o.is_active !== false).map(outlet => (
                                            <SelectItem key={outlet.id} value={outlet.id}>
                                                {outlet.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Kategorie</Label>
                                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
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
                            <div className="space-y-2">
                                <Label>Sortierung</Label>
                                <Select value={sortBy} onValueChange={setSortBy}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="value">Gesamtwert (absteigend)</SelectItem>
                                        <SelectItem value="quantity">Menge (absteigend)</SelectItem>
                                        <SelectItem value="name">Name (A-Z)</SelectItem>
                                        <SelectItem value="category">Kategorie</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Suche</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        placeholder="Artikel suchen..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Data Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Bestandsübersicht</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Artikel</TableHead>
                                        <TableHead className="hidden sm:table-cell">Kategorie</TableHead>
                                        <TableHead className="hidden md:table-cell">Lieferant</TableHead>
                                        <TableHead className="text-right">Menge</TableHead>
                                        <TableHead className="hidden sm:table-cell text-right">Preis/Einheit</TableHead>
                                        <TableHead className="text-right">Gesamtwert</TableHead>
                                        {selectedOutletId === 'all' && (
                                            <TableHead className="hidden lg:table-cell">Outlets</TableHead>
                                        )}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedData.length > 0 ? (
                                        sortedData.map(item => (
                                            <TableRow key={item.article_id}>
                                                <TableCell>
                                                    <div className="font-medium">{item.article_name}</div>
                                                    <div className="text-xs text-slate-500 sm:hidden">
                                                        {item.category_name}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="hidden sm:table-cell text-sm">
                                                    {item.category_name}
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell text-sm text-slate-600">
                                                    {item.supplier_name}
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {item.total_quantity.toFixed(2)} {item.unit_abbreviation}
                                                </TableCell>
                                                <TableCell className="hidden sm:table-cell text-right text-sm text-slate-600">
                                                    €{item.purchase_price.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right font-semibold text-slate-900">
                                                    €{item.total_value.toFixed(2)}
                                                </TableCell>
                                                {selectedOutletId === 'all' && (
                                                    <TableCell className="hidden lg:table-cell">
                                                        <div className="flex flex-wrap gap-1">
                                                            {item.outlets.map(outlet => (
                                                                <Badge 
                                                                    key={outlet.outlet_id} 
                                                                    variant="secondary"
                                                                    className="text-xs"
                                                                >
                                                                    {outlet.outlet_name}: {outlet.quantity.toFixed(0)}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                                                Keine Daten verfügbar
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}