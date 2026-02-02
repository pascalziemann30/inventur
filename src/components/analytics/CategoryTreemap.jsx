import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';

export default function CategoryTreemap({ data, onCategoryClick }) {
    const chartData = useMemo(() => {
        // Group by category
        const byCategory = {};
        data.forEach(item => {
            const category = item.category || 'Keine Kategorie';
            if (!byCategory[category]) {
                byCategory[category] = 0;
            }
            byCategory[category] += (item.value || 0);
        });

        // Convert to array
        return Object.entries(byCategory)
            .map(([name, value]) => ({ 
                name, 
                size: value,
                value: value 
            }))
            .sort((a, b) => b.value - a.value);
    }, [data]);

    const CustomizedContent = ({ x, y, width, height, name, value }) => {
        return (
            <g>
                <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    style={{
                        fill: `hsl(${Math.random() * 360}, 70%, 50%)`,
                        stroke: '#fff',
                        strokeWidth: 2,
                        cursor: 'pointer'
                    }}
                    onClick={() => onCategoryClick && onCategoryClick(name)}
                />
                {width > 60 && height > 40 && (
                    <>
                        <text
                            x={x + width / 2}
                            y={y + height / 2 - 7}
                            textAnchor="middle"
                            fill="#fff"
                            fontSize={12}
                            fontWeight="bold"
                        >
                            {name}
                        </text>
                        <text
                            x={x + width / 2}
                            y={y + height / 2 + 10}
                            textAnchor="middle"
                            fill="#fff"
                            fontSize={11}
                        >
                            {value.toFixed(2)} €
                        </text>
                    </>
                )}
            </g>
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Waste nach Kategorie</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                    <Treemap
                        data={chartData}
                        dataKey="size"
                        aspectRatio={4 / 3}
                        stroke="#fff"
                        fill="#8884d8"
                        content={<CustomizedContent />}
                    />
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}