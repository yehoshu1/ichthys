import { Badge } from "../../../../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { scripts, slashCommands } from "../../../../lib/docs-content";

const categoryOrder: Array<"public" | "config" | "moderation"> = [
    "public",
    "config",
    "moderation",
];

const categoryLabel: Record<(typeof categoryOrder)[number], string> = {
    public: "Public",
    config: "Configuration",
    moderation: "Moderation",
};

export default function DocsDevCommandsPage() {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Complete Command Catalog</CardTitle>
                    <CardDescription>
                        Includes every npm script and every slash command/subcommand currently defined in the bot source.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{scripts.length} npm scripts</Badge>
                    <Badge variant="secondary">{slashCommands.length} slash command entries</Badge>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>npm Scripts</CardTitle>
                    <CardDescription>From <code>package.json</code>.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[180px]">Script</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="w-[220px]">Typical Use</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {scripts.map((script) => (
                                <TableRow key={script.name}>
                                    <TableCell className="font-mono text-xs">{script.name}</TableCell>
                                    <TableCell>{script.description}</TableCell>
                                    <TableCell>{script.typicalUse}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Slash Commands Summary</CardTitle>
                    <CardDescription>Quick lookup of command, category, and required permission.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[220px]">Command</TableHead>
                                <TableHead className="w-[180px]">Category</TableHead>
                                <TableHead className="w-[240px]">Permission</TableHead>
                                <TableHead>Description</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {slashCommands.map((command) => (
                                <TableRow key={command.command}>
                                    <TableCell className="font-mono text-xs">{command.command}</TableCell>
                                    <TableCell>{categoryLabel[command.category]}</TableCell>
                                    <TableCell>{command.permission}</TableCell>
                                    <TableCell>{command.description}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {categoryOrder.map((category) => {
                const entries = slashCommands.filter((command) => command.category === category);
                return (
                    <Card key={category}>
                        <CardHeader>
                            <CardTitle>{categoryLabel[category]} Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {entries.map((command) => (
                                <div key={command.command} className="rounded-md border p-4">
                                    <div className="mb-3 flex flex-wrap items-center gap-2">
                                        <span className="font-mono text-sm font-semibold">{command.command}</span>
                                        <Badge variant="outline">{command.permission}</Badge>
                                    </div>
                                    <p className="mb-3 text-sm text-muted-foreground">{command.description}</p>

                                    {command.options.length > 0 ? (
                                        <div className="mb-3 overflow-x-auto rounded-md border">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-[180px]">Option</TableHead>
                                                        <TableHead className="w-[120px]">Type</TableHead>
                                                        <TableHead className="w-[120px]">Required</TableHead>
                                                        <TableHead>Description</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {command.options.map((option) => (
                                                        <TableRow key={option.name}>
                                                            <TableCell className="font-mono text-xs">{option.name}</TableCell>
                                                            <TableCell>{option.type}</TableCell>
                                                            <TableCell>{option.required ? "Yes" : "No"}</TableCell>
                                                            <TableCell>
                                                                {option.description}
                                                                {option.choices && option.choices.length > 0 ? (
                                                                    <div className="mt-1 text-xs text-muted-foreground">
                                                                        Choices: {option.choices.join(", ")}
                                                                    </div>
                                                                ) : null}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ) : null}

                                    <div className="space-y-2 text-sm">
                                        <div>
                                            <span className="font-medium">Examples</span>
                                            <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                                                {command.examples.map((example) => (
                                                    <li key={example} className="font-mono text-xs">{example}</li>
                                                ))}
                                            </ul>
                                        </div>
                                        {command.notes && command.notes.length > 0 ? (
                                            <div>
                                                <span className="font-medium">Notes</span>
                                                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                                                    {command.notes.map((note) => (
                                                        <li key={note}>{note}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
