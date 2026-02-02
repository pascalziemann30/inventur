import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#06b6d4', '#6366f1', '#a855f7'];

export default function WasteByReasonChart({ data }) {
    const chartData = useMemo(() => {
        // Group by reason
        const byReason = {};
        data.forEach(item => {
            const reason = item.reason || 'Kein Grund angegeben';
            if (!byReason[reason]) {
                byReason[reason] = 0;
            }
            byReason[reason] += item.value;
        });

        // Convert to array
        return Object.entries(byReason)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [data]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Waste nach Grund</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(entry) => `${entry.name}`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(value) => `${value.toFixed(2)} €`} />
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}