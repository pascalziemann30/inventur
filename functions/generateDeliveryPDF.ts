import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@2.5.2';

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

        const doc = new jsPDF();

        // Title
        doc.setFontSize(20);
        doc.text('Lieferung', 20, 20);

        // Delivery info
        doc.setFontSize(10);
        doc.text(`Datum: ${new Date(delivery.delivery_date).toLocaleDateString('de-DE')}`, 20, 35);
        doc.text(`Lieferant: ${delivery.supplier_name || '-'}`, 20, 42);
        doc.text(`Lieferschein-Nr.: ${delivery.delivery_note_number || '-'}`, 20, 49);

        // Table headers
        doc.setFontSize(12);
        doc.text('Artikel', 20, 65);
        doc.text('Menge', 100, 65);
        doc.text('Einheit', 130, 65);
        doc.text('Preis', 160, 65);
        doc.text('Gesamt', 180, 65);

        // Table content
        let y = 75;
        const items = delivery.items || [];
        let totalValue = 0;

        for (const item of items) {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }

            const itemTotal = (item.quantity || 0) * (item.price || 0);
            totalValue += itemTotal;

            doc.setFontSize(10);
            doc.text(item.article_name || '-', 20, y);
            doc.text((item.quantity || 0).toFixed(2), 100, y);
            doc.text(item.unit_abbreviation || '-', 130, y);
            doc.text(`${(item.price || 0).toFixed(2)} €`, 160, y);
            doc.text(`${itemTotal.toFixed(2)} €`, 180, y);
            y += 10;
        }

        // Total
        y += 10;
        doc.setFontSize(12);
        doc.text(`Gesamtwert: ${totalValue.toFixed(2)} €`, 20, y);

        // Notes
        if (delivery.notes) {
            y += 10;
            doc.setFontSize(10);
            doc.text(`Bemerkungen: ${delivery.notes}`, 20, y);
        }

        const pdfBytes = doc.output('arraybuffer');

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