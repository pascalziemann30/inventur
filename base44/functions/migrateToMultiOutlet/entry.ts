import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const results = {
            outlets_created: 0,
            outlet_stocks_created: 0,
            deliveries_updated: 0,
            wastes_updated: 0,
            inventory_sessions_updated: 0,
            stock_movements_updated: 0,
            errors: []
        };

        // 1. Check if default outlet exists
        let defaultOutlet = (await base44.asServiceRole.entities.Outlet.filter({ code: 'DEFAULT' }))[0];
        
        if (!defaultOutlet) {
            // Create default outlet
            defaultOutlet = await base44.asServiceRole.entities.Outlet.create({
                name: 'Hauptstandort',
                code: 'DEFAULT',
                address: '',
                is_active: true
            });
            results.outlets_created = 1;
        }

        // 2. Migrate Article stock to OutletStock
        const articles = await base44.asServiceRole.entities.Article.list();
        
        for (const article of articles) {
            try {
                // Check if OutletStock already exists
                const existingStock = await base44.asServiceRole.entities.OutletStock.filter({
                    outlet_id: defaultOutlet.id,
                    article_id: article.id
                });

                if (existingStock.length === 0) {
                    await base44.asServiceRole.entities.OutletStock.create({
                        outlet_id: defaultOutlet.id,
                        outlet_name: defaultOutlet.name,
                        article_id: article.id,
                        article_name: article.name,
                        on_hand_quantity: article.current_stock || 0,
                        unit_abbreviation: article.unit_abbreviation
                    });
                    results.outlet_stocks_created++;
                }
            } catch (error) {
                results.errors.push(`Article ${article.id}: ${error.message}`);
            }
        }

        // 3. Update Deliveries to have outlet_id
        const deliveries = await base44.asServiceRole.entities.Delivery.list();
        for (const delivery of deliveries) {
            if (!delivery.outlet_id) {
                try {
                    await base44.asServiceRole.entities.Delivery.update(delivery.id, {
                        outlet_id: defaultOutlet.id,
                        outlet_name: defaultOutlet.name
                    });
                    results.deliveries_updated++;
                } catch (error) {
                    results.errors.push(`Delivery ${delivery.id}: ${error.message}`);
                }
            }
        }

        // 4. Update Wastes to have outlet_id
        const wastes = await base44.asServiceRole.entities.Waste.list();
        for (const waste of wastes) {
            if (!waste.outlet_id) {
                try {
                    await base44.asServiceRole.entities.Waste.update(waste.id, {
                        outlet_id: defaultOutlet.id,
                        outlet_name: defaultOutlet.name
                    });
                    results.wastes_updated++;
                } catch (error) {
                    results.errors.push(`Waste ${waste.id}: ${error.message}`);
                }
            }
        }

        // 5. Update InventorySessions to have outlet_id
        const sessions = await base44.asServiceRole.entities.InventorySession.list();
        for (const session of sessions) {
            if (!session.outlet_id) {
                try {
                    await base44.asServiceRole.entities.InventorySession.update(session.id, {
                        outlet_id: defaultOutlet.id,
                        outlet_name: defaultOutlet.name
                    });
                    results.inventory_sessions_updated++;
                } catch (error) {
                    results.errors.push(`InventorySession ${session.id}: ${error.message}`);
                }
            }
        }

        // 6. Update StockMovements to have outlet_id
        const movements = await base44.asServiceRole.entities.StockMovement.list();
        for (const movement of movements) {
            if (!movement.outlet_id) {
                try {
                    await base44.asServiceRole.entities.StockMovement.update(movement.id, {
                        outlet_id: defaultOutlet.id,
                        outlet_name: defaultOutlet.name
                    });
                    results.stock_movements_updated++;
                } catch (error) {
                    results.errors.push(`StockMovement ${movement.id}: ${error.message}`);
                }
            }
        }

        return Response.json({
            success: true,
            message: 'Migration completed',
            default_outlet: defaultOutlet,
            results
        });

    } catch (error) {
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});