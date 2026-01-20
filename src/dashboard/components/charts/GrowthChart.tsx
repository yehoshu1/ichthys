"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function GrowthChart({ data }: { data: any[] }) {
    if (!data || data.length === 0) {
        return <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa' }}>No data available</div>;
    }

    const primary = "hsl(var(--primary))";
    const muted = "hsl(var(--muted-foreground))";
    const border = "hsl(var(--border))";
    const card = "hsl(var(--card))";
    const foreground = "hsl(var(--foreground))";

    return (
        <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorJoins" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={primary} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={primary} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={border} vertical={false} />
                    <XAxis
                        dataKey="date"
                        stroke={muted}
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        stroke={muted}
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}`}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: card, borderColor: border, color: foreground }}
                        itemStyle={{ color: foreground }}
                        labelStyle={{ color: muted }}
                    />
                    <Area
                        type="monotone"
                        dataKey="joins"
                        stroke={primary}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorJoins)"
                        name="New Members"
                    />
                    <Area
                        type="monotone"
                        dataKey="verified"
                        stroke="hsl(142 70% 45%)"
                        strokeWidth={2}
                        fillOpacity={0}
                        fill="transparent"
                        name="Verified"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
