import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    Plus, 
    Search, 
    ClipboardCheck, 
    Truck, 
    BarChart3,
    Package,
    RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from "sonner";
import { format } from 'date-fns';

import StatsCards from '../components/inventory/StatsCards';
import ArticleTable from '../components/inventory/ArticleTable';
import ArticleForm from '../components/inventory/ArticleForm';
import DeliveryForm from '../components/inventory/DeliveryForm';
import ConsumptionView from '../components/inventory/ConsumptionView';
import ArticlesOverview from '../components/inventory/ArticlesOverview';
import LowStockOverview from '../components/inventory/LowStockOverview';
import InventoriesOverview from '../components/inventory/InventoriesOverview';
import DeliveriesOverview from '../components/inventory/DeliveriesOverview';

export default function Dashboard() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('articles');
    
    // Modal states
    const [showArticleForm, setShowArticleForm] = useState(false);
    const [showDeliveryForm, setShowDeliveryForm] = useState(false);
    const [editingArticle, setEditingArticle] = useState(null);
    
    // Overview modals
    const [showArticlesOverview, setShowArticlesOverview] = useState(false);
    const [showLowStockOverview, setShowLowStockOverview] = useState(false);
    const [showInventoriesOverview, setShowInventoriesOverview] = useState(false);
    const [showDeliveriesOverview, setShowDeliveriesOverview] = useState(false);

    // Data queries
    const { data: articles = [], isLoading: loadingArticles } = useQuery({
        queryKey: ['articles'],
        queryFn: () => base44.entities.Article.list('-created_date')
    });

    const { data: categories = [] } = useQuery({
        queryKey: ['categories'],
        queryFn: () => base44.entities.Category.list()
    });

    const { data: units = [] } = useQuery({
        queryKey: ['units'],
        queryFn: () => base44.entities.Unit.list()
    });

    const { data: suppliers = [] } = useQuery({
        queryKey: ['suppliers'],
        queryFn: () => base44.entities.Supplier.list()
    });

    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    const { data: inventories = [] } = useQuery({
        queryKey: ['inventories'],
        queryFn: () => base44.entities.Inventory.list('-inventory_date')
    });

    const { data: inventorySessions = [] } = useQuery({
        queryKey: ['inventorySessions'],
        queryFn: () => base44.entities.InventorySession.list('-session_date')
    });

    const { data: deliveries = [] } = useQuery({
        queryKey: ['deliveries'],
        queryFn: () => base44.entities.Delivery.list('-delivery_date')
    });

    // Mutations
    const createArticleMutation = useMutation({
        mutationFn: (data) => base44.entities.Article.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['articles'] });
            toast.success('Artikel hinzugefügt');
            setShowArticleForm(false);
        }
    });

    const updateArticleMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.Article.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['articles'] });
            toast.success('Artikel aktualisiert');
            setShowArticleForm(false);
            setEditingArticle(null);
        }
    });

    const deleteArticleMutation = useMutation({
        mutationFn: (id) => base44.entities.Article.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['articles'] });
            toast.success('Artikel gelöscht');
        }
    });



    const createDeliveryMutation = useMutation({
        mutationFn: async (data) => {
            await base44.entities.Delivery.create(data);
            // Update article stocks and prices
            for (const item of data.items) {
                const article = articles.find(a => a.id === item.article_id);
                if (article) {
                    const updateData = {
                        current_stock: (article.current_stock || 0) + item.quantity
                    };
                    
                    // Update price in article master if requested
                    if (item.update_master_price && item.price !== article.purchase_price) {
                        updateData.purchase_price = item.price;
                        
                        // Track price change
                        if (currentUser) {
                            await base44.entities.PriceHistory.create({
                                article_id: article.id,
                                article_name: article.name,
                                old_price: article.purchase_price,
                                new_price: item.price,
                                change_date: format(new Date(), 'yyyy-MM-dd'),
                                changed_by: currentUser.email,
                                reason: 'Preisänderung bei Lieferung'
                            });
                        }
                    }
                    
                    await base44.entities.Article.update(item.article_id, updateData);
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['deliveries'] });
            queryClient.invalidateQueries({ queryKey: ['articles'] });
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            toast.success('Lieferung erfasst');
            setShowDeliveryForm(false);
        }
    });

    // Handlers
    const handleSaveArticle = async (data, meta) => {
        // Track price change
        if (meta?.priceChanged && currentUser) {
            const priceHistoryData = {
                article_id: editingArticle.id,
                article_name: editingArticle.name,
                old_price: meta.oldPrice,
                new_price: meta.newPrice,
                change_date: format(new Date(), 'yyyy-MM-dd'),
                changed_by: currentUser.email,
                reason: 'Manuelle Preisänderung'
            };
            
            try {
                await base44.entities.PriceHistory.create(priceHistoryData);
            } catch (error) {
                console.error('Failed to save price history:', error);
            }
        }

        if (editingArticle) {
            updateArticleMutation.mutate({ id: editingArticle.id, data });
        } else {
            createArticleMutation.mutate(data);
        }
    };

    const handleEditArticle = (article) => {
        setEditingArticle(article);
        setShowArticleForm(true);
    };

    const handleDeleteArticle = (article) => {
        if (confirm(`"${article.name}" wirklich löschen?`)) {
            deleteArticleMutation.mutate(article.id);
        }
    };



    const handleSaveDelivery = (data) => {
        createDeliveryMutation.mutate(data);
    };

    // Filter articles
    const filteredArticles = articles.filter(article =>
        article.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.category_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const activeArticles = filteredArticles.filter(a => a.is_active !== false);

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                                Café Inventar
                            </h1>
                            <p className="text-sm text-slate-500 hidden sm:block">
                                Bestandsverwaltung & Inventur
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link to={createPageUrl('InventoryCapture')}>
                                <Button 
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                    <ClipboardCheck className="w-4 h-4 mr-2" />
                                    Inventur starten
                                </Button>
                            </Link>
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => queryClient.invalidateQueries()}
                                className="hidden sm:flex"
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Aktualisieren
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                {/* Stats */}
                <StatsCards 
                    articles={articles} 
                    inventories={inventorySessions} 
                    deliveries={deliveries}
                    onArticlesClick={() => setShowArticlesOverview(true)}
                    onLowStockClick={() => setShowLowStockOverview(true)}
                    onInventoriesClick={() => setShowInventoriesOverview(true)}
                    onDeliveriesClick={() => setShowDeliveriesOverview(true)}
                />

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                        <TabsList className="bg-white border border-slate-200">
                            <TabsTrigger value="articles" className="gap-2">
                                <Package className="w-4 h-4" />
                                <span className="hidden sm:inline">Artikel</span>
                            </TabsTrigger>
                            <TabsTrigger value="consumption" className="gap-2">
                                <BarChart3 className="w-4 h-4" />
                                <span className="hidden sm:inline">Verbrauch</span>
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex gap-2">
                            <div className="relative flex-1 sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    placeholder="Suchen..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 bg-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        <Button 
                            onClick={() => { setEditingArticle(null); setShowArticleForm(true); }}
                            className="bg-slate-900 hover:bg-slate-800"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Artikel
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={() => setShowDeliveryForm(true)}
                            disabled={articles.length === 0}
                        >
                            <Truck className="w-4 h-4 mr-2" />
                            Lieferung
                        </Button>
                    </div>

                    <TabsContent value="articles" className="mt-0">
                        <ArticleTable
                            articles={activeArticles}
                            inventories={inventories}
                            onEdit={handleEditArticle}
                            onDelete={handleDeleteArticle}
                        />
                    </TabsContent>

                    <TabsContent value="consumption" className="mt-0">
                        <ConsumptionView
                            articles={articles}
                            inventories={inventories}
                            deliveries={deliveries}
                        />
                    </TabsContent>
                </Tabs>
            </main>

            {/* Modals */}
            <ArticleForm
                open={showArticleForm}
                onClose={() => { setShowArticleForm(false); setEditingArticle(null); }}
                onSave={handleSaveArticle}
                article={editingArticle}
                categories={categories}
                units={units}
                suppliers={suppliers}
                currentUser={currentUser}
            />

            <DeliveryForm
                open={showDeliveryForm}
                onClose={() => setShowDeliveryForm(false)}
                onSave={handleSaveDelivery}
                articles={articles}
                suppliers={suppliers}
            />

            {/* Overview Modals */}
            <ArticlesOverview
                open={showArticlesOverview}
                onClose={() => setShowArticlesOverview(false)}
                articles={articles}
            />

            <LowStockOverview
                open={showLowStockOverview}
                onClose={() => setShowLowStockOverview(false)}
                articles={articles}
            />

            <InventoriesOverview
                open={showInventoriesOverview}
                onClose={() => setShowInventoriesOverview(false)}
                sessions={inventorySessions}
            />

            <DeliveriesOverview
                open={showDeliveriesOverview}
                onClose={() => setShowDeliveriesOverview(false)}
                deliveries={deliveries}
            />
            </div>
            );
            }