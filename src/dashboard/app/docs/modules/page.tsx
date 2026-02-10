import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { modules } from "../../../lib/docs-content";

export default function DocsModulesIndexPage() {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Feature Guides</CardTitle>
                    <CardDescription>
                        Usage guides for each bot module, focused on day-to-day server operations.
                    </CardDescription>
                </CardHeader>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                {modules.map((module) => (
                    <Link key={module.slug} href={`/docs/modules/${module.slug}`}>
                        <Card className="h-full transition hover:bg-muted/30">
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between gap-3 text-lg">
                                    <span>{module.title}</span>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                </CardTitle>
                                <CardDescription>{module.summary}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 text-xs text-muted-foreground">
                                <p>Dashboard route: <code>{module.dashboardRoute}</code></p>
                                {module.commandRefs.length > 0 ? (
                                    <p>{module.commandRefs.length} related command entries</p>
                                ) : (
                                    <p>Dashboard-first module (no dedicated slash commands)</p>
                                )}
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
