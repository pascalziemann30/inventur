import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO, eachDayOfInterval, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';

export default function WasteTimelineChart({ data }) {
    const chartData = useMemo(() => {
        if (data.length === 0) return [];

        // Group by date
        const byDate = {};
        data.forEach(item => {
            const date = format(parseISO(item.date), 'yyyy-MM-dd');
            if (!byDate[date]) {
                byDate[date] = { waste: 0 };
            }
            byDate[date].waste += item.value;
        });

        // Convert to array and sort
        return Object.entries(byDate)
            .map(([date, values]) => ({
                date: format(parseISO(date), 'dd.MM', { locale: de }),
                waste: values.waste
            }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [data]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Waste-Verlauf (Wert)</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 12 }}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                        />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip 
                            formatter={(value) => `${value.toFixed(2)} €`}
                            labelStyle={{ color: '#000' }}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="waste" 
                            stroke="#ef4444" 
                            fill="#fecaca" 
                            name="Waste"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}