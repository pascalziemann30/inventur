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
    BarChart2,
    Package,
    Box,
    RefreshCw,
    ArrowUpDown,
    ArrowRightLeft,
    ArrowRight,
    AlertTriangle,
    Trash2,
    ClipboardList,
    LogOut
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
import EmployeeActivityList from '../components/inventory/EmployeeActivityList';

export default function Dashboard() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { currentOutletId, currentOutletName } = useOutlet();
    const [searchTerm, setSearchTerm] = useState('');
    const userRole = localStorage.getItem('user_role');
    const isEmployee = userRole === 'employee';
    const [activeTab, setActiveTab] = useState(isEmployee ? 'consumption' : 'articles');
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

    // Computed values for employee view
    const lowStockCount = articlesWithStock.filter(a => a.is_active !== false && a.min_stock && a.current_stock < a.min_stock).length;

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['outlet-stocks'] });
        queryClient.invalidateQueries({ queryKey: ['outlet-items'] });
        queryClient.invalidateQueries({ queryKey: ['all-outlet-stocks'] });
        queryClient.invalidateQueries({ queryKey: ['all-outlet-items'] });
        queryClient.invalidateQueries({ queryKey: ['deliveries'] });
        queryClient.invalidateQueries({ queryKey: ['inventorySessions'] });
        queryClient.invalidateQueries({ queryKey: ['wastes'] });
        toast.success('Daten aktualisiert');
    };

    // --- EMPLOYEE VIEW ---
    if (isEmployee) {
        const now = new Date();
        const monthName = now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        const lastDayNum = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const shortMonth = now.toLocaleDateString('de-DE', { month: 'short' });

        const handleLogout = () => {
            localStorage.removeItem('user_role');
            navigate('/OutletLogin');
        };

        const movementTypeIcon = (type) => {
            if (type === 'purchase') return <Truck className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
            if (type === 'waste') return <Trash2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
            if (type === 'outlet_transfer_in' || type === 'outlet_transfer_out') return <ArrowRightLeft className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
            return <ClipboardList className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
        };

        const movementTypeLabel = (type) => {
            if (type === 'purchase') return 'Lieferung';
            if (type === 'waste') return 'Waste';
            if (type === 'outlet_transfer_in') return 'Transfer eingehend';
            if (type === 'outlet_transfer_out') return 'Transfer ausgehend';
            if (type === 'inventory_adjustment') return 'Inventur';
            return type;
        };

        return (
            <div className="min-h-screen bg-background">
                {/* Header */}
                <div className="px-4 sm:px-6 pt-6 pb-2 flex items-center justify-between max-w-2xl mx-auto">
                    <div>
                        <p className="text-base font-semibold text-foreground">{currentOutletName}</p>
                        <p className="text-sm text-muted-foreground">{monthName}</p>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={handleRefresh} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <button onClick={handleLogout} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 space-y-6">
                    {/* Aktionen & Übersicht — 5 Kacheln */}
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">Aktionen & Übersicht</p>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                            {/* Inventur starten */}
                            <Link to={createPageUrl('InventoryCapture')} className="block relative">
                                <div className="bg-card border-2 border-border rounded-2xl p-4 hover:bg-accent transition-colors cursor-pointer flex flex-col items-center text-center">
                                    <span className="absolute top-2 right-2 text-[9px] font-semibold bg-destructive/10 text-destructive rounded-full px-1.5 py-0.5">!</span>
                                    <ClipboardList className="w-5 h-5 text-foreground mb-2" />
                                    <p className="text-xs font-semibold text-foreground leading-tight">Inventur starten</p>
                                </div>
                            </Link>
                            {/* Lieferung */}
                            <div
                                onClick={() => setShowDeliveryForm(true)}
                                className="bg-muted border border-border rounded-2xl p-4 hover:bg-accent transition-colors cursor-pointer flex flex-col items-center text-center"
                            >
                                <Truck className="w-5 h-5 text-foreground mb-2" />
                                <p className="text-xs font-medium text-foreground">Lieferung</p>
                            </div>
                            {/* Waste */}
                            <div
                                onClick={() => setShowWasteForm(true)}
                                className="bg-muted border border-border rounded-2xl p-4 hover:bg-accent transition-colors cursor-pointer flex flex-col items-center text-center"
                            >
                                <Trash2 className="w-5 h-5 text-foreground mb-2" />
                                <p className="text-xs font-medium text-foreground">Waste</p>
                            </div>
                            {/* Transfer */}
                            <div
                                onClick={() => setShowTransferForm(true)}
                                className="bg-muted border border-border rounded-2xl p-4 hover:bg-accent transition-colors cursor-pointer flex flex-col items-center text-center"
                            >
                                <ArrowRightLeft className="w-5 h-5 text-foreground mb-2" />
                                <p className="text-xs font-medium text-foreground">Transfer</p>
                            </div>
                            {/* Niedrigbestand */}
                            <div
                                onClick={() => setShowLowStockOverview(true)}
                                className="bg-amber-50 border border-amber-200 rounded-2xl p-4 cursor-pointer hover:bg-amber-100 transition-colors flex flex-col items-center text-center"
                            >
                                <AlertTriangle className="w-5 h-5 text-amber-500 mb-2" />
                                <p className="text-xl font-semibold text-amber-600">{lowStockCount}</p>
                                <p className="text-xs font-medium text-amber-600 leading-tight">Niedrig­bestand</p>
                            </div>
                        </div>
                    </div>

                    {/* Letzte Aktivität */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                                Letzte Aktivität — {monthName}
                            </p>
                            <p className="text-xs text-muted-foreground">1.–{lastDayNum}. {shortMonth}</p>
                        </div>
                        <EmployeeActivityList
                            outletId={currentOutletId}
                            firstDay={firstDay}
                            lastDay={lastDay}
                            movementTypeIcon={movementTypeIcon}
                            movementTypeLabel={movementTypeLabel}
                        />
                    </div>
                </div>

                {/* Modals */}
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
                    categories={categories}
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

    const handleAdminLogout = () => {
        localStorage.removeItem('user_role');
        navigate('/OutletLogin');
    };

    // --- ADMIN VIEW ---
    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="bg-muted border-b border-border sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-base font-semibold text-foreground">{currentOutletName}</span>
                            <span className="text-xs border border-border rounded-md px-2 py-0.5 text-muted-foreground">Admin</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={handleRefresh} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                                <RefreshCw className="w-4 h-4" />
                                <span className="hidden sm:inline">Aktualisieren</span>
                            </button>
                            <button onClick={handleAdminLogout} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                                <LogOut className="w-4 h-4" />
                                <span className="hidden sm:inline">Logout</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

                {/* Abschnitt 1 — Überblick */}
                <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">Überblick</p>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                        {/* Inventur starten */}
                        <Link to={createPageUrl('InventoryCapture')} className="block">
                            <div className="bg-muted border border-border rounded-2xl p-4 hover:bg-accent transition-colors cursor-pointer flex flex-col items-center text-center h-full">
                                <ClipboardList className="w-5 h-5 text-foreground mb-2" />
                                <p className="text-xs font-semibold text-foreground leading-tight">Inventur starten</p>
                            </div>
                        </Link>
                        {/* Artikel */}
                        <div
                            onClick={() => setShowArticlesOverview(true)}
                            className="bg-muted border border-border rounded-2xl p-4 cursor-pointer hover:bg-accent transition-colors"
                        >
                            <Box className="w-4 h-4 text-muted-foreground mb-1" />
                            <p className="text-2xl font-semibold text-foreground">{articlesWithStock.filter(a => a.is_active !== false).length}</p>
                            <p className="text-xs text-muted-foreground">Artikel</p>
                        </div>
                        {/* Niedrigbestand */}
                        <div
                            onClick={() => setShowLowStockOverview(true)}
                            className="bg-amber-50 border border-amber-200 rounded-2xl p-4 cursor-pointer hover:bg-amber-100 transition-colors"
                        >
                            <AlertTriangle className="w-4 h-4 text-amber-500 mb-1" />
                            <p className="text-2xl font-semibold text-amber-600">{lowStockCount}</p>
                            <p className="text-xs text-amber-500">Niedrigbestand</p>
                        </div>
                        {/* Inventuren */}
                        <div
                            onClick={() => setShowInventoriesOverview(true)}
                            className="bg-muted border border-border rounded-2xl p-4 cursor-pointer hover:bg-accent transition-colors"
                        >
                            <ClipboardCheck className="w-4 h-4 text-muted-foreground mb-1" />
                            <p className="text-2xl font-semibold text-foreground">{inventorySessions.length}</p>
                            <p className="text-xs text-muted-foreground">Inventuren</p>
                        </div>
                        {/* Lieferungen */}
                        <div
                            onClick={() => setShowDeliveriesOverview(true)}
                            className="bg-muted border border-border rounded-2xl p-4 cursor-pointer hover:bg-accent transition-colors"
                        >
                            <Truck className="w-4 h-4 text-muted-foreground mb-1" />
                            <p className="text-2xl font-semibold text-foreground">{deliveries.length}</p>
                            <p className="text-xs text-muted-foreground">Lieferungen</p>
                        </div>
                    </div>
                </div>

                {/* Abschnitt 2 — Analyse */}
                {!isAggregatorOutlet && (
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3 mt-6">Analyse</p>
                        <div
                            onClick={() => setShowStockIntelligence(true)}
                            className="bg-muted border border-border rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:bg-accent transition-colors"
                        >
                            <div className="w-8 h-8 bg-card border border-border rounded-xl flex items-center justify-center flex-shrink-0">
                                <BarChart2 className="w-4 h-4 text-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground">Stock Intelligence</p>
                                <p className="text-xs text-muted-foreground">Verbrauch & Waste im Überblick</p>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                                <span>Öffnen</span>
                                <ArrowRight className="w-3 h-3" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Abschnitt 3 — Artikelverwaltung */}
                <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3 mt-6">Artikelverwaltung</p>

                    {isAggregatorOutlet && (
                        <div className="mb-4 p-4 rounded-lg" style={{ background: '#e8f0e4', border: '0.5px solid #c8d5c0' }}>
                            <p className="text-sm" style={{ color: '#2d4a2d' }}>
                                <strong>Zentrale Übersicht:</strong> Dieser Bereich zeigt die aggregierten Bestände aller Outlets. 
                                Keine Buchungen möglich - nur zur Übersicht.
                            </p>
                        </div>
                    )}

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        {/* Zeile 1: Tabs + Aktions-Buttons */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                            {/* Tab-Leiste */}
                            <TabsList className="p-0 h-auto rounded-lg overflow-hidden w-fit" style={{ border: '0.5px solid #c8d5c0', background: 'transparent' }}>
                                <TabsTrigger
                                    value="articles"
                                    className="rounded-none text-xs px-3.5 py-1.5 border-0 data-[state=active]:shadow-none data-[state=active]:font-medium"
                                    style={{
                                        borderRight: '0.5px solid #c8d5c0',
                                    }}
                                    data-active-style={{ background: '#e8f0e4', color: '#2d4a2d' }}
                                >
                                    <span className="data-[state=active]:text-[#2d4a2d]">Artikel</span>
                                </TabsTrigger>
                                <TabsTrigger
                                    value="consumption"
                                    className="rounded-none text-xs px-3.5 py-1.5 border-0 data-[state=active]:shadow-none data-[state=active]:font-medium"
                                    style={{ borderRight: '0.5px solid #c8d5c0' }}
                                >
                                    Verbrauch
                                </TabsTrigger>
                                <TabsTrigger
                                    value="waste"
                                    className="rounded-none text-xs px-3.5 py-1.5 border-0 data-[state=active]:shadow-none data-[state=active]:font-medium"
                                >
                                    Waste
                                </TabsTrigger>
                            </TabsList>

                            {/* Aktions-Buttons */}
                            {!isAggregatorOutlet && (
                                <div className="flex items-center gap-1.5 flex-nowrap">
                                    <button
                                        onClick={() => { setEditingArticle(null); setShowArticleForm(true); }}
                                        className="flex items-center gap-1 whitespace-nowrap rounded-lg text-xs transition-colors hover:opacity-80"
                                        style={{ border: '0.5px solid var(--border)', color: 'var(--foreground)', background: 'var(--card)', padding: '5px 10px' }}
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Artikel anlegen
                                    </button>
                                    <button
                                        onClick={() => setShowDeliveryForm(true)}
                                        disabled={articlesWithStock.length === 0}
                                        className="flex items-center gap-1 whitespace-nowrap rounded-lg text-xs transition-colors hover:opacity-80 disabled:opacity-40"
                                        style={{ border: '0.5px solid var(--border)', color: 'var(--foreground)', background: 'var(--card)', padding: '5px 10px' }}
                                    >
                                        <Truck className="w-3.5 h-3.5" />
                                        Lieferung
                                    </button>
                                    <button
                                        onClick={() => setShowTransferForm(true)}
                                        disabled={articlesWithStock.length === 0}
                                        className="flex items-center gap-1 whitespace-nowrap rounded-lg text-xs transition-colors hover:opacity-80 disabled:opacity-40"
                                        style={{ border: '0.5px solid var(--border)', color: 'var(--foreground)', background: 'var(--card)', padding: '5px 10px' }}
                                    >
                                        <ArrowRightLeft className="w-3.5 h-3.5" />
                                        Outlet Transfer
                                    </button>
                                    <button
                                        onClick={() => setShowWasteForm(true)}
                                        disabled={articlesWithStock.length === 0}
                                        className="flex items-center gap-1 whitespace-nowrap rounded-lg text-xs transition-colors hover:opacity-80 disabled:opacity-40"
                                        style={{ border: '0.5px solid #e8c8a0', color: '#a06020', background: 'var(--card)', padding: '5px 10px' }}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Waste
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Zeile 2: Suche + Sortierung */}
                        <div className="flex items-center gap-1.5 mb-4" style={{ marginTop: '8px' }}>
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} />
                                <input
                                    placeholder="Suchen..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full text-xs outline-none transition-colors"
                                    style={{
                                        border: '0.5px solid var(--border)',
                                        borderRadius: '8px',
                                        padding: '5px 10px 5px 28px',
                                        background: 'var(--muted)',
                                        color: 'var(--muted-foreground)',
                                    }}
                                />
                            </div>
                            <Select value={sortBy} onValueChange={setSortBy}>
                                <SelectTrigger
                                    className="h-auto text-xs whitespace-nowrap w-auto"
                                    style={{
                                        border: '0.5px solid var(--border)',
                                        borderRadius: '8px',
                                        padding: '5px 10px',
                                        background: 'var(--card)',
                                        color: 'var(--muted-foreground)',
                                    }}
                                >
                                    <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="name">Nach Alphabet</SelectItem>
                                    <SelectItem value="quantity">Nach Menge</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

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
                            <ConsumptionView articles={articlesWithStock} />
                        </TabsContent>

                        <TabsContent value="waste" className="mt-0">
                            <WasteOverview wastes={wastes} suppliers={suppliers} />
                        </TabsContent>
                    </Tabs>
                </div>
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
                allArticles={outletItems}
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
                categories={categories}
            />
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