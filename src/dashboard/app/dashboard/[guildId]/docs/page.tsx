
import { ArrowRight, BookOpen, Code, Command, FolderKanban, Wrench } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { modules, scripts, slashCommands } from "../../../../lib/docs-content";

export default function GuildDocsPage() {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Documentation</h2>
                <p className="text-muted-foreground">
                    Ixoye docs are split into user guides at <code>/docs</code> and technical docs at <code>/docs/dev</code>.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Documentation Coverage</CardTitle>
                    <CardDescription>Live in-app docs synced with current code paths.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                    <p>{slashCommands.length} slash command entries documented</p>
                    <p>{modules.length} feature/module pages documented</p>
                    <p>{scripts.length} npm script entries in developer docs</p>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                <NavCard
                    href="/docs"
                    title="User Docs"
                    description="Guides for server owners, admins, and moderators using the bot."
                    icon={<BookOpen className="h-5 w-5 text-primary" />}
                />
                <NavCard
                    href="/docs/getting-started"
                    title="Getting Started"
                    description="Onboarding checklist for roles, permissions, and first-time configuration."
                    icon={<Wrench className="h-5 w-5 text-primary" />}
                />
                <NavCard
                    href="/docs/commands"
                    title="Bot Commands"
                    description="Slash command catalog with options and examples for staff workflows."
                    icon={<Command className="h-5 w-5 text-primary" />}
                />
                <NavCard
                    href="/docs/modules"
                    title="Feature Guides"
                    description="Module-level usage guides and operational workflows."
                    icon={<FolderKanban className="h-5 w-5 text-primary" />}
                />
                <NavCard
                    href="/docs/dev"
                    title="Developer Docs"
                    description="Self-hosting, environment setup, API/routes, and implementation references."
                    icon={<Code className="h-5 w-5 text-primary" />}
                />
            </div>
        </div>
    );
}

function NavCard({
    href,
    title,
    description,
    icon,
}: {
    href: string;
    title: string;
    description: string;
    icon: React.ReactNode;
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
                <a href={href}>
                    <Button className="w-full gap-2">
                        Open {title}
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </a>
            </CardContent>
        </Card>
    );
}
