import React from 'react';
import { Card } from "@/components/ui/card";
import { Calendar, User, Clock, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const periodLabels = {
    weekly: 'Wöchentlich',
    monthly: 'Monatlich',
    yearly: 'Jährlich',
    adhoc: 'Einzelzählung'
};

export default function SessionHeader({ session, countedItems, totalItems }) {
    const progress = totalItems > 0 ? Math.round((countedItems / totalItems) * 100) : 0;

    return (
        <Card className="bg-white border-slate-200 p-4 sm:p-6">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 mb-1">
                            Inventur-Erfassung
                        </h2>
                        <p className="text-sm text-slate-500">
                            Zähle alle Artikel und bestätige am Ende
                        </p>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-lg">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <div>
                            <div className="text-sm font-semibold text-slate-900">
                                {countedItems} / {totalItems}
                            </div>
                            <div className="text-xs text-slate-500">
                                Artikel gezählt
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                        <Calendar className="w-4 h-4" />
                        <span className="font-medium">
                            {format(new Date(session.session_date), 'dd. MMMM yyyy', { locale: de })}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                        <Clock className="w-4 h-4" />
                        <span>{periodLabels[session.period_type]}</span>
                    </div>
                    {session.employee_name && (
                        <div className="flex items-center gap-2 text-slate-600">
                            <User className="w-4 h-4" />
                            <span>{session.employee_name}</span>
                        </div>
                    )}
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Fortschritt</span>
                        <span className="font-semibold text-slate-900">{progress}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>
        </Card>
    );
}