import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Check, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";

export default function AlertDetailDialog({ alert, items, open, onClose, onUpdate }) {
    const [editingItem, setEditingItem] = useState(null);
    const [newPrice, setNewPrice] = useState('');
    const [saving, setSaving] = useState(false);

    const handleEditPrice = (item) => {
        setEditingItem(item.article_id);
        setNewPrice(item.price?.toString() || '');
    };

    const handleSavePrice = async (item) => {
        if (!newPrice || isNaN(parseFloat(newPrice))) {
            toast.error('Bitte gültigen Preis eingeben');
            return;
        }

        setSaving(true);
        try {
            // Find and update the OutletItem
            const outletItems = await base44.entities.OutletItem.filter({ 
                global_item_id: item.article_id 
            });
            
            if (outletItems.length === 0) {
                toast.error('Artikel nicht gefunden');
                return;
            }

            // Update all matching OutletItems (in case article exists in multiple outlets)
            await Promise.all(
                outletItems.map(outletItem => 
                    base44.entities.OutletItem.update(outletItem.id, {
                        net_purchase_price: parseFloat(newPrice)
                    })
                )
            );

            toast.success('Preis aktualisiert');
            setEditingItem(null);
            onUpdate();
        } catch (error) {
            console.error('Update error:', error);
            toast.error('Fehler beim Speichern: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingItem(null);
        setNewPrice('');
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{alert?.title}</DialogTitle>
                    <p className="text-sm text-slate-600">{alert?.description}</p>
                </DialogHeader>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Datum</TableHead>
                            <TableHead>Artikel</TableHead>
                            <TableHead>Lieferant</TableHead>
                            <TableHead>Menge</TableHead>
                            <TableHead>Preis</TableHead>
                            <TableHead>Wert</TableHead>
                            {alert?.type === 'error' && <TableHead>Aktion</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item, index) => (
                            <TableRow key={index}>
                                <TableCell className="text-xs">
                                    {format(parseISO(item.date), 'dd.MM.yyyy', { locale: de })}
                                </TableCell>
                                <TableCell className="font-medium">{item.article_name}</TableCell>
                                <TableCell className="text-sm">{item.supplier_name || '—'}</TableCell>
                                <TableCell className="text-sm">
                                    {(item.quantity || 0).toFixed(2)} {item.unit}
                                </TableCell>
                                <TableCell>
                                    {editingItem === item.article_id ? (
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={newPrice}
                                            onChange={(e) => setNewPrice(e.target.value)}
                                            className="w-24"
                                            autoFocus
                                        />
                                    ) : (
                                        <span>{(item.price || 0).toFixed(2)} €</span>
                                    )}
                                </TableCell>
                                <TableCell className="font-medium">
                                    {(item.value || 0).toFixed(2)} €
                                </TableCell>
                                {alert?.type === 'error' && (
                                    <TableCell>
                                        {editingItem === item.article_id ? (
                                            <div className="flex gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleSavePrice(item)}
                                                    disabled={saving}
                                                >
                                                    <Check className="w-4 h-4 text-green-600" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={handleCancelEdit}
                                                    disabled={saving}
                                                >
                                                    <X className="w-4 h-4 text-red-600" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleEditPrice(item)}
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </DialogContent>
        </Dialog>
    );
}