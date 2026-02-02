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
import StockIntelligenceDashboard from '../components/analytics/StockIntelligenceDashboard';

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
    const [showStockIntelligence, setShowStockIntelligence] = useState(false);

    // Check if current outlet is aggregator
    const { data: currentOutlet } = useQuery({
        queryKey: ['current-outlet', currentOutletId],
        queryFn: () => base44.entities.Outlet.filter({ id: currentOutletId }).then(r => r[0]),
        enabled: !!currentOutletId
    });

    const isAggregatorOutlet = currentOutlet?.type === 'AGGREGATOR';

    // Data queries - for AGGREGATOR load ALL, for NORMAL load only current outlet
    const { data: allOutletStocks = [] } = useQuery({
        queryKey: ['all-outlet-stocks'],
        queryFn: () => base44.entities.OutletStock.list(),
        enabled: isAggregatorOutlet
    });

    const { data: allOutletItems = [] } = useQuery({
        queryKey: ['all-outlet-items'],
        queryFn: () => base44.entities.OutletItem.list(),
        enabled: isAggregatorOutlet
    });

    const { data: outletStocks = [], isLoading: loadingStocks } = useQuery({
        queryKey: ['outlet-stocks', currentOutletId],
        queryFn: () => base44.entities.OutletStock.filter({ outlet_id: currentOutletId }),
        enabled: !!currentOutletId && !isAggregatorOutlet
    });

    const { data: outletItems = [], isLoading: loadingArticles } = useQuery({
        queryKey: ['outlet-items', currentOutletId],
        queryFn: () => base44.entities.OutletItem.filter({ outlet_id: currentOutletId }),
        enabled: !!currentOutletId && !isAggregatorOutlet
    });

    const { data: globalItems = [] } = useQuery({
        queryKey: ['global-items'],
        queryFn: () => base44.entities.GlobalItem.list()
    });

    // Merge outlet items with outlet stock
    const articlesWithStock = React.useMemo(() => {
        if (isAggregatorOutlet) {
            // Aggregate by global_item_id across all outlets
            const aggregatedMap = new Map();
            
            allOutletItems.forEach(item => {
                const key = item.global_item_id;
                const stock = allOutletStocks.find(s => s.outlet_item_id === item.id);
                const globalItem = globalItems.find(g => g.id === item.global_item_id);
                
                if (aggregatedMap.has(key)) {
                    const existing = aggregatedMap.get(key);
                    existing.current_stock += (stock?.on_hand_quantity || 0);
                    existing.outlets.push({
                        outlet_id: item.outlet_id,
                        outlet_name: item.outlet_name,
                        stock: stock?.on_hand_quantity || 0,
                        price: item.net_purchase_price
                    });
                } else {
                    aggregatedMap.set(key, {
                        id: item.id,
                        name: item.display_name,
                        category_id: globalItem?.category_id,
                        category_name: globalItem?.category_name,
                        unit_abbreviation: stock?.unit_abbreviation || globalItem?.unit_abbreviation || '',
                        supplier_id: item.supplier_id,
                        supplier_name: item.supplier_name,
                        purchase_price: item.net_purchase_price,
                        current_stock: stock?.on_hand_quantity || 0,
                        min_stock: item.min_stock,
                        notes: item.notes,
                        is_active: item.is_active,
                        global_item_id: item.global_item_id,
                        outlets: [{
                            outlet_id: item.outlet_id,
                            outlet_name: item.outlet_name,
                            stock: stock?.on_hand_quantity || 0,
                            price: item.net_purchase_price
                        }]
                    });
                }
            });
            
            return Array.from(aggregatedMap.values());
        } else {
            // Normal outlet - show only its items
            return outletItems.map(item => {
                const stock = outletStocks.find(s => s.outlet_item_id === item.id);
                const globalItem = globalItems.find(g => g.id === item.global_item_id);
                return {
                    id: item.id,
                    name: item.display_name,
                    category_id: globalItem?.category_id,
                    category_name: globalItem?.category_name,
                    unit_id: globalItem?.unit_id,
                    unit_abbreviation: stock?.unit_abbreviation || globalItem?.unit_abbreviation || '',
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
        }
    }, [outletItems, outletStocks, allOutletItems, allOutletStocks, isAggregatorOutlet, globalItems]);

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

            // Step 4: Create StockMovement for initial stock if > 0
            if (data.initial_stock && data.initial_stock > 0) {
                await base44.entities.StockMovement.create({
                    movement_date: format(new Date(), 'yyyy-MM-dd'),
                    movement_type: 'inventory_adjustment',
                    outlet_id: currentOutletId,
                    outlet_name: currentOutletName,
                    article_id: globalItem.id,
                    article_name: data.name,
                    delta_quantity: data.initial_stock,
                    unit_abbreviation: data.unit_abbreviation,
                    notes: 'Anfangsbestand bei Artikelanlage'
                });
            }

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

            // Update stock if initial_stock was changed
            if (data.initial_stock !== undefined && data.initial_stock !== null) {
                const stock = outletStocks.find(s => s.outlet_item_id === id);
                if (stock) {
                    const oldQuantity = stock.on_hand_quantity || 0;
                    const newQuantity = data.initial_stock;
                    const difference = newQuantity - oldQuantity;

                    if (difference !== 0) {
                        // Update OutletStock
                        await base44.entities.OutletStock.update(stock.id, {
                            on_hand_quantity: newQuantity
                        });

                        // Create StockMovement for the adjustment
                        await base44.entities.StockMovement.create({
                            movement_date: format(new Date(), 'yyyy-MM-dd'),
                            movement_type: 'inventory_adjustment',
                            outlet_id: currentOutletId,
                            outlet_name: currentOutletName,
                            article_id: outletItem.global_item_id,
                            article_name: data.name,
                            delta_quantity: difference,
                            unit_abbreviation: data.unit_abbreviation,
                            notes: 'Bestandsanpassung bei Artikelbearbeitung'
                        });
                    }
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['outlet-items', currentOutletId] });
            queryClient.invalidateQueries({ queryKey: ['outlet-stocks', currentOutletId] });
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
            
            // Process each item
            for (const item of data.items) {
                // Get source OutletItem to find global_item_id
                const sourceOutletItems = await base44.entities.OutletItem.filter({ 
                    outlet_id: data.from_outlet_id,
                    id: item.article_id
                });
                const sourceOutletItem = sourceOutletItems[0];
                
                if (!sourceOutletItem) continue;

                // 1. REDUCE stock in source outlet
                const sourceStocks = await base44.entities.OutletStock.filter({ 
                    outlet_id: data.from_outlet_id,
                    outlet_item_id: item.article_id
                });
                const sourceStock = sourceStocks[0];
                
                if (sourceStock) {
                    await base44.entities.OutletStock.update(sourceStock.id, {
                        on_hand_quantity: Math.max(0, (sourceStock.on_hand_quantity || 0) - item.quantity)
                    });
                }

                // 2. Check if article exists in destination outlet
                const destOutletItems = await base44.entities.OutletItem.filter({
                    outlet_id: data.to_outlet_id,
                    global_item_id: sourceOutletItem.global_item_id
                });
                
                let destOutletItem;
                if (destOutletItems.length === 0) {
                    // Article doesn't exist in destination - create it
                    destOutletItem = await base44.entities.OutletItem.create({
                        outlet_id: data.to_outlet_id,
                        outlet_name: data.to_outlet_name,
                        global_item_id: sourceOutletItem.global_item_id,
                        display_name: item.article_name,
                        supplier_id: sourceOutletItem.supplier_id,
                        supplier_name: sourceOutletItem.supplier_name,
                        net_purchase_price: sourceOutletItem.net_purchase_price,
                        min_stock: sourceOutletItem.min_stock,
                        inventory_intervals: sourceOutletItem.inventory_intervals || [],
                        notes: `Automatisch angelegt durch Transfer von ${data.from_outlet_name}`,
                        is_active: true
                    });

                    // Create initial stock for new article
                    await base44.entities.OutletStock.create({
                        outlet_id: data.to_outlet_id,
                        outlet_name: data.to_outlet_name,
                        outlet_item_id: destOutletItem.id,
                        global_item_id: sourceOutletItem.global_item_id,
                        display_name: item.article_name,
                        on_hand_quantity: item.quantity,
                        unit_abbreviation: item.unit_abbreviation
                    });
                } else {
                    // Article exists - update stock
                    destOutletItem = destOutletItems[0];
                    const destStocks = await base44.entities.OutletStock.filter({
                        outlet_id: data.to_outlet_id,
                        outlet_item_id: destOutletItem.id
                    });
                    
                    const destStock = destStocks[0];
                    if (destStock) {
                        await base44.entities.OutletStock.update(destStock.id, {
                            on_hand_quantity: (destStock.on_hand_quantity || 0) + item.quantity
                        });
                    } else {
                        // Stock record doesn't exist - create it
                        await base44.entities.OutletStock.create({
                            outlet_id: data.to_outlet_id,
                            outlet_name: data.to_outlet_name,
                            outlet_item_id: destOutletItem.id,
                            global_item_id: sourceOutletItem.global_item_id,
                            display_name: item.article_name,
                            on_hand_quantity: item.quantity,
                            unit_abbreviation: item.unit_abbreviation
                        });
                    }
                }

                // 3. Create stock movements
                // OUT movement from source outlet
                await base44.entities.StockMovement.create({
                    movement_date: data.transfer_date,
                    movement_type: 'outlet_transfer_out',
                    article_id: sourceOutletItem.global_item_id,
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
                    article_id: sourceOutletItem.global_item_id,
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
            queryClient.invalidateQueries({ queryKey: ['outlet-items'] });
            queryClient.invalidateQueries({ queryKey: ['outlet-stocks'] });
            queryClient.invalidateQueries({ queryKey: ['all-outlet-items'] });
            queryClient.invalidateQueries({ queryKey: ['all-outlet-stocks'] });
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
        } else if (sortBy === 'quantity') {
            const qtyA = a.current_stock || 0;
            const qtyB = b.current_stock || 0;
            return qtyB - qtyA; // Höchste Menge zuerst
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
                        <div className="flex items-center gap-4">
                            <img 
                                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6975d510bbe0422af7fe76ca/19feb6d1b_ChatGPTImage1Feb202616_14_34.png" 
                                alt="Kolek Schröder Logo" 
                                className="h-12 w-auto"
                            />
                            <div>
                                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                                    Bestandsverwaltung
                                </h1>
                                <p className="text-sm text-slate-500 hidden sm:block">
                                    Inventar & Verbrauch
                                </p>
                            </div>
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
                                onClick={() => {
                                    queryClient.invalidateQueries({ queryKey: ['outlet-stocks'] });
                                    queryClient.invalidateQueries({ queryKey: ['outlet-items'] });
                                    queryClient.invalidateQueries({ queryKey: ['all-outlet-stocks'] });
                                    queryClient.invalidateQueries({ queryKey: ['all-outlet-items'] });
                                    queryClient.invalidateQueries({ queryKey: ['deliveries'] });
                                    queryClient.invalidateQueries({ queryKey: ['inventorySessions'] });
                                    queryClient.invalidateQueries({ queryKey: ['wastes'] });
                                    toast.success('Daten aktualisiert');
                                }}
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

                {/* Stock Intelligence Dashboard Button */}
                {!isAggregatorOutlet && (
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-6 text-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <BarChart3 className="w-6 h-6" />
                                    Stock Intelligence
                                </h3>
                                <p className="text-sm text-indigo-100 mt-1">
                                    Verbrauch & Waste im Überblick – Analysieren Sie Ihre Daten
                                </p>
                            </div>
                            <Button 
                                onClick={() => setShowStockIntelligence(true)}
                                className="bg-white text-indigo-600 hover:bg-indigo-50"
                            >
                                Dashboard öffnen
                            </Button>
                        </div>
                    </div>
                )}

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
                                    <SelectItem value="quantity">Nach Menge</SelectItem>
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
                    {!isAggregatorOutlet && (
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
                    )}

                    {isAggregatorOutlet && (
                        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-blue-800">
                                <strong>Zentrale Übersicht:</strong> Dieser Bereich zeigt die aggregierten Bestände aller Outlets. 
                                Keine Buchungen möglich - nur zur Übersicht.
                            </p>
                        </div>
                    )}

                    <TabsContent value="articles" className="mt-0">
                        <CategoryArticleView
                            articles={activeArticles}
                            inventories={inventories}
                            onEdit={isAggregatorOutlet ? null : handleEditArticle}
                            onDelete={isAggregatorOutlet ? null : handleDeleteArticle}
                            isAggregator={isAggregatorOutlet}
                        />
                    </TabsContent>

                    <TabsContent value="consumption" className="mt-0">
                        <ConsumptionView
                            articles={articlesWithStock}
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
                outletName={currentOutletName}
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

            {/* Stock Intelligence Dashboard */}
            {showStockIntelligence && (
                <StockIntelligenceDashboard
                    currentOutletId={currentOutletId}
                    currentOutletName={currentOutletName}
                    onClose={() => setShowStockIntelligence(false)}
                />
            )}
            </div>
            );
            }