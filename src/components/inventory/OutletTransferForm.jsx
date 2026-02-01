import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Trash2, Plus, ShoppingCart, Package } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default function OutletTransferForm({ open, onClose, onSave, articles, outlets, suppliers }) {
    const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
    const [fromOutletId, setFromOutletId] = useState('');
    const [toOutletId, setToOutletId] = useState('');
    const [notes, setNotes] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [transferList, setTransferList] = useState([]);
    const [addingArticleId, setAddingArticleId] = useState(null);
    const [tempQuantity, setTempQuantity] = useState('');

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

    const handleStartAddingArticle = (article) => {
        setAddingArticleId(article.id);
        setTempQuantity('');
    };

    const handleConfirmAddArticle = () => {
        if (!addingArticleId || !tempQuantity || parseFloat(tempQuantity) <= 0) {
            return;
        }

        const article = articles.find(a => a.id === addingArticleId);
        if (!article) return;

        // Check if article already in transfer list
        const existingIndex = transferList.findIndex(item => item.article_id === article.id);
        
        if (existingIndex >= 0) {
            // Add quantity to existing item
            const updatedList = [...transferList];
            updatedList[existingIndex] = {
                ...updatedList[existingIndex],
                quantity: updatedList[existingIndex].quantity + parseFloat(tempQuantity)
            };
            setTransferList(updatedList);
        } else {
            // Add as new item
            setTransferList([...transferList, {
                article_id: article.id,
                article_name: article.name,
                supplier_name: article.supplier_name,
                quantity: parseFloat(tempQuantity),
                unit_abbreviation: article.unit_abbreviation
            }]);
        }

        setAddingArticleId(null);
        setTempQuantity('');
    };

    const handleRemoveFromTransferList = (articleId) => {
        setTransferList(transferList.filter(item => item.article_id !== articleId));
    };

    const handleUpdateQuantityInList = (articleId, quantity) => {
        setTransferList(transferList.map(item => 
            item.article_id === articleId 
                ? { ...item, quantity: parseFloat(quantity) || 0 }
                : item
        ));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!fromOutletId || !toOutletId) {
            alert('Bitte Quell- und Ziel-Outlet auswählen');
            return;
        }

        if (fromOutletId === toOutletId) {
            alert('Quell- und Ziel-Outlet müssen unterschiedlich sein');
            return;
        }

        const validItems = transferList.filter(item => item.quantity > 0);
        if (validItems.length === 0) {
            alert('Bitte mindestens einen Artikel zur Transferliste hinzufügen');
            return;
        }

        const fromOutlet = outlets.find(o => o.id === fromOutletId);
        const toOutlet = outlets.find(o => o.id === toOutletId);

        onSave({
            transfer_date: transferDate,
            from_outlet_id: fromOutletId,
            from_outlet_name: fromOutlet?.name,
            to_outlet_id: toOutletId,
            to_outlet_name: toOutlet?.name,
            items: validItems,
            notes,
            status: 'draft'
        });

        resetForm();
    };

    const resetForm = () => {
        setTransferDate(new Date().toISOString().split('T')[0]);
        setFromOutletId('');
        setToOutletId('');
        setNotes('');
        setSearchTerm('');
        setSelectedSupplierId('');
        setTransferList([]);
        setAddingArticleId(null);
        setTempQuantity('');
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b">
                    <DialogTitle className="text-lg font-semibold">
                        Outlet Transfer
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="overflow-y-auto px-6 py-4 space-y-6 flex-1">
                        {/* Transfer Details */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Datum *</Label>
                                <Input
                                    type="date"
                                    value={transferDate}
                                    onChange={(e) => setTransferDate(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Von Outlet *</Label>
                                <Select value={fromOutletId} onValueChange={setFromOutletId} required>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Wählen..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {outlets.filter(o => o.is_active !== false).map(outlet => (
                                            <SelectItem key={outlet.id} value={outlet.id}>
                                                {outlet.name} ({outlet.code})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Nach Outlet *</Label>
                                <Select value={toOutletId} onValueChange={setToOutletId} required>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Wählen..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {outlets.filter(o => o.is_active !== false).map(outlet => (
                                            <SelectItem key={outlet.id} value={outlet.id}>
                                                {outlet.name} ({outlet.code})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Supplier Selection */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-slate-600" />
                                <h3 className="font-semibold text-sm text-slate-900">Artikel hinzufügen</h3>
                            </div>
                            
                            <div className="space-y-2">
                                <Label>1. Lieferant auswählen *</Label>
                                <Select value={selectedSupplierId} onValueChange={(value) => {
                                    setSelectedSupplierId(value);
                                    setSearchTerm('');
                                    setAddingArticleId(null);
                                }}>
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

                            {/* Article List for Selected Supplier */}
                            {selectedSupplierId && (
                                <div className="space-y-3">
                                    <Label>2. Artikel auswählen</Label>
                                    
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input
                                            placeholder="Artikel suchen..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-10"
                                        />
                                    </div>

                                    <div className="border border-slate-200 rounded-lg max-h-64 overflow-y-auto">
                                        {filteredArticles.length > 0 ? (
                                            filteredArticles.map(article => (
                                                <div key={article.id} className="border-b last:border-b-0">
                                                    {addingArticleId === article.id ? (
                                                        <div className="p-4 bg-slate-50 space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <div className="font-medium text-sm">{article.name}</div>
                                                                    <div className="text-xs text-slate-500">
                                                                        Einheit: {article.unit_abbreviation}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-end gap-2">
                                                                <div className="flex-1 space-y-1">
                                                                    <Label className="text-xs">Menge *</Label>
                                                                    <Input
                                                                        type="number"
                                                                        step="0.01"
                                                                        min="0.01"
                                                                        value={tempQuantity}
                                                                        onChange={(e) => setTempQuantity(e.target.value)}
                                                                        placeholder="0"
                                                                        className="h-9"
                                                                        autoFocus
                                                                        onKeyPress={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                e.preventDefault();
                                                                                handleConfirmAddArticle();
                                                                            }
                                                                        }}
                                                                    />
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    onClick={handleConfirmAddArticle}
                                                                    disabled={!tempQuantity || parseFloat(tempQuantity) <= 0}
                                                                    className="bg-green-600 hover:bg-green-700"
                                                                >
                                                                    <Plus className="w-4 h-4 mr-1" />
                                                                    Hinzufügen
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setAddingArticleId(null);
                                                                        setTempQuantity('');
                                                                    }}
                                                                >
                                                                    Abbrechen
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleStartAddingArticle(article)}
                                                            className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between group"
                                                        >
                                                            <div>
                                                                <div className="font-medium text-sm">{article.name}</div>
                                                                <div className="text-xs text-slate-500">
                                                                    {article.category_name} • {article.unit_abbreviation}
                                                                </div>
                                                            </div>
                                                            {transferList.some(item => item.article_id === article.id) ? (
                                                                <Badge variant="secondary" className="text-xs">
                                                                    In Liste
                                                                </Badge>
                                                            ) : (
                                                                <Plus className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-4 text-center text-sm text-slate-500">
                                                {searchTerm ? 'Keine Artikel gefunden' : 'Dieser Lieferant hat keine Artikel'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Transfer List */}
                        {transferList.length > 0 && (
                            <Card className="border-2 border-slate-300 bg-slate-50">
                                <div className="p-4 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <ShoppingCart className="w-4 h-4 text-slate-700" />
                                        <h3 className="font-semibold text-sm text-slate-900">
                                            Transferliste ({transferList.length} Artikel)
                                        </h3>
                                    </div>
                                    
                                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Artikel</TableHead>
                                                    <TableHead className="hidden sm:table-cell">Lieferant</TableHead>
                                                    <TableHead className="w-28">Menge</TableHead>
                                                    <TableHead className="w-20">Einheit</TableHead>
                                                    <TableHead className="w-12"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {transferList.map(item => (
                                                    <TableRow key={item.article_id}>
                                                        <TableCell>
                                                            <div className="font-medium text-sm">{item.article_name}</div>
                                                            <div className="text-xs text-slate-500 sm:hidden">
                                                                {item.supplier_name}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-sm text-slate-600 hidden sm:table-cell">
                                                            {item.supplier_name}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min="0.01"
                                                                value={item.quantity}
                                                                onChange={(e) => handleUpdateQuantityInList(item.article_id, e.target.value)}
                                                                className="h-8"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-sm text-slate-600">
                                                            {item.unit_abbreviation}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleRemoveFromTransferList(item.article_id)}
                                                                className="h-8 w-8"
                                                            >
                                                                <Trash2 className="w-4 h-4 text-red-600" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </Card>
                        )}

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label>Bemerkungen</Label>
                            <Input
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Optional..."
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex gap-3 px-6 py-4 border-t bg-white sticky bottom-0">
                        <Button type="button" variant="outline" onClick={() => { onClose(); resetForm(); }} className="flex-1">
                            Abbrechen
                        </Button>
                        <Button 
                            type="submit" 
                            className="flex-1 bg-slate-900 hover:bg-slate-800"
                            disabled={transferList.length === 0}
                        >
                            Transfer buchen ({transferList.length})
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}