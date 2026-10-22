import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ClipboardList, Truck, Trash2, ArrowRightLeft } from 'lucide-react';

const movementTypeIcon = (type) => {
    if (type === 'purchase') return <Truck className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
    if (type === 'waste') return <Trash2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
    if (type === 'outlet_transfer_in' || type === 'outlet_transfer_out') return <ArrowRightLeft className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
    return <ClipboardList className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
};

const movementTypeLabel = (type) => {
    if (type === 'purchase') return 'Lieferung';
    if (type === 'waste') return 'Waste';
    if (type === 'outlet_transfer_in') return 'Transfer eingehend';
    if (type === 'outlet_transfer_out') return 'Transfer ausgehend';
    if (type === 'inventory_adjustment') return 'Inventur';
    return type;
};

export default function EmployeeActivityList({ outletId, firstDay, lastDay }) {
    const { data: movements = [], isLoading } = useQuery({
        queryKey: ['stock-movements-month', outletId, firstDay, lastDay],
        queryFn: () => base44.entities.StockMovement.filter(
            { outlet_id: outletId },
            '-movement_date',
            100
        ).then(all => all.filter(m => m.movement_date >= firstDay && m.movement_date <= lastDay)),
        enabled: !!outletId
    });

    if (isLoading) {
        return (
            <div className="space-y-2">
                {[1, 2, 3].map(i => (
                    <div key={i} className="bg-muted border border-border rounded-xl px-3 py-2.5 animate-pulse h-10" />
                ))}
            </div>
        );
    }

    if (movements.length === 0) {
        return (
            <p className="text-sm text-muted-foreground text-center py-6">
                Noch keine Aktivitäten in diesem Monat.
            </p>
        );
    }

    return (
        <div className="space-y-2">
            {movements.map((m) => {
                const dateStr = m.movement_date
                    ? new Date(m.movement_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
                    : '—';
                const createdAt = m.created_date
                    ? new Date(m.created_date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                    : '';
                const displayDate = createdAt ? `${dateStr}, ${createdAt}` : dateStr;

                return (
                    <div key={m.id} className="bg-muted border border-border rounded-xl px-3 py-2.5 flex items-center gap-2.5">
                        {movementTypeIcon(m.movement_type)}
                        <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-foreground">{movementTypeLabel(m.movement_type)}</span>
                            {m.article_name && (
                                <span className="text-xs text-muted-foreground ml-1.5 truncate">{m.article_name}</span>
                            )}
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0">{displayDate}</span>
                    </div>
                );
            })}
        </div>
    );
}