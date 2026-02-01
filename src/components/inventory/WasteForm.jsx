import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Trash2, Plus, AlertTriangle, Edit2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export default function WasteForm({ open, onClose, onSave, articles, suppliers }) {
    const [wasteDate, setWasteDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSupplierId, setSelectedSupplierId] = useState('all');
    const [wasteList, setWasteList] = useState([]);
    const [addingArticleId, setAddingArticleId] = useState(null);
    const [tempQuantity, setTempQuantity] = useState('');
    const [tempReason, setTempReason] = useState('');
    const [editingItemId, setEditingItemId] = useState(null);

    // Filter articles by selected supplier
    const supplierArticles = useMemo(() => {
        if (selectedSupplierId === 'all') {
            return articles.filter(a => a.is_active !== false);
        }
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
        setTempReason('');
    };

    const handleConfirmAddArticle = () => {
        if (!addingArticleId || !tempQuantity || parseFloat(tempQuantity) <= 0 || !tempReason.trim()) {
            return;
        }

        const article = articles.find(a => a.id === addingArticleId);
        if (!article) return;

        // Check if article already in waste list
        const existingIndex = wasteList.findIndex(item => item.article_id === article.id);
        
        if (existingIndex >= 0) {
            // Add quantity and append reason
            const updatedList = [...wasteList];
            const existingReason = updatedList[existingIndex].reason;
            updatedList[existingIndex] = {
                ...updatedList[existingIndex],
                quantity: updatedList[existingIndex].quantity + parseFloat(tempQuantity),
                reason: existingReason + '; ' + tempReason
            };
            setWasteList(updatedList);
        } else {
            // Add as new item
            setWasteList([...wasteList, {
                article_id: article.id,
                article_name: article.name,
                supplier_name: article.supplier_name,
                quantity: parseFloat(tempQuantity),
                unit_abbreviation: article.unit_abbreviation,
                reason: tempReason
            }]);
        }

        setAddingArticleId(null);
        setTempQuantity('');
        setTempReason('');
    };

    const handleRemoveFromWasteList = (articleId) => {
        setWasteList(wasteList.filter(item => item.article_id !== articleId));
    };

    const handleStartEditItem = (item) => {
        setEditingItemId(item.article_id);
        setTempQuantity(item.quantity.toString());
        setTempReason(item.reason);
    };

    const handleConfirmEditItem = () => {
        if (!editingItemId || !tempQuantity || parseFloat(tempQuantity) <= 0 || !tempReason.trim()) {
            return;
        }

        setWasteList(wasteList.map(item => 
            item.article_id === editingItemId 
                ? { ...item, quantity: parseFloat(tempQuantity), reason: tempReason }
                : item
        ));

        setEditingItemId(null);
        setTempQuantity('');
        setTempReason('');
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const validItems = wasteList.filter(item => item.quantity > 0 && item.reason?.trim());
        if (validItems.length === 0) {
            alert('Bitte mindestens einen Artikel mit Menge und Grund hinzufügen');
            return;
        }

        onSave({
            waste_date: wasteDate,
            items: validItems,
            notes,
            status: 'draft'
        });

        resetForm();
    };

    const resetForm = () => {
        setWasteDate(new Date().toISOString().split('T')[0]);
        setNotes('');
        setSearchTerm('');
        setSelectedSupplierId('all');
        setWasteList([]);
        setAddingArticleId(null);
        setTempQuantity('');
        setTempReason('');
        setEditingItemId(null);
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b">
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                        Waste erfassen
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="overflow-y-auto px-6 py-4 space-y-6 flex-1">
                        {/* Waste Details */}
                        <div className="space-y-2">
                            <Label>Datum *</Label>
                            <Input
                                type="date"
                                value={wasteDate}
                                onChange={(e) => setWasteDate(e.target.value)}
                                required
                            />
                        </div>

                        {/* Supplier & Article Selection */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-orange-600" />
                                <h3 className="font-semibold text-sm text-slate-900">Artikel hinzufügen</h3>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Lieferant (Filter)</Label>
                                    <Select value={selectedSupplierId} onValueChange={(value) => {
                                        setSelectedSupplierId(value);
                                        setSearchTerm('');
                                        setAddingArticleId(null);
                                    }}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Alle Lieferanten</SelectItem>
                                            {suppliers?.filter(s => s.is_active !== false).map(supplier => (
                                                <SelectItem key={supplier.id} value={supplier.id}>
                                                    {supplier.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Artikel suchen</Label>
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

                            {/* Article List */}
                            {searchTerm && (
                                <div className="border border-slate-200 rounded-lg max-h-64 overflow-y-auto">
                                    {filteredArticles.length > 0 ? (
                                        filteredArticles.map(article => (
                                            <div key={article.id} className="border-b last:border-b-0">
                                                {addingArticleId === article.id ? (
                                                    <div className="p-4 bg-orange-50 space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <div className="font-medium text-sm">{article.name}</div>
                                                                <div className="text-xs text-slate-500">
                                                                    {article.supplier_name} • {article.unit_abbreviation}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">Menge *</Label>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0.01"
                                                                    value={tempQuantity}
                                                                    onChange={(e) => setTempQuantity(e.target.value)}
                                                                    placeholder="0"
                                                                    className="h-9"
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">Grund *</Label>
                                                                <Input
                                                                    value={tempReason}
                                                                    onChange={(e) => setTempReason(e.target.value)}
                                                                    placeholder="z.B. abgelaufen"
                                                                    className="h-9"
                                                                    onKeyPress={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            e.preventDefault();
                                                                            handleConfirmAddArticle();
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                onClick={handleConfirmAddArticle}
                                                                disabled={!tempQuantity || parseFloat(tempQuantity) <= 0 || !tempReason.trim()}
                                                                className="bg-orange-600 hover:bg-orange-700 flex-1"
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
                                                                    setTempReason('');
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
                                                                {article.supplier_name} • {article.category_name} • {article.unit_abbreviation}
                                                            </div>
                                                        </div>
                                                        {wasteList.some(item => item.article_id === article.id) ? (
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
                                            Keine Artikel gefunden
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Waste List */}
                        {wasteList.length > 0 && (
                            <Card className="border-2 border-orange-300 bg-orange-50">
                                <div className="p-4 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 text-orange-700" />
                                        <h3 className="font-semibold text-sm text-slate-900">
                                            Waste-Liste ({wasteList.length} Artikel)
                                        </h3>
                                    </div>
                                    
                                    <div className="border border-orange-200 rounded-lg overflow-hidden bg-white">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Artikel</TableHead>
                                                    <TableHead className="hidden sm:table-cell">Lieferant</TableHead>
                                                    <TableHead className="w-24">Menge</TableHead>
                                                    <TableHead className="w-20">Einheit</TableHead>
                                                    <TableHead>Grund</TableHead>
                                                    <TableHead className="w-20"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {wasteList.map(item => (
                                                    <TableRow key={item.article_id}>
                                                        {editingItemId === item.article_id ? (
                                                            <>
                                                                <TableCell colSpan={6} className="p-4 bg-orange-50">
                                                                    <div className="space-y-3">
                                                                        <div className="font-medium text-sm">{item.article_name}</div>
                                                                        <div className="grid grid-cols-2 gap-2">
                                                                            <div className="space-y-1">
                                                                                <Label className="text-xs">Menge *</Label>
                                                                                <Input
                                                                                    type="number"
                                                                                    step="0.01"
                                                                                    min="0.01"
                                                                                    value={tempQuantity}
                                                                                    onChange={(e) => setTempQuantity(e.target.value)}
                                                                                    className="h-8"
                                                                                />
                                                                            </div>
                                                                            <div className="space-y-1">
                                                                                <Label className="text-xs">Grund *</Label>
                                                                                <Input
                                                                                    value={tempReason}
                                                                                    onChange={(e) => setTempReason(e.target.value)}
                                                                                    className="h-8"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex gap-2">
                                                                            <Button
                                                                                type="button"
                                                                                size="sm"
                                                                                onClick={handleConfirmEditItem}
                                                                                disabled={!tempQuantity || parseFloat(tempQuantity) <= 0 || !tempReason.trim()}
                                                                                className="bg-orange-600 hover:bg-orange-700"
                                                                            >
                                                                                Speichern
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => {
                                                                                    setEditingItemId(null);
                                                                                    setTempQuantity('');
                                                                                    setTempReason('');
                                                                                }}
                                                                            >
                                                                                Abbrechen
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                </TableCell>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <TableCell>
                                                                    <div className="font-medium text-sm">{item.article_name}</div>
                                                                    <div className="text-xs text-slate-500 sm:hidden">
                                                                        {item.supplier_name}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-sm text-slate-600 hidden sm:table-cell">
                                                                    {item.supplier_name}
                                                                </TableCell>
                                                                <TableCell className="font-medium">{item.quantity}</TableCell>
                                                                <TableCell className="text-sm text-slate-600">
                                                                    {item.unit_abbreviation}
                                                                </TableCell>
                                                                <TableCell className="text-sm text-slate-600 max-w-xs truncate">
                                                                    {item.reason}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex gap-1">
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            onClick={() => handleStartEditItem(item)}
                                                                            className="h-8 w-8"
                                                                        >
                                                                            <Edit2 className="w-4 h-4 text-slate-600" />
                                                                        </Button>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            onClick={() => handleRemoveFromWasteList(item.article_id)}
                                                                            className="h-8 w-8"
                                                                        >
                                                                            <Trash2 className="w-4 h-4 text-red-600" />
                                                                        </Button>
                                                                    </div>
                                                                </TableCell>
                                                            </>
                                                        )}
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
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Optional..."
                                rows={2}
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
                            className="flex-1 bg-orange-600 hover:bg-orange-700"
                            disabled={wasteList.length === 0}
                        >
                            Waste buchen ({wasteList.length})
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}