"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "../components/ui/button";
import ThemeToggle from "../components/ThemeToggle";
import { Card } from "../components/ui/card";
import { ArrowRight, ShieldCheck, Sparkles, Zap } from "lucide-react";

export default function Home() {
    const { data: session } = useSession();

    return (
        <main className="min-h-screen px-6 py-10">
            <div className="mx-auto flex max-w-6xl justify-end">
                <ThemeToggle />
            </div>
            <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
                <div className="space-y-6">
                    <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1 text-xs font-medium text-muted-foreground">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        Modern Discord operations suite
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                        ΙΧΘΥΣ dashboard for high-signal communities
                    </h1>
                    <p className="text-base text-muted-foreground md:text-lg">
                        Configure welcomes, verification, boosts, and leveling from a single, focused control center.
                        Built for speed, clarity, and automation-first workflows.
                    </p>

                    {!session ? (
                        <div className="flex flex-wrap items-center gap-3">
                            <Button size="lg" onClick={() => signIn("discord")} className="gap-2">
                                Login with Discord
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                            <Link href="/docs">
                                <Button variant="outline" size="lg">Docs</Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="flex flex-wrap items-center gap-3">
                            <Link href="/guilds">
                                <Button size="lg" className="gap-2">
                                    Go to Dashboard
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </Link>
                            <Link href="/docs">
                                <Button variant="outline" size="lg">Docs</Button>
                            </Link>
                            <Button variant="outline" size="lg" onClick={() => signOut()}>
                                Logout
                            </Button>
                        </div>
                    )}
                </div>

                <Card className="relative overflow-hidden border bg-card/60 p-6 shadow-lg backdrop-blur">
                    <div className="space-y-6">
                        {session ? (
                            <div className="flex items-center gap-4 rounded-xl border bg-background p-4">
                                {session.user?.image ? (
                                    <Image
                                        src={session.user.image}
                                        alt="Avatar"
                                        width={52}
                                        height={52}
                                        className="rounded-full border"
                                    />
                                ) : (
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                                        {session.user?.name?.[0] || "U"}
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm font-semibold">{session.user?.name}</p>
                                    <p className="text-xs text-muted-foreground">Signed in and ready</p>
                                </div>
                            </div>
                        ) : null}

                        <div className="grid gap-3">
                            <div className="flex items-center gap-3 rounded-xl border bg-background p-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <ShieldCheck className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold">Verification guardrails</p>
                                    <p className="text-xs text-muted-foreground">Auto-kick unverified members on schedule.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-xl border bg-background p-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20 text-accent-foreground">
                                    <Zap className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold">Automation at scale</p>
                                    <p className="text-xs text-muted-foreground">Role actions and boosters, fully automated.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            <section className="mx-auto mt-16 max-w-6xl space-y-6">
                <div className="flex flex-col gap-2">
                    <h2 className="text-2xl font-semibold tracking-tight">What the bot does for your server</h2>
                    <p className="text-muted-foreground">
                        Ixoye automates the repetitive work of community operations, so you can focus on culture.
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[
                        {
                            title: "Welcome orchestration",
                            desc: "Design join/leave messages, embeds, and role-based triggers without touching code.",
                        },
                        {
                            title: "Verification enforcement",
                            desc: "Set grace periods, auto-kick rules, and role-specific verification messaging.",
                        },
                        {
                            title: "Leveling + rewards",
                            desc: "Track text and voice activity with configurable XP and auto-rewarded roles.",
                        },
                        {
                            title: "Boost management",
                            desc: "Automate booster thanks, role rewards, and graceful expiry handling.",
                        },
                        {
                            title: "Role automations",
                            desc: "Trigger DM, log, kick, or channel actions when roles change.",
                        },
                        {
                            title: "Analytics and insights",
                            desc: "See growth, activity heatmaps, and leaderboards in one place.",
                        },
                    ].map((item) => (
                        <Card key={item.title} className="border bg-card/70 p-5">
                            <h3 className="text-base font-semibold">{item.title}</h3>
                            <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
                        </Card>
                    ))}
                </div>
            </section>
        </main>
    );
}
