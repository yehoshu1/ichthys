"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS: Record<string, string> = {
    WARN: '#f59e0b',    // yellow
    MUTE: '#3b82f6',    // blue
    KICK: '#f97316',    // orange
    BAN: '#ef4444',     // red
    DEFAULT: '#8b5cf6'  // purple
};

export default function ModerationPieChart({ data }: { data: { action: string, count: number }[] }) {
    if (!data || data.length === 0) {
        return <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa' }}>No moderation actions in the last 30 days</div>;
    }

    const card = "hsl(var(--card))";
    const border = "hsl(var(--border))";
    const foreground = "hsl(var(--foreground))";
    const muted = "hsl(var(--muted-foreground))";

    return (
        <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="count"
                        nameKey="action"
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[entry.action.toUpperCase()] || COLORS.DEFAULT} />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{ backgroundColor: card, borderColor: border, color: foreground, borderRadius: '8px' }}
                        itemStyle={{ color: foreground }}
                    />
                    <Legend wrapperStyle={{ color: muted, fontSize: '12px' }} />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
