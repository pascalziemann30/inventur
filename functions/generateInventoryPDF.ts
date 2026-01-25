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

        // Table headers
        doc.setFontSize(12);
        doc.text('Artikel', 20, 65);
        doc.text('Vorher', 100, 65);
        doc.text('Gezählt', 130, 65);
        doc.text('Differenz', 160, 65);

        // Table content
        let y = 75;
        const entries = session.entries || [];

        for (const entry of entries) {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }

            doc.setFontSize(10);
            doc.text(entry.article_name || '-', 20, y);
            doc.text((entry.last_stock || 0).toFixed(2), 100, y);
            doc.text((entry.counted_quantity || 0).toFixed(2), 130, y);
            doc.text((entry.difference || 0).toFixed(2), 160, y);
            y += 10;
        }

        // Summary
        y += 10;
        doc.setFontSize(12);
        doc.text(`Gesamt gezählt: ${session.total_items_counted || entries.length} Artikel`, 20, y);

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