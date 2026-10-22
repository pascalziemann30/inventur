import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from "sonner";

import SupplierForm from '../components/suppliers/SupplierForm';
import SupplierTable from '../components/suppliers/SupplierTable';

export default function Suppliers() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [showSupplierForm, setShowSupplierForm] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);

    const { data: suppliers = [] } = useQuery({
        queryKey: ['suppliers'],
        queryFn: () => base44.entities.Supplier.list('-created_date')
    });

    const { data: articles = [] } = useQuery({
        queryKey: ['articles'],
        queryFn: () => base44.entities.Article.list()
    });

    const createSupplierMutation = useMutation({
        mutationFn: (data) => base44.entities.Supplier.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            toast.success('Lieferant hinzugefügt');
            setShowSupplierForm(false);
        }
    });

    const updateSupplierMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.Supplier.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            toast.success('Lieferant aktualisiert');
            setShowSupplierForm(false);
            setEditingSupplier(null);
        }
    });

    const deleteSupplierMutation = useMutation({
        mutationFn: (id) => base44.entities.Supplier.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            toast.success('Lieferant gelöscht');
        }
    });

    const handleSaveSupplier = (data) => {
        if (editingSupplier) {
            updateSupplierMutation.mutate({ id: editingSupplier.id, data });
        } else {
            createSupplierMutation.mutate(data);
        }
    };

    const handleEditSupplier = (supplier) => {
        setEditingSupplier(supplier);
        setShowSupplierForm(true);
    };

    const handleDeleteSupplier = (supplier) => {
        const articleCount = articles.filter(a => a.supplier_id === supplier.id && a.is_active !== false).length;
        
        if (articleCount > 0) {
            toast.error('Lieferant kann nicht gelöscht werden, da noch Artikel zugeordnet sind');
            return;
        }

        if (confirm(`Lieferant "${supplier.name}" wirklich löschen?`)) {
            deleteSupplierMutation.mutate(supplier.id);
        }
    };

    const filteredSuppliers = suppliers.filter(supplier =>
        supplier.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.contact_person?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                    <div className="flex items-center gap-4">
                        <Link to={createPageUrl('Dashboard')}>
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div className="flex-1">
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                                Lieferanten
                            </h1>
                            <p className="text-sm text-slate-500">
                                Lieferanten verwalten
                            </p>
                        </div>
                        <Button 
                            onClick={() => { setEditingSupplier(null); setShowSupplierForm(true); }}
                            className="bg-slate-900 hover:bg-slate-800"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Lieferant
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                <div className="mb-6">
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Lieferant suchen..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-white"
                        />
                    </div>
                </div>

                <SupplierTable
                    suppliers={filteredSuppliers}
                    articles={articles}
                    onEdit={handleEditSupplier}
                    onDelete={handleDeleteSupplier}
                />
            </main>

            <SupplierForm
                open={showSupplierForm}
                onClose={() => { setShowSupplierForm(false); setEditingSupplier(null); }}
                onSave={handleSaveSupplier}
                supplier={editingSupplier}
            />
        </div>
    );
}