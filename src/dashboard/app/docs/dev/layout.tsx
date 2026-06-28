import Link from "next/link";
import { BookOpen, Code, Command, FolderKanban, Home, Wrench } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";

export default function DocsDevLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen px-6 py-10">
            <div className="mx-auto flex max-w-7xl flex-col gap-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Ixoye Developer Documentation</h1>
                        <p className="text-sm text-muted-foreground">
                            Full self-hosting, operations, commands, and implementation references.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <a href="/">
                            <Button variant="outline" className="gap-2">
                                <Home className="h-4 w-4" />
                                Home
                            </Button>
                        </a>
                        <a href="/guilds">
                            <Button variant="outline" className="gap-2">
                                <BookOpen className="h-4 w-4" />
                                Dashboard
                            </Button>
                        </a>
                        <Link href="/docs">
                            <Button className="gap-2">
                                <Code className="h-4 w-4" />
                                User Docs
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
                    <aside className="lg:sticky lg:top-6 lg:self-start">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Developer Docs</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <NavLink href="/docs/dev" icon={<BookOpen className="h-4 w-4" />} label="Overview" />
                                <NavLink href="/docs/dev/setup" icon={<Wrench className="h-4 w-4" />} label="Setup" />
                                <NavLink href="/docs/dev/commands" icon={<Command className="h-4 w-4" />} label="Commands" />
                                <NavLink href="/docs/dev/modules" icon={<FolderKanban className="h-4 w-4" />} label="Modules" />
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
