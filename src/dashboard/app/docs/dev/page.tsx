import Link from "next/link";
import { ArrowRight, BookText, Command, FolderKanban, Wrench } from "lucide-react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { modules, scripts, setupSections, slashCommands } from "../../../lib/docs-content";

export default function DocsDevOverviewPage() {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Developer Docs Overview</CardTitle>
                    <CardDescription>
                        Technical documentation for maintainers and self-hosters.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{scripts.length} npm scripts</Badge>
                    <Badge variant="secondary">{slashCommands.length} slash command entries</Badge>
                    <Badge variant="secondary">{modules.length} module pages</Badge>
                    <Badge variant="secondary">{setupSections.length} setup sections</Badge>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
                <SectionCard
                    href="/docs/dev/setup"
                    icon={<Wrench className="h-5 w-5 text-primary" />}
                    title="Setup"
                    description="Environment, install, runtime, Docker, deployment, and troubleshooting."
                />
                <SectionCard
                    href="/docs/dev/commands"
                    icon={<Command className="h-5 w-5 text-primary" />}
                    title="Commands"
                    description="Complete npm scripts and Discord slash command catalog with options and examples."
                />
                <SectionCard
                    href="/docs/dev/modules"
                    icon={<FolderKanban className="h-5 w-5 text-primary" />}
                    title="Module Docs"
                    description="Detailed module pages with API, data model, workflows, and failure modes."
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BookText className="h-5 w-5 text-primary" />
                        Module Quick Access
                    </CardTitle>
                    <CardDescription>Open a deep-dive page for each module.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2">
                    {modules.map((module) => (
                        <Link
                            key={module.slug}
                            href={`/docs/dev/modules/${module.slug}`}
                            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm transition hover:bg-muted/40"
                        >
                            <span>{module.title}</span>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </Link>
                    ))}
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
