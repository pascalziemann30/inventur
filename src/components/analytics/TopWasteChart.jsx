import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function TopWasteChart({ data, onArticleClick }) {
    const chartData = useMemo(() => {
        // Group by article
        const byArticle = {};
        data.forEach(item => {
            if (!byArticle[item.article_name]) {
                byArticle[item.article_name] = { value: 0, quantity: 0, article: item };
            }
            byArticle[item.article_name].value += item.value;
            byArticle[item.article_name].quantity += item.quantity;
        });

        // Get top 10
        return Object.entries(byArticle)
            .map(([name, data]) => ({
                name,
                value: data.value,
                quantity: data.quantity,
                article: data.article
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [data]);

    const handleClick = (data) => {
        if (data && onArticleClick) {
            onArticleClick(data.article);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Top 10 Waste Artikel (Wert)</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis 
                            dataKey="name" 
                            type="category" 
                            width={100}
                            tick={{ fontSize: 11 }}
                        />
                        <Tooltip 
                            formatter={(value) => `${value.toFixed(2)} €`}
                            labelStyle={{ color: '#000' }}
                        />
                        <Bar 
                            dataKey="value" 
                            fill="#ef4444"
                            onClick={handleClick}
                            cursor="pointer"
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={`hsl(${0 - index * 3}, 85%, ${55 - index * 2}%)`} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}