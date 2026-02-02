import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { articles, outletName } = await req.json();

        if (!articles || !Array.isArray(articles)) {
            return Response.json({ error: 'Articles array required' }, { status: 400 });
        }

        let totalValue = 0;

        // Build CSV content
        let csv = '\uFEFF'; // UTF-8 BOM for Excel
        
        // Header info
        csv += 'Artikel-Übersicht\n';
        csv += `Datum;${new Date().toLocaleDateString('de-DE')}\n`;
        if (outletName) {
            csv += `Outlet;${outletName}\n`;
        }
        csv += '\n';
        
        // Table header
        csv += 'Artikel;Lieferant;Kategorie;Menge;Einheit;Einzelpreis (EUR);Gesamtwert (EUR)\n';

        // Table rows
        for (const article of articles) {
            const quantity = article.current_stock || 0;
            const price = article.purchase_price || 0;
            const total = quantity * price;
            totalValue += total;

            csv += `${article.name || '-'};${article.supplier_name || '-'};${article.category_name || '-'};${quantity.toFixed(2)};${article.unit_abbreviation || ''};${price.toFixed(2)};${total.toFixed(2)}\n`;
        }

        // Summary
        csv += '\n';
        csv += `Artikel gesamt;${articles.length}\n`;
        csv += `Gesamtwert;${totalValue.toFixed(2)}\n`;

        return new Response(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename=Artikel_${new Date().toISOString().split('T')[0]}.csv`
            }
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});