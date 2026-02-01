import React, { useState, useEffect } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, AlertCircle, Package } from 'lucide-react';
import { format } from 'date-fns';

const categoryColors = {
    'Getränke': 'bg-blue-50 border-blue-200',
    'Lebensmittel': 'bg-green-50 border-green-200',
    'Fleisch & Wurst': 'bg-red-50 border-red-200',
    'Milchprodukte': 'bg-yellow-50 border-yellow-200',
    'Backwaren': 'bg-orange-50 border-orange-200',
    'Obst & Gemüse': 'bg-emerald-50 border-emerald-200',
    'Tiefkühl': 'bg-cyan-50 border-cyan-200',
    'Süßwaren': 'bg-pink-50 border-pink-200',
    'Gewürze': 'bg-amber-50 border-amber-200',
    'Sonstiges': 'bg-slate-50 border-slate-200'
};

const categoryBadgeColors = {
    'Getränke': 'bg-blue-100 text-blue-800 border-blue-200',
    'Lebensmittel': 'bg-green-100 text-green-800 border-green-200',
    'Fleisch & Wurst': 'bg-red-100 text-red-800 border-red-200',
    'Milchprodukte': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Backwaren': 'bg-orange-100 text-orange-800 border-orange-200',
    'Obst & Gemüse': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'Tiefkühl': 'bg-cyan-100 text-cyan-800 border-cyan-200',
    'Süßwaren': 'bg-pink-100 text-pink-800 border-pink-200',
    'Gewürze': 'bg-amber-100 text-amber-800 border-amber-200',
    'Sonstiges': 'bg-slate-100 text-slate-800 border-slate-200'
};

export default function CategoryArticleView({ articles, inventories, onEdit, onDelete, isAggregator }) {
    const [openCategories, setOpenCategories] = useState(() => {
        const saved = localStorage.getItem('openCategories');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        localStorage.setItem('openCategories', JSON.stringify(openCategories));
    }, [openCategories]);

    // Group articles by category
    const groupedArticles = articles.reduce((acc, article) => {
        const category = article.category_name || 'Ohne Kategorie';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(article);
        return acc;
    }, {});

    // Sort categories alphabetically
    const sortedCategories = Object.keys(groupedArticles).sort((a, b) => a.localeCompare(b));

    const getLastInventoryDate = (article) => {
        const articleInventories = inventories.filter(inv => inv.article_id === article.id);
        if (articleInventories.length === 0) return null;
        const latest = articleInventories.sort((a, b) => 
            new Date(b.inventory_date) - new Date(a.inventory_date)
        )[0];
        return latest.inventory_date;
    };

    const isLowStock = (article) => {
        return article.min_stock && article.current_stock < article.min_stock;
    };

    if (sortedCategories.length === 0) {
        return (
            <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Noch keine Artikel vorhanden</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <Accordion type="multiple" value={openCategories} onValueChange={setOpenCategories}>
                {sortedCategories.map((category) => {
                    const categoryArticles = groupedArticles[category];
                    const lowStockCount = categoryArticles.filter(isLowStock).length;

                    return (
                        <AccordionItem 
                            key={category} 
                            value={category}
                            className={`border rounded-lg mb-3 ${categoryColors[category] || 'bg-white border-slate-200'}`}
                        >
                            <AccordionTrigger className="px-4 py-3 hover:opacity-90">
                                <div className="flex items-center justify-between w-full pr-4">
                                    <div className="flex items-center gap-3">
                                        <Package className="w-5 h-5 text-slate-700" />
                                        <span className="font-semibold text-slate-900">{category}</span>
                                        <Badge variant="outline" className={`text-xs ${categoryBadgeColors[category] || 'bg-slate-100 text-slate-800 border-slate-200'}`}>
                                            {categoryArticles.length} Artikel
                                        </Badge>
                                        {lowStockCount > 0 && (
                                            <Badge variant="destructive" className="text-xs bg-orange-100 text-orange-800 border-orange-200">
                                                {lowStockCount} Niedrig
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Artikel</TableHead>
                                            <TableHead className="hidden sm:table-cell">Kategorie</TableHead>
                                            <TableHead className="text-right">Bestand</TableHead>
                                            {isAggregator && <TableHead className="hidden lg:table-cell">Outlets</TableHead>}
                                            <TableHead className="hidden md:table-cell">Letzte Inventur</TableHead>
                                            {!isAggregator && <TableHead className="text-right">Aktionen</TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {categoryArticles.map((article) => {
                                            const lastInv = getLastInventoryDate(article);
                                            const lowStock = isLowStock(article);

                                            return (
                                                <TableRow key={article.id}>
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-2">
                                                            {lowStock && (
                                                                <AlertCircle className="w-4 h-4 text-red-500" />
                                                            )}
                                                            <span className={lowStock ? 'text-red-600' : ''}>
                                                                {article.name}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="hidden sm:table-cell">
                                                        <Badge variant="outline" className="text-xs">
                                                            {article.category_name || '-'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <span className={lowStock ? 'text-red-600 font-semibold' : ''}>
                                                            {article.current_stock?.toFixed(2) || '0.00'} {article.unit_abbreviation}
                                                        </span>
                                                    </TableCell>
                                                    {isAggregator && article.outlets && (
                                                        <TableCell className="hidden lg:table-cell">
                                                            <div className="space-y-1">
                                                                {article.outlets.map(o => (
                                                                    <div key={o.outlet_id} className="text-xs text-slate-600">
                                                                        {o.outlet_name}: <span className="font-medium">{o.stock?.toFixed(2) || 0}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </TableCell>
                                                    )}
                                                    <TableCell className="hidden md:table-cell text-slate-500 text-sm">
                                                        {lastInv ? format(new Date(lastInv), 'dd.MM.yyyy') : '-'}
                                                    </TableCell>
                                                    {!isAggregator && (
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => onEdit(article)}
                                                                    className="h-8 w-8"
                                                                >
                                                                    <Pencil className="w-4 h-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => onDelete(article)}
                                                                    className="h-8 w-8 text-red-600 hover:text-red-700"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </AccordionContent>
                        </AccordionItem>
                    );
                })}
            </Accordion>
        </div>
    );
}