import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@2.5.2';

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

        const doc = new jsPDF();

        // Title
        doc.setFontSize(20);
        doc.text('Inventur-Bericht', 20, 20);

        // Session info
        doc.setFontSize(10);
        doc.text(`Datum: ${new Date(session.session_date).toLocaleDateString('de-DE')}`, 20, 35);
        doc.text(`Bearbeiter: ${session.employee_name || '-'}`, 20, 42);
        doc.text(`Art: ${session.period_type}`, 20, 49);

        // Fetch article details for prices and suppliers
        const articleIds = session.entries?.map(e => e.article_id).filter(Boolean) || [];
        let articles = [];
        if (articleIds.length > 0) {
            articles = await base44.entities.Article.list();
        }

        // Table headers
        doc.setFontSize(8);
        doc.text('Artikel', 15, 65);
        doc.text('Lieferant', 70, 65);
        doc.text('Menge', 110, 65);
        doc.text('Preis', 135, 65);
        doc.text('Gesamt', 160, 65);

        // Table content
        let y = 73;
        const entries = session.entries?.filter(e => e.counted_quantity !== null) || [];
        let totalInventoryValue = 0;

        for (const entry of entries) {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }

            // Find article for price and supplier
            const article = articles.find(a => a.id === entry.article_id);
            const price = article?.purchase_price || 0;
            const supplier = article?.supplier_name || '-';
            const totalValue = (entry.counted_quantity || 0) * price;
            totalInventoryValue += totalValue;

            doc.setFontSize(8);
            doc.text((entry.article_name || '-').substring(0, 30), 15, y);
            doc.text(supplier.substring(0, 20), 70, y);
            doc.text(`${(entry.counted_quantity || 0).toFixed(2)} ${entry.unit_abbreviation || ''}`, 110, y);
            doc.text(`${price.toFixed(2)} €`, 135, y);
            doc.text(`${totalValue.toFixed(2)} €`, 160, y);
            y += 7;
        }

        // Summary
        y += 10;
        doc.setFontSize(10);
        doc.text(`Artikel gezählt: ${session.total_items_counted || entries.length}`, 15, y);
        y += 8;
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`Gesamtwert: ${totalInventoryValue.toFixed(2)} €`, 15, y);

        const pdfBytes = doc.output('arraybuffer');

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