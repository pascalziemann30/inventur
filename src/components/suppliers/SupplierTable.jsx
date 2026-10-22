import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Mail, Phone } from 'lucide-react';

export default function SupplierTable({ suppliers, articles, onEdit, onDelete }) {
    const getArticleCount = (supplierId) => {
        return articles.filter(a => a.supplier_id === supplierId && a.is_active !== false).length;
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-50">
                        <TableHead className="font-semibold text-slate-700">Lieferant</TableHead>
                        <TableHead className="font-semibold text-slate-700">Kontakt</TableHead>
                        <TableHead className="font-semibold text-slate-700">Artikel</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-right">Aktionen</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {suppliers.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center py-12 text-slate-500">
                                Noch keine Lieferanten vorhanden
                            </TableCell>
                        </TableRow>
                    ) : (
                        suppliers.map(supplier => {
                            const articleCount = getArticleCount(supplier.id);
                            
                            return (
                                <TableRow key={supplier.id} className="hover:bg-slate-50/50 transition-colors">
                                    <TableCell>
                                        <div>
                                            <div className="font-medium">{supplier.name}</div>
                                            {supplier.contact_person && (
                                                <div className="text-sm text-slate-500">
                                                    {supplier.contact_person}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1 text-sm text-slate-600">
                                            {supplier.phone && (
                                                <div className="flex items-center gap-1">
                                                    <Phone className="w-3 h-3" />
                                                    <span>{supplier.phone}</span>
                                                </div>
                                            )}
                                            {supplier.email && (
                                                <div className="flex items-center gap-1">
                                                    <Mail className="w-3 h-3" />
                                                    <span>{supplier.email}</span>
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                                            {articleCount} Artikel
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => onEdit(supplier)}
                                                className="h-8 w-8 text-slate-500 hover:text-slate-700"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => onDelete(supplier)}
                                                disabled={articleCount > 0}
                                                className="h-8 w-8 text-slate-500 hover:text-red-600 disabled:opacity-50"
                                                title={articleCount > 0 ? 'Lieferant hat noch Artikel' : ''}
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