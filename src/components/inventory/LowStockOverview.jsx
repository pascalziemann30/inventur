import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from 'lucide-react';

export default function LowStockOverview({ open, onClose, articles }) {
    const lowStockArticles = articles.filter(article => 
        article.min_stock && (article.current_stock || 0) <= article.min_stock
    );

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                        Niedrigstand
                    </DialogTitle>
                </DialogHeader>

                {lowStockArticles.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        Keine Artikel mit Niedrigstand
                    </div>
                ) : (
                    <div className="flex-1 overflow-auto border rounded-lg">
                        <Table>
                            <TableHeader className="sticky top-0 bg-slate-50 z-10">
                                <TableRow>
                                    <TableHead>Artikel</TableHead>
                                    <TableHead>Lieferant</TableHead>
                                    <TableHead className="text-right">Aktuell</TableHead>
                                    <TableHead className="text-right">Mindest</TableHead>
                                    <TableHead className="text-right">Differenz</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {lowStockArticles.map(article => {
                                    const diff = (article.current_stock || 0) - (article.min_stock || 0);
                                    return (
                                        <TableRow key={article.id}>
                                            <TableCell className="font-medium">{article.name}</TableCell>
                                            <TableCell>{article.supplier_name || '-'}</TableCell>
                                            <TableCell className="text-right">
                                                {(article.current_stock || 0).toFixed(2)} {article.unit_abbreviation}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {(article.min_stock || 0).toFixed(2)} {article.unit_abbreviation}
                                            </TableCell>
                                            <TableCell className="text-right text-amber-600 font-medium">
                                                {diff.toFixed(2)} {article.unit_abbreviation}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="destructive" className="bg-amber-100 text-amber-800">
                                                    Nachbestellen
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}

                <div className="border-t pt-3 text-sm text-slate-600">
                    {lowStockArticles.length} Artikel mit Niedrigstand
                </div>
            </DialogContent>
        </Dialog>
    );
}