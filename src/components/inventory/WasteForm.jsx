import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Trash2, AlertTriangle, RotateCcw } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export default function WasteForm({ open, onClose, onSave, articles, suppliers }) {
    const [wasteDate, setWasteDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [globalReason, setGlobalReason] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [quantities, setQuantities] = useState({});

    // Filter articles by selected supplier
    const supplierArticles = useMemo(() => {
        if (!selectedSupplierId) return [];
        return articles.filter(a => a.supplier_id === selectedSupplierId && a.is_active !== false);
    }, [selectedSupplierId, articles]);

    // Filter articles by search term
    const filteredArticles = useMemo(() => {
        if (!searchTerm) return supplierArticles;
        return supplierArticles.filter(article => 
            article.name?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [supplierArticles, searchTerm]);

    // Get items with quantities > 0
    const selectedItems = useMemo(() => {
        return filteredArticles
            .filter(article => quantities[article.id] && parseFloat(quantities[article.id]) > 0)
            .map(article => ({
                article_id: article.id,
                article_name: article.name,
                supplier_name: article.supplier_name,
                quantity: parseFloat(quantities[article.id]),
                unit_abbreviation: article.unit_abbreviation,
                reason: globalReason
            }));
    }, [filteredArticles, quantities, globalReason]);

    const handleQuantityChange = (articleId, value) => {
        setQuantities(prev => ({
            ...prev,
            [articleId]: value
        }));
    };

    const handleReset = () => {
        setQuantities({});
        setGlobalReason('');
        setSearchTerm('');
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!selectedSupplierId) {
            alert('Bitte Lieferant auswählen');
            return;
        }

        if (selectedItems.length === 0) {
            alert('Bitte mindestens einen Artikel mit Menge > 0 eingeben');
            return;
        }

        if (!globalReason.trim()) {
            alert('Bitte Grund angeben');
            return;
        }

        onSave({
            waste_date: wasteDate,
            items: selectedItems,
            notes: '',
            status: 'draft'
        });

        resetForm();
    };

    const resetForm = () => {
        setWasteDate(new Date().toISOString().split('T')[0]);
        setSelectedSupplierId('');
        setGlobalReason('');
        setSearchTerm('');
        setQuantities({});
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b">
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                        Waste erfassen
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="overflow-y-auto px-6 py-4 space-y-6 flex-1">
                        {/* Header Info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Datum *</Label>
                                <Input
                                    type="date"
                                    value={wasteDate}
                                    onChange={(e) => setWasteDate(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Lieferant *</Label>
                                <Select 
                                    value={selectedSupplierId} 
                                    onValueChange={(value) => {
                                        setSelectedSupplierId(value);
                                        setSearchTerm('');
                                        setQuantities({});
                                    }}
                                    required
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Lieferant wählen..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suppliers?.filter(s => s.is_active !== false).map(supplier => (
                                            <SelectItem key={supplier.id} value={supplier.id}>
                                                {supplier.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Grund *</Label>
                                <Input
                                    value={globalReason}
                                    onChange={(e) => setGlobalReason(e.target.value)}
                                    placeholder="z.B. abgelaufen, Bruch..."
                                    required
                                />
                            </div>
                        </div>

                        {/* Article List */}
                        {selectedSupplierId && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-sm text-slate-900">
                                        Artikel erfassen
                                    </h3>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleReset}
                                        className="text-slate-600 hover:text-slate-900"
                                    >
                                        <RotateCcw className="w-4 h-4 mr-2" />
                                        Zurücksetzen
                                    </Button>
                                </div>

                                {/* Search */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        placeholder="Artikel suchen..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>

                                {/* Article Table */}
                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                    {filteredArticles.length > 0 ? (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-12">#</TableHead>
                                                    <TableHead>Artikel</TableHead>
                                                    <TableHead className="hidden sm:table-cell">Kategorie</TableHead>
                                                    <TableHead className="w-32">Menge *</TableHead>
                                                    <TableHead className="w-24">Einheit</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredArticles.map((article, index) => {
                                                    const hasQuantity = quantities[article.id] && parseFloat(quantities[article.id]) > 0;
                                                    return (
                                                        <TableRow 
                                                            key={article.id}
                                                            className={hasQuantity ? 'bg-orange-50' : ''}
                                                        >
                                                            <TableCell className="text-slate-500 text-sm">
                                                                {index + 1}
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="font-medium text-sm">{article.name}</div>
                                                                <div className="text-xs text-slate-500 sm:hidden">
                                                                    {article.category_name}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-sm text-slate-600 hidden sm:table-cell">
                                                                {article.category_name}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={quantities[article.id] || ''}
                                                                    onChange={(e) => handleQuantityChange(article.id, e.target.value)}
                                                                    placeholder="0"
                                                                    className="h-9"
                                                                />
                                                            </TableCell>
                                                            <TableCell className="text-sm text-slate-600">
                                                                {article.unit_abbreviation}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    ) : (
                                        <div className="p-8 text-center text-slate-500">
                                            {searchTerm ? 'Keine Artikel gefunden' : 'Dieser Lieferant hat keine Artikel'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Review / Selected Items */}
                        {selectedItems.length > 0 && (
                            <Card className="border-2 border-orange-300 bg-orange-50">
                                <div className="p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4 text-orange-700" />
                                            <h3 className="font-semibold text-sm text-slate-900">
                                                Zur Buchung ({selectedItems.length} Artikel)
                                            </h3>
                                        </div>
                                        <Badge variant="secondary" className="bg-orange-200 text-orange-800">
                                            Grund: {globalReason}
                                        </Badge>
                                    </div>
                                    
                                    <div className="border border-orange-200 rounded-lg overflow-hidden bg-white">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Artikel</TableHead>
                                                    <TableHead className="text-right">Menge</TableHead>
                                                    <TableHead className="w-20">Einheit</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {selectedItems.map(item => (
                                                    <TableRow key={item.article_id}>
                                                        <TableCell className="font-medium text-sm">
                                                            {item.article_name}
                                                        </TableCell>
                                                        <TableCell className="text-right font-medium">
                                                            {item.quantity}
                                                        </TableCell>
                                                        <TableCell className="text-sm text-slate-600">
                                                            {item.unit_abbreviation}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </Card>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex gap-3 px-6 py-4 border-t bg-white sticky bottom-0">
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => { 
                                onClose(); 
                                resetForm(); 
                            }} 
                            className="flex-1"
                        >
                            Abbrechen
                        </Button>
                        <Button 
                            type="submit" 
                            className="flex-1 bg-orange-600 hover:bg-orange-700"
                            disabled={selectedItems.length === 0 || !globalReason.trim()}
                        >
                            Waste buchen ({selectedItems.length})
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}