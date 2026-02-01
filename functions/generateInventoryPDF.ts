import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createPDF, validationString } from './pdfConfig.js';

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

        // Build table rows
        const tableBody = [
            [
                { text: 'Artikel', style: 'tableHeader' },
                { text: 'Lieferant', style: 'tableHeader' },
                { text: 'Menge', style: 'tableHeader', alignment: 'right' },
                { text: 'Einzelpreis', style: 'tableHeader', alignment: 'right' },
                { text: 'Gesamtwert', style: 'tableHeader', alignment: 'right' }
            ]
        ];

        for (const entry of entries) {
            const outletItem = outletItems.find(a => a.id === entry.article_id);
            const price = outletItem?.net_purchase_price || 0;
            const supplier = outletItem?.supplier_name || '-';
            const totalValue = (entry.counted_quantity || 0) * price;
            totalInventoryValue += totalValue;

            tableBody.push([
                entry.article_name || '-',
                supplier,
                { text: `${(entry.counted_quantity || 0).toFixed(2)} ${entry.unit_abbreviation || ''}`, alignment: 'right' },
                { text: `${price.toFixed(2)} €`, alignment: 'right' },
                { text: `${totalValue.toFixed(2)} €`, alignment: 'right' }
            ]);
        }

        // Create PDF document definition
        const periodLabels = {
            weekly: 'Wöchentlich',
            monthly: 'Monatlich',
            yearly: 'Jährlich',
            adhoc: 'Ad-hoc'
        };

        const docDefinition = {
            content: [
                { text: 'Inventurbericht', style: 'header' },
                { text: `Datum: ${new Date(session.session_date).toLocaleDateString('de-DE')}`, margin: [0, 5, 0, 3] },
                { text: `Zeitraum: ${periodLabels[session.period_type] || session.period_type}`, margin: [0, 0, 0, 3] },
                { text: `Mitarbeiter: ${session.employee_name || '-'}`, margin: [0, 0, 0, 3] },
                session.notes ? { text: `Bemerkungen: ${session.notes}`, margin: [0, 0, 0, 10] } : { text: '', margin: [0, 0, 0, 10] },
                {
                    table: {
                        headerRows: 1,
                        widths: ['*', 'auto', 'auto', 'auto', 'auto'],
                        body: tableBody
                    },
                    layout: {
                        fillColor: function (rowIndex) {
                            return (rowIndex === 0) ? '#eeeeee' : null;
                        }
                    }
                },
                { text: `Artikel gezählt: ${session.total_items_counted || entries.length}`, margin: [0, 15, 0, 5] },
                { text: `Gesamtwert: ${totalInventoryValue.toFixed(2)} €`, style: 'total' },
                { text: `\nValidierung: ${validationString}`, style: 'small', color: '#999999' }
            ]
        };

        const pdfBase64 = await createPDF(docDefinition);
        const pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));

        return new Response(pdfBytes, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=Inventur_${session.session_date}.pdf`
            }
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});