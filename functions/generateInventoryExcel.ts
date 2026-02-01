import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { sessionId } = await req.json();

        if (!sessionId) {
            return Response.json({ error: 'Session ID required' }, { status: 400 });
        }

        // Fetch session data
        const sessions = await base44.entities.InventorySession.filter({ id: sessionId });
        const session = sessions[0];

        if (!session) {
            return Response.json({ error: 'Session not found' }, { status: 404 });
        }

        // Fetch outlet items for prices and suppliers
        const outletItems = await base44.entities.OutletItem.filter({ outlet_id: session.outlet_id });

        const entries = session.entries?.filter(e => e.counted_quantity !== null) || [];
        let totalInventoryValue = 0;

        // Build Excel data
        const excelData = [];
        
        // Header info
        excelData.push(['Inventurbericht']);
        excelData.push(['Datum:', new Date(session.session_date).toLocaleDateString('de-DE')]);
        excelData.push(['Outlet:', session.outlet_name || '-']);
        excelData.push(['Zeitraum:', session.period_type === 'weekly' ? 'Wöchentlich' : 
                                     session.period_type === 'monthly' ? 'Monatlich' : 
                                     session.period_type === 'yearly' ? 'Jährlich' : 'Ad-hoc']);
        excelData.push(['Mitarbeiter:', session.employee_name || '-']);
        if (session.notes) {
            excelData.push(['Bemerkungen:', session.notes]);
        }
        excelData.push([]);
        
        // Table header
        excelData.push(['Artikel', 'Lieferant', 'Menge', 'Einheit', 'Einzelpreis (€)', 'Gesamtwert (€)']);

        // Table rows
        for (const entry of entries) {
            const outletItem = outletItems.find(a => a.id === entry.article_id);
            const price = outletItem?.net_purchase_price || 0;
            const supplier = outletItem?.supplier_name || '-';
            const totalValue = (entry.counted_quantity || 0) * price;
            totalInventoryValue += totalValue;

            excelData.push([
                entry.article_name || '-',
                supplier,
                entry.counted_quantity || 0,
                entry.unit_abbreviation || '',
                price,
                totalValue
            ]);
        }

        // Summary
        excelData.push([]);
        excelData.push(['Artikel gezählt:', session.total_items_counted || entries.length]);
        excelData.push(['Gesamtwert:', totalInventoryValue]);

        // Create workbook
        const ws = XLSX.utils.aoa_to_sheet(excelData);
        
        // Set column widths
        ws['!cols'] = [
            { wch: 30 }, // Artikel
            { wch: 20 }, // Lieferant
            { wch: 10 }, // Menge
            { wch: 10 }, // Einheit
            { wch: 15 }, // Einzelpreis
            { wch: 15 }  // Gesamtwert
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Inventur');

        // Generate Excel file
        const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        return new Response(excelBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename=Inventur_${session.session_date}.xlsx`
            }
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});