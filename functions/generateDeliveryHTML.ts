import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

        const deliveries = await base44.entities.Delivery.filter({ id: deliveryId });
        const delivery = deliveries[0];

        if (!delivery) {
            return Response.json({ error: 'Delivery not found' }, { status: 404 });
        }

        const items = delivery.items || [];
        let totalDeliveryValue = 0;
        let rows = '';

        for (const item of items) {
            const totalValue = (item.quantity || 0) * (item.price || 0);
            totalDeliveryValue += totalValue;

            rows += `
                <tr>
                    <td>${item.article_name || '-'}</td>
                    <td style="text-align: right;">${item.quantity || 0}</td>
                    <td>${item.unit_abbreviation || ''}</td>
                    <td style="text-align: right;">${(item.price || 0).toFixed(2)} €</td>
                    <td style="text-align: right;"><strong>${totalValue.toFixed(2)} €</strong></td>
                </tr>
            `;
        }

        const html = `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lieferschein</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #1e293b; margin-bottom: 20px; }
        .info { margin-bottom: 30px; line-height: 1.8; }
        .info-row { display: flex; margin-bottom: 8px; }
        .info-label { font-weight: bold; width: 180px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #1e293b; color: white; padding: 12px; text-align: left; font-weight: 600; }
        td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
        tr:hover { background: #f8fafc; }
        .summary { margin-top: 30px; padding: 20px; background: #f1f5f9; border-radius: 8px; }
        .total { font-size: 18px; font-weight: bold; color: #059669; text-align: right; }
        @media print {
            body { margin: 0; background: white; }
            .container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚚 Lieferschein</h1>
        <div class="info">
            <div class="info-row"><span class="info-label">Datum:</span><span>${new Date(delivery.delivery_date).toLocaleDateString('de-DE')}</span></div>
            <div class="info-row"><span class="info-label">Outlet:</span><span>${delivery.outlet_name || '-'}</span></div>
            <div class="info-row"><span class="info-label">Lieferant:</span><span>${delivery.supplier_name || '-'}</span></div>
            <div class="info-row"><span class="info-label">Lieferschein-Nr.:</span><span>${delivery.delivery_note_number || '-'}</span></div>
            ${delivery.notes ? `<div class="info-row"><span class="info-label">Bemerkungen:</span><span>${delivery.notes}</span></div>` : ''}
        </div>
        <table>
            <thead>
                <tr>
                    <th>Artikel</th>
                    <th style="text-align: right;">Menge</th>
                    <th>Einheit</th>
                    <th style="text-align: right;">Einzelpreis</th>
                    <th style="text-align: right;">Gesamtwert</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
        <div class="summary">
            <div class="total">Gesamtwert: ${totalDeliveryValue.toFixed(2)} €</div>
        </div>
    </div>
</body>
</html>
        `;

        return new Response(html, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Disposition': `attachment; filename=Lieferung_${delivery.delivery_date}_${delivery.supplier_name}.html`
            }
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});