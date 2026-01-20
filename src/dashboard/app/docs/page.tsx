"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { BookOpen, Command, Shield, Zap, Star, Sparkles, Wrench } from "lucide-react";

export default function PublicDocsPage() {
    return (
        <div className="min-h-screen px-6 py-12">
            <div className="mx-auto flex max-w-5xl flex-col gap-10">
                <div className="flex flex-col gap-4">
                    <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1 text-xs font-medium text-muted-foreground">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        Ixoye Documentation
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight">Everything you need to run Ixoye</h1>
                    <p className="text-muted-foreground">
                        Setup steps, module walkthroughs, and command references for the Discord bot + dashboard.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Link href="/">
                            <Button variant="outline">Back to Home</Button>
                        </Link>
                        <Link href="/guilds">
                            <Button>Open Dashboard</Button>
                        </Link>
                    </div>
                </div>

                <Tabs defaultValue="modules" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 md:w-[520px]">
                        <TabsTrigger value="modules" className="gap-2">
                            <BookOpen className="h-4 w-4" />
                            Modules
                        </TabsTrigger>
                        <TabsTrigger value="commands" className="gap-2">
                            <Command className="h-4 w-4" />
                            Commands
                        </TabsTrigger>
                        <TabsTrigger value="setup" className="gap-2">
                            <Wrench className="h-4 w-4" />
                            Setup
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="modules" className="mt-6 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Core Modules</CardTitle>
                                <CardDescription>What each module does and when to use it.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2">
                                <ModuleCard
                                    title="Welcome System"
                                    desc="Create join/leave messaging, auto-role assignment, and role-based welcome triggers."
                                    icon={<Sparkles className="h-5 w-5 text-primary" />}
                                />
                                <ModuleCard
                                    title="Verification"
                                    desc="Protect your server with unverified roles, grace periods, and auto-kick enforcement."
                                    icon={<Shield className="h-5 w-5 text-primary" />}
                                />
                                <ModuleCard
                                    title="Leveling"
                                    desc="Reward engagement with XP, voice tracking, and auto-assigned level roles."
                                    icon={<Star className="h-5 w-5 text-primary" />}
                                />
                                <ModuleCard
                                    title="Role Actions"
                                    desc="Trigger DM, log, kick, or message actions when roles change."
                                    icon={<Zap className="h-5 w-5 text-primary" />}
                                />
                                <ModuleCard
                                    title="Boosts"
                                    desc="Automate boost rewards and send custom thank-you messages."
                                    icon={<Sparkles className="h-5 w-5 text-primary" />}
                                />
                                <ModuleCard
                                    title="Analytics"
                                    desc="Track growth, activity heatmaps, actions, and leaderboards."
                                    icon={<BookOpen className="h-5 w-5 text-primary" />}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="commands" className="mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Slash Commands</CardTitle>
                                <CardDescription>Commands available from Discord.</CardDescription>
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
                                            <TableCell className="font-mono font-medium">/info</TableCell>
                                            <TableCell>Show a compact analytics overview for the server.</TableCell>
                                            <TableCell><Badge variant="secondary">Public</Badge></TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-mono font-medium">/setup</TableCell>
                                            <TableCell>Interactive setup panel with toggles and role/channel selectors.</TableCell>
                                            <TableCell><Badge variant="destructive">Manage Server</Badge></TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-mono font-medium">/rank</TableCell>
                                            <TableCell>View XP, level, and progression.</TableCell>
                                            <TableCell><Badge variant="secondary">Public</Badge></TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-mono font-medium">/leaderboard</TableCell>
                                            <TableCell>See top active members by XP.</TableCell>
                                            <TableCell><Badge variant="secondary">Public</Badge></TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-mono font-medium">/verify</TableCell>
                                            <TableCell>Manually verify a user (assign roles).</TableCell>
                                            <TableCell><Badge variant="destructive">Manage Roles</Badge></TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="setup" className="mt-6 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Quick Start</CardTitle>
                                <CardDescription>Recommended setup flow for a new server.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm text-muted-foreground">
                                <ol className="list-decimal space-y-2 pl-5">
                                    <li>Invite the bot and ensure it has Manage Roles + Manage Server.</li>
                                    <li>Run <span className="font-mono">/setup</span> to enable modules and set roles/channels.</li>
                                    <li>Visit the dashboard to customize templates, triggers, and analytics.</li>
                                </ol>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

function ModuleCard({ title, desc, icon }: { title: string; desc: string; icon: React.ReactNode }) {
    return (
        <div className="rounded-xl border bg-background/70 p-4">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    {icon}
                </div>
                <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
            </div>
        </div>
    );
}
