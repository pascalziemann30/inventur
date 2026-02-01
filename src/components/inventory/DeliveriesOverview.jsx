import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function DeliveriesOverview({ open, onClose, deliveries }) {
    const handleDownloadExcel = async (delivery) => {
        try {
            toast.loading('Excel wird erstellt...');
            const response = await base44.functions.invoke('generateDeliveryExcel', {
                deliveryId: delivery.id
            });
            
            // Decode base64 to binary
            const binaryString = atob(response.data.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = response.data.filename || `Lieferung_${format(new Date(delivery.delivery_date), 'yyyy-MM-dd')}_${delivery.supplier_name}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            toast.success('Excel heruntergeladen');
        } catch (error) {
            console.error('Excel generation failed:', error);
            toast.error('Excel-Erstellung fehlgeschlagen');
        }
    };

    const sortedDeliveries = [...deliveries].sort((a, b) => 
        new Date(b.delivery_date) - new Date(a.delivery_date)
    );

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Lieferungen</DialogTitle>
                </DialogHeader>

                {sortedDeliveries.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        Keine Lieferungen erfasst
                    </div>
                ) : (
                    <div className="flex-1 overflow-auto border rounded-lg">
                        <Table>
                            <TableHeader className="sticky top-0 bg-slate-50 z-10">
                                <TableRow>
                                    <TableHead>Datum</TableHead>
                                    <TableHead>Lieferant</TableHead>
                                    <TableHead>Lieferschein-Nr.</TableHead>
                                    <TableHead className="text-right">Positionen</TableHead>
                                    <TableHead>Bemerkungen</TableHead>
                                    <TableHead className="text-right">Aktion</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedDeliveries.map(delivery => (
                                    <TableRow key={delivery.id}>
                                        <TableCell className="font-medium">
                                            {format(new Date(delivery.delivery_date), 'dd.MM.yyyy', { locale: de })}
                                        </TableCell>
                                        <TableCell>{delivery.supplier_name || '-'}</TableCell>
                                        <TableCell className="text-slate-600">
                                            {delivery.delivery_note_number || '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {delivery.items?.length || 0}
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-600 truncate max-w-xs">
                                            {delivery.notes || '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleDownloadExcel(delivery)}
                                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                            >
                                                <Download className="w-4 h-4 mr-1" />
                                                Excel
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}

                <div className="border-t pt-3 text-sm text-slate-600">
                    {sortedDeliveries.length} Lieferungen
                </div>
            </DialogContent>
        </Dialog>
    );
}