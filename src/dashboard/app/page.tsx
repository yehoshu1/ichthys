"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "../components/ui/button";
import ThemeToggle from "../components/ThemeToggle";
import { Card } from "../components/ui/card";
import {
    ArrowRight,
    Bot,
    Cake,
    Hand,
    MessageSquare,
    Rocket,
    ScrollText,
    Settings,
    Shield,
    ShieldCheck,
    Sparkles,
    Star,
    Zap,
} from "lucide-react";

const moduleCards = [
    {
        title: "Welcome + Verification",
        desc: "Role-based welcome flows, verification tracking, and unverified cleanup automation.",
        icon: Hand,
    },
    {
        title: "Leveling + Rewards",
        desc: "Text and voice XP, rank commands, and automatic role rewards at configured levels.",
        icon: Star,
    },
    {
        title: "Boost Management",
        desc: "Track booster lifecycle, claim flows, reward roles, and expiry handling.",
        icon: Rocket,
    },
    {
        title: "Moderation Suite",
        desc: "Warnings, mutes, timeouts, bans, message clearing, move tools, and case tracking.",
        icon: Shield,
    },
    {
        title: "Birthdays",
        desc: "Birthday reminders, timezone-aware celebration windows, and scheduled birthday role management.",
        icon: Cake,
    },
    {
        title: "Aliases + Role Actions",
        desc: "Auto-responder aliases and role-triggered actions (DM, logs, kicks, scheduled automation).",
        icon: MessageSquare,
    },
    {
        title: "Analytics + Logs",
        desc: "Guild growth, activity insights, and operational logs for audits and troubleshooting.",
        icon: ScrollText,
    },
    {
        title: "Settings + Backups",
        desc: "Import/export configuration, dashboard controls, and database backup workflows.",
        icon: Settings,
    },
];

const commandCategories = [
    {
        title: "Public Commands",
        examples: "/rank, /profile, /leaderboard, /top, /user, /server, /roles",
    },
    {
        title: "Moderator Commands",
        examples: "/warn, /kick, /ban, /timeout, /mute, /clear, /cases, /move, /lock",
    },
    {
        title: "Admin Commands",
        examples: "/setup, /config, /welcome, /verify, /boost, /setxp, /setlevel",
    },
];

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
                        Full-stack Discord operations platform
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                        ΙΧΘΥΣ for modern community infrastructure
                    </h1>
                    <p className="text-base text-muted-foreground md:text-lg">
                        Manage welcome and verification flows, moderation, leveling, boosts, birthdays,
                        aliases, role automations, analytics, logs, and backups from one dashboard.
                    </p>

                    {!session ? (
                        <div className="flex flex-wrap items-center gap-3">
                            <Button size="lg" onClick={() => signIn("discord")} className="gap-2">
                                Login with Discord
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                            <a href="/docs">
                                <Button variant="outline" size="lg">Docs</Button>
                            </a>
                            <Link href="/timestamp">
                                <Button variant="outline" size="lg">Timestamp Tool</Button>
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
                            <a href="/docs">
                                <Button variant="outline" size="lg">Docs</Button>
                            </a>
                            <Link href="/timestamp">
                                <Button variant="outline" size="lg">Timestamp Tool</Button>
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

                        <div className="rounded-xl border bg-background p-4">
                            <div className="flex items-center gap-2">
                                <Bot className="h-4 w-4 text-primary" />
                                <p className="text-sm font-semibold">Current Coverage</p>
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                                <div className="rounded-lg border p-2">
                                    <p className="text-lg font-semibold">{moduleCards.length}</p>
                                    <p className="text-[11px] text-muted-foreground">Modules</p>
                                </div>
                                <div className="rounded-lg border p-2">
                                    <p className="text-lg font-semibold">30+</p>
                                    <p className="text-[11px] text-muted-foreground">Commands</p>
                                </div>
                                <div className="rounded-lg border p-2">
                                    <p className="text-lg font-semibold">9</p>
                                    <p className="text-[11px] text-muted-foreground">Dashboard Areas</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-3">
                            <div className="flex items-center gap-3 rounded-xl border bg-background p-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <ShieldCheck className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold">Verification + moderation guardrails</p>
                                    <p className="text-xs text-muted-foreground">Role checks, unverified cleanup, cases, and enforcement tools.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-xl border bg-background p-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20 text-accent-foreground">
                                    <Zap className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold">Automation across core workflows</p>
                                    <p className="text-xs text-muted-foreground">Role actions, booster flows, aliases, and scheduled tasks.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-xl border bg-background p-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                                    <Cake className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold">Engagement systems built in</p>
                                    <p className="text-xs text-muted-foreground">Leveling, birthdays, and visibility through analytics.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            <section className="mx-auto mt-16 max-w-6xl space-y-6">
                <div className="flex flex-col gap-2">
                    <h2 className="text-2xl font-semibold tracking-tight">Feature Modules</h2>
                    <p className="text-muted-foreground">
                        Everything currently available in Ixoye today, grouped by operational module.
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {moduleCards.map((item) => (
                        <Card key={item.title} className="border bg-card/70 p-5">
                            <div className="flex items-center gap-2">
                                <item.icon className="h-4 w-4 text-primary" />
                                <h3 className="text-base font-semibold">{item.title}</h3>
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
                        </Card>
                    ))}
                </div>
            </section>

            <section className="mx-auto mt-12 max-w-6xl space-y-6">
                <div className="flex flex-col gap-2">
                    <h2 className="text-2xl font-semibold tracking-tight">Command Surface</h2>
                    <p className="text-muted-foreground">
                        The bot ships with broad slash-command coverage for public, moderator, and admin use.
                    </p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                    {commandCategories.map((category) => (
                        <Card key={category.title} className="border bg-card/70 p-5">
                            <h3 className="text-base font-semibold">{category.title}</h3>
                            <p className="mt-2 text-sm text-muted-foreground">{category.examples}</p>
                        </Card>
                    ))}
                </div>
            </section>
        </main>
    );
}
