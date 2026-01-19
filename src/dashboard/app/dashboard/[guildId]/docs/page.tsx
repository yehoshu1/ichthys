"use client";

import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "../../../../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Badge } from "../../../../components/ui/badge";
import { BookOpen, Command, Terminal, Shield, Zap, Star } from "lucide-react";

export default function DocsPage() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-bold tracking-tight">Documentation</h2>
                <p className="text-muted-foreground">
                    Learn how to use Ixoye features and commands.
                </p>
            </div>

            <Tabs defaultValue="commands" className="w-full">
                <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                    <TabsTrigger value="commands" className="gap-2">
                        <Terminal className="h-4 w-4" />
                        Command Reference
                    </TabsTrigger>
                    <TabsTrigger value="guide" className="gap-2">
                        <BookOpen className="h-4 w-4" />
                        Dashboard Guide
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="commands" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Slash Commands</CardTitle>
                            <CardDescription>
                                A complete list of available bot commands and their required permissions.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[200px]">Command</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="w-[150px]">Permission</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow>
                                        <TableCell className="font-mono font-medium">/rank</TableCell>
                                        <TableCell>View your current experience, level, and rank card.</TableCell>
                                        <TableCell><Badge variant="secondary">Public</Badge></TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-mono font-medium">/leaderboard</TableCell>
                                        <TableCell>View the server's top 50 members sorted by XP.</TableCell>
                                        <TableCell><Badge variant="secondary">Public</Badge></TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-mono font-medium">/ping</TableCell>
                                        <TableCell>Check the bot system latency.</TableCell>
                                        <TableCell><Badge variant="secondary">Public</Badge></TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-mono font-medium">/config sync</TableCell>
                                        <TableCell>Sync database users with current server members.</TableCell>
                                        <TableCell><Badge variant="destructive">Administrator</Badge></TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-mono font-medium">/welcome test</TableCell>
                                        <TableCell>Test a welcome message trigger to preview it.</TableCell>
                                        <TableCell><Badge variant="destructive">Administrator</Badge></TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-mono font-medium">/level set</TableCell>
                                        <TableCell>Manually set a user's level or XP amount.</TableCell>
                                        <TableCell><Badge variant="destructive">Administrator</Badge></TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="guide" className="mt-6 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Command className="h-5 w-5 text-primary" />
                                Welcome System
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                The Welcome module allows you to greet new members or send messages when they receive roles.
                            </p>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-lg border p-4 bg-muted/20">
                                    <h4 className="font-medium mb-2">Triggers</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Define <strong>when</strong> a message sends. You can trigger messages on specific role additions (e.g., "Member" role).
                                    </p>
                                </div>
                                <div className="rounded-lg border p-4 bg-muted/20">
                                    <h4 className="font-medium mb-2">Templates</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Create rich embeds with title, color, and fields. Use placeholders like <code>{'{user}'}</code> to mention the member.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5 text-primary" />
                                Verification
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Protect your server by enforcing verification rules.
                            </p>
                            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                                <li>Set a <strong>Grace Period</strong> (e.g., 3 days) for new members to verify.</li>
                                <li>The bot tracks join dates and verification status automatically.</li>
                                <li>Enable <strong>Auto-Kick</strong> to remove users who fail to verify in time.</li>
                            </ul>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Star className="h-5 w-5 text-primary" />
                                Leveling & XP
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Gamify activity with a robust XP system.
                            </p>
                            <div className="grid gap-2 text-sm text-muted-foreground">
                                <div className="flex justify-between border-b pb-2">
                                    <span>Text XP</span>
                                    <span className="font-mono">Configurable range per message</span>
                                </div>
                                <div className="flex justify-between border-b pb-2">
                                    <span>Voice XP</span>
                                    <span className="font-mono">Earned per minute in voice channels</span>
                                </div>
                                <div className="flex justify-between pt-1">
                                    <span>Rewards</span>
                                    <span className="font-mono">Auto-assign roles at specific levels</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Zap className="h-5 w-5 text-primary" />
                                Role Actions
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-4">
                                Automate administrative tasks based on role changes.
                            </p>
                            <p className="text-sm text-muted-foreground">
                                For example, you can create a rule: <em>"When the 'Muted' role is ADDED, send a DM to the user explaining why."</em>
                                Supported actions include <strong>DM</strong>, <strong>Kick</strong>, and <strong>Log</strong>.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
