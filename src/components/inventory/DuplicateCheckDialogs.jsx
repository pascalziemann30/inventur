import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info } from 'lucide-react';

export function ExactDuplicateDialog({ open, onClose, duplicate }) {
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold text-red-600 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Artikel existiert bereits
                    </DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <p className="text-slate-700">
                        Dieser Artikel existiert bereits und kann nicht ein zweites Mal angelegt werden.
                    </p>
                    
                    {duplicate && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                            <div className="flex justify-between">
                                <span className="text-sm text-slate-600">Bezeichnung:</span>
                                <span className="text-sm font-medium">{duplicate.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-slate-600">Lieferant:</span>
                                <span className="text-sm font-medium">{duplicate.supplier_name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-slate-600">Kategorie:</span>
                                <span className="text-sm font-medium">{duplicate.category_name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-slate-600">Einheit:</span>
                                <span className="text-sm font-medium">{duplicate.unit_abbreviation}</span>
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex justify-end">
                    <Button onClick={onClose} variant="default">
                        Zurück zur Bearbeitung
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function SimilarArticlesDialog({ open, onClose, onProceed, similarArticles }) {
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold text-amber-600 flex items-center gap-2">
                        <Info className="w-5 h-5" />
                        Ähnliche Artikel gefunden
                    </DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <p className="text-slate-700">
                        Ein ähnlicher Artikel existiert bereits. Möchtest du diesen Artikel trotzdem neu anlegen?
                    </p>
                    
                    <div className="space-y-2">
                        {similarArticles.slice(0, 3).map((article, idx) => (
                            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
                                <div className="font-medium text-sm">{article.name}</div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                                    <span>Lieferant: {article.supplier_name}</span>
                                    <span>Kategorie: {article.category_name}</span>
                                    <span>Einheit: {article.unit_abbreviation}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button onClick={onClose} variant="outline" className="flex-1">
                        Abbrechen & prüfen
                    </Button>
                    <Button onClick={onProceed} className="flex-1 bg-slate-900 hover:bg-slate-800">
                        Trotzdem anlegen
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}