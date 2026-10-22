import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';

export default function CompletionDialog({ 
    open, 
    onClose, 
    onConfirm, 
    countedItems, 
    totalItems,
    highDifferences,
    isProcessing 
}) {
    const hasWarnings = highDifferences.length > 0;
    const missingCount = totalItems - countedItems;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">
                        Inventur abschließen?
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Status Summary */}
                    <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600">Gezählte Artikel:</span>
                            <span className="font-bold text-lg text-slate-900">
                                {countedItems} / {totalItems}
                            </span>
                        </div>
                        {missingCount > 0 && (
                            <div className="flex items-center justify-between text-amber-600">
                                <span className="text-sm">Nicht gezählt:</span>
                                <span className="font-semibold">{missingCount} Artikel</span>
                            </div>
                        )}
                    </div>

                    {/* Warnings */}
                    {missingCount > 0 && (
                        <Alert className="border-amber-200 bg-amber-50">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-amber-800">
                                <strong>Hinweis:</strong> {missingCount} Artikel wurden nicht gezählt. 
                                Diese behalten ihren aktuellen Bestand.
                            </AlertDescription>
                        </Alert>
                    )}

                    {hasWarnings && (
                        <Alert className="border-red-200 bg-red-50">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-red-800">
                                <strong>Große Abweichungen erkannt:</strong>
                                <ul className="mt-2 space-y-1 text-sm">
                                    {highDifferences.slice(0, 5).map((item, idx) => (
                                        <li key={idx} className="flex items-center gap-2">
                                            {item.difference > 0 ? (
                                                <TrendingUp className="w-3 h-3" />
                                            ) : (
                                                <TrendingDown className="w-3 h-3" />
                                            )}
                                            <span>
                                                <strong>{item.article_name}:</strong> {item.difference > 0 ? '+' : ''}{item.difference.toFixed(1)} {item.unit_abbreviation}
                                            </span>
                                        </li>
                                    ))}
                                    {highDifferences.length > 5 && (
                                        <li className="text-slate-600">
                                            ... und {highDifferences.length - 5} weitere
                                        </li>
                                    )}
                                </ul>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Success Info */}
                    {!hasWarnings && missingCount === 0 && (
                        <Alert className="border-emerald-200 bg-emerald-50">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <AlertDescription className="text-emerald-800">
                                Alle Artikel gezählt! Die Inventur ist vollständig.
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Explanation */}
                    <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-900">
                        <p className="font-semibold mb-1">Was passiert beim Abschließen?</p>
                        <ul className="space-y-1 text-blue-800 ml-4 list-disc">
                            <li>Gezählte Mengen werden in die Hauptdatenbank übertragen</li>
                            <li>Der Bestand aller Artikel wird aktualisiert</li>
                            <li>Die Inventur wird im Verlauf gespeichert</li>
                            <li>Der Verbrauch wird neu berechnet</li>
                        </ul>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={isProcessing}
                    >
                        Abbrechen
                    </Button>
                    <Button
                        type="button"
                        onClick={onConfirm}
                        disabled={isProcessing}
                        className="bg-emerald-600 hover:bg-emerald-700"
                    >
                        {isProcessing ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                Wird übertragen...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Inventur abschließen
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}