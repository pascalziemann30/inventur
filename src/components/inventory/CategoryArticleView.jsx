import React, { useState, useEffect } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, AlertCircle, Package } from 'lucide-react';
import { format } from 'date-fns';

export default function CategoryArticleView({ articles, inventories, onEdit, onDelete }) {
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
        <div className="bg-white rounded-lg border border-slate-200">
            <Accordion type="multiple" value={openCategories} onValueChange={setOpenCategories}>
                {sortedCategories.map((category) => {
                    const categoryArticles = groupedArticles[category];
                    const lowStockCount = categoryArticles.filter(isLowStock).length;

                    return (
                        <AccordionItem key={category} value={category}>
                            <AccordionTrigger className="px-4 py-3 hover:bg-slate-50">
                                <div className="flex items-center justify-between w-full pr-4">
                                    <div className="flex items-center gap-3">
                                        <span className="font-semibold text-slate-900">{category}</span>
                                        <Badge variant="outline" className="text-xs">
                                            {categoryArticles.length} Artikel
                                        </Badge>
                                        {lowStockCount > 0 && (
                                            <Badge variant="destructive" className="text-xs">
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
                                            <TableHead className="hidden md:table-cell">Letzte Inventur</TableHead>
                                            <TableHead className="text-right">Aktionen</TableHead>
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
                                                    <TableCell className="hidden md:table-cell text-slate-500 text-sm">
                                                        {lastInv ? format(new Date(lastInv), 'dd.MM.yyyy') : '-'}
                                                    </TableCell>
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