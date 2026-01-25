import React, { useState, useRef, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp } from 'lucide-react';

const categoryColors = {
    'Getränke': 'bg-violet-100 text-violet-700',
    'Trockenware': 'bg-amber-100 text-amber-700',
    'Frische Lebensmittel': 'bg-emerald-100 text-emerald-700',
    'Tiefkühlware': 'bg-cyan-100 text-cyan-700',
    'Non-Food': 'bg-indigo-100 text-indigo-700',
    'Verpackungen': 'bg-pink-100 text-pink-700',
    'Reinigungsmittel': 'bg-teal-100 text-teal-700',
    'Sonstiges': 'bg-slate-100 text-slate-700'
};

export default function InventoryCaptureTable({ articles, entries, onUpdateEntry }) {
    const inputRefs = useRef({});
    const [focusedIndex, setFocusedIndex] = useState(0);

    const handleChange = (articleId, value) => {
        const numValue = value === '' ? null : parseFloat(value);
        onUpdateEntry(articleId, numValue);
    };

    const handleKeyDown = (e, index) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const nextIndex = index + 1;
            if (nextIndex < articles.length) {
                const nextArticleId = articles[nextIndex].id;
                inputRefs.current[nextArticleId]?.focus();
                setFocusedIndex(nextIndex);
            }
        }
    };

    const getEntry = (articleId) => {
        return entries.find(e => e.article_id === articleId);
    };

    const getDifference = (article) => {
        const entry = getEntry(article.id);
        if (entry && entry.counted_quantity !== null && entry.counted_quantity !== undefined) {
            return entry.counted_quantity - article.current_stock;
        }
        return null;
    };

    return (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-100 border-b-2 border-slate-200">
                        <TableHead className="font-bold text-slate-900 w-12">#</TableHead>
                        <TableHead className="font-bold text-slate-900">Artikel</TableHead>
                        <TableHead className="font-bold text-slate-900 text-center hidden sm:table-cell">Letzter Stand</TableHead>
                        <TableHead className="font-bold text-slate-900 text-center">Gezählt</TableHead>
                        <TableHead className="font-bold text-slate-900 text-center hidden md:table-cell">Differenz</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {articles.map((article, index) => {
                        const entry = getEntry(article.id);
                        const counted = entry?.counted_quantity;
                        const diff = getDifference(article);
                        const hasValue = counted !== null && counted !== undefined;
                        const isHighDiff = diff && Math.abs(diff) > article.current_stock * 0.3; // >30% Abweichung

                        return (
                            <TableRow 
                                key={article.id}
                                className={`
                                    hover:bg-slate-50 transition-colors
                                    ${hasValue ? 'bg-emerald-50/30' : ''}
                                    ${focusedIndex === index ? 'bg-blue-50' : ''}
                                `}
                            >
                                <TableCell className="text-slate-400 text-sm font-mono">
                                    {index + 1}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium text-slate-900">
                                            {article.name}
                                        </span>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge 
                                                variant="secondary" 
                                                className={`${categoryColors[article.category_name]} text-xs hidden sm:inline-flex`}
                                            >
                                                {article.category_name}
                                            </Badge>
                                            <span className="text-xs text-slate-500 font-medium">
                                                Einheit: {article.unit_abbreviation}
                                            </span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-center hidden sm:table-cell">
                                    <span className="font-mono text-slate-600">
                                        {article.current_stock?.toFixed(1) || '0.0'}
                                    </span>
                                    <span className="text-xs text-slate-400 ml-1">
                                        {article.unit_abbreviation}
                                    </span>
                                </TableCell>
                                <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <Input
                                            ref={(el) => inputRefs.current[article.id] = el}
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            value={counted ?? ''}
                                            onChange={(e) => handleChange(article.id, e.target.value)}
                                            onKeyDown={(e) => handleKeyDown(e, index)}
                                            onFocus={() => setFocusedIndex(index)}
                                            placeholder="—"
                                            className={`
                                                w-24 sm:w-28 text-center font-mono text-lg
                                                ${hasValue ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold' : ''}
                                                focus:ring-2 focus:ring-blue-500
                                            `}
                                        />
                                        <span className="text-sm text-slate-500 min-w-[3ch] hidden sm:inline">
                                            {article.unit_abbreviation}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-center hidden md:table-cell">
                                    {diff !== null ? (
                                        <div className="flex items-center justify-center gap-1">
                                            {isHighDiff && (
                                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                            )}
                                            <span className={`
                                                font-mono font-medium
                                                ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-slate-500'}
                                            `}>
                                                {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                                            </span>
                                            <span className="text-xs text-slate-400">
                                                {article.unit_abbreviation}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-slate-300">—</span>
                                    )}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>

            <div className="bg-slate-50 p-4 border-t border-slate-200 text-sm text-slate-600">
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300"></div>
                        <span>Gezählt</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span>Große Abweichung (&gt;30%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <kbd className="px-2 py-1 bg-white border border-slate-300 rounded text-xs">Enter</kbd>
                        <span>Nächster Artikel</span>
                    </div>
                </div>
            </div>
        </div>
    );
}