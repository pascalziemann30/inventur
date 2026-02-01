import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
        }

        // Find Kuno15 outlet
        const kuno15Outlets = await base44.entities.Outlet.filter({ code: 'KUNO15' });
        if (kuno15Outlets.length === 0) {
            return Response.json({ error: 'Kuno15 Outlet nicht gefunden' }, { status: 404 });
        }
        const kuno15 = kuno15Outlets[0];

        // Get all old Articles
        const articles = await base44.entities.Article.list();
        
        // Get existing OutletItems for Kuno15
        const existingItems = await base44.entities.OutletItem.filter({ outlet_id: kuno15.id });
        const existingGlobalIds = new Set(existingItems.map(i => i.global_item_id));

        const results = {
            total: articles.length,
            created: 0,
            skipped: 0,
            errors: []
        };

        for (const article of articles) {
            try {
                // Check if GlobalItem exists for this article
                const globalItems = await base44.entities.GlobalItem.filter({
                    canonical_name: article.name,
                    unit_abbreviation: article.unit_abbreviation
                });

                let globalItem;
                if (globalItems.length > 0) {
                    globalItem = globalItems[0];
                    
                    // Skip if already exists as OutletItem
                    if (existingGlobalIds.has(globalItem.id)) {
                        results.skipped++;
                        continue;
                    }
                } else {
                    // Create GlobalItem
                    globalItem = await base44.asServiceRole.entities.GlobalItem.create({
                        canonical_name: article.name,
                        unit_id: article.unit_id,
                        unit_abbreviation: article.unit_abbreviation,
                        category_id: article.category_id,
                        category_name: article.category_name,
                        default_net_price: article.purchase_price,
                        notes: article.notes
                    });
                }

                // Create OutletItem for Kuno15
                const outletItem = await base44.asServiceRole.entities.OutletItem.create({
                    outlet_id: kuno15.id,
                    outlet_name: kuno15.name,
                    global_item_id: globalItem.id,
                    display_name: article.name,
                    supplier_id: article.supplier_id,
                    supplier_name: article.supplier_name,
                    net_purchase_price: article.purchase_price || 0,
                    min_stock: article.min_stock,
                    inventory_intervals: article.inventory_intervals || [],
                    notes: article.notes || '',
                    is_active: article.is_active !== false
                });

                // Create OutletStock with current stock from Article
                await base44.asServiceRole.entities.OutletStock.create({
                    outlet_id: kuno15.id,
                    outlet_name: kuno15.name,
                    outlet_item_id: outletItem.id,
                    global_item_id: globalItem.id,
                    display_name: article.name,
                    on_hand_quantity: article.current_stock || 0,
                    unit_abbreviation: article.unit_abbreviation
                });

                results.created++;
            } catch (error) {
                results.errors.push({ article: article.name, error: error.message });
            }
        }

        return Response.json({
            success: true,
            message: `Wiederherstellung abgeschlossen für Kuno15`,
            results
        });
    } catch (error) {
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});