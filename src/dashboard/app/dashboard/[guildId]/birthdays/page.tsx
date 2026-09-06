"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ChannelSelect, RoleSelect } from "../../../../components/DiscordSelectors";
import { Button } from "../../../../components/ui/button";
import { ConfirmDeleteDialog } from "../../../../components/ConfirmDeleteDialog";
import { Input } from "../../../../components/ui/input";
import { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter } from "../../../../components/ui/card";
import { Label } from "../../../../components/ui/label";
import { Switch } from "../../../../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Cake, Trash, Calendar, Clock, Gift } from "lucide-react";
import { MessageEditor, EmbedData } from "../../../../components/MessageEditor";
import { ExampleBox, HelperText, LabelWithTooltip } from "../../../../components/HelpTooltip";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";

// Types
interface BirthdayConfig {
    enabled: boolean;
    channelId: string | null;
    roleId: string | null;
    messageTemplate: string;
    messageEmbed?: EmbedData;
    hourOfDay: number;
    showAge: boolean;
    mentionRoleId: string | null; // "everyone", "here", role ID, or null
    autoRemoveRole: boolean;
}

interface BirthdayEntry {
    id: string;
    userId: string;
    username: string;
    avatar: string | null;
    month: number;
    day: number;
    year: number | null;
    timezone: string;
}

const BIRTHDAY_VARIABLES = [
    "{user.mention}",
    "{user.username}",
    "{user.displayname}",
    "{user.nickname}",
    "{user.id}",
    "{age}",
    "{server.name}",
    "{server.id}",
    "{server.members}",
];

const HOURS_OF_DAY = Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: `${i.toString().padStart(2, "0")}:00 (${i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`})`,
}));

const BIRTHDAY_TABS = ["settings", "members"] as const;
type BirthdayTab = (typeof BIRTHDAY_TABS)[number];

export default function BirthdaysPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const guildId = params.guildId as string;
    const requestedTab = searchParams.get("tab");
    const resolvedTab: BirthdayTab = (requestedTab && BIRTHDAY_TABS.includes(requestedTab as BirthdayTab))
        ? (requestedTab as BirthdayTab)
        : "settings";
    const [activeTab, setActiveTab] = useState<BirthdayTab>(resolvedTab);

    useEffect(() => {
        setActiveTab(resolvedTab);
    }, [resolvedTab]);

    return (
        <div className="container mx-auto p-6 max-w-5xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <Cake className="h-8 w-8 text-pink-500" />
                    Birthdays
                </h1>
                <p className="text-muted-foreground">Automatically announce and celebrate member birthdays in your server.</p>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as BirthdayTab)} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                    <TabsTrigger value="members">Birthday Members</TabsTrigger>
                </TabsList>

                <TabsContent value="settings" className="space-y-4">
                    <SettingsTab guildId={guildId} />
                </TabsContent>

                <TabsContent value="members" className="space-y-4">
                    <MembersTab guildId={guildId} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function SettingsTab({ guildId }: { guildId: string }) {
    const [config, setConfig] = useState<BirthdayConfig>({
        enabled: false,
        channelId: null,
        roleId: null,
        messageTemplate: "🎉 **Happy Birthday {user.mention}!** 🎂 They are now {age} years old!",
        messageEmbed: {},
        hourOfDay: 9,
        showAge: true,
        mentionRoleId: null,
        autoRemoveRole: true,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, [guildId]);

    async function fetchConfig() {
        try {
            const res = await fetch(`/api/guilds/${guildId}/birthdays/config`);
            if (res.ok) {
                const data = await res.json();
                setConfig({
                    ...data,
                    messageEmbed: data.messageEmbed || {},
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch(`/api/guilds/${guildId}/birthdays/config`, {
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
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading settings...</div>;

    return (
        <form onSubmit={handleSave}>
            <Card>
                <CardHeader>
                    <CardTitle>Birthday Configuration</CardTitle>
                    <CardDescription>Configure how birthdays are announced and celebrated.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Enable Toggle */}
                    <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label className="text-base">Enable Birthday Module</Label>
                            <p className="text-sm text-muted-foreground">
                                Automatically announce member birthdays and assign birthday roles.
                            </p>
                        </div>
                        <Switch
                            checked={config.enabled}
                            onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
                        />
                    </div>

                    {config.enabled && (
                        <>
                            <ExampleBox>
                                At 9:00 AM server time, the bot will announce &quot;🎉 Happy Birthday @User! They are now 25 years old!&quot; 
                                in #general and assign the @Birthday role for 24 hours.
                            </ExampleBox>

                            {/* Channel Selection */}
                            <div className="space-y-2">
                                <LabelWithTooltip
                                    label={
                                        <span className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4" />
                                            Channel
                                        </span>
                                    }
                                    tooltip="Channel where birthday announcements are posted"
                                />
                                <HelperText>Choose the channel for birthday messages to be sent in.</HelperText>
                                <ChannelSelect
                                    guildId={guildId}
                                    value={config.channelId || ""}
                                    onChange={(value) => setConfig({ ...config, channelId: value || null })}
                                    placeholder="Select a channel..."
                                />
                            </div>

                            {/* Birthday Role */}
                            <div className="space-y-2">
                                <LabelWithTooltip
                                    label={
                                        <span className="flex items-center gap-2">
                                            <Gift className="h-4 w-4" />
                                            Birthday Role
                                        </span>
                                    }
                                    tooltip="Temporary role given to users on their birthday. Auto-removes after the day ends if enabled."
                                />
                                <HelperText>Give a role to members celebrating their birthday.</HelperText>
                                <RoleSelect
                                    guildId={guildId}
                                    value={config.roleId || ""}
                                    onChange={(value) => setConfig({ ...config, roleId: value || null })}
                                    allowNone={true}
                                    placeholder="Select a role or leave blank..."
                                />
                            </div>

                            {/* Message Template */}
                            <div className="space-y-2">
                                <LabelWithTooltip
                                    label="Message"
                                    tooltip="Use {user.mention} to ping them, {age} for their age (if they set birth year)"
                                />
                                <HelperText>Customize the birthday message.</HelperText>
                                <MessageEditor
                                    content={config.messageTemplate}
                                    embed={config.messageEmbed}
                                    embedEnabled={!!(config.messageEmbed as any)?.enabled}
                                    onChange={(content, enabled, embed) =>
                                        setConfig({
                                            ...config,
                                            messageTemplate: content,
                                            messageEmbed: { ...embed, enabled } as any,
                                        })
                                    }
                                    variables={BIRTHDAY_VARIABLES}
                                    placeholder="🎉 Happy Birthday {user.mention}!"
                                />
                            </div>

                            {/* Hour of Day */}
                            <div className="space-y-2">
                                <LabelWithTooltip
                                    label={
                                        <span className="flex items-center gap-2">
                                            <Clock className="h-4 w-4" />
                                            Time to Send Message
                                        </span>
                                    }
                                    tooltip="What hour (server time) to post birthday messages"
                                />
                                <HelperText>Change the hour at which the birthday messages should be sent (in server time).</HelperText>
                                <Select
                                    value={config.hourOfDay.toString()}
                                    onValueChange={(value) => setConfig({ ...config, hourOfDay: parseInt(value) })}
                                >
                                    <SelectTrigger className="w-[280px]">
                                        <SelectValue placeholder="Select hour..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {HOURS_OF_DAY.map((hour) => (
                                            <SelectItem key={hour.value} value={hour.value.toString()}>
                                                {hour.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Additional Options */}
                            <div className="space-y-4 pt-4 border-t">
                                <Label className="text-base">Additional Options</Label>
                                
                                <div className="flex items-center justify-between space-x-2">
                                    <div className="space-y-0.5">
                                        <LabelWithTooltip
                                            label="Show Age"
                                            tooltip="Display the user's age in the message. Only works if they provided their birth year."
                                        />
                                        <HelperText>Display the user's age in the birthday message.</HelperText>
                                    </div>
                                    <Switch
                                        checked={config.showAge}
                                        onCheckedChange={(checked) => setConfig({ ...config, showAge: checked })}
                                    />
                                </div>

                                {/* Mention Role Selection */}
                                <div className="space-y-2">
                                    <LabelWithTooltip
                                        label={
                                            <span className="flex items-center gap-2">
                                                <span className="text-lg">@</span>
                                                Mention Role
                                            </span>
                                        }
                                        tooltip="Optionally mention @everyone, @here, or a specific role to draw attention"
                                    />
                                    <HelperText>Select a role to mention in birthday messages (optional).</HelperText>
                                    <div className="flex gap-2">
                                        <Select
                                            value={config.mentionRoleId === "everyone" ? "everyone" : config.mentionRoleId === "here" ? "here" : config.mentionRoleId ? "custom" : "none"}
                                            onValueChange={(value) => {
                                                if (value === "none") {
                                                    setConfig({ ...config, mentionRoleId: null });
                                                } else if (value === "everyone" || value === "here") {
                                                    setConfig({ ...config, mentionRoleId: value });
                                                } else if (value === "custom") {
                                                    // Keep existing or set to empty for custom selection
                                                    setConfig({ ...config, mentionRoleId: "" });
                                                }
                                            }}
                                        >
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="Select mention type..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">No mention</SelectItem>
                                                <SelectItem value="everyone">@everyone</SelectItem>
                                                <SelectItem value="here">@here</SelectItem>
                                                <SelectItem value="custom">Specific role...</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        
                                        {config.mentionRoleId !== "everyone" && config.mentionRoleId !== "here" && config.mentionRoleId !== null && (
                                            <RoleSelect
                                                guildId={guildId}
                                                value={config.mentionRoleId || ""}
                                                onChange={(value) => setConfig({ ...config, mentionRoleId: value || null })}
                                                allowNone={true}
                                                placeholder="Select a role to mention..."
                                            />
                                        )}
                                    </div>
                                    {config.mentionRoleId === "everyone" && (
                                        <p className="text-xs text-amber-600">⚠️ This will mention everyone in the server</p>
                                    )}
                                    {config.mentionRoleId === "here" && (
                                        <p className="text-xs text-amber-600">⚠️ This will mention all online members</p>
                                    )}
                                </div>

                                <div className="flex items-center justify-between space-x-2">
                                    <div className="space-y-0.5">
                                        <LabelWithTooltip
                                            label="Auto-Remove Role"
                                            tooltip="Automatically remove the birthday role after the day ends (midnight)"
                                        />
                                        <HelperText>Automatically remove the birthday role after the day ends.</HelperText>
                                    </div>
                                    <Switch
                                        checked={config.autoRemoveRole}
                                        onCheckedChange={(checked) => setConfig({ ...config, autoRemoveRole: checked })}
                                    />
                                </div>
                            </div>
                        </>
                    )}
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

function MembersTab({ guildId }: { guildId: string }) {
    const [entries, setEntries] = useState<BirthdayEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        fetchEntries();
    }, [guildId]);

    async function fetchEntries() {
        try {
            const res = await fetch(`/api/guilds/${guildId}/birthdays/entries`);
            if (res.ok) {
                const data = await res.json();
                setEntries(data);
            }
        } catch (error) {
            console.error("Error fetching entries:", error);
        } finally {
            setLoading(false);
        }
    }

    async function deleteEntry(id: string) {
        try {
            await fetch(`/api/guilds/${guildId}/birthdays/entries?id=${id}`, { method: "DELETE" });
            setEntries(entries.filter((e) => e.id !== id));
            toast.success("Birthday entry removed");
        } catch (error) {
            console.error("Error deleting entry:", error);
            toast.error("Failed to remove entry");
        }
    }

    const filteredEntries = entries.filter(
        (e) =>
            e.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.userId.includes(searchTerm)
    );

    const getMonthName = (month: number) => {
        return new Date(2000, month - 1, 1).toLocaleString("default", { month: "long" });
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                    Loading birthday members...
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>Birthday Members</span>
                    <span className="text-sm font-normal text-muted-foreground">
                        {entries.length} member{entries.length !== 1 ? "s" : ""}
                    </span>
                </CardTitle>
                <CardDescription>Members who have set their birthday in this server.</CardDescription>
                <div className="pt-2">
                    <Input
                        placeholder="Search by username or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="max-w-sm"
                    />
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Birthday</TableHead>
                            <TableHead>Timezone</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredEntries.map((entry) => (
                            <TableRow key={entry.id}>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        {entry.avatar ? (
                                            <img src={entry.avatar} alt={entry.username} className="h-8 w-8 rounded-full" />
                                        ) : (
                                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs">
                                                {entry.username?.charAt(0) || "?"}
                                            </div>
                                        )}
                                        <div>
                                            <div className="font-medium">{entry.username}</div>
                                            <div className="text-xs text-muted-foreground">{entry.userId}</div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {getMonthName(entry.month)} {entry.day}
                                    {entry.year && `, ${entry.year}`}
                                </TableCell>
                                <TableCell>{entry.timezone}</TableCell>
                                <TableCell>
                                    <ConfirmDeleteDialog
                                        onConfirm={() => deleteEntry(entry.id)}
                                        title="Delete Birthday Entry?"
                                        description={`Are you sure you want to delete the birthday entry for ${entry.username}?`}
                                        confirmText="Delete Entry"
                                    >
                                        <Button variant="ghost" size="sm">
                                            <Trash className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </ConfirmDeleteDialog>
                                </TableCell>
                            </TableRow>
                        ))}
                        {filteredEntries.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                    {searchTerm ? "No members found matching your search." : "No members have set their birthday yet."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
