"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import GrowthChart from "../../../components/charts/GrowthChart";
import { Button } from "../../../components/ui/button";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "../../../components/ui/card";
import { Users, ShieldCheck, Rocket, Zap, Hand, Star, CheckCircle, ArrowRight } from "lucide-react";

export default function GuildOverviewPage() {
    const params = useParams();
    const guildId = params.guildId as string;

    // Stats State
    const [stats, setStats] = useState({
        members: 0,
        verified: 0,
        boosts: 0,
        actionsToday: 0,
        levelingEnabled: false
    });
    const [growthData, setGrowthData] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch Analytics Data
    const fetchData = async () => {
        try {
            const res = await fetch(`/api/guilds/${guildId}/analytics`);
            if (res.ok) {
                const data = await res.json();
                if (data.stats) setStats(data.stats);
                if (data.growth) setGrowthData(data.growth);
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

    const downloadReport = () => {
        const payload = {
            generatedAt: new Date().toISOString(),
            stats,
            growth: growthData,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `ixoye-report-${guildId}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Overview</h2>
                    <p className="text-muted-foreground">Here's what's happening with your server today.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={fetchData}>Refresh</Button>
                    <Button onClick={downloadReport}>Download Report</Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Total Members"
                    value={loading ? "..." : stats.members.toLocaleString()}
                    icon={Users}
                    trend="Live"
                    trendPositive={true}
                    trendLabel="count"
                />
                <StatCard
                    title="Verified Users"
                    value={loading ? "..." : stats.verified.toLocaleString()}
                    icon={ShieldCheck}
                    trend={`${stats.members > 0 ? Math.round((stats.verified / stats.members) * 100) : 0}%`}
                    trendPositive={true}
                    trendLabel="of total"
                />
                <StatCard
                    title="Server Boosts"
                    value={loading ? "..." : stats.boosts.toLocaleString()}
                    icon={Rocket}
                    trend="Active"
                    trendPositive={true}
                    trendLabel="boosters"
                />
                <StatCard
                    title="Actions Today"
                    value={loading ? "..." : stats.actionsToday.toLocaleString()}
                    icon={Zap}
                    trend="Today"
                    trendPositive={true}
                    trendLabel="automated"
                />
            </div>

            {/* Content Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader className="flex items-center justify-between space-y-0 md:flex-row">
                        <div>
                            <CardTitle className="text-xl">Member Growth</CardTitle>
                            <CardDescription>New joins and verified members over time.</CardDescription>
                        </div>
                        <Link href={`/dashboard/${guildId}/analytics`}>
                            <Button variant="outline" size="sm" className="gap-2">
                                <Rocket className="h-4 w-4" />
                                Full Analytics
                            </Button>
                        </Link>
                    </CardHeader>
                    <CardContent>
                        <GrowthChart data={growthData} />
                    </CardContent>
                </Card>

                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Setup Guide</CardTitle>
                        <CardDescription>Get the most out of Ixoye</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <SetupItem
                            title="Welcome System"
                            desc="Greet new members"
                            icon={Hand}
                            href={`/dashboard/${guildId}/welcome`}
                            completed={true}
                        />
                        <SetupItem
                            title="Verification"
                            desc="Protect your server"
                            icon={ShieldCheck}
                            href={`/dashboard/${guildId}/verification`}
                            completed={stats.verified > 0}
                        />
                        <SetupItem
                            title="Leveling"
                            desc="Reward activity"
                            icon={Star}
                            href={`/dashboard/${guildId}/leveling`}
                            completed={stats.levelingEnabled}
                        />
                        <SetupItem
                            title="Role Actions"
                            desc="Automate roles"
                            icon={Zap}
                            href={`/dashboard/${guildId}/role-actions`}
                            completed={stats.actionsToday > 0}
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

interface StatCardProps {
    title: string;
    value: string;
    icon: React.ElementType;
    trend: string;
    trendPositive: boolean;
    trendLabel: string;
}

function StatCard({ title, value, icon: Icon, trend, trendPositive, trendLabel }: StatCardProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                    {title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground">
                    <span className={trendPositive ? "text-green-500 font-medium" : "text-red-500 font-medium"}>
                        {trend}
                    </span>{" "}
                    {trendLabel || "from last month"}
                </p>
            </CardContent>
        </Card>
    );
}

interface SetupItemProps {
    title: string;
    desc: string;
    icon: React.ElementType;
    href: string;
    completed: boolean;
}

function SetupItem({ title, desc, icon: Icon, href, completed }: SetupItemProps) {
    return (
        <Link
            href={href}
            className="flex items-center space-x-4 rounded-md border p-4 transition-all hover:bg-accent hover:text-accent-foreground"
        >
            <Icon className="h-5 w-5 mt-px text-muted-foreground" />
            <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            {completed ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
            )}
        </Link>
    );
}
