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
        let rows = '';

        for (const article of articles) {
            const quantity = article.current_stock || 0;
            const price = article.purchase_price || 0;
            const total = quantity * price;
            totalValue += total;

            rows += `
                <tr>
                    <td>${article.name || '-'}</td>
                    <td>${article.supplier_name || '-'}</td>
                    <td>${article.category_name || '-'}</td>
                    <td style="text-align: right;">${quantity.toFixed(2)}</td>
                    <td>${article.unit_abbreviation || ''}</td>
                    <td style="text-align: right;">${price.toFixed(2)} €</td>
                    <td style="text-align: right;"><strong>${total.toFixed(2)} €</strong></td>
                </tr>
            `;
        }

        const html = `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Artikel-Übersicht</title>
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
        <h1>📦 Artikel-Übersicht</h1>
        <div class="info">
            <div class="info-row"><span class="info-label">Datum:</span><span>${new Date().toLocaleDateString('de-DE')}</span></div>
            ${outletName ? `<div class="info-row"><span class="info-label">Outlet:</span><span>${outletName}</span></div>` : ''}
        </div>
        <table>
            <thead>
                <tr>
                    <th>Artikel</th>
                    <th>Lieferant</th>
                    <th>Kategorie</th>
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
            <div class="summary-row"><span>Artikel gesamt:</span><span><strong>${articles.length}</strong></span></div>
            <div class="summary-row total"><span>Gesamtwert:</span><span>${totalValue.toFixed(2)} €</span></div>
        </div>
    </div>
</body>
</html>
        `;

        return new Response(html, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Disposition': `attachment; filename=Artikel_${new Date().toISOString().split('T')[0]}.html`
            }
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});