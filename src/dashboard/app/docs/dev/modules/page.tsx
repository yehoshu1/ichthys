import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { modules } from "../../../../lib/docs-content";

export default function DocsDevModulesIndexPage() {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Module Documentation</CardTitle>
                    <CardDescription>
                        Deep-dive pages for each module, including routes, API endpoints, DB tables, and operations guidance.
                    </CardDescription>
                </CardHeader>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                {modules.map((module) => (
                    <Link key={module.slug} href={`/docs/dev/modules/${module.slug}`}>
                        <Card className="h-full transition hover:bg-muted/30">
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between gap-3 text-lg">
                                    <span>{module.title}</span>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                </CardTitle>
                                <CardDescription>{module.summary}</CardDescription>
                            </CardHeader>
                            <CardContent className="text-xs text-muted-foreground">
                                Dashboard route: <code>{module.dashboardRoute}</code>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
