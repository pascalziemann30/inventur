import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

        // Build CSV content
        let csv = '\uFEFF'; // UTF-8 BOM for Excel
        
        // Header info
        csv += 'Inventurbericht\n';
        csv += `Datum;${new Date(session.session_date).toLocaleDateString('de-DE')}\n`;
        csv += `Outlet;${session.outlet_name || '-'}\n`;
        csv += `Zeitraum;${session.period_type === 'weekly' ? 'Wöchentlich' : 
                            session.period_type === 'monthly' ? 'Monatlich' : 
                            session.period_type === 'yearly' ? 'Jährlich' : 'Ad-hoc'}\n`;
        csv += `Mitarbeiter;${session.employee_name || '-'}\n`;
        if (session.notes) {
            csv += `Bemerkungen;${session.notes}\n`;
        }
        csv += '\n';
        
        // Table header
        csv += 'Artikel;Lieferant;Menge;Einheit;Einzelpreis (EUR);Gesamtwert (EUR)\n';

        // Table rows
        for (const entry of entries) {
            const outletItem = outletItems.find(a => a.id === entry.article_id);
            const price = outletItem?.net_purchase_price || 0;
            const supplier = outletItem?.supplier_name || '-';
            const totalValue = (entry.counted_quantity || 0) * price;
            totalInventoryValue += totalValue;

            csv += `${entry.article_name || '-'};${supplier};${entry.counted_quantity || 0};${entry.unit_abbreviation || ''};${price.toFixed(2)};${totalValue.toFixed(2)}\n`;
        }

        // Summary
        csv += '\n';
        csv += `Artikel gezählt;${session.total_items_counted || entries.length}\n`;
        csv += `Gesamtwert;${totalInventoryValue.toFixed(2)}\n`;

        return new Response(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename=Inventur_${session.session_date}.csv`
            }
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});