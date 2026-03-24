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

        const sessions = await base44.entities.InventorySession.filter({ id: sessionId });
        const session = sessions[0];

        if (!session) {
            return Response.json({ error: 'Session not found' }, { status: 404 });
        }

        const outletItems = await base44.entities.OutletItem.filter({ outlet_id: session.outlet_id });
        const globalItems = await base44.entities.GlobalItem.list();
        const entries = session.entries?.filter(e => e.counted_quantity !== null) || [];
        let totalInventoryValue = 0;

        let rows = '';
        for (const entry of entries) {
            // Find OutletItem by ID (entry.article_id is the OutletItem ID)
            const outletItem = outletItems.find(a => a.id === entry.article_id);
            
            // Get price with fallback logic
            let price = 0;
            if (outletItem?.net_purchase_price) {
                price = outletItem.net_purchase_price;
            } else if (outletItem?.global_item_id) {
                const globalItem = globalItems.find(g => g.id === outletItem.global_item_id);
                price = globalItem?.default_net_price || 0;
            }
            
            const supplier = outletItem?.supplier_name || '—';
            const quantity = entry.counted_quantity || 0;
            const totalValue = quantity * price;
            totalInventoryValue += totalValue;

            const priceDisplay = price > 0 ? `${price.toFixed(2)} €` : '—';
            const totalDisplay = totalValue > 0 ? `${totalValue.toFixed(2)} €` : '—';
            
            rows += `
                <tr>
                    <td>${entry.article_name || '—'}</td>
                    <td>${supplier}</td>
                    <td style="text-align: right;">${quantity.toFixed(2)}</td>
                    <td>${entry.unit_abbreviation || ''}</td>
                    <td style="text-align: right;">${priceDisplay}</td>
                    <td style="text-align: right;"><strong>${totalDisplay}</strong></td>
                </tr>
            `;
        }

        const periodTypeLabel = session.period_type === 'weekly' ? 'Wöchentlich' : 
                                session.period_type === 'monthly' ? 'Monatlich' : 
                                session.period_type === 'yearly' ? 'Jährlich' : 'Ad-hoc';

        const html = `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Inventurbericht</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #1e293b; margin-bottom: 20px; }
        .info { margin-bottom: 30px; line-height: 1.8; }
        .info-row { display: flex; margin-bottom: 8px; }
        .info-label { font-weight: bold; width: 150px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #1e293b; color: white; padding: 12px; text-align: left; font-weight: 600; }
        td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
        tr:hover { background: #f8fafc; }
        .summary { margin-top: 30px; padding: 20px; background: #f1f5f9; border-radius: 8px; }
        .summary-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .total { font-size: 18px; font-weight: bold; color: #059669; }
        @media print {
            body { margin: 0; background: white; }
            .container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📋 Inventurbericht</h1>
        <div class="info">
            <div class="info-row"><span class="info-label">Datum:</span><span>${new Date(session.session_date).toLocaleDateString('de-DE')}</span></div>
            <div class="info-row"><span class="info-label">Outlet:</span><span>${session.outlet_name || '-'}</span></div>
            <div class="info-row"><span class="info-label">Zeitraum:</span><span>${periodTypeLabel}</span></div>
            <div class="info-row"><span class="info-label">Mitarbeiter:</span><span>${session.employee_name || '-'}</span></div>
            ${session.notes ? `<div class="info-row"><span class="info-label">Bemerkungen:</span><span>${session.notes}</span></div>` : ''}
        </div>
        <table>
            <thead>
                <tr>
                    <th>Artikel</th>
                    <th>Lieferant</th>
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
            <div class="summary-row"><span>Artikel gezählt:</span><span><strong>${session.total_items_counted || entries.length}</strong></span></div>
            <div class="summary-row total"><span>Gesamtwert:</span><span>${totalInventoryValue.toFixed(2)} €</span></div>
        </div>
    </div>
</body>
</html>
        `;

        return new Response(html, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Disposition': `attachment; filename=Inventur_${session.session_date}.html`
            }
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});