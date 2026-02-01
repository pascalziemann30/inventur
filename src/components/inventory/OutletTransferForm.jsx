import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Trash2, Plus } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export default function OutletTransferForm({ open, onClose, onSave, articles, outlets }) {
    const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
    const [fromOutletId, setFromOutletId] = useState('');
    const [toOutletId, setToOutletId] = useState('');
    const [notes, setNotes] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [supplierFilter, setSupplierFilter] = useState('all');
    const [selectedItems, setSelectedItems] = useState([]);

    // Get unique suppliers from articles
    const suppliers = [...new Set(articles.map(a => a.supplier_name))].filter(Boolean);

    // Filter articles based on search and supplier
    const filteredArticles = articles.filter(article => {
        const matchesSearch = article.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSupplier = supplierFilter === 'all' || article.supplier_name === supplierFilter;
        return matchesSearch && matchesSupplier;
    });

    const handleAddItem = (article) => {
        const existing = selectedItems.find(item => item.article_id === article.id);
        if (!existing) {
            setSelectedItems([...selectedItems, {
                article_id: article.id,
                article_name: article.name,
                supplier_name: article.supplier_name,
                quantity: 1,
                unit_abbreviation: article.unit_abbreviation
            }]);
        }
    };

    const handleRemoveItem = (articleId) => {
        setSelectedItems(selectedItems.filter(item => item.article_id !== articleId));
    };

    const handleQuantityChange = (articleId, quantity) => {
        setSelectedItems(selectedItems.map(item => 
            item.article_id === articleId 
                ? { ...item, quantity: parseFloat(quantity) || 0 }
                : item
        ));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (fromOutletId === toOutletId) {
            alert('Quell- und Ziel-Outlet müssen unterschiedlich sein');
            return;
        }

        const validItems = selectedItems.filter(item => item.quantity > 0);
        if (validItems.length === 0) {
            alert('Bitte mindestens einen Artikel mit Menge > 0 hinzufügen');
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
        setSupplierFilter('all');
        setSelectedItems([]);
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

                        {/* Article Search & Filter */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-sm text-slate-900">Artikel hinzufügen</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        placeholder="Artikel suchen..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>

                                <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Alle Lieferanten</SelectItem>
                                        {suppliers.map(supplier => (
                                            <SelectItem key={supplier} value={supplier}>
                                                {supplier}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Article List */}
                            {searchTerm && (
                                <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                                    {filteredArticles.length > 0 ? (
                                        filteredArticles.slice(0, 10).map(article => (
                                            <button
                                                key={article.id}
                                                type="button"
                                                onClick={() => handleAddItem(article)}
                                                className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center justify-between border-b last:border-b-0"
                                                disabled={selectedItems.some(item => item.article_id === article.id)}
                                            >
                                                <div>
                                                    <div className="font-medium text-sm">{article.name}</div>
                                                    <div className="text-xs text-slate-500">
                                                        {article.supplier_name} • {article.unit_abbreviation}
                                                    </div>
                                                </div>
                                                {selectedItems.some(item => item.article_id === article.id) ? (
                                                    <Badge variant="secondary" className="text-xs">Hinzugefügt</Badge>
                                                ) : (
                                                    <Plus className="w-4 h-4 text-slate-400" />
                                                )}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="p-4 text-center text-sm text-slate-500">
                                            Keine Artikel gefunden
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Selected Items */}
                        {selectedItems.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="font-semibold text-sm text-slate-900">
                                    Transfer-Liste ({selectedItems.length} Artikel)
                                </h3>
                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Artikel</TableHead>
                                                <TableHead>Lieferant</TableHead>
                                                <TableHead className="w-32">Menge *</TableHead>
                                                <TableHead className="w-20">Einheit</TableHead>
                                                <TableHead className="w-16"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedItems.map(item => (
                                                <TableRow key={item.article_id}>
                                                    <TableCell className="font-medium">{item.article_name}</TableCell>
                                                    <TableCell className="text-sm text-slate-600">
                                                        {item.supplier_name}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            min="0.01"
                                                            value={item.quantity}
                                                            onChange={(e) => handleQuantityChange(item.article_id, e.target.value)}
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
                                                            onClick={() => handleRemoveItem(item.article_id)}
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
                        <Button type="submit" className="flex-1 bg-slate-900 hover:bg-slate-800">
                            Transfer speichern
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}