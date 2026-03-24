import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        // Only admins can merge suppliers
        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        // Get all suppliers
        const suppliers = await base44.asServiceRole.entities.Supplier.list();

        // Group suppliers by normalized name
        const groupedByName = new Map();
        
        suppliers.forEach(supplier => {
            const normalizedName = supplier.name.trim().toLowerCase();
            if (!groupedByName.has(normalizedName)) {
                groupedByName.set(normalizedName, []);
            }
            groupedByName.get(normalizedName).push(supplier);
        });

        // Find duplicates
        const duplicates = [];
        groupedByName.forEach((group, name) => {
            if (group.length > 1) {
                duplicates.push({
                    name: group[0].name,
                    count: group.length,
                    suppliers: group
                });
            }
        });

        if (duplicates.length === 0) {
            return Response.json({ 
                success: true, 
                message: 'Keine doppelten Lieferanten gefunden',
                merged: 0
            });
        }

        let mergedCount = 0;
        const mergeLog = [];

        // Merge each duplicate group
        for (const duplicate of duplicates) {
            const master = duplicate.suppliers[0]; // Keep the first one
            const toMerge = duplicate.suppliers.slice(1);
            const idsToMerge = toMerge.map(s => s.id);

            mergeLog.push({
                masterName: master.name,
                masterId: master.id,
                merged: toMerge.map(s => ({ id: s.id, name: s.name }))
            });

            // Update OutletItems
            const outletItems = await base44.asServiceRole.entities.OutletItem.list();
            for (const item of outletItems) {
                if (idsToMerge.includes(item.supplier_id)) {
                    await base44.asServiceRole.entities.OutletItem.update(item.id, {
                        supplier_id: master.id,
                        supplier_name: master.name
                    });
                }
            }

            // Update Deliveries
            const deliveries = await base44.asServiceRole.entities.Delivery.list();
            for (const delivery of deliveries) {
                if (idsToMerge.includes(delivery.supplier_id)) {
                    await base44.asServiceRole.entities.Delivery.update(delivery.id, {
                        supplier_id: master.id,
                        supplier_name: master.name
                    });
                }
            }

            // Update Waste items (stored as JSON array, need to update supplier_name)
            const wastes = await base44.asServiceRole.entities.Waste.list();
            for (const waste of wastes) {
                let updated = false;
                const updatedItems = (waste.items || []).map(item => {
                    const matchingSupplier = toMerge.find(s => s.name === item.supplier_name);
                    if (matchingSupplier) {
                        updated = true;
                        return { ...item, supplier_name: master.name };
                    }
                    return item;
                });
                
                if (updated) {
                    await base44.asServiceRole.entities.Waste.update(waste.id, {
                        items: updatedItems
                    });
                }
            }

            // Update OutletTransfer items
            const transfers = await base44.asServiceRole.entities.OutletTransfer.list();
            for (const transfer of transfers) {
                let updated = false;
                const updatedItems = (transfer.items || []).map(item => {
                    const matchingSupplier = toMerge.find(s => s.name === item.supplier_name);
                    if (matchingSupplier) {
                        updated = true;
                        return { ...item, supplier_name: master.name };
                    }
                    return item;
                });
                
                if (updated) {
                    await base44.asServiceRole.entities.OutletTransfer.update(transfer.id, {
                        items: updatedItems
                    });
                }
            }

            // Delete duplicate suppliers
            for (const supplier of toMerge) {
                await base44.asServiceRole.entities.Supplier.delete(supplier.id);
            }

            mergedCount += toMerge.length;
        }

        return Response.json({ 
            success: true, 
            message: `${mergedCount} doppelte Lieferanten wurden zusammengeführt`,
            merged: mergedCount,
            details: mergeLog
        });

    } catch (error) {
        console.error('Error merging suppliers:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});