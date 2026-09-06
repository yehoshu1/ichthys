"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { ChannelSelect, RoleSelect } from "../../../../components/DiscordSelectors";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter } from "../../../../components/ui/card";
import { Label } from "../../../../components/ui/label";
import { Switch } from "../../../../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { ScrollArea } from "../../../../components/ui/scroll-area";
import { Trophy, Trash } from "lucide-react";
import { MessageEditor, EmbedData } from "../../../../components/MessageEditor";
import { ConfirmDeleteDialog } from "../../../../components/ConfirmDeleteDialog";
import { useDiscordData } from "../../../../components/useDiscordData";
import { toast } from "sonner";
import { ExampleBox, HelperText, LabelWithTooltip } from "../../../../components/HelpTooltip";

// Types
interface LevelingConfig {
    levelingEnabled: boolean;
    textXpMin: number;
    textXpMax: number;
    textXpCooldown: number;
    voiceXpPerMinute: number;
    levelUpNotifEnabled: boolean;
    levelUpChannelId: string | null;
    levelUpMessage: string | null;
    levelUpMessageEmbed?: EmbedData;
}

interface LeaderboardEntry {
    userId: string;
    username: string;
    avatar: string | null;
    level: number;
    totalXp: number;
    textXp: number;
    voiceXp: number;
    totalVoiceMinutes: number;
}

interface LevelReward {
    id: string;
    roleId: string;
    level: number;
}

const LEVELING_TABS = ["settings", "leaderboard"] as const;
type LevelingTab = (typeof LEVELING_TABS)[number];

export default function LevelingPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const guildId = params.guildId as string;
    const requestedTab = searchParams.get("tab");
    const resolvedTab: LevelingTab = (requestedTab && LEVELING_TABS.includes(requestedTab as LevelingTab))
        ? (requestedTab as LevelingTab)
        : "settings";
    const [activeTab, setActiveTab] = useState<LevelingTab>(resolvedTab);

    useEffect(() => {
        setActiveTab(resolvedTab);
    }, [resolvedTab]);

    return (
        <div className="container mx-auto p-6 max-w-5xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Leveling System</h1>
                <p className="text-muted-foreground">Reward members for activity with XP and levels.</p>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as LevelingTab)} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                    <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
                </TabsList>

                <TabsContent value="settings" className="space-y-4">
                    <SettingsTab guildId={guildId} />
                </TabsContent>

                <TabsContent value="leaderboard" className="space-y-4">
                    <LeaderboardTab guildId={guildId} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function SettingsTab({ guildId }: { guildId: string }) {
    const [config, setConfig] = useState<LevelingConfig>({
        levelingEnabled: false,
        textXpMin: 15,
        textXpMax: 25,
        textXpCooldown: 60,
        voiceXpPerMinute: 10,
        levelUpNotifEnabled: true,
        levelUpChannelId: "",
        levelUpMessage: "",
        levelUpMessageEmbed: {}
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, [guildId]);

    async function fetchConfig() {
        try {
            const res = await fetch(`/api/guilds/${guildId}/leveling/config`);
            if (res.ok) {
                const data = await res.json();
                setConfig({
                    ...data,
                    levelUpMessageEmbed: data.levelUpMessageEmbed || {}
                });
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch(`/api/guilds/${guildId}/leveling/config`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });
            if (!res.ok) {
                toast.error("Failed to save settings");
                return;
            }
            toast.success("Settings saved");
        } catch (e) {
            console.error(e);
            toast.error("Failed to save settings");
        }
        finally { setSaving(false); }
    }

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading settings...</div>;

    return (
        <form onSubmit={handleSave}>
            <Card>
                <CardHeader>
                    <CardTitle>Configuration</CardTitle>
                    <CardDescription>Manage how members earn XP and level up.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label className="text-base">Enable Leveling System</Label>
                            <p className="text-sm text-muted-foreground">
                                Allow members to earn XP from text and voice activity.
                            </p>
                        </div>
                        <Switch
                            checked={config.levelingEnabled}
                            onCheckedChange={(checked) => setConfig({ ...config, levelingEnabled: checked })}
                        />
                    </div>

                    <div className="space-y-4">
                        <Label className="text-base">XP Rates</Label>
                        <ExampleBox>
                            With Min: 15 and Max: 25 XP, users will randomly receive between 15-25 XP per message 
                            (within the cooldown period). Voice users get XP for every minute they stay in a voice channel.
                        </ExampleBox>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <LabelWithTooltip
                                    label="Min Text XP"
                                    tooltip="The minimum XP a user can earn from a single message."
                                />
                                <Input
                                    type="number"
                                    value={isNaN(config.textXpMin) ? "" : config.textXpMin}
                                    onChange={(e) => setConfig({ ...config, textXpMin: e.target.value === "" ? NaN : parseInt(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-2">
                                <LabelWithTooltip
                                    label="Max Text XP"
                                    tooltip="The maximum XP a user can earn from a single message. Actual XP awarded will be random between Min and Max."
                                />
                                <Input
                                    type="number"
                                    value={isNaN(config.textXpMax) ? "" : config.textXpMax}
                                    onChange={(e) => setConfig({ ...config, textXpMax: e.target.value === "" ? NaN : parseInt(e.target.value) })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <LabelWithTooltip
                                label="Text XP Cooldown (seconds)"
                                tooltip="How long users must wait between earning XP from messages. Prevents spam farming."
                            />
                            <Input
                                type="number"
                                value={isNaN(config.textXpCooldown) ? "" : config.textXpCooldown}
                                onChange={(e) => setConfig({ ...config, textXpCooldown: e.target.value === "" ? NaN : parseInt(e.target.value) })}
                            />
                            <HelperText>Recommended: 60 seconds. Prevents XP farming from spam.</HelperText>
                        </div>
                        <div className="space-y-2">
                            <LabelWithTooltip
                                label="Voice XP (per minute)"
                                tooltip="XP earned for each minute spent in voice channels. Users must not be muted/deafened to earn."
                            />
                            <Input
                                type="number"
                                value={isNaN(config.voiceXpPerMinute) ? "" : config.voiceXpPerMinute}
                                onChange={(e) => setConfig({ ...config, voiceXpPerMinute: e.target.value === "" ? NaN : parseInt(e.target.value) })}
                            />
                            <HelperText>Users must be unmuted and undeafened to earn voice XP.</HelperText>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                        <Label className="text-base">Notifications</Label>
                        <div className="flex items-center justify-between space-x-2">
                            <Label htmlFor="levelup-notif">Send Level Up Messages</Label>
                            <Switch
                                id="levelup-notif"
                                checked={config.levelUpNotifEnabled}
                                onCheckedChange={(checked) => setConfig({ ...config, levelUpNotifEnabled: checked })}
                            />
                        </div>

                        {config.levelUpNotifEnabled && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <LabelWithTooltip
                                        label="Level Up Channel (Optional)"
                                        tooltip="Channel where level up announcements are posted. Leave blank to announce in the same channel where the user leveled up."
                                    />
                                    <ChannelSelect
                                        guildId={guildId}
                                        value={config.levelUpChannelId || ""}
                                        onChange={(value) => setConfig({ ...config, levelUpChannelId: value })}
                                        allowNone={true}
                                        placeholder="Select a channel or leave blank for context channel"
                                    />
                                    <HelperText>If left blank, the message will be sent in the channel where the user leveled up.</HelperText>
                                </div>
                                <div className="space-y-2">
                                    <LabelWithTooltip
                                        label="Custom Level Up Message"
                                        tooltip="Use {user} to mention the player, {level} for their new level, and {xp} for their total XP."
                                    />
                                    <MessageEditor
                                        content={config.levelUpMessage || ""}
                                        embed={config.levelUpMessageEmbed}
                                        embedEnabled={!!(config.levelUpMessageEmbed as any)?.enabled}
                                        onChange={(content, enabled, embed) => setConfig({
                                            ...config,
                                            levelUpMessage: content,
                                            levelUpMessageEmbed: { ...embed, enabled } as any
                                        })}
                                        variables={["{user}", "{level}", "{xp}"]}
                                        placeholder="🎉 **Level Up!** {user} has reached level **{level}**!"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                        <div className="flex items-center justify-between">
                            <LabelWithTooltip
                                label="Level Rewards"
                                tooltip="Automatically assign roles when users reach specific levels. For example: Level 5 = Active role, Level 10 = Veteran role."
                            />
                        </div>
                        <ExampleBox>
                            At <strong>Level 5</strong>, users automatically receive the <strong>@Active</strong> role. 
                            At <strong>Level 25</strong>, they get the <strong>@Veteran</strong> role. 
                            Roles are given automatically when users level up.
                        </ExampleBox>
                        <LevelRewardsManager guildId={guildId} />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={saving}>
                        {saving ? "Saving..." : "Save Settings"}
                    </Button>
                </CardFooter>
            </Card>
        </form>
    );
}

function LevelRewardsManager({ guildId }: { guildId: string }) {
    const [rewards, setRewards] = useState<LevelReward[]>([]);
    const [newLevel, setNewLevel] = useState(1);
    const [newRoleId, setNewRoleId] = useState("");
    const [loading, setLoading] = useState(true);
    const { rolesById } = useDiscordData(guildId);

    useEffect(() => {
        fetchRewards();
    }, [guildId]);

    const fetchRewards = async () => {
        try {
            const res = await fetch(`/api/guilds/${guildId}/leveling/rewards`);
            if (res.ok) setRewards(await res.json());
        } catch (error) {
            console.error("Error fetching rewards:", error);
        } finally {
            setLoading(false);
        }
    };

    const addReward = async () => {
        if (!newRoleId || newLevel < 1) return;

        try {
            const res = await fetch(`/api/guilds/${guildId}/leveling/rewards`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ roleId: newRoleId, level: newLevel })
            });

            if (res.ok) {
                const reward = await res.json();
                setRewards([...rewards, reward].sort((a, b) => a.level - b.level));
                setNewRoleId("");
                setNewLevel(1);
            }
        } catch (error) {
            console.error("Error adding reward:", error);
        }
    };

    const deleteReward = async (id: string) => {
        try {
            await fetch(`/api/guilds/${guildId}/leveling/rewards?id=${id}`, { method: "DELETE" });
            setRewards(rewards.filter(r => r.id !== id));
        } catch (error) {
            console.error("Error deleting reward:", error);
        }
    };

    return (
        <div className="space-y-4 border rounded-md p-4 bg-card/50">
            <div className="flex items-end gap-4">
                <div className="space-y-2 flex-1">
                    <LabelWithTooltip
                        label="At Level"
                        tooltip="The level at which the user will automatically receive the specified role."
                    />
                    <input
                        type="number"
                        min="1"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={newLevel}
                        onChange={(e) => setNewLevel(parseInt(e.target.value) || 1)}
                    />
                </div>
                <div className="space-y-2 flex-[2]">
                    <LabelWithTooltip
                        label="Award Role"
                        tooltip="The role to assign when the user reaches the specified level. Make sure the bot's role is higher than this role."
                    />
                    <RoleSelect
                        guildId={guildId}
                        value={newRoleId}
                        onChange={setNewRoleId}
                        placeholder="Select a role..."
                    />
                </div>
                <Button onClick={addReward} disabled={!newRoleId}>Add Reward</Button>
            </div>

            <ScrollArea className="max-h-[300px]">
                <div className="space-y-2">
                {loading ? (
                    <div className="text-center text-sm text-muted-foreground">Loading...</div>
                ) : rewards.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground py-4">No rewards configured.</div>
                ) : (
                    rewards.map(reward => (
                        <div key={reward.id} className="flex items-center justify-between p-2 rounded border bg-background">
                            <div className="flex items-center gap-4">
                                <span className="font-medium">Level {reward.level}</span>
                                <span className="text-muted-foreground">→</span>
                                <RoleBadge roleName={rolesById.get(reward.roleId)?.name || reward.roleId} />
                            </div>
                            <ConfirmDeleteDialog
                                onConfirm={() => deleteReward(reward.id)}
                                title="Delete Level Reward"
                                description={`Are you sure you want to delete the reward for Level ${reward.level}?`}
                                confirmText="Delete"
                            >
                                <Button variant="ghost" size="sm">
                                    <Trash className="h-4 w-4 text-red-500" />
                                </Button>
                            </ConfirmDeleteDialog>
                        </div>
                    ))
                )}
                </div>
            </ScrollArea>
        </div>
    );
}

// Helper component to display role name (fetching if needed, or just ID if lazy)
// Assuming RoleSelect handles fetching, we might need a similar component for display or just fetch all roles.
// For now, I'll create a simple RoleBadge that might need the RoleSelect's role list or fetch it efficiently.
function RoleBadge({ roleName }: { roleName: string }) {
    return (
        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
            {roleName}
        </span>
    );
}

function LeaderboardTab({ guildId }: { guildId: string }) {
    const [users, setUsers] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [type, setType] = useState<"total" | "text" | "voice">("total");

    useEffect(() => {
        fetchData();
    }, [guildId, type]);

    async function fetchData() {
        setLoading(true);
        try {
            const res = await fetch(`/api/guilds/${guildId}/leveling/leaderboard?type=${type}`);
            if (res.ok) setUsers(await res.json());
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Server Leaderboard</CardTitle>
                    <CardDescription>Top active members.</CardDescription>
                </div>
                <Tabs value={type} onValueChange={(v) => setType(v as any)} className="w-[400px]">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="total">Total XP</TabsTrigger>
                        <TabsTrigger value="text">Text XP</TabsTrigger>
                        <TabsTrigger value="voice">Voice XP</TabsTrigger>
                    </TabsList>
                </Tabs>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="p-8 text-center text-muted-foreground">Loading leaderboard...</div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">Rank</TableHead>
                                <TableHead>User</TableHead>
                                <TableHead>Level</TableHead>
                                <TableHead>XP ({type === 'total' ? 'Total' : type === 'text' ? 'Text' : 'Voice'})</TableHead>
                                {type === 'voice' && <TableHead>Time</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((u, i) => (
                                <TableRow key={u.userId}>
                                    <TableCell className="font-medium">
                                        {i < 3 ? <Trophy className={`h-4 w-4 ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : 'text-amber-600'}`} /> : `#${i + 1}`}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {u.avatar ? (
                                                <img src={u.avatar} alt={u.username} className="h-6 w-6 rounded-full" />
                                            ) : (
                                                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs">
                                                    {u.username?.charAt(0) || '?'}
                                                </div>
                                            )}
                                            <span>{u.username}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                                            Lvl {u.level}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {type === 'text' ? u.textXp.toLocaleString() : type === 'voice' ? u.voiceXp.toLocaleString() : u.totalXp.toLocaleString()}
                                    </TableCell>
                                    {type === 'voice' && (
                                        <TableCell>{Math.round(u.totalVoiceMinutes / 60)}h {u.totalVoiceMinutes % 60}m</TableCell>
                                    )}
                                </TableRow>
                            ))}
                            {users.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        No data found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
