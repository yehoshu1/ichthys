import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "../../../../../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { modules } from "../../../../../lib/docs-content";

export default async function DevModuleDetailPage({
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
            <Link href="/docs/dev/modules" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Back to module index
            </Link>

            <Card>
                <CardHeader>
                    <CardTitle>{moduleDoc.title}</CardTitle>
                    <CardDescription>{moduleDoc.summary}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>
                        Dashboard route: <code>{moduleDoc.dashboardRoute}</code>
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {moduleDoc.commandRefs.map((command) => (
                            <Badge key={command} variant="outline" className="font-mono text-[10px]">
                                {command}
                            </Badge>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
                <ListCard title="API Routes" items={moduleDoc.apiRoutes} mono />
                <ListCard title="Database Tables" items={moduleDoc.tables} mono />
                <ListCard title="Runtime References" items={moduleDoc.runtimeRefs} mono />
                <ListCard title="Typical Workflow" items={moduleDoc.workflow} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Common Failure Modes</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                        {moduleDoc.failureModes.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}

function ListCard({ title, items, mono = false }: { title: string; items: string[]; mono?: boolean }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                    {items.map((item) => (
                        <li key={item} className={mono ? "font-mono text-xs" : undefined}>
                            {item}
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}
