
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "../../../../components/ui/button";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "../../../../components/ui/card";
import { Users, ShieldCheck, Rocket, Zap, Mic, Clock, Trophy } from "lucide-react";

export default function AnalyticsPage() {
    const params = useParams();
    const guildId = params.guildId as string;

    const [stats, setStats] = useState({
        members: 0,
        verified: 0,
        boosts: 0,
        actionsToday: 0,
        voiceHours: 0,
        retentionRate: 0
    });
    // Removed: Growth and Role data state
    const [heatmapData, setHeatmapData] = useState<number[][]>([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/guilds/${guildId}/analytics`);
            if (res.ok) {
                const data = await res.json();
                if (data.stats) setStats(data.stats);

                if (data.heatmap) {
                    const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
                    data.heatmap.forEach((h: any) => {
                        if (matrix[h.day] && matrix[h.day][h.hour] !== undefined) {
                            matrix[h.day][h.hour] += h.count;
                        }
                    });
                    setHeatmapData(matrix);
                }

                if (data.leaderboard) setLeaderboard(data.leaderboard);
            }
        } catch (error) {
            console.error("Failed to fetch analytics:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [guildId]);

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
                    <p className="text-muted-foreground">Detailed insights into your server's performance.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={fetchData}>Refresh</Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                <StatCard title="Total Members" value={stats.members.toLocaleString()} icon={Users} />
                <StatCard title="Verified" value={stats.verified.toLocaleString()} icon={ShieldCheck} />
                <StatCard title="Voice Hours" value={`${stats.voiceHours}h`} icon={Mic} />
                <StatCard title="Retention" value={`${stats.retentionRate}%`} icon={Clock} />
                <StatCard title="Boosts" value={stats.boosts.toLocaleString()} icon={Rocket} />
                <StatCard title="Actions (24h)" value={stats.actionsToday.toLocaleString()} icon={Zap} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {/* Activity Heatmap (Day x Hour Grid) */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Activity Heatmap</CardTitle>
                        <CardDescription>Busiest times of the week (UTC)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Loading /> : (
                            <div className="flex flex-col gap-2 overflow-x-auto pb-2">
                                <div className="flex">
                                    <div className="w-10"></div>
                                    <div className="flex-1 grid grid-cols-24 gap-0.5 min-w-[500px]">
                                        {Array.from({ length: 24 }).map((_, h) => (
                                            <div key={h} className="text-[10px] text-muted-foreground text-center">
                                                {h % 4 === 0 ? h : ''}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {heatmapData.length > 0 && heatmapData.map((dayData: number[], dayIndex: number) => {
                                    const max = Math.max(...(heatmapData.flat() as number[])) || 1;
                                    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                                    return (
                                        <div key={dayIndex} className="flex items-center">
                                            <div className="w-10 text-xs text-muted-foreground font-medium">
                                                {days[dayIndex]}
                                            </div>
                                            <div className="flex-1 grid grid-cols-24 gap-0.5 min-w-[500px]">
                                                {dayData.map((count, hourIndex) => {
                                                    const intensity = count > 0 ? 0.3 + (0.7 * (count / max)) : 0.05;
                                                    return (
                                                        <div
                                                            key={hourIndex}
                                                            className="aspect-square rounded-sm transition-all hover:ring-2 ring-primary/50 cursor-help"
                                                            style={{
                                                                backgroundColor: `hsl(var(--primary) / ${intensity})`,
                                                            }}
                                                            title={`${count} messages at ${hourIndex}:00`}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Leaderboard */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Top Active Members</CardTitle>
                        <CardDescription>Most XP earned</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Loading /> : (
                            <div className="space-y-4">
                                {leaderboard.map((user: any, i) => (
                                    <div key={user.userId} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-bold text-primary overflow-hidden">
                                                {user.avatar ? (
                                                    <img
                                                        src={`https://cdn.discordapp.com/avatars/${user.userId}/${user.avatar}.png`}
                                                        alt={user.username}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    i + 1
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{user.username}</span>
                                                <span className="text-xs text-muted-foreground">Level {user.level}</span>
                                            </div>
                                        </div>
                                        <div className="font-bold flex items-center gap-1">
                                            <Trophy className="h-3 w-3 text-yellow-500" />
                                            {user.xp.toLocaleString()} XP
                                        </div>
                                    </div>
                                ))}
                                {leaderboard.length === 0 && <p className="text-muted-foreground text-center py-4">No data yet</p>}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon: Icon }: { title: string, value: string, icon: any }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
            </CardContent>
        </Card>
    );
}

function Loading() {
    return <div className="h-full flex items-center justify-center text-muted-foreground">Loading...</div>;
}
