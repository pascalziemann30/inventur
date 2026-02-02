import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function OutletComparisonChart({ data, deliveryValue }) {
    const chartData = useMemo(() => {
        // Group by outlet
        const byOutlet = {};
        data.forEach(item => {
            const outlet = item.outlet_name || 'Unbekannt';
            if (!byOutlet[outlet]) {
                byOutlet[outlet] = { waste: 0 };
            }
            byOutlet[outlet].waste += (item.value || 0);
        });

        // Calculate waste quote (simplified - using total delivery value)
        return Object.entries(byOutlet).map(([name, values]) => ({
            name,
            waste: values.waste || 0,
            quote: (deliveryValue || 0) > 0 ? ((values.waste || 0) / (deliveryValue || 1)) * 100 : 0
        }));
    }, [data, deliveryValue]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Outlet-Vergleich</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="waste" fill="#ef4444" name="Waste (€)" />
                        <Bar yAxisId="right" dataKey="quote" fill="#f97316" name="Quote (%)" />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}