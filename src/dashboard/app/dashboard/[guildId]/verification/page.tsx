"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { RoleSelect, ChannelSelect } from "../../../../components/DiscordSelectors";
import { MessageEditor, EmbedData } from "../../../../components/MessageEditor";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "../../../../components/ui/card";
import { Label } from "../../../../components/ui/label";
import { Switch } from "../../../../components/ui/switch";
import { Trash2, Plus, ShieldCheck, UserX, UserCheck } from "lucide-react";
import Image from "next/image";
import { useDiscordData } from "../../../../components/useDiscordData";
import { ConfirmDeleteDialog } from "../../../../components/ConfirmDeleteDialog";
import { toast } from "sonner";
import { HelperText, LabelWithTooltip } from "../../../../components/HelpTooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";

// Types
interface VerificationConfig {
    verificationEnabled: boolean;
    unverifiedRoleId: string | null;
    verificationRoleId: string | null;
    verificationGraceDays: number;
    verificationKickDmEnabled: boolean;
    verificationMessage: string | null;
    verificationMessageEmbed?: EmbedData | null;
    verificationMessageEmbedEnabled?: boolean;
    verificationMessageChannelId: string | null;
    verificationWelcomeMessage: string | null;
}

interface VerificationRule {
    id: string;
    name: string;
    roleId: string;
    notifyChannelId: string | null;
    message?: string | null;
    welcomeMessage: string | null;
    enabled: boolean;
}

interface VerificationStats {
    verified: number;
    unverified: number;
    kicked: number;
}

interface KickedUser {
    userId: string;
    username: string;
    avatar: string | null;
    executedAt: string;
}

interface UnverifiedUser {
    userId: string;
    username: string;
    avatar: string | null;
    joinedAt: string;
}

interface RoleMessageRule {
    id: string;
    roleId: string;
    notifyChannelId?: string | null;
    message?: string | null;
    messageEmbed?: EmbedData | null;
    messageEmbedEnabled?: boolean;
    welcomeMessage?: string | null;
    enabled: boolean;
}

const VERIFICATION_TABS = ["config", "role-messages", "profiles", "statistics"] as const;
type VerificationTab = (typeof VERIFICATION_TABS)[number];

export default function VerificationPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const guildId = params.guildId as string;
    const requestedTab = searchParams.get("tab");
    const resolvedTab: VerificationTab =
        requestedTab && VERIFICATION_TABS.includes(requestedTab as VerificationTab)
            ? (requestedTab as VerificationTab)
            : "config";
    const [activeTab, setActiveTab] = useState<VerificationTab>(resolvedTab);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [config, setConfig] = useState<VerificationConfig>({
        verificationEnabled: false,
        unverifiedRoleId: "",
        verificationRoleId: "",
        verificationGraceDays: 30,
        verificationKickDmEnabled: true,
        verificationMessage: "",
        verificationMessageEmbed: undefined,
        verificationMessageEmbedEnabled: false,
        verificationMessageChannelId: "",
        verificationWelcomeMessage: "",
    });

    const [rules, setRules] = useState<VerificationRule[]>([]);
    const [newRuleName, setNewRuleName] = useState("");
    const [newRuleRoleId, setNewRuleRoleId] = useState("");
    const [newRuleChannelId, setNewRuleChannelId] = useState("");
    const [newRuleMessage, setNewRuleMessage] = useState("");
    const [newRuleWelcomeMessage, setNewRuleWelcomeMessage] = useState("");
    const [addingRule, setAddingRule] = useState(false);
    const [ruleError, setRuleError] = useState<string | null>(null);
    const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
    const [roleMessages, setRoleMessages] = useState<RoleMessageRule[]>([]);
    const [newRoleMessageRoleId, setNewRoleMessageRoleId] = useState("");
    const [newRoleMessageChannelId, setNewRoleMessageChannelId] = useState("");
    const [newRoleMessageText, setNewRoleMessageText] = useState("");
    const [newRoleMessageEmbed, setNewRoleMessageEmbed] = useState<EmbedData>({});
    const [newRoleMessageEmbedEnabled, setNewRoleMessageEmbedEnabled] = useState(false);
    const [newRoleMessageWelcomeText, setNewRoleMessageWelcomeText] = useState("");
    const [roleMessageError, setRoleMessageError] = useState<string | null>(null);
    const [addingRoleMessage, setAddingRoleMessage] = useState(false);
    const [editingRoleMessageId, setEditingRoleMessageId] = useState<string | null>(null);
    const { rolesById, channelsById } = useDiscordData(guildId);

    const [stats, setStats] = useState<VerificationStats>({
        verified: 0,
        unverified: 0,
        kicked: 0
    });
    const [kickedUsers, setKickedUsers] = useState<KickedUser[]>([]);
    const [unverifiedUsers, setUnverifiedUsers] = useState<UnverifiedUser[]>([]);

    useEffect(() => {
        fetchData();
    }, [guildId]);

    useEffect(() => {
        setActiveTab(resolvedTab);
    }, [resolvedTab]);

    async function fetchData() {
        try {
            const [configRes, statsRes, rulesRes, roleMessageRes, kickedRes, unverifiedRes] = await Promise.all([
                fetch(`/api/guilds/${guildId}/verification/config`),
                fetch(`/api/guilds/${guildId}/verification/stats`),
                fetch(`/api/guilds/${guildId}/verification/rules`),
                fetch(`/api/guilds/${guildId}/verification/role-messages`),
                fetch(`/api/guilds/${guildId}/verification/kicked?limit=10`),
                fetch(`/api/guilds/${guildId}/verification/unverified?limit=10`)
            ]);

            if (configRes.ok) setConfig(await configRes.json());
            if (statsRes.ok) setStats(await statsRes.json());
            if (rulesRes.ok) {
                const data = await rulesRes.json();
                setRules(data.map((rule: VerificationRule) => ({
                    ...rule,
                    enabled: rule.enabled ?? true,
                    name: rule.name || "",
                    notifyChannelId: rule.notifyChannelId || null
                })));
            }
            if (roleMessageRes.ok) {
                const data = await roleMessageRes.json();
                setRoleMessages(data.map((rule: RoleMessageRule) => ({
                    ...rule,
                    notifyChannelId: rule.notifyChannelId || null,
                    messageEmbed: (rule as any).messageEmbed || null,
                    messageEmbedEnabled: !!((rule as any).messageEmbed as any)?.enabled,
                    welcomeMessage: rule.welcomeMessage || null,
                    enabled: rule.enabled ?? true
                })));
            }
            if (kickedRes.ok) setKickedUsers(await kickedRes.json());
            if (unverifiedRes.ok) setUnverifiedUsers(await unverifiedRes.json());
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch(`/api/guilds/${guildId}/verification/config`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });
            if (!res.ok) {
                toast.error("Failed to save settings");
                return;
            }
            toast.success("Settings saved");
        } catch (err) {
            console.error(err);
            toast.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
    }

    async function handleAddRule() {
        if (!newRuleName || !newRuleRoleId || !newRuleChannelId) {
            setRuleError("Please provide a profile name, role, and notification channel.");
            return;
        }
        setAddingRule(true);
        setRuleError(null);
        try {
            const url = editingRuleId
                ? `/api/guilds/${guildId}/verification/rules/${editingRuleId}`
                : `/api/guilds/${guildId}/verification/rules`;
            const method = editingRuleId ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newRuleName,
                    roleId: newRuleRoleId,
                    notifyChannelId: newRuleChannelId || null,
                    message: newRuleMessage || null,
                    welcomeMessage: newRuleWelcomeMessage || null,
                    enabled: true
                }),
            });

            if (res.ok) {
                const updatedRule = await res.json();
                if (editingRuleId) {
                    setRules(rules.map(rule => rule.id === editingRuleId ? updatedRule : rule));
                } else {
                    setRules([...rules, updatedRule]);
                }
                setNewRuleName("");
                setNewRuleRoleId("");
                setNewRuleChannelId("");
                setNewRuleMessage("");
                setNewRuleWelcomeMessage("");
                setEditingRuleId(null);
            } else {
                const data = await res.json().catch(() => ({}));
                setRuleError(data.error || "Failed to add verification profile.");
            }
        } catch (err) {
            console.error(err);
            setRuleError("Failed to add verification profile.");
        } finally {
            setAddingRule(false);
        }
    }

    async function handleDeleteRule(ruleId: string) {
        try {
            const res = await fetch(`/api/guilds/${guildId}/verification/rules/${ruleId}`, {
                method: "DELETE"
            });

            if (res.ok) {
                setRules(rules.filter(r => r.id !== ruleId));
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function toggleRule(ruleId: string, enabled: boolean) {
        try {
            const res = await fetch(`/api/guilds/${guildId}/verification/rules/${ruleId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled })
            });
            if (res.ok) {
                setRules(rules.map(r => r.id === ruleId ? { ...r, enabled } : r));
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function handleAddRoleMessage() {
        if (!newRoleMessageRoleId) {
            setRoleMessageError("Please provide a role.");
            return;
        }
        setAddingRoleMessage(true);
        setRoleMessageError(null);
        try {
            const url = editingRoleMessageId
                ? `/api/guilds/${guildId}/verification/role-messages/${editingRoleMessageId}`
                : `/api/guilds/${guildId}/verification/role-messages`;
            const method = editingRoleMessageId ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    roleId: newRoleMessageRoleId,
                    notifyChannelId: newRoleMessageChannelId || null,
                    message: newRoleMessageText || null,
                    messageEmbed: newRoleMessageEmbedEnabled ? newRoleMessageEmbed : null,
                    welcomeMessage: newRoleMessageWelcomeText || null,
                    enabled: true
                }),
            });
            if (res.ok) {
                const updatedRule = await res.json();
                if (editingRoleMessageId) {
                    setRoleMessages(roleMessages.map(rule =>
                        rule.id === editingRoleMessageId ? updatedRule : rule
                    ));
                } else {
                    setRoleMessages([...roleMessages, updatedRule]);
                }
                setNewRoleMessageRoleId("");
                setNewRoleMessageChannelId("");
                setNewRoleMessageText("");
                setNewRoleMessageEmbed({});
                setNewRoleMessageEmbedEnabled(false);
                setNewRoleMessageWelcomeText("");
                setEditingRoleMessageId(null);
            } else {
                const data = await res.json().catch(() => ({}));
                setRoleMessageError(data.error || "Failed to save role message.");
            }
        } catch (err) {
            console.error(err);
            setRoleMessageError("Failed to save role message.");
        } finally {
            setAddingRoleMessage(false);
        }
    }

    async function toggleRoleMessage(ruleId: string, enabled: boolean) {
        try {
            const res = await fetch(`/api/guilds/${guildId}/verification/role-messages/${ruleId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled })
            });
            if (res.ok) {
                setRoleMessages(roleMessages.map(r => r.id === ruleId ? { ...r, enabled } : r));
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function deleteRoleMessage(ruleId: string) {
        try {
            const res = await fetch(`/api/guilds/${guildId}/verification/role-messages/${ruleId}`, {
                method: "DELETE"
            });
            if (res.ok) {
                setRoleMessages(roleMessages.filter(r => r.id !== ruleId));
                if (editingRoleMessageId === ruleId) {
                    resetRoleMessageForm();
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    function startEditRoleMessage(rule: RoleMessageRule) {
        setEditingRoleMessageId(rule.id);
        setNewRoleMessageRoleId(rule.roleId);
        setNewRoleMessageText(rule.message ?? "");
        setNewRoleMessageChannelId(rule.notifyChannelId || "");
        setNewRoleMessageEmbed(rule.messageEmbed || {});
        setNewRoleMessageEmbedEnabled(!!rule.messageEmbedEnabled);
        setNewRoleMessageWelcomeText(rule.welcomeMessage || "");
        setRoleMessageError(null);
    }

    function resetRoleMessageForm() {
        setEditingRoleMessageId(null);
        setNewRoleMessageRoleId("");
        setNewRoleMessageChannelId("");
        setNewRoleMessageText("");
        setNewRoleMessageEmbed({});
        setNewRoleMessageEmbedEnabled(false);
        setNewRoleMessageWelcomeText("");
        setRoleMessageError(null);
    }

    function startEditRule(rule: VerificationRule) {
        setEditingRuleId(rule.id);
        setNewRuleName(rule.name || "");
        setNewRuleRoleId(rule.roleId);
        setNewRuleChannelId(rule.notifyChannelId || "");
        setNewRuleMessage(rule.message ?? "");
        setNewRuleWelcomeMessage(rule.welcomeMessage || "");
        setRuleError(null);
    }

    function resetRuleForm() {
        setEditingRuleId(null);
        setNewRuleName("");
        setNewRuleRoleId("");
        setNewRuleChannelId("");
        setNewRuleMessage("");
        setNewRuleWelcomeMessage("");
        setRuleError(null);
    }

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading verification settings...</div>;

    const totalMembers = stats.verified + stats.unverified || 1;
    const verifiedPercent = (stats.verified / totalMembers) * 100;

    return (
        <div className="container mx-auto p-6 max-w-5xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Verification System</h1>
                <p className="text-muted-foreground">Automatically kick unverified members after a grace period.</p>
            </div>

            <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as VerificationTab)}
                className="space-y-6"
            >
                <TabsList className="w-full justify-start overflow-x-auto whitespace-nowrap bg-muted">
                    <TabsTrigger value="config">Configuration</TabsTrigger>
                    <TabsTrigger value="role-messages">Role-Specific Messages</TabsTrigger>
                    <TabsTrigger value="profiles">Additional Verification Profiles</TabsTrigger>
                    <TabsTrigger value="statistics">Statistics</TabsTrigger>
                </TabsList>

                <TabsContent value="config" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Configuration</CardTitle>
                            <CardDescription>Manage automated verification enforcement.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSave} className="space-y-6">
                                <div className="flex items-center space-x-2 rounded-lg border p-4">
                                    <Switch
                                        id="kick-enabled"
                                        checked={config.verificationEnabled}
                                        onCheckedChange={(checked) => setConfig({ ...config, verificationEnabled: checked })}
                                    />
                                    <div className="space-y-0.5">
                                        <Label htmlFor="kick-enabled" className="text-base">Enable Auto-Kick System</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Automatically kick members who remain unverified.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <LabelWithTooltip
                                        label="Unverified Role"
                                        tooltip="Assigned to new members automatically. Removed when they verify."
                                    />
                                    <RoleSelect
                                        guildId={guildId}
                                        value={config.unverifiedRoleId || ""}
                                        onChange={(value) => setConfig({ ...config, unverifiedRoleId: value })}
                                        allowNone={true}
                                    />
                                    <HelperText>Optional. This role will be removed when a user is verified.</HelperText>
                                </div>

                                <div className="space-y-2">
                                    <LabelWithTooltip
                                        label="Verification Role"
                                        tooltip="Given when a user completes verification"
                                    />
                                    <RoleSelect
                                        guildId={guildId}
                                        value={config.verificationRoleId || ""}
                                        onChange={(value) => setConfig({ ...config, verificationRoleId: value })}
                                        allowNone={false}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <LabelWithTooltip
                                        label="Grace Period (Days)"
                                        tooltip="Users who joined longer ago than this without verifying will be kicked"
                                    />
                                    <Input
                                        type="number"
                                        min="1"
                                        max="365"
                                        value={config.verificationGraceDays}
                                        onChange={(e) => setConfig({ ...config, verificationGraceDays: parseInt(e.target.value) })}
                                    />
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id="dm-enabled"
                                        checked={config.verificationKickDmEnabled}
                                        onCheckedChange={(checked) => setConfig({ ...config, verificationKickDmEnabled: checked })}
                                    />
                                    <LabelWithTooltip
                                        label="Send DM before kicking"
                                        tooltip="Send a warning message to the user before they are kicked"
                                        htmlFor="dm-enabled"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <LabelWithTooltip
                                        label="Notification Channel (Optional)"
                                        tooltip="Channel where the verification notification will be posted. Leave blank to post in the context channel."
                                    />
                                    <ChannelSelect guildId={guildId} value={config.verificationMessageChannelId || ""} onChange={(v) => setConfig({ ...config, verificationMessageChannelId: v })} allowNone={true} placeholder="Select a channel or leave blank for context channel" />
                                    <HelperText>If left blank, the notification will be sent to the context channel where verification occurred.</HelperText>
                                </div>

                                <div className="space-y-2">
                                    <LabelWithTooltip
                                        label="Send this message"
                                        tooltip="This is the notification message posted to the selected channel when a user verifies. Use {user} to mention them."
                                    />
                                    <MessageEditor
                                        content={config.verificationMessage || ""}
                                        embed={config.verificationMessageEmbed || {}}
                                        embedEnabled={!!config.verificationMessageEmbedEnabled}
                                        onChange={(content, enabled, embed) => setConfig({ ...config, verificationMessage: content, verificationMessageEmbed: embed, verificationMessageEmbedEnabled: enabled })}
                                        variables={["{user}", "{username}", "{server}", "{memberCount}"]}
                                        placeholder="Welcome {user}! You are now verified."
                                    />
                                </div>

                                <div className="space-y-2">
                                    <LabelWithTooltip
                                        label="Welcome Message (Optional)"
                                        tooltip="Posted in the channel where the user is verified (like the default verification message). Leave empty to disable."
                                    />
                                    <textarea
                                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="Welcome {user}! You now have access to restricted channels."
                                        value={config.verificationWelcomeMessage || ""}
                                        onChange={(e) => setConfig({ ...config, verificationWelcomeMessage: e.target.value })}
                                    />
                                    <HelperText>
                                        Sent in the channel where the user is verified. Use <code>{'{user}'}</code> to mention.
                                    </HelperText>
                                </div>

                                <Button type="submit" disabled={saving}>
                                    {saving ? "Saving..." : "Save Settings"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="role-messages" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="mb-4 rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
                                <p className="text-sm text-blue-900 dark:text-blue-200"><strong>Example:</strong> If a user with the @Premium member role verifies, send them "Welcome to the premium community! Enjoy exclusive perks and early access." Regular members see "Welcome to our community!" instead.</p>
                            </div>
                            <HelperText>
                                Create custom welcome messages for users with specific roles. Perfect for premium members, VIPs, or special access groups.
                            </HelperText>
                            <CardTitle>Role-Specific Messages</CardTitle>
                            <CardDescription>Send different messages based on the user's existing roles.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                {roleMessages.map(rule => (
                                    <div key={rule.id} className="flex items-start justify-between rounded-lg border p-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium">
                                                    Role: {rolesById.get(rule.roleId)?.name || rule.roleId}
                                                </span>
                                                <Switch
                                                    checked={rule.enabled}
                                                    onCheckedChange={(checked) => toggleRoleMessage(rule.id, checked)}
                                                />
                                            </div>
                                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{rule.message}</p>
                                            {rule.messageEmbed && (
                                                <p className="text-xs text-muted-foreground">Embed configured</p>
                                            )}
                                            {rule.notifyChannelId && (
                                                <p className="text-xs text-muted-foreground">Notify: #{channelsById.get(rule.notifyChannelId)?.name || rule.notifyChannelId}</p>
                                            )}
                                            {rule.welcomeMessage && (
                                                <p className="text-xs text-muted-foreground whitespace-pre-wrap"><span className="font-medium text-foreground">Welcome:</span> {rule.welcomeMessage}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => startEditRoleMessage(rule)}
                                            >
                                                Edit
                                            </Button>
                                            <ConfirmDeleteDialog
                                                onConfirm={() => deleteRoleMessage(rule.id)}
                                                title="Delete Role Message"
                                                description="Are you sure you want to delete this role-specific message?"
                                                confirmText="Delete"
                                            >
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive hover:text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </ConfirmDeleteDialog>
                                        </div>
                                    </div>
                                ))}
                                {roleMessages.length === 0 && (
                                    <p className="text-sm text-muted-foreground">No role-specific messages configured.</p>
                                )}
                            </div>

                            <div className="space-y-4 rounded-lg border border-dashed p-4">
                                <h4 className="text-sm font-medium">
                                    {editingRoleMessageId ? "Edit Role Message" : "Add Role Message"}
                                </h4>
                                <div className="space-y-2">
                                    <Label>Role</Label>
                                    <RoleSelect
                                        guildId={guildId}
                                        value={newRoleMessageRoleId}
                                        onChange={setNewRoleMessageRoleId}
                                        allowNone={false}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Notification Channel</Label>
                                    <ChannelSelect guildId={guildId} value={newRoleMessageChannelId} onChange={setNewRoleMessageChannelId} allowNone={true} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Message</Label>
                                    <MessageEditor
                                        content={newRoleMessageText}
                                        embed={newRoleMessageEmbed}
                                        embedEnabled={newRoleMessageEmbedEnabled}
                                        onChange={(content, enabled, embed) => {
                                            setNewRoleMessageText(content);
                                            setNewRoleMessageEmbed(embed || {});
                                            setNewRoleMessageEmbedEnabled(enabled);
                                        }}
                                        variables={["{user}", "{username}", "{server}", "{memberCount}"]}
                                        placeholder="Welcome {user}!"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Welcome Message (Optional)</Label>
                                    <textarea
                                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="Welcome {user}!"
                                        value={newRoleMessageWelcomeText}
                                        onChange={(e) => setNewRoleMessageWelcomeText(e.target.value)}
                                    />
                                </div>
                                <Button
                                    onClick={handleAddRoleMessage}
                                    disabled={addingRoleMessage || !newRoleMessageRoleId}
                                    className="w-full"
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    {editingRoleMessageId ? "Save Changes" : "Add Role Message"}
                                </Button>
                                {editingRoleMessageId && (
                                    <Button variant="ghost" onClick={resetRoleMessageForm} className="w-full">
                                        Cancel Edit
                                    </Button>
                                )}
                                {roleMessageError && (
                                    <p className="text-sm text-destructive">{roleMessageError}</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="profiles" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="mb-4 rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
                                <p className="text-sm text-blue-900 dark:text-blue-200"><strong>Example:</strong> Create an "Adult Verified" profile that gives users the @Adult role and notifies them in the #adults-only-restricted channel when applied.</p>
                            </div>
                            <HelperText>
                                Set up multiple verification tiers with different roles and notification channels for specialized access control.
                            </HelperText>
                            <CardTitle>Additional Verification Profiles</CardTitle>
                            <CardDescription>Assign separate verified roles and notify a channel when applied. Verify users into specific roles such as Restricted Channels, Premium Access, or custom verification profiles.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                {rules.map(rule => (
                                    <div key={rule.id} className="flex items-start justify-between rounded-lg border p-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium">
                                                    {rule.name || rolesById.get(rule.roleId)?.name || rule.roleId}
                                                </span>
                                                <Switch
                                                    checked={rule.enabled}
                                                    onCheckedChange={(checked) => toggleRule(rule.id, checked)}
                                                />
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Role: {rolesById.get(rule.roleId)?.name || rule.roleId}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Notify: {rule.notifyChannelId ? `#${channelsById.get(rule.notifyChannelId)?.name || rule.notifyChannelId}` : "Not set"}
                                            </p>
                                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{rule.message}</p>
                                            {rule.welcomeMessage && (
                                                <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                                                    <span className="font-medium text-foreground">Welcome:</span> {rule.welcomeMessage}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => startEditRule(rule)}
                                            >
                                                Edit
                                            </Button>
                                            <ConfirmDeleteDialog
                                                onConfirm={() => handleDeleteRule(rule.id)}
                                                title="Delete Verification Profile"
                                                description="Are you sure you want to delete this verification profile?"
                                                confirmText="Delete"
                                            >
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive hover:text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </ConfirmDeleteDialog>
                                        </div>
                                    </div>
                                ))}

                                {rules.length === 0 && (
                                    <div className="text-center text-sm text-muted-foreground py-4">
                                        No role-specific messages configured.
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4 rounded-lg border border-dashed p-4">
                                <h4 className="text-sm font-medium">
                                    {editingRuleId ? "Edit Verification Profile" : "Add Verification Profile"}
                                </h4>
                                <div className="space-y-2">
                                    <Label>Profile Name</Label>
                                    <Input
                                        value={newRuleName}
                                        onChange={(e) => setNewRuleName(e.target.value)}
                                        placeholder="Adult"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Verified Role</Label>
                                    <RoleSelect
                                        guildId={guildId}
                                        value={newRuleRoleId}
                                        onChange={setNewRuleRoleId}
                                        allowNone={false}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Notification Channel</Label>
                                    <ChannelSelect
                                        guildId={guildId}
                                        value={newRuleChannelId}
                                        onChange={setNewRuleChannelId}
                                        allowNone={false}
                                        placeholder="Select a channel"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Send this message:</Label>
                                    <textarea
                                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="Welcome VIP {user}!"
                                        value={newRuleMessage}
                                        onChange={(e) => setNewRuleMessage(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <LabelWithTooltip
                                        label="Welcome Message (Optional)"
                                        tooltip="Posted in the channel where the user is verified (like the default verification message). Leave empty to disable."
                                    />
                                    <textarea
                                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="Welcome {user}! You now have access to restricted channels."
                                        value={newRuleWelcomeMessage}
                                        onChange={(e) => setNewRuleWelcomeMessage(e.target.value)}
                                    />
                                    <HelperText>
                                        Sent in the channel where the user is verified, when applied with <code>/verify</code>. The message above is sent to the selected notification channel.
                                    </HelperText>
                                </div>
                                <Button
                                    onClick={handleAddRule}
                                    disabled={addingRule || !newRuleName || !newRuleRoleId || !newRuleChannelId}
                                    className="w-full"
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    {editingRuleId ? "Save Changes" : "Add Rule"}
                                </Button>
                                {editingRuleId && (
                                    <Button variant="ghost" onClick={resetRuleForm} className="w-full">
                                        Cancel Edit
                                    </Button>
                                )}
                                {ruleError && (
                                    <p className="text-sm text-destructive">{ruleError}</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="statistics" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Statistics</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center text-muted-foreground"><ShieldCheck className="mr-2 h-4 w-4" /> Verified</span>
                                    <span className="font-bold text-green-500">{stats.verified}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center text-muted-foreground"><UserCheck className="mr-2 h-4 w-4" /> Unverified</span>
                                    <span className="font-bold text-orange-500">{stats.unverified}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center text-muted-foreground"><UserX className="mr-2 h-4 w-4" /> Auto-Kicked</span>
                                    <span className="font-bold text-destructive">{stats.kicked}</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Server Verification Level</Label>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                                    <div
                                        className="h-full bg-primary transition-all duration-500"
                                        style={{ width: `${verifiedPercent}%` }}
                                    />
                                </div>
                                <p className="text-right text-xs text-muted-foreground">{verifiedPercent.toFixed(1)}% Verified</p>
                            </div>
                        </CardContent>
                    </Card>
                <Card>
                        <CardHeader>
                            <CardTitle>Recently Auto-Kicked</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {kickedUsers.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No auto-kicks recorded.</p>
                            ) : (
                                kickedUsers.map((user) => (
                                    <div key={user.userId} className="flex items-center justify-between rounded-lg border p-3">
                                        <div className="flex items-center gap-3">
                                            {user.avatar ? (
                                                <Image
                                                    src={user.avatar}
                                                    alt={user.username}
                                                    width={32}
                                                    height={32}
                                                    className="rounded-full"
                                                />
                                            ) : (
                                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                                                    {user.username.charAt(0)}
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-sm font-medium">{user.username}</p>
                                                <p className="text-xs text-muted-foreground">{user.userId}</p>
                                            </div>
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(user.executedAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Unverified Users</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {unverifiedUsers.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No unverified users right now.</p>
                            ) : (
                                unverifiedUsers.map((user) => (
                                    <div key={user.userId} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                                        <div className="flex min-w-0 flex-1 items-center gap-3">
                                            {user.avatar ? (
                                                <Image
                                                    src={user.avatar}
                                                    alt={user.username}
                                                    width={32}
                                                    height={32}
                                                    className="shrink-0 rounded-full"
                                                />
                                            ) : (
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                                                    {user.username.charAt(0)}
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium">{user.username}</p>
                                                <p className="truncate text-xs text-muted-foreground">{user.userId}</p>
                                            </div>
                                        </div>
                                        <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                                            Joined {new Date(user.joinedAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
