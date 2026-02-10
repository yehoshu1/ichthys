import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "../../../../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { modules } from "../../../../lib/docs-content";

export function generateStaticParams() {
    return modules.map((module) => ({ module: module.slug }));
}

export default async function ModuleDetailPage({
    params,
}: {
    params: Promise<{ module: string }>;
}) {
    const { module: slug } = await params;
    const moduleDoc = modules.find((entry) => entry.slug === slug);

    if (!moduleDoc) {
        notFound();
    }

    return (
        <div className="space-y-6">
            <Link href="/docs/modules" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Back to feature guides
            </Link>

            <Card>
                <CardHeader>
                    <CardTitle>{moduleDoc.title}</CardTitle>
                    <CardDescription>{moduleDoc.summary}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>
                        Configure this module in: <code>{moduleDoc.dashboardRoute}</code>
                    </p>
                    {moduleDoc.commandRefs.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {moduleDoc.commandRefs.map((command) => (
                                <Badge key={command} variant="outline" className="font-mono text-[10px]">
                                    {command}
                                </Badge>
                            ))}
                        </div>
                    ) : (
                        <p>This module is managed primarily through the dashboard UI.</p>
                    )}
                </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
                <ListCard title="Recommended Workflow" items={moduleDoc.workflow} />
                <ListCard title="Common Failure Modes" items={moduleDoc.failureModes} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Need Technical Internals?</CardTitle>
                    <CardDescription>
                        API endpoints, database tables, and runtime implementation details are available in Developer Docs.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Link href={`/docs/dev/modules/${moduleDoc.slug}`} className="text-sm font-medium text-primary hover:underline">
                        Open developer page for {moduleDoc.title}
                    </Link>
                </CardContent>
            </Card>
        </div>
    );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                    {items.map((item) => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}
