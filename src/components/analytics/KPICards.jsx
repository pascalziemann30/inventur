import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, ShoppingCart, AlertTriangle, Package } from 'lucide-react';

export default function KPICards({ data }) {
    const { wasteItems, deliveryValue } = data;

    // Calculate totals
    const totalWasteValue = wasteItems.reduce((sum, item) => sum + (item.value || 0), 0);
    const totalWasteQuantity = wasteItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
    
    // Estimated consumption (delivery - waste)
    const estimatedConsumption = Math.max(0, (deliveryValue || 0) - totalWasteValue);
    
    // Waste quote
    const wasteQuote = (deliveryValue || 0) > 0 
        ? (totalWasteValue / (deliveryValue || 1)) * 100 
        : 0;

    // Top waste article
    const articleTotals = {};
    wasteItems.forEach(item => {
        if (!articleTotals[item.article_name]) {
            articleTotals[item.article_name] = { value: 0, quantity: 0 };
        }
        articleTotals[item.article_name].value += (item.value || 0);
        articleTotals[item.article_name].quantity += (item.quantity || 0);
    });
    
    const topWasteArticle = Object.entries(articleTotals)
        .sort((a, b) => b[1].value - a[1].value)[0];

    // Alerts count
    const alerts = wasteItems.filter(item => !item.reason || item.reason === 'Kein Grund angegeben' || (item.price || 0) === 0).length;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Waste Gesamt</CardTitle>
                    <TrendingDown className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                        {(totalWasteValue || 0).toFixed(2)} €
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        {(totalWasteQuantity || 0).toFixed(2)} Einheiten
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Wareneingang</CardTitle>
                    <ShoppingCart className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                        {(deliveryValue || 0).toFixed(2)} €
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        im Zeitraum
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Waste-Quote</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                        {(wasteQuote || 0).toFixed(1)}%
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        Waste / Wareneingang
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Top Waste Artikel</CardTitle>
                    <Package className="h-4 w-4 text-slate-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-sm font-bold truncate">
                        {topWasteArticle ? topWasteArticle[0] : 'Keine Daten'}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        {topWasteArticle ? `${(topWasteArticle[1].value || 0).toFixed(2)} €` : '—'}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}