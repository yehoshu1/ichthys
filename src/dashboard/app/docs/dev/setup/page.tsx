import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { setupSections } from "../../../../lib/docs-content";

const envRows = [
    {
        key: "DISCORD_TOKEN",
        required: "Yes",
        description: "Discord bot token used by bot runtime and Discord API-backed dashboard routes.",
    },
    {
        key: "DISCORD_CLIENT_ID",
        required: "Yes",
        description: "Discord OAuth client ID and slash command deployment target.",
    },
    {
        key: "DISCORD_CLIENT_SECRET",
        required: "Yes",
        description: "Discord OAuth client secret for NextAuth provider.",
    },
    {
        key: "NEXTAUTH_SECRET",
        required: "Yes",
        description: "Secret for session/JWT signing.",
    },
    {
        key: "NEXTAUTH_URL",
        required: "Yes",
        description: "Public base URL for auth callback resolution. Local default: http://localhost:4002.",
    },
    {
        key: "DATABASE_URL",
        required: "Yes",
        description: "PostgreSQL DSN (for example: postgresql://ixoye:change_me@localhost:5432/ixoye).",
    },
    {
        key: "GUILD_ID",
        required: "Optional",
        description: "Optional testing guild ID for focused command deployment workflows.",
    },
    {
        key: "LOG_LEVEL",
        required: "Optional",
        description: "Runtime logging verbosity.",
    },
    {
        key: "DOMAIN",
        required: "Optional",
        description: "Domain for Traefik routing and cookie scope.",
    },
    {
        key: "DASHBOARD_URL",
        required: "Optional",
        description: "Public URL for the dashboard, used by the /dashboard command.",
    },
];

export default function DocsDevSetupPage() {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Developer Setup Guide</CardTitle>
                    <CardDescription>
                        Full self-hosting setup, build, deployment, and operations workflow.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Recommended baseline: Node 22.x + npm 11.9.0.</p>
                    <p>Local dashboard URL: <code>http://localhost:4002</code>.</p>
                    <p>Primary bootstrap flow: copy env, install deps, apply DB migrations, start dev processes.</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Environment Variables</CardTitle>
                    <CardDescription>Required and optional variables used by bot + dashboard.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Key</TableHead>
                                <TableHead className="w-[120px]">Required</TableHead>
                                <TableHead>Description</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {envRows.map((row) => (
                                <TableRow key={row.key}>
                                    <TableCell className="font-mono text-xs">{row.key}</TableCell>
                                    <TableCell>{row.required}</TableCell>
                                    <TableCell>{row.description}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                {setupSections.map((section) => (
                    <Card key={section.title}>
                        <CardHeader>
                            <CardTitle className="text-base">{section.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {section.bullets && section.bullets.length > 0 ? (
                                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                                    {section.bullets.map((bullet) => (
                                        <li key={bullet}>{bullet}</li>
                                    ))}
                                </ul>
                            ) : null}
                            {section.commands && section.commands.length > 0 ? (
                                <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 text-xs leading-relaxed">
                                    <code>{section.commands.join("\n")}</code>
                                </pre>
                            ) : null}
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Troubleshooting Quick Checks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>If <code>npm ci</code> fails with lock mismatch, regenerate lock with the project npm version and rerun.</p>
                    <p>If dashboard package resolution fails in Docker dev, rebuild the dev image and restart <code>ixoye-dev</code>.</p>
                    <p>If auth fails, verify both <code>NEXTAUTH_URL</code> and Discord OAuth redirect URI match exactly.</p>
                    <p>If slash command updates do not appear, run <code>npm run deploy</code> with correct app credentials.</p>
                </CardContent>
            </Card>
        </div>
    );
}
