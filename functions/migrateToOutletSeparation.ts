import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const logs = [];
        
        // Step 1: Get or create "Kuno" outlet
        logs.push('Step 1: Sicherstelle Outlet "Kuno"...');
        const outlets = await base44.asServiceRole.entities.Outlet.list();
        let kunoOutlet = outlets.find(o => o.name === 'Kuno' || o.code === 'KUNO');
        
        if (!kunoOutlet) {
            kunoOutlet = await base44.asServiceRole.entities.Outlet.create({
                name: 'Kuno',
                code: 'KUNO',
                type: 'NORMAL',
                is_active: true
            });
            logs.push(`✓ Outlet "Kuno" erstellt: ${kunoOutlet.id}`);
        } else {
            // Update type if needed
            await base44.asServiceRole.entities.Outlet.update(kunoOutlet.id, {
                type: 'NORMAL'
            });
            logs.push(`✓ Outlet "Kuno" gefunden: ${kunoOutlet.id}`);
        }

        // Step 2: Create aggregator outlet "Kolek Schröder GbR"
        logs.push('Step 2: Erstelle Aggregator-Outlet...');
        let aggregatorOutlet = outlets.find(o => o.name === 'Kolek Schröder GbR');
        
        if (!aggregatorOutlet) {
            aggregatorOutlet = await base44.asServiceRole.entities.Outlet.create({
                name: 'Kolek Schröder GbR',
                code: 'AGGREGATOR',
                type: 'AGGREGATOR',
                is_active: true
            });
            logs.push(`✓ Aggregator-Outlet erstellt: ${aggregatorOutlet.id}`);
        } else {
            await base44.asServiceRole.entities.Outlet.update(aggregatorOutlet.id, {
                type: 'AGGREGATOR'
            });
            logs.push(`✓ Aggregator-Outlet aktualisiert: ${aggregatorOutlet.id}`);
        }

        // Step 3: Migrate Articles to GlobalItems and OutletItems
        logs.push('Step 3: Migriere Articles zu GlobalItems und OutletItems...');
        const articles = await base44.asServiceRole.entities.Article.list();
        const globalItemMap = new Map(); // article_id -> global_item_id
        
        for (const article of articles) {
            // Create GlobalItem
            const globalItem = await base44.asServiceRole.entities.GlobalItem.create({
                canonical_name: article.name,
                unit_id: article.unit_id,
                unit_abbreviation: article.unit_abbreviation,
                category_id: article.category_id,
                category_name: article.category_name,
                default_net_price: article.purchase_price,
                notes: article.notes
            });
            
            globalItemMap.set(article.id, globalItem.id);
            
            // Create OutletItem for Kuno
            const outletItem = await base44.asServiceRole.entities.OutletItem.create({
                outlet_id: kunoOutlet.id,
                outlet_name: kunoOutlet.name,
                global_item_id: globalItem.id,
                display_name: article.name,
                supplier_id: article.supplier_id,
                supplier_name: article.supplier_name,
                net_purchase_price: article.purchase_price || 0,
                min_stock: article.min_stock,
                inventory_intervals: article.inventory_intervals || [],
                notes: article.notes,
                is_active: article.is_active !== false
            });
            
            // Migrate OutletStock
            const existingStocks = await base44.asServiceRole.entities.OutletStock.filter({ 
                outlet_id: kunoOutlet.id,
                article_id: article.id 
            });
            
            if (existingStocks.length > 0) {
                // Update existing stock
                for (const stock of existingStocks) {
                    await base44.asServiceRole.entities.OutletStock.update(stock.id, {
                        outlet_item_id: outletItem.id,
                        global_item_id: globalItem.id,
                        display_name: article.name
                    });
                }
            } else {
                // Create new stock entry
                await base44.asServiceRole.entities.OutletStock.create({
                    outlet_id: kunoOutlet.id,
                    outlet_name: kunoOutlet.name,
                    outlet_item_id: outletItem.id,
                    global_item_id: globalItem.id,
                    display_name: article.name,
                    on_hand_quantity: article.current_stock || 0,
                    unit_abbreviation: article.unit_abbreviation
                });
            }
            
            logs.push(`✓ Migriert: ${article.name} -> GlobalItem + OutletItem`);
        }

        // Step 4: Update StockMovements with outlet_item_id and global_item_id
        logs.push('Step 4: Aktualisiere StockMovements...');
        const movements = await base44.asServiceRole.entities.StockMovement.list();
        
        for (const movement of movements) {
            if (!movement.outlet_id) {
                await base44.asServiceRole.entities.StockMovement.update(movement.id, {
                    outlet_id: kunoOutlet.id,
                    outlet_name: kunoOutlet.name
                });
            }
        }
        logs.push(`✓ ${movements.length} StockMovements aktualisiert`);

        // Step 5: Mark Article entity as legacy (optional - keep for reference)
        logs.push('Step 5: Migration abgeschlossen!');
        logs.push(`✓ ${articles.length} Artikel migriert`);
        logs.push(`✓ Outlet "Kuno" bereit mit allen Artikeln`);
        logs.push(`✓ Aggregator-Outlet "Kolek Schröder GbR" erstellt`);
        logs.push('');
        logs.push('WICHTIG: Die Article-Entity bleibt vorerst bestehen (Legacy).');
        logs.push('Alle neuen Outlets starten leer und müssen eigene Artikel anlegen.');

        return Response.json({
            success: true,
            kunoOutletId: kunoOutlet.id,
            aggregatorOutletId: aggregatorOutlet.id,
            articlesProcessed: articles.length,
            logs
        });

    } catch (error) {
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});