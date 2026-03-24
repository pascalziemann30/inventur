import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createPDF, validationString } from './pdfConfig.js';

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

        // Build table rows
        const tableBody = [
            [
                { text: 'Artikel', style: 'tableHeader' },
                { text: 'Menge', style: 'tableHeader', alignment: 'right' },
                { text: 'Einzelpreis', style: 'tableHeader', alignment: 'right' },
                { text: 'Gesamtwert', style: 'tableHeader', alignment: 'right' }
            ]
        ];

        let totalDeliveryValue = 0;

        for (const item of items) {
            const totalValue = (item.quantity || 0) * (item.price || 0);
            totalDeliveryValue += totalValue;

            tableBody.push([
                item.article_name || '-',
                { text: `${item.quantity} ${item.unit_abbreviation || ''}`, alignment: 'right' },
                { text: `${(item.price || 0).toFixed(2)} €`, alignment: 'right' },
                { text: `${totalValue.toFixed(2)} €`, alignment: 'right' }
            ]);
        }

        // Create PDF document definition
        const docDefinition = {
            content: [
                { text: 'Lieferschein', style: 'header' },
                { text: `Datum: ${new Date(delivery.delivery_date).toLocaleDateString('de-DE')}`, margin: [0, 5, 0, 3] },
                { text: `Lieferant: ${delivery.supplier_name || '-'}`, margin: [0, 0, 0, 3] },
                { text: `Lieferschein-Nr.: ${delivery.delivery_note_number || '-'}`, margin: [0, 0, 0, 3] },
                delivery.notes ? { text: `Bemerkungen: ${delivery.notes}`, margin: [0, 0, 0, 10] } : { text: '', margin: [0, 0, 0, 10] },
                {
                    table: {
                        headerRows: 1,
                        widths: ['*', 'auto', 'auto', 'auto'],
                        body: tableBody
                    },
                    layout: {
                        fillColor: function (rowIndex) {
                            return (rowIndex === 0) ? '#eeeeee' : null;
                        }
                    }
                },
                { text: `Gesamtwert: ${totalDeliveryValue.toFixed(2)} €`, style: 'total', margin: [0, 15, 0, 0] },
                { text: `\nValidierung: ${validationString}`, style: 'small', color: '#999999' }
            ]
        };

        const pdfBase64 = await createPDF(docDefinition);
        const pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));

        return new Response(pdfBytes, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=Lieferung_${delivery.delivery_date}_${delivery.supplier_name}.pdf`
            }
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});