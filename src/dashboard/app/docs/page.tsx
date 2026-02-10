import Link from "next/link";
import { ArrowRight, BookOpen, Command, FolderKanban, Wrench } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { modules, slashCommands } from "../../lib/docs-content";

export default function DocsOverviewPage() {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>User Documentation</CardTitle>
                    <CardDescription>
                        This section is for communities using Ixoye in their Discord servers.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>Use these pages to configure features, run moderation workflows, and train your staff.</p>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{slashCommands.length} command entries</Badge>
                        <Badge variant="secondary">{modules.length} feature guides</Badge>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
                <SectionCard
                    href="/docs/setup"
                    icon={<Wrench className="h-5 w-5 text-primary" />}
                    title="Getting Started"
                    description="Invite, permissions, first-time setup sequence, and admin onboarding."
                />
                <SectionCard
                    href="/docs/commands"
                    icon={<Command className="h-5 w-5 text-primary" />}
                    title="Bot Commands"
                    description="Slash commands by category, with options, examples, and permission requirements."
                />
                <SectionCard
                    href="/docs/modules"
                    icon={<FolderKanban className="h-5 w-5 text-primary" />}
                    title="Feature Guides"
                    description="Module-by-module operations guide for Welcome, Verification, Leveling, Moderation, and more."
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        Need Self-Hosting Instructions?
                    </CardTitle>
                    <CardDescription>
                        Full environment, deployment, and technical internals are separated into Developer Docs.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Link href="/docs/dev">
                        <Button className="gap-2">
                            Open Developer Docs
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        </div>
    );
}

function SectionCard({
    href,
    icon,
    title,
    description,
}: {
    href: string;
    icon: React.ReactNode;
    title: string;
    description: string;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    {icon}
                    {title}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <Link href={href}>
                    <Button className="w-full gap-2">
                        Open {title}
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </Link>
            </CardContent>
        </Card>
    );
}
