import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

export default function ArticleDrilldown({ article, wasteItems, deliveries, onClose }) {
    // Filter data for this article
    const articleWaste = useMemo(() => {
        return wasteItems.filter(item => item.article_name === article.article_name);
    }, [wasteItems, article]);

    const articleDeliveries = useMemo(() => {
        const result = [];
        deliveries.forEach(delivery => {
            (delivery.items || []).forEach(item => {
                if (item.article_name === article.article_name) {
                    result.push({
                        date: delivery.delivery_date,
                        supplier: delivery.supplier_name,
                        quantity: item.quantity,
                        unit: item.unit_abbreviation,
                        price: item.price || 0
                    });
                }
            });
        });
        return result.sort((a, b) => b.date.localeCompare(a.date));
    }, [deliveries, article]);

    return (
        <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-2xl z-50 overflow-y-auto border-l">
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold">{article.article_name}</h3>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Waste History */}
                <Card className="mb-4">
                    <CardHeader>
                        <CardTitle className="text-sm">Waste-Historie</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {articleWaste.length === 0 ? (
                                <p className="text-sm text-slate-500">Keine Einträge</p>
                            ) : (
                                articleWaste.map((item, index) => (
                                    <div key={index} className="text-xs border-b pb-2">
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">
                                                {format(parseISO(item.date), 'dd.MM.yyyy', { locale: de })}
                                            </span>
                                            <span className="font-medium">{item.value.toFixed(2)} €</span>
                                        </div>
                                        <div className="text-slate-500 mt-1">
                                            {item.quantity} {item.unit} • {item.reason}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Delivery History */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Lieferungen</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {articleDeliveries.length === 0 ? (
                                <p className="text-sm text-slate-500">Keine Einträge</p>
                            ) : (
                                articleDeliveries.map((item, index) => (
                                    <div key={index} className="text-xs border-b pb-2">
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">
                                                {format(parseISO(item.date), 'dd.MM.yyyy', { locale: de })}
                                            </span>
                                            <span className="font-medium">{item.price.toFixed(2)} €</span>
                                        </div>
                                        <div className="text-slate-500 mt-1">
                                            {item.quantity} {item.unit} • {item.supplier}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}