import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const categoryColors = {
    'Getränke': 'bg-violet-100 text-violet-700',
    'Trockenware': 'bg-amber-100 text-amber-700',
    'Frische Lebensmittel': 'bg-emerald-100 text-emerald-700',
    'Tiefkühlware': 'bg-cyan-100 text-cyan-700',
    'Non-Food': 'bg-indigo-100 text-indigo-700',
    'Verpackungen': 'bg-pink-100 text-pink-700',
    'Reinigungsmittel': 'bg-teal-100 text-teal-700',
    'Sonstiges': 'bg-slate-100 text-slate-700'
};

export default function ArticleTable({ articles, inventories, onEdit, onDelete }) {
    const getLastInventory = (articleId) => {
        const articleInventories = inventories
            .filter(inv => inv.article_id === articleId)
            .sort((a, b) => new Date(b.inventory_date) - new Date(a.inventory_date));
        return articleInventories[0];
    };

    const isLowStock = (article) => {
        return article.min_stock && article.current_stock <= article.min_stock;
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-50">
                        <TableHead className="font-semibold text-slate-700">Artikel</TableHead>
                        <TableHead className="font-semibold text-slate-700">Kategorie</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-right">Bestand</TableHead>
                        <TableHead className="font-semibold text-slate-700">Einheit</TableHead>
                        <TableHead className="font-semibold text-slate-700">Letzte Inventur</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-right">Aktionen</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {articles.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                                Noch keine Artikel vorhanden. Füge deinen ersten Artikel hinzu!
                            </TableCell>
                        </TableRow>
                    ) : (
                        articles.map(article => {
                            const lastInv = getLastInventory(article.id);
                            const lowStock = isLowStock(article);
                            
                            return (
                                <TableRow key={article.id} className="hover:bg-slate-50/50 transition-colors">
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            {article.name}
                                            {lowStock && (
                                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge 
                                            variant="secondary" 
                                            className={categoryColors[article.category_name] || 'bg-slate-100 text-slate-700'}
                                        >
                                            {article.category_name || 'Keine'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className={`text-right font-mono ${lowStock ? 'text-amber-600 font-semibold' : ''}`}>
                                        {article.current_stock?.toFixed(2) || '0.00'}
                                    </TableCell>
                                    <TableCell className="text-slate-600">
                                        {article.unit_abbreviation}
                                    </TableCell>
                                    <TableCell className="text-slate-500 text-sm">
                                        {lastInv ? format(new Date(lastInv.inventory_date), 'dd.MM.yyyy', { locale: de }) : '-'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => onEdit(article)}
                                                className="h-8 w-8 text-slate-500 hover:text-slate-700"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => onDelete(article)}
                                                className="h-8 w-8 text-slate-500 hover:text-red-600"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    )}
                </TableBody>
            </Table>
        </div>
    );
}