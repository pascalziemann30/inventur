import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Package, AlertTriangle, ClipboardList, Truck } from 'lucide-react';

export default function StatsCards({ 
    articles, 
    inventories, 
    deliveries,
    onArticlesClick,
    onLowStockClick,
    onInventoriesClick,
    onDeliveriesClick 
}) {
    const totalArticles = articles.length;
    const lowStockCount = articles.filter(a => a.min_stock && a.current_stock <= a.min_stock).length;
    const totalInventories = inventories.length;
    const totalDeliveries = deliveries.length;

    const stats = [
        {
            label: 'Artikel',
            value: totalArticles,
            icon: Package,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
            onClick: onArticlesClick
        },
        {
            label: 'Niedrigbestand',
            value: lowStockCount,
            icon: AlertTriangle,
            color: lowStockCount > 0 ? 'text-amber-600' : 'text-slate-400',
            bgColor: lowStockCount > 0 ? 'bg-amber-50' : 'bg-slate-50',
            onClick: onLowStockClick
        },
        {
            label: 'Inventuren',
            value: totalInventories,
            icon: ClipboardList,
            color: 'text-emerald-600',
            bgColor: 'bg-emerald-50',
            onClick: onInventoriesClick
        },
        {
            label: 'Lieferungen',
            value: totalDeliveries,
            icon: Truck,
            color: 'text-violet-600',
            bgColor: 'bg-violet-50',
            onClick: onDeliveriesClick
        }
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat, index) => (
                <Card 
                    key={index} 
                    className="bg-white border-slate-200 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={stat.onClick}
                >
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                                <p className="text-sm text-slate-500">{stat.label}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}