"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useMemo, useCallback } from "react";

import { Button } from "../../../../components/ui/button";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "../../../../components/ui/card";
import { Users, ShieldCheck, Rocket, Zap, Mic, Clock, Trophy, CalendarDays, CheckSquare, Cake, Activity, Timer } from "lucide-react";
import { HelperText, LabelWithTooltip } from "../../../../components/HelpTooltip";
import GrowthChart from "../../../../components/charts/GrowthChart";
import ModerationPieChart from "../../../../components/charts/ModerationPieChart";
import VerificationFunnel from "../../../../components/charts/VerificationFunnel";
import { FadeInStagger, FadeInItem, InteractiveCard } from "../../../../components/MotionWrapper";

interface Stats {
    members: number;
    verified: number;
    boosts: number;
    actionsToday: number;
    voiceHours: number;
    retentionRate: number;
    eventsThisMonth: number;
    pollsThisMonth: number;
    birthdaysThisMonth: number;
    actionSuccessRate: number;
    avgVerifyHours: number;
}

interface LeaderboardUser {
    userId: string;
    username: string;
    level: number;
    xp: number;
    avatar: string | null;
}

interface HeatmapEntry {
    day: number;
    hour: number;
    count: number;
}

export default function AnalyticsPage() {
    const params = useParams();
    const guildId = params.guildId as string;

    const [stats, setStats] = useState<Stats>({
        members: 0,
        verified: 0,
        boosts: 0,
        actionsToday: 0,
        voiceHours: 0,
        retentionRate: 0,
        eventsThisMonth: 0,
        pollsThisMonth: 0,
        birthdaysThisMonth: 0,
        actionSuccessRate: 100,
        avgVerifyHours: 0,
    });
    const [heatmapData, setHeatmapData] = useState<HeatmapEntry[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
    const [moderationStats, setModerationStats] = useState<{ action: string; count: number }[]>([]);
    const [verificationStats, setVerificationStats] = useState<{ joinedLast30Days: number; verifiedLast30Days: number }>({ joinedLast30Days: 0, verifiedLast30Days: 0 });
    const [growthData, setGrowthData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // 🎯 PERFORMANCE FIX: Memoize fetch function to prevent unnecessary re-renders
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/guilds/${guildId}/analytics`);
            if (res.ok) {
                const data = await res.json();
                if (data.stats) setStats(data.stats);
                if (data.heatmap) setHeatmapData(data.heatmap);
                if (data.leaderboard) setLeaderboard(data.leaderboard);
                if (data.moderationStats) setModerationStats(data.moderationStats);
                if (data.verificationStats) setVerificationStats(data.verificationStats);
                if (data.growth) setGrowthData(data.growth);
            }
        } catch (error) {
            console.error("Failed to fetch analytics:", error);
        } finally {
            setLoading(false);
        }
    }, [guildId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // 🎯 PERFORMANCE FIX: Memoize heatmap matrix calculation
    const heatmapMatrix = useMemo(() => {
        if (!heatmapData.length) return [];

        const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
        heatmapData.forEach((h) => {
            if (matrix[h.day] && matrix[h.day][h.hour] !== undefined) {
                matrix[h.day][h.hour] += h.count;
            }
        });
        return matrix;
    }, [heatmapData]);

    // 🎯 PERFORMANCE FIX: Memoize max calculation
    const maxHeatmapValue = useMemo(() => {
        if (!heatmapMatrix.length) return 1;
        return Math.max(...heatmapMatrix.flat()) || 1;
    }, [heatmapMatrix]);

    // 🎯 PERFORMANCE FIX: Memoize days array
    const days = useMemo(() => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], []);

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
                    <p className="text-muted-foreground">Detailed insights into your server&apos;s performance.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={fetchData}>Refresh</Button>
                </div>
            </div>

            {/* Stats Grid */}
            <FadeInStagger className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                <StatCard title="Total Members" value={stats.members.toLocaleString()} icon={Users} tooltip="Current server member count" />
                <StatCard title="Verified" value={stats.verified.toLocaleString()} icon={ShieldCheck} tooltip="Members who have the verification role" />
                <StatCard title="Voice Hours" value={`${stats.voiceHours}h`} icon={Mic} tooltip="Total hours spent in voice channels by all members" />
                <StatCard title="Retention" value={`${stats.retentionRate}%`} icon={Clock} tooltip="Percentage of members who stay vs leave over time" />
                <StatCard title="Boosts" value={stats.boosts.toLocaleString()} icon={Rocket} tooltip="Current number of server boosts" />
                <StatCard title="Actions (24h)" value={stats.actionsToday.toLocaleString()} icon={Zap} tooltip="Automated actions executed in the last 24 hours" />
                
                <StatCard title="Events (30d)" value={stats.eventsThisMonth.toLocaleString()} icon={CalendarDays} tooltip="Events scheduled in the last 30 days" />
                <StatCard title="Polls (30d)" value={stats.pollsThisMonth.toLocaleString()} icon={CheckSquare} tooltip="Polls created in the last 30 days" />
                <StatCard title="Birthdays (This Month)" value={stats.birthdaysThisMonth.toLocaleString()} icon={Cake} tooltip="Birthdays happening this month" />
                <StatCard title="Action Reliability" value={`${stats.actionSuccessRate}%`} icon={Activity} tooltip="Success rate of automated background actions" />
                <StatCard title="Avg Verify Time" value={`${stats.avgVerifyHours}h`} icon={Timer} tooltip="Average time from join to verification" />
            </FadeInStagger>

            <FadeInStagger className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Growth Chart */}
                <FadeInItem className="col-span-1 lg:col-span-2">
                    <InteractiveCard className="h-full">
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle>Member Growth</CardTitle>
                                <CardDescription>Server population over the last 30 days</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loading ? <Loading /> : <GrowthChart data={growthData} />}
                            </CardContent>
                        </Card>
                    </InteractiveCard>
                </FadeInItem>

                {/* Verification Funnel */}
                <FadeInItem className="col-span-1">
                    <InteractiveCard className="h-full">
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle>Verification Funnel</CardTitle>
                                <CardDescription>Users joined vs verified (30d)</CardDescription>
                                <HelperText>Shows how many of the users who joined recently actually completed the verification process.</HelperText>
                            </CardHeader>
                            <CardContent>
                                {loading ? <Loading /> : <VerificationFunnel data={verificationStats} />}
                            </CardContent>
                        </Card>
                    </InteractiveCard>
                </FadeInItem>
            </FadeInStagger>

            <FadeInStagger className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Moderation Chart */}
                <FadeInItem className="col-span-1">
                    <InteractiveCard className="h-full">
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle>Moderation Overview</CardTitle>
                                <CardDescription>Actions taken (30d)</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loading ? <Loading /> : <ModerationPieChart data={moderationStats} />}
                            </CardContent>
                        </Card>
                    </InteractiveCard>
                </FadeInItem>
                {/* Activity Heatmap (Day x Hour Grid) */}
                <FadeInItem className="col-span-1 lg:col-span-2">
                    <InteractiveCard className="h-full">
                        <Card className="h-full">
                    <CardHeader>
                        <CardTitle>Activity Heatmap</CardTitle>
                        <CardDescription>Busiest times of the week (UTC)</CardDescription>
                        <HelperText>Darker colors indicate more activity. Hover over cells to see message counts. Times are in UTC.</HelperText>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Loading /> : (
                            <div className="flex flex-col gap-2 overflow-x-auto pb-2">
                                <div className="flex">
                                    <div className="w-10"></div>
                                    <div className="flex-1 grid gap-0.5 min-w-[500px]" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                                        {Array.from({ length: 24 }).map((_, h) => (
                                            <div key={h} className="text-[10px] text-muted-foreground text-center">
                                                {h % 4 === 0 ? h : ''}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {heatmapMatrix.length > 0 && heatmapMatrix.map((dayData, dayIndex) => (
                                    <HeatmapRow
                                        key={dayIndex}
                                        dayData={dayData}
                                        dayIndex={dayIndex}
                                        max={maxHeatmapValue}
                                        days={days}
                                    />
                                ))}
                            </div>
                        )}
                    </CardContent>
                        </Card>
                    </InteractiveCard>
                </FadeInItem>

                {/* Leaderboard */}
                <FadeInItem className="col-span-1">
                    <InteractiveCard className="h-full">
                        <Card className="h-full">
                    <CardHeader>
                        <CardTitle>Top Active Members</CardTitle>
                        <CardDescription>Most XP earned</CardDescription>
                        <HelperText>Ranked by total XP earned. Voice and text activity both contribute to XP.</HelperText>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Loading /> : (
                            <div className="space-y-4">
                                {leaderboard.map((user, i) => (
                                    <LeaderboardRow key={user.userId} user={user} index={i} />
                                ))}
                                {leaderboard.length === 0 && <p className="text-muted-foreground text-center py-4">No data yet</p>}
                            </div>
                        )}
                    </CardContent>
                        </Card>
                    </InteractiveCard>
                </FadeInItem>
            </FadeInStagger>
        </div>
    );
}

// 🎯 PERFORMANCE FIX: Extract components to prevent unnecessary re-renders
function HeatmapRow({ dayData, dayIndex, max, days }: {
    dayData: number[];
    dayIndex: number;
    max: number;
    days: string[];
}) {
    return (
        <div className="flex items-center">
            <div className="w-10 text-xs text-muted-foreground font-medium">
                {days[dayIndex]}
            </div>
            <div className="flex-1 grid gap-0.5 min-w-[500px]" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                {dayData.map((count, hourIndex) => (
                    <HeatmapCell
                        key={hourIndex}
                        count={count}
                        max={max}
                        hourIndex={hourIndex}
                    />
                ))}
            </div>
        </div>
    );
}

function HeatmapCell({ count, max, hourIndex }: {
    count: number;
    max: number;
    hourIndex: number;
}) {
    const intensity = count > 0 ? 0.3 + (0.7 * (count / max)) : 0.05;

    return (
        <div
            className="aspect-square rounded-sm transition-all hover:ring-2 ring-primary/50 cursor-help"
            style={{
                backgroundColor: `hsl(var(--primary) / ${intensity})`,
            }}
            title={`${count} messages at ${hourIndex}:00`}
        />
    );
}

function LeaderboardRow({ user, index }: { user: LeaderboardUser; index: number }) {
    return (
        <div className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-bold text-primary overflow-hidden">
                    {user.avatar ? (
                        <img
                            src={`https://cdn.discordapp.com/avatars/${user.userId}/${user.avatar}.png`}
                            alt={user.username}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        index + 1
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
    );
}

function StatCard({ title, value, icon: Icon, tooltip }: {
    title: string;
    value: string;
    icon: React.ElementType;
    tooltip?: string;
}) {
    return (
        <FadeInItem className="h-full">
            <InteractiveCard className="h-full">
                <Card className="h-full">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            <LabelWithTooltip label={title} tooltip={tooltip} />
                        </CardTitle>
                        <Icon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{value}</div>
                    </CardContent>
                </Card>
            </InteractiveCard>
        </FadeInItem>
    );
}

function Loading() {
    return <div className="h-full flex items-center justify-center text-muted-foreground">Loading...</div>;
}
