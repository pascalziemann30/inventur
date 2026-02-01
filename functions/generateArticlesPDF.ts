import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createPDF, validationString } from './pdfConfig.js';

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

        // Build table rows
        const tableBody = [
            [
                { text: 'Artikel', style: 'tableHeader' },
                { text: 'Lieferant', style: 'tableHeader' },
                { text: 'Kategorie', style: 'tableHeader' },
                { text: 'Menge', style: 'tableHeader', alignment: 'right' },
                { text: 'Einzelpreis', style: 'tableHeader', alignment: 'right' },
                { text: 'Gesamtwert', style: 'tableHeader', alignment: 'right' }
            ]
        ];

        for (const article of articles) {
            const quantity = article.current_stock || 0;
            const price = article.purchase_price || 0;
            const total = quantity * price;
            totalValue += total;

            tableBody.push([
                article.name || '-',
                article.supplier_name || '-',
                article.category_name || '-',
                { text: `${quantity.toFixed(2)} ${article.unit_abbreviation || ''}`, alignment: 'right' },
                { text: `${price.toFixed(2)} €`, alignment: 'right' },
                { text: `${total.toFixed(2)} €`, alignment: 'right' }
            ]);
        }

        // Create PDF document definition
        const docDefinition = {
            content: [
                { text: 'Artikel-Übersicht', style: 'header' },
                { text: `Datum: ${new Date().toLocaleDateString('de-DE')}`, margin: [0, 5, 0, 3] },
                outletName ? { text: `Outlet: ${outletName}`, margin: [0, 0, 0, 10] } : { text: '', margin: [0, 0, 0, 10] },
                {
                    table: {
                        headerRows: 1,
                        widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
                        body: tableBody
                    },
                    layout: {
                        fillColor: function (rowIndex) {
                            return (rowIndex === 0) ? '#eeeeee' : null;
                        }
                    }
                },
                { text: `Artikel gesamt: ${articles.length}`, margin: [0, 15, 0, 5] },
                { text: `Gesamtwert: ${totalValue.toFixed(2)} €`, style: 'total' },
                { text: `\nValidierung: ${validationString}`, style: 'small', color: '#999999' }
            ]
        };

        const pdfBase64 = await createPDF(docDefinition);
        const pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));

        return new Response(pdfBytes, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=Artikel_${new Date().toISOString().split('T')[0]}.pdf`
            }
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});