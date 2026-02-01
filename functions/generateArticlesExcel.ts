import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as XLSX from 'npm:xlsx@0.18.5';

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

        // Build Excel data
        const excelData = [];
        
        // Header info
        excelData.push(['Artikel-Übersicht']);
        excelData.push(['Datum:', new Date().toLocaleDateString('de-DE')]);
        if (outletName) {
            excelData.push(['Outlet:', outletName]);
        }
        excelData.push([]);
        
        // Table header
        excelData.push(['Artikel', 'Lieferant', 'Kategorie', 'Menge', 'Einheit', 'Einzelpreis (€)', 'Gesamtwert (€)']);

        // Table rows
        for (const article of articles) {
            const quantity = article.current_stock || 0;
            const price = article.purchase_price || 0;
            const total = quantity * price;
            totalValue += total;

            excelData.push([
                article.name || '-',
                article.supplier_name || '-',
                article.category_name || '-',
                quantity,
                article.unit_abbreviation || '',
                price,
                total
            ]);
        }

        // Summary
        excelData.push([]);
        excelData.push(['Artikel gesamt:', articles.length]);
        excelData.push(['Gesamtwert:', totalValue]);

        // Create workbook
        const ws = XLSX.utils.aoa_to_sheet(excelData);
        
        // Set column widths
        ws['!cols'] = [
            { wch: 30 }, // Artikel
            { wch: 20 }, // Lieferant
            { wch: 15 }, // Kategorie
            { wch: 10 }, // Menge
            { wch: 10 }, // Einheit
            { wch: 15 }, // Einzelpreis
            { wch: 15 }  // Gesamtwert
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Artikel');

        // Generate Excel file
        const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        return new Response(excelBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename=Artikel_${new Date().toISOString().split('T')[0]}.xlsx`
            }
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});