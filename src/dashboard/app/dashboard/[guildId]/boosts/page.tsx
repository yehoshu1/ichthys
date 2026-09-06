"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { RoleSelect, ChannelSelect } from "../../../../components/DiscordSelectors";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "../../../../components/ui/card";
import { Label } from "../../../../components/ui/label";
import { Switch } from "../../../../components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Zap, Clock } from "lucide-react";
import { MessageEditor, EmbedData } from "../../../../components/MessageEditor";
import Image from "next/image";
import { ExampleBox, HelperText, LabelWithTooltip } from "../../../../components/HelpTooltip";

interface BoostConfig {
    boostEnabled: boolean;
    boostAnnouncementChannelId: string | null;
    boostRoleId: string | null;
    boostRoleName?: string | null;
    boostRoleColorPrimary?: string | null;
    boostRoleColorSecondary?: string | null;
    boostClaimRequired?: boolean;
    boostWelcomeMessage: string;
    boostWelcomeMessageEmbed?: EmbedData;
    boostReBoostMessage: string;
    boostReBoostMessageEmbed?: EmbedData;
    boostRoleRemovalDays: number;
    boostRoleRemovalDmEnabled: boolean;
}

interface Booster {
    id: string;
    userId: string;
    boostedAt: string;
    boostEndsAt: string;
    roleAssigned: boolean;
    roleRemoved: boolean;
}

const BOOST_TABS = ["config", "analytics"] as const;
type BoostTab = (typeof BOOST_TABS)[number];

export default function BoostsPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const guildId = params.guildId as string;
    const requestedTab = searchParams.get("tab");
    const resolvedTab: BoostTab =
        requestedTab && BOOST_TABS.includes(requestedTab as BoostTab)
            ? (requestedTab as BoostTab)
            : "config";
    const [activeTab, setActiveTab] = useState<BoostTab>(resolvedTab);

    const [config, setConfig] = useState<BoostConfig | null>(null);
    const [boosters, setBoosters] = useState<Booster[]>([]);
    const [stats, setStats] = useState({ activeCount: 0, totalHistorical: 0, totalBoosts: 0 });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [memberMap, setMemberMap] = useState<Record<string, { username: string; avatar: string | null }>>({});

    useEffect(() => {
        fetchData();
    }, [guildId]);

    useEffect(() => {
        setActiveTab(resolvedTab);
    }, [resolvedTab]);

    async function fetchData() {
        try {
            const [configRes, statsRes] = await Promise.all([
                fetch(`/api/guilds/${guildId}/boosts/config`),
                fetch(`/api/guilds/${guildId}/boosts/stats`)
            ]);

            if (configRes.ok) {
                const data = await configRes.json();
                setConfig({
                    ...data,
                    boostClaimRequired: data.boostClaimRequired ?? true,
                    boostWelcomeMessageEmbed: data.boostWelcomeMessageEmbed || {},
                    boostReBoostMessageEmbed: data.boostReBoostMessageEmbed || {}
                });
            }
            if (statsRes.ok) {
                const statsData = await statsRes.json();
                setBoosters(statsData.boosters);
                setStats(statsData.stats);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (boosters.length === 0) return;
        const ids = boosters.map((b) => b.userId).join(",");
        fetch(`/api/guilds/${guildId}/members?ids=${ids}`)
            .then((res) => res.json())
            .then((data) => {
                const map: Record<string, { username: string; avatar: string | null }> = {};
                (data.members || []).forEach((member: any) => {
                    map[member.id] = { username: member.username, avatar: member.avatar };
                });
                setMemberMap(map);
            })
            .catch((err) => console.error(err));
    }, [boosters, guildId]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const res = await fetch(`/api/guilds/${guildId}/boosts/config`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });

            if (res.ok) {
                setMessage({ type: 'success', text: "Configuration saved successfully!" });
            } else {
                setMessage({ type: 'error', text: "Failed to save configuration." });
            }
        } catch (err) {
            setMessage({ type: 'error', text: "An error occurred." });
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading boost configuration...</div>;

    return (
        <div className="container mx-auto p-6 max-w-5xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Server Boost Management</h1>
                <p className="text-muted-foreground">Automate rewards and announcements for your server boosters.</p>
            </div>

            <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as BoostTab)}
                className="space-y-6"
            >
                <TabsList className="w-full justify-start overflow-x-auto whitespace-nowrap bg-muted">
                    <TabsTrigger value="config">Configuration</TabsTrigger>
                    <TabsTrigger value="analytics">Analytics</TabsTrigger>
                </TabsList>

                <TabsContent value="config" className="space-y-6">
                    <ExampleBox>
                        When a user boosts, they use <code>/boost claim</code> to receive the <strong>Booster</strong> role. 
                        If they stop boosting, the bot waits the grace period (e.g., 7 days) before removing their role, 
                        giving them time to re-boost without losing benefits.
                    </ExampleBox>

                    <Card>
                        <CardHeader>
                            <CardTitle>Configuration</CardTitle>
                            <CardDescription>Configure boost rewards and announcements.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="flex items-center space-x-2 rounded-lg border p-4">
                                    <Switch
                                        checked={config?.boostEnabled}
                                        onCheckedChange={(checked) => setConfig({ ...config!, boostEnabled: checked })}
                                    />
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Enable Boost Management</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Rewards are claim-based. Boosters use <code>/boost claim</code> to receive the role.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Reward Role Name</Label>
                                        <Input
                                            value={config?.boostRoleName || ""}
                                            onChange={(e) => setConfig({ ...config!, boostRoleName: e.target.value })}
                                            placeholder="Booster"
                                        />
                                        <p className="text-[0.8rem] text-muted-foreground">
                                            Used when admins create the role via <code>/boost setup</code>.
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Existing Reward Role (optional)</Label>
                                        <RoleSelect
                                            guildId={guildId}
                                            value={config?.boostRoleId || ""}
                                            onChange={(value) => setConfig({ ...config!, boostRoleId: value })}
                                            allowNone={true}
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <LabelWithTooltip
                                            label="Primary Color"
                                            tooltip="The main color for the booster role. Use hex format like #2CB7C9."
                                        />
                                        <Input
                                            value={config?.boostRoleColorPrimary || ""}
                                            onChange={(e) => setConfig({ ...config!, boostRoleColorPrimary: e.target.value })}
                                            placeholder="#2CB7C9"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <LabelWithTooltip
                                            label="Secondary Color (gradient)"
                                            tooltip="Optional second color for a gradient effect on the role."
                                        />
                                        <Input
                                            value={config?.boostRoleColorSecondary || ""}
                                            onChange={(e) => setConfig({ ...config!, boostRoleColorSecondary: e.target.value })}
                                            placeholder="#F4B740"
                                        />
                                    </div>
                                    <HelperText className="md:col-span-2">
                                        Gradient colors are stored for enhanced role styles. If unavailable, the primary color is used.
                                    </HelperText>
                                </div>

                                <div className="space-y-2">
                                    <Label>Announcement Channel</Label>
                                    <ChannelSelect
                                        guildId={guildId}
                                        value={config?.boostAnnouncementChannelId || ""}
                                        onChange={(value) => setConfig({ ...config!, boostAnnouncementChannelId: value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Welcome Message</Label>
                                    <MessageEditor
                                        content={config?.boostWelcomeMessage || ""}
                                        embed={config?.boostWelcomeMessageEmbed}
                                        embedEnabled={!!(config?.boostWelcomeMessageEmbed as any)?.enabled}
                                        onChange={(content, enabled, embed) => setConfig({
                                            ...config!,
                                            boostWelcomeMessage: content,
                                            boostWelcomeMessageEmbed: { ...embed, enabled } as any
                                        })}
                                        variables={['{user}', '{server}', '{boostCount}', '{boostLevel}']}
                                        placeholder="Thank you {user} for boosting!"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Re-Boost / Renewal Message</Label>
                                    <MessageEditor
                                        content={config?.boostReBoostMessage || ""}
                                        embed={config?.boostReBoostMessageEmbed}
                                        embedEnabled={!!(config?.boostReBoostMessageEmbed as any)?.enabled}
                                        onChange={(content, enabled, embed) => setConfig({
                                            ...config!,
                                            boostReBoostMessage: content,
                                            boostReBoostMessageEmbed: { ...embed, enabled } as any
                                        })}
                                        variables={['{user}', '{server}', '{boostCount}', '{boostLevel}']}
                                        placeholder="Thank you {user} for renewing your boost!"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Grace Period (Days)</Label>
                                    <Input
                                        type="number"
                                        value={config?.boostRoleRemovalDays}
                                        onChange={(e) => setConfig({ ...config!, boostRoleRemovalDays: parseInt(e.target.value) })}
                                    />
                                    <p className="text-[0.8rem] text-muted-foreground">Days to wait before removing rewards after a boost is withdrawn.</p>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Switch
                                        checked={config?.boostRoleRemovalDmEnabled}
                                        onCheckedChange={(checked) => setConfig({ ...config!, boostRoleRemovalDmEnabled: checked })}
                                    />
                                    <Label>Send DM on Reward Removal</Label>
                                </div>

                                {message && (
                                    <div className={`p-3 rounded-md text-sm text-white ${message.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                                        {message.text}
                                    </div>
                                )}

                                <Button type="submit" disabled={saving}>
                                    {saving ? "Saving..." : "Save Configuration"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="analytics" className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Active Boosters</CardTitle>
                                <Zap className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.activeCount}</div>
                                <p className="text-xs text-muted-foreground">Currently boosting the server</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">All-Time Boosts</CardTitle>
                                <Clock className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.totalBoosts}</div>
                                <p className="text-xs text-muted-foreground">Total boosts claimed over time</p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Boosters</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User ID</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {boosters.map((b) => (
                                        <TableRow key={b.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {memberMap[b.userId]?.avatar ? (
                                                        <Image
                                                            src={memberMap[b.userId].avatar as string}
                                                            alt={memberMap[b.userId].username}
                                                            width={24}
                                                            height={24}
                                                            className="rounded-full"
                                                        />
                                                    ) : (
                                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">
                                                            {(memberMap[b.userId]?.username || "U").charAt(0)}
                                                        </div>
                                                    )}
                                                    <span className="text-sm">
                                                        {memberMap[b.userId]?.username || b.userId}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>{new Date(b.boostedAt).toLocaleDateString()}</TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${b.roleRemoved ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                                    }`}>
                                                    {b.roleRemoved ? 'Expired' : 'Active'}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {boosters.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center text-muted-foreground">
                                                No booster records found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
