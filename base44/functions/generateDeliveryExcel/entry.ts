import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as XLSX from 'npm:xlsx@0.18.5';

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

        // Build Excel data
        const excelData = [];
        
        // Header info
        excelData.push(['Lieferschein']);
        excelData.push(['Datum:', new Date(delivery.delivery_date).toLocaleDateString('de-DE')]);
        excelData.push(['Outlet:', delivery.outlet_name || '-']);
        excelData.push(['Lieferant:', delivery.supplier_name || '-']);
        excelData.push(['Lieferschein-Nr.:', delivery.delivery_note_number || '-']);
        if (delivery.notes) {
            excelData.push(['Bemerkungen:', delivery.notes]);
        }
        excelData.push([]);
        
        // Table header
        excelData.push(['Artikel', 'Menge', 'Einheit', 'Einzelpreis (€)', 'Gesamtwert (€)']);

        let totalDeliveryValue = 0;

        // Table rows
        for (const item of items) {
            const totalValue = (item.quantity || 0) * (item.price || 0);
            totalDeliveryValue += totalValue;

            excelData.push([
                item.article_name || '-',
                item.quantity || 0,
                item.unit_abbreviation || '',
                item.price || 0,
                totalValue
            ]);
        }

        // Summary
        excelData.push([]);
        excelData.push(['Gesamtwert:', totalDeliveryValue]);

        // Create workbook
        const ws = XLSX.utils.aoa_to_sheet(excelData);
        
        // Set column widths
        ws['!cols'] = [
            { wch: 30 }, // Artikel
            { wch: 10 }, // Menge
            { wch: 10 }, // Einheit
            { wch: 15 }, // Einzelpreis
            { wch: 15 }  // Gesamtwert
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Lieferung');

        // Generate Excel file as base64
        const excelData = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

        return Response.json({
            data: excelData,
            filename: `Lieferung_${delivery.delivery_date}_${delivery.supplier_name}.xlsx`
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});