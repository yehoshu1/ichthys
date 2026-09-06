"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Loader2, Search } from "lucide-react";
import ThemeToggle from "../../components/ThemeToggle";

interface Guild {
    id: string;
    name: string;
    icon: string | null;
    iconUrl: string | null;
    hasManagePermission: boolean;
    botPresent: boolean;
}

export default function GuildsPage() {
    const { status } = useSession();
    const router = useRouter();
    const [guilds, setGuilds] = useState<Guild[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/");
            return;
        }

        if (status === "authenticated") {
            fetchGuilds();
        }
    }, [status, router]);

    async function fetchGuilds() {
        try {
            const res = await fetch("/api/guilds");
            if (!res.ok) {
                throw new Error("Failed to fetch guilds");
            }
            const data = await res.json();
            setGuilds(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    }

    const filteredGuilds = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return guilds;
        return guilds.filter((guild) => guild.name.toLowerCase().includes(q));
    }, [guilds, query]);

    if (status === "loading" || loading) {
        return (
            <main className="min-h-screen px-6 py-12">
                <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <p className="text-sm">Loading your servers...</p>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="min-h-screen px-6 py-12">
                <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-3 text-center">
                    <p className="text-sm font-medium text-destructive">Error: {error}</p>
                    <p className="text-xs text-muted-foreground">Try refreshing or signing in again.</p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen px-6 py-12">
            <div className="mx-auto max-w-6xl space-y-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <Link href="/" className="inline-flex items-center text-sm font-semibold text-primary hover:opacity-80">
                            ΙΧΘΥΣ Dashboard
                        </Link>
                        <h1 className="text-3xl font-semibold tracking-tight">Select a server</h1>
                        <p className="text-muted-foreground">Choose a server to manage with ΙΧΘΥΣ.</p>
                    </div>
                    <div className="flex w-full flex-col gap-3 md:max-w-sm">
                        <div className="flex items-center justify-end">
                            <ThemeToggle />
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search servers..."
                                aria-label="Search servers"
                                className="pl-9"
                            />
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredGuilds.map((guild) => (
                        <Card
                            key={guild.id}
                            className="group cursor-pointer overflow-hidden border bg-card/70 transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
                            onClick={() => router.push(`/dashboard/${guild.id}`)}
                        >
                            <div className="flex items-center gap-4 p-5">
                                {guild.iconUrl ? (
                                    <Image
                                        src={guild.iconUrl}
                                        alt={guild.name}
                                        width={56}
                                        height={56}
                                        className="rounded-2xl border"
                                    />
                                ) : (
                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary">
                                        {guild.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div className="flex-1">
                                    <h3 className="truncate text-lg font-semibold">{guild.name}</h3>
                                    <p className="text-xs text-muted-foreground">
                                        {guild.botPresent ? "Bot connected" : "Bot not installed"}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between border-t bg-background/60 px-5 py-3 text-xs text-muted-foreground">
                                <span>{guild.hasManagePermission ? "Manage server" : "Limited access"}</span>
                                <Button size="sm" variant={guild.botPresent ? "default" : "outline"}>
                                    {guild.botPresent ? "Manage" : "Setup"}
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>

                {filteredGuilds.length === 0 && (
                    <div className="rounded-xl border border-dashed bg-card/60 p-10 text-center text-muted-foreground">
                        No servers found. Make sure you have Manage Server permissions.
                    </div>
                )}
            </div>
        </main>
    );
}
