import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Info, ChevronRight } from 'lucide-react';
import AlertDetailDialog from './AlertDetailDialog';

export default function AlertsList({ wasteItems, deliveries, onUpdate }) {
    const [selectedAlert, setSelectedAlert] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const alerts = useMemo(() => {
        const result = [];

        // Missing reason
        const missingReason = wasteItems.filter(item => 
            !item.reason || item.reason === 'Kein Grund angegeben'
        );
        if (missingReason.length > 0) {
            result.push({
                type: 'warning',
                title: 'Waste ohne Grund',
                description: `${missingReason.length} Einträge ohne Begründung`,
                items: missingReason.length,
                data: missingReason,
                clickable: true
            });
        }

        // Price = 0
        const zeroPrices = wasteItems.filter(item => (item.price || 0) === 0);
        if (zeroPrices.length > 0) {
            result.push({
                type: 'error',
                title: 'Fehlende Preise',
                description: `${zeroPrices.length} Artikel ohne Preis (Gesamtwert = 0)`,
                items: zeroPrices.length,
                data: zeroPrices,
                clickable: true
            });
        }

        // High waste items (> 100€)
        const highWaste = wasteItems.filter(item => (item.value || 0) > 100);
        if (highWaste.length > 0) {
            result.push({
                type: 'warning',
                title: 'Hohe Einzelwerte',
                description: `${highWaste.length} Waste-Einträge über 100€`,
                items: highWaste.length,
                data: highWaste,
                clickable: true
            });
        }

        // Info: Total entries
        result.push({
            type: 'info',
            title: 'Datenbasis',
            description: `${wasteItems.length} Waste-Einträge, ${deliveries.length} Lieferungen`,
            items: wasteItems.length + deliveries.length,
            clickable: false
        });

        return result;
    }, [wasteItems, deliveries]);

    const handleAlertClick = (alert) => {
        if (alert.clickable) {
            setSelectedAlert(alert);
            setDialogOpen(true);
        }
    };

    const handleClose = () => {
        setDialogOpen(false);
        setSelectedAlert(null);
    };

    const handleUpdate = () => {
        if (onUpdate) {
            onUpdate();
        }
        handleClose();
    };

    const getIcon = (type) => {
        switch (type) {
            case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
            case 'warning': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
            default: return <Info className="w-4 h-4 text-blue-500" />;
        }
    };

    const getBadgeVariant = (type) => {
        switch (type) {
            case 'error': return 'destructive';
            case 'warning': return 'secondary';
            default: return 'outline';
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Hinweise & Anomalien</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {alerts.map((alert, index) => (
                        <div 
                            key={index} 
                            className={`flex items-start gap-3 p-3 border rounded-lg transition-colors ${
                                alert.clickable 
                                    ? 'cursor-pointer hover:bg-slate-50 hover:border-slate-300' 
                                    : ''
                            }`}
                            onClick={() => handleAlertClick(alert)}
                        >
                            {getIcon(alert.type)}
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{alert.title}</span>
                                    <Badge variant={getBadgeVariant(alert.type)} className="text-xs">
                                        {alert.items}
                                    </Badge>
                                </div>
                                <p className="text-xs text-slate-600 mt-1">{alert.description}</p>
                            </div>
                            {alert.clickable && (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                        </div>
                    ))}
                </div>

                <AlertDetailDialog
                    alert={selectedAlert}
                    items={selectedAlert?.data || []}
                    open={dialogOpen}
                    onClose={handleClose}
                    onUpdate={handleUpdate}
                />
            </CardContent>
        </Card>
    );
}