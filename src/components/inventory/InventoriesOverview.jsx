import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const periodTypeLabels = {
    weekly: 'Wöchentlich',
    monthly: 'Monatlich',
    yearly: 'Jährlich',
    adhoc: 'Ad-hoc'
};

export default function InventoriesOverview({ open, onClose, sessions }) {
    const handleDownloadExcel = async (session) => {
        try {
            toast.loading('Excel wird erstellt...');
            const response = await base44.functions.invoke('generateInventoryExcel', {
                sessionId: session.id
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
            a.download = response.data.filename || `Inventur_${format(new Date(session.session_date), 'yyyy-MM-dd')}.xlsx`;
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

    const completedSessions = sessions
        .filter(s => s.status === 'completed')
        .sort((a, b) => new Date(b.session_date) - new Date(a.session_date));

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Inventuren</DialogTitle>
                </DialogHeader>

                {completedSessions.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        Keine abgeschlossenen Inventuren
                    </div>
                ) : (
                    <div className="flex-1 overflow-auto border rounded-lg">
                        <Table>
                            <TableHeader className="sticky top-0 bg-slate-50 z-10">
                                <TableRow>
                                    <TableHead>Datum</TableHead>
                                    <TableHead>Bearbeiter</TableHead>
                                    <TableHead>Art</TableHead>
                                    <TableHead className="text-right">Artikel</TableHead>
                                    <TableHead className="text-right">Aktion</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {completedSessions.map(session => (
                                    <TableRow key={session.id}>
                                        <TableCell className="font-medium">
                                            {format(new Date(session.session_date), 'dd.MM.yyyy', { locale: de })}
                                        </TableCell>
                                        <TableCell>{session.employee_name || '-'}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                {periodTypeLabels[session.period_type] || session.period_type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {session.total_items_counted || session.entries?.length || 0}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleDownloadExcel(session)}
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
                    {completedSessions.length} abgeschlossene Inventuren
                </div>
            </DialogContent>
        </Dialog>
    );
}