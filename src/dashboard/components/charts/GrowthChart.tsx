"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function GrowthChart({ data }: { data: any[] }) {
    if (!data || data.length === 0) {
        return <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa' }}>No data available</div>;
    }

    return (
        <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorJoins" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis
                        dataKey="date"
                        stroke="#71717a"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        stroke="#71717a"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}`}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fafafa' }}
                        itemStyle={{ color: '#fafafa' }}
                        labelStyle={{ color: '#a1a1aa' }}
                    />
                    <Area
                        type="monotone"
                        dataKey="joins"
                        stroke="#7c3aed"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorJoins)"
                        name="New Members"
                    />
                    <Area
                        type="monotone"
                        dataKey="verified"
                        stroke="#4ade80"
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
