import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Save, CheckCircle } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from "sonner";
import { format } from 'date-fns';

import SessionHeader from '../components/inventory/SessionHeader';
import InventoryCaptureTable from '../components/inventory/InventuryCaptureTable';
import CompletionDialog from '../components/inventory/CompletionDialog';

export default function InventoryCapture() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session');

    const [currentSession, setCurrentSession] = useState(null);
    const [entries, setEntries] = useState([]);
    const [showNewSessionForm, setShowNewSessionForm] = useState(!sessionId);
    const [showCompletionDialog, setShowCompletionDialog] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // New session form
    const [sessionDate, setSessionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [periodType, setPeriodType] = useState('weekly');
    const [employeeName, setEmployeeName] = useState('');

    // Data queries
    const { data: articles = [] } = useQuery({
        queryKey: ['articles'],
        queryFn: () => base44.entities.Article.list()
    });

    const { data: inventories = [] } = useQuery({
        queryKey: ['inventories'],
        queryFn: () => base44.entities.Inventory.list('-inventory_date')
    });

    const { data: deliveries = [] } = useQuery({
        queryKey: ['deliveries'],
        queryFn: () => base44.entities.Delivery.list('-delivery_date')
    });

    const { data: sessions = [] } = useQuery({
        queryKey: ['inventory-sessions'],
        queryFn: () => base44.entities.InventorySession.list('-created_date')
    });

    // Load existing session
    useEffect(() => {
        if (sessionId && sessions.length > 0) {
            const session = sessions.find(s => s.id === sessionId);
            if (session) {
                setCurrentSession(session);
                setEntries(session.entries || []);
                setShowNewSessionForm(false);
            }
        }
    }, [sessionId, sessions]);

    // Calculate article frequency (consumption + deliveries)
    const sortedArticles = useMemo(() => {
        if (!articles.length) return [];

        const activeArticles = articles.filter(a => a.is_active !== false);

        const articlesWithFrequency = activeArticles.map(article => {
            // Count consumption from inventories
            const articleInventories = inventories.filter(inv => inv.article_id === article.id);
            const consumptionCount = articleInventories.length;

            // Count deliveries
            const deliveryCount = deliveries.filter(del => 
                del.items?.some(item => item.article_id === article.id)
            ).length;

            // Total activity = higher is more important
            const frequency = consumptionCount + deliveryCount;

            return {
                ...article,
                frequency
            };
        });

        // Sort by frequency (descending)
        return articlesWithFrequency.sort((a, b) => b.frequency - a.frequency);
    }, [articles, inventories, deliveries]);

    // Create new session
    const createSessionMutation = useMutation({
        mutationFn: async (data) => {
            const initialEntries = sortedArticles.map(article => ({
                article_id: article.id,
                article_name: article.name,
                unit_abbreviation: article.unit_abbreviation,
                last_stock: article.current_stock || 0,
                counted_quantity: null,
                difference: null
            }));

            const sessionData = {
                ...data,
                entries: initialEntries,
                status: 'in_progress',
                total_items_counted: 0
            };

            return base44.entities.InventorySession.create(sessionData);
        },
        onSuccess: (newSession) => {
            setCurrentSession(newSession);
            setEntries(newSession.entries || []);
            setShowNewSessionForm(false);
            queryClient.invalidateQueries({ queryKey: ['inventory-sessions'] });
            toast.success('Inventur-Session gestartet');
        }
    });

    // Update session (auto-save entries)
    const updateSessionMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.InventorySession.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory-sessions'] });
        }
    });

    // Complete session
    const completeSessionMutation = useMutation({
        mutationFn: async () => {
            const validEntries = entries.filter(e => e.counted_quantity !== null);
            
            // Create inventory records and update article stocks
            for (const entry of validEntries) {
                const inventoryData = {
                    article_id: entry.article_id,
                    article_name: entry.article_name,
                    counted_quantity: entry.counted_quantity,
                    unit_abbreviation: entry.unit_abbreviation,
                    inventory_date: currentSession.session_date,
                    inventory_type: currentSession.period_type,
                    previous_stock: entry.last_stock,
                    difference: entry.difference,
                    notes: `Erfasst von: ${currentSession.employee_name || 'System'}`
                };
                
                await base44.entities.Inventory.create(inventoryData);
                
                // Update article stock
                await base44.entities.Article.update(entry.article_id, {
                    current_stock: entry.counted_quantity
                });
            }

            // Mark session as completed
            await base44.entities.InventorySession.update(currentSession.id, {
                status: 'completed',
                total_items_counted: validEntries.length
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventories'] });
            queryClient.invalidateQueries({ queryKey: ['articles'] });
            queryClient.invalidateQueries({ queryKey: ['inventory-sessions'] });
            toast.success('Inventur erfolgreich abgeschlossen!');
            navigate(createPageUrl('Dashboard'));
        }
    });

    const handleStartSession = (e) => {
        e.preventDefault();
        createSessionMutation.mutate({
            session_date: sessionDate,
            period_type: periodType,
            employee_name: employeeName
        });
    };

    const handleUpdateEntry = (articleId, countedQuantity) => {
        const newEntries = entries.map(entry => {
            if (entry.article_id === articleId) {
                const difference = countedQuantity !== null 
                    ? countedQuantity - entry.last_stock 
                    : null;
                return { ...entry, counted_quantity: countedQuantity, difference };
            }
            return entry;
        });

        setEntries(newEntries);

        // Auto-save session
        if (currentSession) {
            const countedCount = newEntries.filter(e => e.counted_quantity !== null).length;
            updateSessionMutation.mutate({
                id: currentSession.id,
                data: {
                    entries: newEntries,
                    total_items_counted: countedCount
                }
            });
        }
    };

    const handleCompleteClick = () => {
        setShowCompletionDialog(true);
    };

    const handleConfirmComplete = async () => {
        setIsProcessing(true);
        try {
            await completeSessionMutation.mutateAsync();
        } catch (error) {
            toast.error('Fehler beim Abschließen der Inventur');
            setIsProcessing(false);
        }
    };

    const countedItems = entries.filter(e => e.counted_quantity !== null).length;
    const highDifferences = entries
        .filter(e => {
            if (e.counted_quantity === null) return false;
            const percentDiff = Math.abs(e.difference) / Math.max(e.last_stock, 1);
            return percentDiff > 0.3; // >30% difference
        })
        .map(e => ({
            article_name: e.article_name,
            difference: e.difference,
            unit_abbreviation: e.unit_abbreviation
        }));

    if (showNewSessionForm) {
        return (
            <div className="min-h-screen bg-slate-50">
                <header className="bg-white border-b border-slate-200">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
                        <div className="flex items-center gap-4">
                            <Link to={createPageUrl('Dashboard')}>
                                <Button variant="ghost" size="icon">
                                    <ArrowLeft className="w-5 h-5" />
                                </Button>
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold text-slate-900">
                                    Neue Inventur starten
                                </h1>
                                <p className="text-sm text-slate-500">
                                    Session-Informationen eingeben
                                </p>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
                    <Card className="p-6">
                        <form onSubmit={handleStartSession} className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="date">Inventurdatum *</Label>
                                    <Input
                                        id="date"
                                        type="date"
                                        value={sessionDate}
                                        onChange={(e) => setSessionDate(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Zeitraum *</Label>
                                    <Select value={periodType} onValueChange={setPeriodType}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="weekly">Wöchentlich</SelectItem>
                                            <SelectItem value="monthly">Monatlich</SelectItem>
                                            <SelectItem value="yearly">Jährlich</SelectItem>
                                            <SelectItem value="adhoc">Einzelzählung</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="employee">Mitarbeitername / Kürzel</Label>
                                <Input
                                    id="employee"
                                    value={employeeName}
                                    onChange={(e) => setEmployeeName(e.target.value)}
                                    placeholder="z.B. Max, Maria, MM..."
                                />
                            </div>

                            <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-900">
                                <p className="font-semibold mb-1">Hinweis:</p>
                                <p>Die Artikel werden automatisch nach Bestellhäufigkeit sortiert. Die wichtigsten Artikel erscheinen zuerst.</p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Link to={createPageUrl('Dashboard')} className="flex-1">
                                    <Button type="button" variant="outline" className="w-full">
                                        Abbrechen
                                    </Button>
                                </Link>
                                <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                                    Session starten
                                </Button>
                            </div>
                        </form>
                    </Card>
                </main>
            </div>
        );
    }

    if (!currentSession) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-500">Lade Session...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                    <div className="flex items-center gap-4">
                        <Link to={createPageUrl('Dashboard')}>
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div className="flex-1">
                            <h1 className="text-xl font-bold text-slate-900">
                                Inventur läuft
                            </h1>
                            <p className="text-sm text-slate-500">
                                {countedItems} von {sortedArticles.length} gezählt
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                if (currentSession) {
                                    updateSessionMutation.mutate({
                                        id: currentSession.id,
                                        data: { entries }
                                    });
                                    toast.success('Zwischenstand gespeichert');
                                }
                            }}
                            className="hidden sm:flex"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            Speichern
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                <SessionHeader
                    session={currentSession}
                    countedItems={countedItems}
                    totalItems={sortedArticles.length}
                />

                <InventoryCaptureTable
                    articles={sortedArticles}
                    entries={entries}
                    onUpdateEntry={handleUpdateEntry}
                />
            </main>

            {/* Fixed Bottom Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-lg z-20">
                <div className="max-w-7xl mx-auto flex gap-3">
                    <Button
                        variant="outline"
                        onClick={() => {
                            if (confirm('Inventur wirklich abbrechen? Nicht gespeicherte Daten gehen verloren.')) {
                                navigate(createPageUrl('Dashboard'));
                            }
                        }}
                        className="flex-1 sm:flex-none sm:px-8"
                    >
                        Abbrechen
                    </Button>
                    <Button
                        onClick={handleCompleteClick}
                        disabled={countedItems === 0}
                        className="flex-1 sm:flex-none sm:px-8 bg-emerald-600 hover:bg-emerald-700 text-base font-semibold"
                    >
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Inventur abschließen
                    </Button>
                </div>
            </div>

            <CompletionDialog
                open={showCompletionDialog}
                onClose={() => setShowCompletionDialog(false)}
                onConfirm={handleConfirmComplete}
                countedItems={countedItems}
                totalItems={sortedArticles.length}
                highDifferences={highDifferences}
                isProcessing={isProcessing}
            />
        </div>
    );
}