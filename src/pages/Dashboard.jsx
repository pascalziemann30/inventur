import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useOutlet } from '../components/outlet/OutletContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
    Plus, 
    Search, 
    ClipboardCheck, 
    Truck, 
    BarChart3,
    Package,
    RefreshCw,
    ArrowUpDown,
    ArrowRightLeft,
    AlertTriangle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from "sonner";
import { format } from 'date-fns';

import StatsCards from '../components/inventory/StatsCards';
import ArticleTable from '../components/inventory/ArticleTable';
import CategoryArticleView from '../components/inventory/CategoryArticleView';
import ArticleForm from '../components/inventory/ArticleForm';
import DeliveryForm from '../components/inventory/DeliveryForm';
import OutletTransferForm from '../components/inventory/OutletTransferForm';
import WasteForm from '../components/inventory/WasteForm';
import ConsumptionView from '../components/inventory/ConsumptionView';
import WasteOverview from '../components/inventory/WasteOverview';
import ArticlesOverview from '../components/inventory/ArticlesOverview';
import LowStockOverview from '../components/inventory/LowStockOverview';
import InventoriesOverview from '../components/inventory/InventoriesOverview';
import DeliveriesOverview from '../components/inventory/DeliveriesOverview';

export default function Dashboard() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { currentOutletId, currentOutletName } = useOutlet();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('articles');
    const [sortBy, setSortBy] = useState('name');

    // Redirect to login if no outlet selected
    useEffect(() => {
        if (!currentOutletId) {
            navigate('/OutletLogin');
        }
    }, [currentOutletId, navigate]);
    
    // Modal states
    const [showArticleForm, setShowArticleForm] = useState(false);
    const [showDeliveryForm, setShowDeliveryForm] = useState(false);
    const [showTransferForm, setShowTransferForm] = useState(false);
    const [showWasteForm, setShowWasteForm] = useState(false);
    const [editingArticle, setEditingArticle] = useState(null);
    
    // Overview modals
    const [showArticlesOverview, setShowArticlesOverview] = useState(false);
    const [showLowStockOverview, setShowLowStockOverview] = useState(false);
    const [showInventoriesOverview, setShowInventoriesOverview] = useState(false);
    const [showDeliveriesOverview, setShowDeliveriesOverview] = useState(false);

    // Data queries - filtered by current outlet
    const { data: outletStocks = [], isLoading: loadingStocks } = useQuery({
        queryKey: ['outlet-stocks', currentOutletId],
        queryFn: () => base44.entities.OutletStock.filter({ outlet_id: currentOutletId }),
        enabled: !!currentOutletId
    });

    const { data: outletItems = [], isLoading: loadingArticles } = useQuery({
        queryKey: ['outlet-items', currentOutletId],
        queryFn: () => base44.entities.OutletItem.filter({ outlet_id: currentOutletId }),
        enabled: !!currentOutletId
    });

    // Merge outlet items with outlet stock
    const articlesWithStock = React.useMemo(() => {
        return outletItems.map(item => {
            const stock = outletStocks.find(s => s.outlet_item_id === item.id);
            return {
                id: item.id,
                name: item.display_name,
                category_id: item.category_id,
                category_name: item.category_name,
                unit_id: item.unit_id,
                unit_abbreviation: stock?.unit_abbreviation || '',
                supplier_id: item.supplier_id,
                supplier_name: item.supplier_name,
                purchase_price: item.net_purchase_price,
                current_stock: stock?.on_hand_quantity || 0,
                min_stock: item.min_stock,
                inventory_intervals: item.inventory_intervals || [],
                notes: item.notes,
                is_active: item.is_active,
                outlet_item_id: item.id,
                global_item_id: item.global_item_id
            };
        });
    }, [outletItems, outletStocks]);

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
        queryKey: ['inventorySessions', currentOutletId],
        queryFn: () => base44.entities.InventorySession.filter({ outlet_id: currentOutletId }, '-session_date'),
        enabled: !!currentOutletId
    });

    const { data: deliveries = [] } = useQuery({
        queryKey: ['deliveries', currentOutletId],
        queryFn: () => base44.entities.Delivery.filter({ outlet_id: currentOutletId }, '-delivery_date'),
        enabled: !!currentOutletId
    });

    const { data: outlets = [] } = useQuery({
        queryKey: ['outlets'],
        queryFn: () => base44.entities.Outlet.list()
    });

    const { data: wastes = [] } = useQuery({
        queryKey: ['wastes', currentOutletId],
        queryFn: () => base44.entities.Waste.filter({ outlet_id: currentOutletId }, '-waste_date'),
        enabled: !!currentOutletId
    });

    // Check if current outlet is aggregator
    const { data: currentOutlet } = useQuery({
        queryKey: ['current-outlet', currentOutletId],
        queryFn: () => base44.entities.Outlet.filter({ id: currentOutletId }).then(r => r[0]),
        enabled: !!currentOutletId
    });

    const isAggregatorOutlet = currentOutlet?.type === 'AGGREGATOR';

    // Mutations
    const createArticleMutation = useMutation({
        mutationFn: async (data) => {
            if (!currentOutletId) {
                throw new Error('Kein Outlet ausgewählt');
            }
            if (isAggregatorOutlet) {
                throw new Error('Artikel können nicht im Aggregator-Outlet angelegt werden');
            }

            // Step 1: Find or create GlobalItem
            const globalItems = await base44.entities.GlobalItem.filter({
                canonical_name: data.name,
                unit_abbreviation: data.unit_abbreviation
            });

            let globalItem;
            if (globalItems.length > 0) {
                globalItem = globalItems[0];
            } else {
                globalItem = await base44.entities.GlobalItem.create({
                    canonical_name: data.name,
                    unit_id: data.unit_id,
                    unit_abbreviation: data.unit_abbreviation,
                    category_id: data.category_id,
                    category_name: data.category_name,
                    default_net_price: data.purchase_price,
                    notes: data.notes
                });
            }

            // Step 2: Create OutletItem ONLY for current outlet
            const outletItem = await base44.entities.OutletItem.create({
                outlet_id: currentOutletId,
                outlet_name: currentOutletName,
                global_item_id: globalItem.id,
                display_name: data.name,
                supplier_id: data.supplier_id,
                supplier_name: data.supplier_name,
                net_purchase_price: data.purchase_price || 0,
                min_stock: data.min_stock,
                inventory_intervals: data.inventory_intervals || [],
                notes: data.notes,
                is_active: true
            });

            // Step 3: Create OutletStock ONLY for current outlet
            await base44.entities.OutletStock.create({
                outlet_id: currentOutletId,
                outlet_name: currentOutletName,
                outlet_item_id: outletItem.id,
                global_item_id: globalItem.id,
                display_name: data.name,
                on_hand_quantity: data.initial_stock || 0,
                unit_abbreviation: data.unit_abbreviation
            });

            return { outletItem, globalItem };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['outlet-items', currentOutletId] });
            queryClient.invalidateQueries({ queryKey: ['outlet-stocks', currentOutletId] });
            queryClient.invalidateQueries({ queryKey: ['global-items'] });
            toast.success('Artikel hinzugefügt');
            setShowArticleForm(false);
        },
        onError: (error) => {
            toast.error(error.message || 'Fehler beim Erstellen des Artikels');
        }
    });

    const updateArticleMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            // Update OutletItem
            await base44.entities.OutletItem.update(id, {
                display_name: data.name,
                supplier_id: data.supplier_id,
                supplier_name: data.supplier_name,
                net_purchase_price: data.purchase_price,
                min_stock: data.min_stock,
                inventory_intervals: data.inventory_intervals,
                notes: data.notes,
                is_active: data.is_active
            });

            // Update GlobalItem if needed
            const outletItem = outletItems.find(i => i.id === id);
            if (outletItem?.global_item_id) {
                await base44.entities.GlobalItem.update(outletItem.global_item_id, {
                    canonical_name: data.name,
                    category_id: data.category_id,
                    category_name: data.category_name,
                    default_net_price: data.purchase_price
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['outlet-items', currentOutletId] });
            queryClient.invalidateQueries({ queryKey: ['global-items'] });
            toast.success('Artikel aktualisiert');
            setShowArticleForm(false);
            setEditingArticle(null);
        }
    });

    const deleteArticleMutation = useMutation({
        mutationFn: async (id) => {
            // Delete OutletStock first
            const stocks = await base44.entities.OutletStock.filter({ outlet_item_id: id });
            for (const stock of stocks) {
                await base44.entities.OutletStock.delete(stock.id);
            }
            
            // Delete OutletItem
            await base44.entities.OutletItem.delete(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['outlet-items', currentOutletId] });
            queryClient.invalidateQueries({ queryKey: ['outlet-stocks', currentOutletId] });
            toast.success('Artikel gelöscht');
        }
    });



    const createDeliveryMutation = useMutation({
        mutationFn: async (data) => {
            // Add outlet info to delivery
            const deliveryData = {
                ...data,
                outlet_id: currentOutletId,
                outlet_name: currentOutletName
            };
            
            const delivery = await base44.entities.Delivery.create(deliveryData);
            
            // Update outlet stock
            for (const item of data.items) {
                const outletItem = outletItems.find(a => a.id === item.article_id);
                if (!outletItem) continue;
                
                // Update or create OutletStock
                const existingStock = outletStocks.find(s => s.outlet_item_id === item.article_id);
                if (existingStock) {
                    await base44.entities.OutletStock.update(existingStock.id, {
                        on_hand_quantity: (existingStock.on_hand_quantity || 0) + item.quantity
                    });
                } else {
                    await base44.entities.OutletStock.create({
                        outlet_id: currentOutletId,
                        outlet_name: currentOutletName,
                        outlet_item_id: item.article_id,
                        global_item_id: outletItem.global_item_id,
                        display_name: item.article_name,
                        on_hand_quantity: item.quantity,
                        unit_abbreviation: item.unit_abbreviation
                    });
                }
                
                // Create stock movement
                await base44.entities.StockMovement.create({
                    movement_date: data.delivery_date,
                    movement_type: 'purchase',
                    outlet_id: currentOutletId,
                    outlet_name: currentOutletName,
                    article_id: outletItem.global_item_id,
                    article_name: item.article_name,
                    delta_quantity: item.quantity,
                    unit_abbreviation: item.unit_abbreviation,
                    source_document_id: delivery.id,
                    source_document_type: 'delivery',
                    notes: `Lieferung von ${data.supplier_name}`
                });
                    
                // Update price in OutletItem if requested
                if (item.update_master_price && item.price !== outletItem.net_purchase_price) {
                    await base44.entities.OutletItem.update(item.article_id, {
                        net_purchase_price: item.price
                    });
                        
                    // Track price change
                    if (currentUser) {
                        await base44.entities.PriceHistory.create({
                            article_id: outletItem.global_item_id,
                            article_name: outletItem.display_name,
                            old_price: outletItem.net_purchase_price,
                            new_price: item.price,
                            change_date: format(new Date(), 'yyyy-MM-dd'),
                            changed_by: currentUser.email,
                            reason: 'Preisänderung bei Lieferung'
                        });
                    }
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['deliveries', currentOutletId] });
            queryClient.invalidateQueries({ queryKey: ['outlet-stocks', currentOutletId] });
            queryClient.invalidateQueries({ queryKey: ['outlet-items', currentOutletId] });
            toast.success('Lieferung erfasst');
            setShowDeliveryForm(false);
        }
    });

    const createTransferMutation = useMutation({
        mutationFn: async (data) => {
            const transfer = await base44.entities.OutletTransfer.create(data);
            
            // Create stock movements for each item
            for (const item of data.items) {
                // OUT movement from source outlet
                await base44.entities.StockMovement.create({
                    movement_date: data.transfer_date,
                    movement_type: 'outlet_transfer_out',
                    article_id: item.article_id,
                    article_name: item.article_name,
                    outlet_id: data.from_outlet_id,
                    outlet_name: data.from_outlet_name,
                    delta_quantity: -item.quantity,
                    unit_abbreviation: item.unit_abbreviation,
                    source_document_id: transfer.id,
                    source_document_type: 'transfer',
                    notes: `Transfer zu ${data.to_outlet_name}`
                });

                // IN movement to destination outlet
                await base44.entities.StockMovement.create({
                    movement_date: data.transfer_date,
                    movement_type: 'outlet_transfer_in',
                    article_id: item.article_id,
                    article_name: item.article_name,
                    outlet_id: data.to_outlet_id,
                    outlet_name: data.to_outlet_name,
                    delta_quantity: item.quantity,
                    unit_abbreviation: item.unit_abbreviation,
                    source_document_id: transfer.id,
                    source_document_type: 'transfer',
                    notes: `Transfer von ${data.from_outlet_name}`
                });
            }

            // Mark transfer as applied
            await base44.entities.OutletTransfer.update(transfer.id, { status: 'applied' });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['outlets'] });
            queryClient.invalidateQueries({ queryKey: ['articles'] });
            toast.success('Transfer erfasst und gebucht');
            setShowTransferForm(false);
        }
    });

    const createWasteMutation = useMutation({
        mutationFn: async (data) => {
            // Add outlet info
            const wasteData = {
                ...data,
                outlet_id: currentOutletId,
                outlet_name: currentOutletName
            };
            
            const waste = await base44.entities.Waste.create(wasteData);
            
            // Create stock movements and reduce outlet stock
            for (const item of data.items) {
                const outletItem = outletItems.find(oi => oi.id === item.article_id);
                
                // Reduce outlet stock
                const stock = outletStocks.find(s => s.outlet_item_id === item.article_id);
                if (stock) {
                    await base44.entities.OutletStock.update(stock.id, {
                        on_hand_quantity: Math.max(0, (stock.on_hand_quantity || 0) - item.quantity)
                    });
                }

                // Create waste stock movement
                await base44.entities.StockMovement.create({
                    movement_date: data.waste_date,
                    movement_type: 'waste',
                    outlet_id: currentOutletId,
                    outlet_name: currentOutletName,
                    article_id: outletItem?.global_item_id || item.article_id,
                    article_name: item.article_name,
                    delta_quantity: -item.quantity,
                    unit_abbreviation: item.unit_abbreviation,
                    source_document_id: waste.id,
                    source_document_type: 'waste',
                    notes: `Waste: ${item.reason}`
                });
            }

            // Mark waste as applied
            await base44.entities.Waste.update(waste.id, { status: 'applied' });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['wastes', currentOutletId] });
            queryClient.invalidateQueries({ queryKey: ['outlet-stocks', currentOutletId] });
            toast.success('Waste erfasst und Bestand reduziert');
            setShowWasteForm(false);
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

    const handleSaveTransfer = (data) => {
        createTransferMutation.mutate(data);
    };

    const handleSaveWaste = (data) => {
        createWasteMutation.mutate(data);
    };

    // Filter and sort articles (with outlet stock)
    const filteredArticles = articlesWithStock.filter(article =>
        article.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.category_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sortedArticles = [...filteredArticles].sort((a, b) => {
        if (sortBy === 'name') {
            return (a.name || '').localeCompare(b.name || '');
        } else if (sortBy === 'category') {
            const catCompare = (a.category_name || '').localeCompare(b.category_name || '');
            if (catCompare !== 0) return catCompare;
            return (a.name || '').localeCompare(b.name || '');
        }
        return 0;
    });

    const activeArticles = sortedArticles.filter(a => a.is_active !== false);

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
                    articles={articlesWithStock} 
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
                            <TabsTrigger value="waste" className="gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                <span className="hidden sm:inline">Waste</span>
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex gap-2">
                            <Select value={sortBy} onValueChange={setSortBy}>
                                <SelectTrigger className="w-[180px] bg-white">
                                    <ArrowUpDown className="w-4 h-4 mr-2" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="name">Nach Alphabet</SelectItem>
                                    <SelectItem value="category">Nach Kategorie</SelectItem>
                                </SelectContent>
                            </Select>
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
                            disabled={isAggregatorOutlet}
                            title={isAggregatorOutlet ? 'Artikel können nicht im Aggregator-Outlet angelegt werden' : ''}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Artikel
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={() => setShowDeliveryForm(true)}
                            disabled={articlesWithStock.length === 0}
                        >
                            <Truck className="w-4 h-4 mr-2" />
                            Lieferung
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={() => setShowTransferForm(true)}
                            disabled={articlesWithStock.length === 0}
                        >
                            <ArrowRightLeft className="w-4 h-4 mr-2" />
                            Outlet Transfer
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={() => setShowWasteForm(true)}
                            disabled={articlesWithStock.length === 0}
                            className="border-orange-200 text-orange-700 hover:bg-orange-50"
                        >
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            Waste
                        </Button>
                    </div>

                    <TabsContent value="articles" className="mt-0">
                        <CategoryArticleView
                            articles={activeArticles}
                            inventories={inventories}
                            onEdit={handleEditArticle}
                            onDelete={handleDeleteArticle}
                        />
                    </TabsContent>

                    <TabsContent value="consumption" className="mt-0">
                        <ConsumptionView
                            articles={articlesWithStock}
                            inventories={inventories}
                            deliveries={deliveries}
                        />
                    </TabsContent>

                    <TabsContent value="waste" className="mt-0">
                        <WasteOverview
                            wastes={wastes}
                            suppliers={suppliers}
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
                outletId={currentOutletId}
                outletName={currentOutletName}
                isAggregator={isAggregatorOutlet}
            />

            <DeliveryForm
                open={showDeliveryForm}
                onClose={() => setShowDeliveryForm(false)}
                onSave={handleSaveDelivery}
                articles={articlesWithStock}
                suppliers={suppliers}
            />

            <OutletTransferForm
                open={showTransferForm}
                onClose={() => setShowTransferForm(false)}
                onSave={handleSaveTransfer}
                articles={articlesWithStock}
                outlets={outlets}
                suppliers={suppliers}
            />

            <WasteForm
                open={showWasteForm}
                onClose={() => setShowWasteForm(false)}
                onSave={handleSaveWaste}
                articles={articlesWithStock}
                suppliers={suppliers}
            />

            {/* Overview Modals */}
            <ArticlesOverview
                open={showArticlesOverview}
                onClose={() => setShowArticlesOverview(false)}
                articles={articlesWithStock}
            />

            <LowStockOverview
                open={showLowStockOverview}
                onClose={() => setShowLowStockOverview(false)}
                articles={articlesWithStock}
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