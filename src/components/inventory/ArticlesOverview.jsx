import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Download, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";

export default function ArticlesOverview({ open, onClose, articles, outletName }) {
    const [sortBy, setSortBy] = useState('name');
    const [searchTerm, setSearchTerm] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);

    const sortedArticles = useMemo(() => {
        let filtered = articles.filter(a => 
            a.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return filtered.sort((a, b) => {
            switch (sortBy) {
                case 'supplier':
                    return (a.supplier_name || '').localeCompare(b.supplier_name || '');
                case 'category':
                    return (a.category_name || '').localeCompare(b.category_name || '');
                case 'quantity':
                    return (b.current_stock || 0) - (a.current_stock || 0);
                case 'total':
                    const totalA = (a.current_stock || 0) * (a.purchase_price || 0);
                    const totalB = (b.current_stock || 0) * (b.purchase_price || 0);
                    return totalB - totalA;
                default:
                    return a.name.localeCompare(b.name);
            }
        });
    }, [articles, sortBy, searchTerm]);

    const totalValue = sortedArticles.reduce((sum, article) => 
        sum + ((article.current_stock || 0) * (article.purchase_price || 0)), 0
    );

    const handleDownloadExcel = async () => {
        setIsDownloading(true);
        try {
            const response = await base44.functions.invoke('generateArticlesExcel', {
                articles: sortedArticles,
                outletName: outletName
            });
            
            // Decode base64 to binary
            const binaryString = atob(response.data.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = response.data.filename || `Artikel_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            toast.success('Excel heruntergeladen');
        } catch (error) {
            toast.error('Fehler beim Erstellen der Excel-Datei');
            console.error(error);
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle>Artikel-Übersicht</DialogTitle>
                        <Button 
                            onClick={handleDownloadExcel} 
                            disabled={isDownloading || sortedArticles.length === 0}
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {isDownloading ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4 mr-2" />
                            )}
                            Excel Download
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex gap-3 items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Suchen..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="Sortieren nach..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="name">Name</SelectItem>
                            <SelectItem value="supplier">Lieferant</SelectItem>
                            <SelectItem value="category">Kategorie</SelectItem>
                            <SelectItem value="quantity">Menge</SelectItem>
                            <SelectItem value="total">Gesamtwert</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex-1 overflow-auto border rounded-lg">
                    <Table>
                        <TableHeader className="sticky top-0 bg-slate-50 z-10">
                            <TableRow>
                                <TableHead>Artikel</TableHead>
                                <TableHead>Lieferant</TableHead>
                                <TableHead>Kategorie</TableHead>
                                <TableHead className="text-right">Menge</TableHead>
                                <TableHead className="text-right">Einzelpreis</TableHead>
                                <TableHead className="text-right">Gesamtwert</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedArticles.map(article => {
                                const total = (article.current_stock || 0) * (article.purchase_price || 0);
                                return (
                                    <TableRow key={article.id}>
                                        <TableCell className="font-medium">{article.name}</TableCell>
                                        <TableCell>{article.supplier_name || '-'}</TableCell>
                                        <TableCell>{article.category_name || '-'}</TableCell>
                                        <TableCell className="text-right">
                                            {(article.current_stock || 0).toFixed(2)} {article.unit_abbreviation}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {(article.purchase_price || 0).toFixed(2)} €
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {total.toFixed(2)} €
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>

                <div className="border-t pt-3 flex justify-between items-center">
                    <div className="text-sm text-slate-600">
                        {sortedArticles.length} Artikel
                    </div>
                    <div className="text-lg font-bold">
                        Gesamtwert: {totalValue.toFixed(2)} €
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}