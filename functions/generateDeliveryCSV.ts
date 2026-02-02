import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { deliveryId } = await req.json();

        if (!deliveryId) {
            return Response.json({ error: 'Delivery ID required' }, { status: 400 });
        }

        // Fetch delivery data
        const deliveries = await base44.entities.Delivery.filter({ id: deliveryId });
        const delivery = deliveries[0];

        if (!delivery) {
            return Response.json({ error: 'Delivery not found' }, { status: 404 });
        }

        const items = delivery.items || [];
        
        // Load OutletItems as fallback for prices
        const outletItems = await base44.entities.OutletItem.filter({ outlet_id: delivery.outlet_id });

        // Build CSV content
        let csv = '\uFEFF'; // UTF-8 BOM for Excel
        
        // Header info
        csv += 'Lieferschein\n';
        csv += `Datum;${new Date(delivery.delivery_date).toLocaleDateString('de-DE')}\n`;
        csv += `Outlet;${delivery.outlet_name || '-'}\n`;
        csv += `Lieferant;${delivery.supplier_name || '-'}\n`;
        csv += `Lieferschein-Nr.;${delivery.delivery_note_number || '-'}\n`;
        if (delivery.notes) {
            csv += `Bemerkungen;${delivery.notes}\n`;
        }
        csv += '\n';
        
        // Table header
        csv += 'Artikel;Menge;Einheit;Einzelpreis (EUR);Gesamtwert (EUR)\n';

        let totalDeliveryValue = 0;

        // Table rows
        for (const item of items) {
            // Get price with fallback
            let price = item.price || 0;
            
            // If no price in item, try to get from OutletItem
            if (!price && item.article_id) {
                const outletItem = outletItems.find(oi => oi.id === item.article_id);
                price = outletItem?.net_purchase_price || 0;
            }
            
            const quantity = item.quantity || 0;
            const totalValue = quantity * price;
            totalDeliveryValue += totalValue;

            const priceDisplay = price > 0 ? price.toFixed(2) : '—';
            const totalDisplay = totalValue > 0 ? totalValue.toFixed(2) : '—';
            const quantityDisplay = quantity > 0 ? quantity.toFixed(2) : '—';

            csv += `${item.article_name || '—'};${quantityDisplay};${item.unit_abbreviation || ''};${priceDisplay};${totalDisplay}\n`;
        }

        // Summary
        csv += '\n';
        csv += `Gesamtwert;${totalDeliveryValue.toFixed(2)}\n`;

        return new Response(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename=Lieferung_${delivery.delivery_date}_${delivery.supplier_name}.csv`
            }
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});