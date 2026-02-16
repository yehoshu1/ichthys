"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Command, FolderKanban, Home, ShieldCheck, Wrench } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import DocsSearchTrigger from "../../components/DocsSearchTrigger";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isDevDocs = pathname?.startsWith("/docs/dev");

    // For dev docs, just render children (dev layout will handle its own sidebar)
    if (isDevDocs) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen px-6 py-10">
            <div className="mx-auto flex max-w-7xl flex-col gap-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Ixoye User Documentation</h1>
                        <p className="text-sm text-muted-foreground">
                            Guides for moderators and server managers using the bot.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <DocsSearchTrigger />
                        <Link href="/">
                            <Button variant="outline" className="gap-2">
                                <Home className="h-4 w-4" />
                                Home
                            </Button>
                        </Link>
                        <Link href="/guilds">
                            <Button variant="outline" className="gap-2">
                                <ShieldCheck className="h-4 w-4" />
                                Dashboard
                            </Button>
                        </Link>
                        <Link href="/docs/dev">
                            <Button className="gap-2">
                                <BookOpen className="h-4 w-4" />
                                Developer Docs
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
                    <aside className="lg:sticky lg:top-6 lg:self-start">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">User Docs</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <NavLink href="/docs" icon={<BookOpen className="h-4 w-4" />} label="Overview" />
                                <NavLink href="/docs/setup" icon={<Wrench className="h-4 w-4" />} label="Getting Started" />
                                <NavLink href="/docs/commands" icon={<Command className="h-4 w-4" />} label="Bot Commands" />
                                <NavLink href="/docs/modules" icon={<FolderKanban className="h-4 w-4" />} label="Feature Guides" />
                            </CardContent>
                        </Card>
                    </aside>
                    <main className="min-w-0">{children}</main>
                </div>
            </div>
        </div>
    );
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
    return (
        <Link
            href={href}
            className="flex items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm text-muted-foreground transition hover:border-border hover:bg-muted/40 hover:text-foreground"
        >
            {icon}
            <span>{label}</span>
        </Link>
    );
}
