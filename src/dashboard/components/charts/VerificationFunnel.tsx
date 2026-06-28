"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function VerificationFunnel({ data }: { data: { joinedLast30Days: number, verifiedLast30Days: number } }) {
    if (!data || data.joinedLast30Days === 0) {
        return <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa' }}>No new members in the last 30 days</div>;
    }

    const chartData = [
        { name: 'Joined', value: data.joinedLast30Days, color: 'hsl(var(--primary))' },
        { name: 'Verified', value: data.verifiedLast30Days, color: 'hsl(142 70% 45%)' } // green-ish
    ];

    const card = "hsl(var(--card))";
    const border = "hsl(var(--border))";
    const foreground = "hsl(var(--foreground))";
    const muted = "hsl(var(--muted-foreground))";

    return (
        <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={border} />
                    <XAxis type="number" stroke={muted} fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis dataKey="name" type="category" stroke={muted} fontSize={12} tickLine={false} axisLine={false} width={80} />
                    <Tooltip
                        contentStyle={{ backgroundColor: card, borderColor: border, color: foreground, borderRadius: '8px' }}
                        cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={40}>
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
