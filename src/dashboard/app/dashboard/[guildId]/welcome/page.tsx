"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { RoleSelect, ChannelSelect } from "../../../../components/DiscordSelectors";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter } from "../../../../components/ui/card";
import { Label } from "../../../../components/ui/label";
import { Switch } from "../../../../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
import { PlusCircle, Trash2, Check, X, Pencil } from "lucide-react";
import { MessageEditor, EmbedData } from "../../../../components/MessageEditor";
import { useDiscordData } from "../../../../components/useDiscordData";
import { toast } from "sonner";

// Types
interface Template {
    id: string;
    name: string;
    content: string;
    embedEnabled: boolean;
    embedTitle?: string;
    embedDescription?: string;
    embedColor?: string;
    embedThumbnail: boolean;
    embedData?: EmbedData; // New field
}

interface Trigger {
    id: string;
    roleId: string;
    templateId: string;
    channelId: string | null;
    enabled: boolean;
    templateName: string;
}

const WELCOME_TABS = ["general", "triggers", "templates"] as const;
type WelcomeTab = (typeof WELCOME_TABS)[number];

export default function WelcomePage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const guildId = params.guildId as string;
    const requestedTab = searchParams.get("tab");
    const resolvedTab: WelcomeTab = (requestedTab && WELCOME_TABS.includes(requestedTab as WelcomeTab))
        ? (requestedTab as WelcomeTab)
        : "general";
    const [activeTab, setActiveTab] = useState<WelcomeTab>(resolvedTab);

    useEffect(() => {
        setActiveTab(resolvedTab);
    }, [resolvedTab]);

    return (
        <div className="container mx-auto p-6 max-w-5xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Welcome System</h1>
                <p className="text-muted-foreground">Configure welcome messages, auto-roles, and join/leave notifications.</p>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as WelcomeTab)} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="general">General Settings</TabsTrigger>
                    <TabsTrigger value="triggers">Role Triggers</TabsTrigger>
                    <TabsTrigger value="templates">Message Templates</TabsTrigger>
                </TabsList>

                <TabsContent value="general">
                    <GeneralSettings guildId={guildId} />
                </TabsContent>
                <TabsContent value="triggers">
                    <TriggersTab guildId={guildId} />
                </TabsContent>
                <TabsContent value="templates">
                    <TemplatesTab guildId={guildId} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function GeneralSettings({ guildId }: { guildId: string }) {
    const [config, setConfig] = useState<{
        welcomeEnabled: boolean;
        autoRoleId: string;
        joinMessageChannelId: string;
        joinMessage: string;
        joinMessageEmbed?: EmbedData;
        leaveMessageChannelId: string;
        leaveMessage: string;
        leaveMessageEmbed?: EmbedData;
    }>({
        welcomeEnabled: false,
        autoRoleId: "",
        joinMessageChannelId: "",
        joinMessage: "",
        leaveMessageChannelId: "",
        leaveMessage: ""
    });
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchConfig();
    }, [guildId]);

    async function fetchConfig() {
        try {
            const res = await fetch(`/api/guilds/${guildId}/welcome/config`);
            if (res.ok) {
                const data = await res.json();
                setConfig({
                    welcomeEnabled: data.welcomeEnabled ?? false,
                    autoRoleId: data.autoRoleId || "",
                    joinMessageChannelId: data.joinMessageChannelId || "",
                    joinMessage: data.joinMessage || "",
                    joinMessageEmbed: data.joinMessageEmbed || {},
                    leaveMessageChannelId: data.leaveMessageChannelId || "",
                    leaveMessage: data.leaveMessage || "",
                    leaveMessageEmbed: data.leaveMessageEmbed || {}
                });
            }
        } catch (error) {
            console.error("Failed to fetch config:", error);
        } finally {
            setLoading(false);
        }
    }

    async function saveConfig() {
        setSaving(true);
        try {
            const res = await fetch(`/api/guilds/${guildId}/welcome/config`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config)
            });
            if (res.ok) {
                toast.success("Settings saved");
            } else {
                toast.error("Failed to save settings");
            }
        } catch (error) {
            toast.error("Error saving settings");
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading settings...</div>;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>System Status</CardTitle>
                    <CardDescription>Enable or disable the entire welcome system.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center space-x-2">
                        <Switch
                            id="welcome-enabled"
                            checked={config.welcomeEnabled}
                            onCheckedChange={(checked) => setConfig({ ...config, welcomeEnabled: checked })}
                        />
                        <Label htmlFor="welcome-enabled">Enable Welcome System</Label>
                    </div>
                </CardContent>
            </Card>


            <Card>
                <CardHeader>
                    <CardTitle>Auto-Role on Join</CardTitle>
                    <CardDescription>Automatically assign a role when a user joins the server.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Role</Label>
                        <RoleSelect
                            guildId={guildId}
                            value={config.autoRoleId}
                            onChange={(value) => setConfig({ ...config, autoRoleId: value })}
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Join Message</CardTitle>
                        <CardDescription>Sent when a user joins.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Channel</Label>
                            <ChannelSelect
                                guildId={guildId}
                                value={config.joinMessageChannelId}
                                onChange={(value) => setConfig({ ...config, joinMessageChannelId: value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Message Template</Label>
                            <MessageEditor
                                content={config.joinMessage}
                                embed={config.joinMessageEmbed}
                                embedEnabled={!!(config.joinMessageEmbed as any)?.enabled}
                                onChange={(content, enabled, embed) => setConfig({
                                    ...config,
                                    joinMessage: content,
                                    joinMessageEmbed: { ...embed, enabled } as any
                                })}
                                variables={["{user}", "{username}", "{server}", "{memberCount}"]}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Leave Message</CardTitle>
                        <CardDescription>Sent when a user leaves.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Channel</Label>
                            <ChannelSelect
                                guildId={guildId}
                                value={config.leaveMessageChannelId}
                                onChange={(value) => setConfig({ ...config, leaveMessageChannelId: value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Message Template</Label>
                            <MessageEditor
                                content={config.leaveMessage}
                                embed={config.leaveMessageEmbed}
                                embedEnabled={!!(config.leaveMessageEmbed as any)?.enabled}
                                onChange={(content, enabled, embed) => setConfig({
                                    ...config,
                                    leaveMessage: content,
                                    leaveMessageEmbed: { ...embed, enabled } as any
                                })}
                                variables={["{user}", "{username}", "{server}", "{memberCount}"]}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Button onClick={saveConfig} disabled={saving} className="w-full md:w-auto">
                {saving ? "Saving..." : "Save Settings"}
            </Button>
        </div>
    );
}

function TemplatesTab({ guildId }: { guildId: string }) {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<Template>>({
        name: "",
        content: "Welcome {user} to {server}!",
        embedEnabled: false,
        embedData: {}
    });

    useEffect(() => {
        fetchTemplates();
    }, [guildId]);

    async function fetchTemplates() {
        try {
            const res = await fetch(`/api/guilds/${guildId}/welcome/templates`);
            if (res.ok) {
                setTemplates(await res.json());
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        try {
            const res = await fetch(`/api/guilds/${guildId}/welcome/templates`, {
                method: editingId ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingId ? { ...formData, id: editingId } : formData),
            });

            if (res.ok) {
                setIsCreating(false);
                setEditingId(null);
                fetchTemplates();
                setFormData({ name: "", content: "Welcome {user} to {server}!", embedEnabled: false, embedData: {} });
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Delete this template?")) return;
        try {
            const res = await fetch(`/api/guilds/${guildId}/welcome/templates?id=${id}`, { method: "DELETE" });
            if (res.ok) fetchTemplates();
        } catch (err) {
            console.error(err);
        }
    }

    function startEdit(template: Template) {
        setIsCreating(true);
        setEditingId(template.id);
        setFormData({
            name: template.name,
            content: template.content,
            embedEnabled: template.embedEnabled,
            embedData: template.embedData || {},
        });
    }

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading templates...</div>;

    return (
        <div className="space-y-6">
            {!isCreating ? (
                <Button onClick={() => setIsCreating(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Create New Template
                </Button>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>{editingId ? "Edit Template" : "New Template"}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Template Name</Label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Member Join"
                                    required
                                />
                            </div>

                            <MessageEditor
                                content={formData.content || ""}
                                embed={formData.embedData}
                                embedEnabled={formData.embedEnabled || false}
                                onChange={(content, enabled, embed) => setFormData({
                                    ...formData,
                                    content,
                                    embedEnabled: enabled,
                                    embedData: embed
                                })}
                            />

                            <div className="flex gap-2 justify-end">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => {
                                        setIsCreating(false);
                                        setEditingId(null);
                                        setFormData({ name: "", content: "Welcome {user} to {server}!", embedEnabled: false, embedData: {} });
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit">Save Template</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {templates.map(t => (
                    <Card key={t.id}>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-medium flex justify-between items-center">
                                {t.name}
                                {t.embedEnabled && <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">Embed</span>}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground pb-3">
                            <p className="line-clamp-3">{t.content}</p>
                        </CardContent>
                        <CardFooter className="pt-0 flex gap-2">
                            <Button variant="outline" size="sm" className="gap-2" onClick={() => startEdit(t)}>
                                <Pencil className="h-3 w-3" />
                                Edit
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(t.id)}>
                                <Trash2 className="h-3 w-3" />
                                Delete
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}

function TriggersTab({ guildId }: { guildId: string }) {
    const [triggers, setTriggers] = useState<Trigger[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ roleId: "", templateId: "", channelId: "" });
    const { rolesById, channelsById } = useDiscordData(guildId);

    useEffect(() => {
        fetchData();
    }, [guildId]);

    async function fetchData() {
        // Fetch triggers and templates parallel
        const [trigRes, tempRes] = await Promise.all([
            fetch(`/api/guilds/${guildId}/welcome/triggers`),
            fetch(`/api/guilds/${guildId}/welcome/templates`)
        ]);
        if (trigRes.ok) setTriggers(await trigRes.json());
        if (tempRes.ok) setTemplates(await tempRes.json());
        setLoading(false);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        try {
            const res = await fetch(`/api/guilds/${guildId}/welcome/triggers`, {
                method: editingId ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingId ? { ...formData, id: editingId } : formData),
            });

            if (res.ok) {
                setIsCreating(false);
                setEditingId(null);
                fetchData();
                setFormData({ roleId: "", templateId: "", channelId: "" });
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Delete this trigger?")) return;
        try {
            const res = await fetch(`/api/guilds/${guildId}/welcome/triggers?id=${id}`, { method: "DELETE" });
            if (res.ok) fetchData();
        } catch (err) {
            console.error(err);
        }
    }

    async function toggleTrigger(trigger: Trigger, enabled: boolean) {
        try {
            await fetch(`/api/guilds/${guildId}/welcome/triggers`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: trigger.id,
                    roleId: trigger.roleId,
                    templateId: trigger.templateId,
                    channelId: trigger.channelId,
                    enabled,
                }),
            });
            fetchData();
        } catch (err) {
            console.error(err);
        }
    }

    function startEdit(trigger: Trigger) {
        setIsCreating(true);
        setEditingId(trigger.id);
        setFormData({
            roleId: trigger.roleId,
            templateId: trigger.templateId,
            channelId: trigger.channelId || "",
        });
    }

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading triggers...</div>;

    return (
        <div className="space-y-6">
            {!isCreating ? (
                <Button onClick={() => setIsCreating(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Trigger
                </Button>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>{editingId ? "Edit Trigger" : "New Trigger"}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Role (to watch)</Label>
                                <RoleSelect
                                    guildId={guildId}
                                    value={formData.roleId}
                                    onChange={(value) => setFormData({ ...formData, roleId: value })}
                                    allowNone={false}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Message Template</Label>
                                <Select
                                    value={formData.templateId}
                                    onValueChange={(value) => setFormData({ ...formData, templateId: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a template..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {templates.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Channel (Optional, leave blank for DM)</Label>
                                <ChannelSelect
                                    guildId={guildId}
                                    value={formData.channelId || ""}
                                    onChange={(value) => setFormData({ ...formData, channelId: value })}
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => {
                                        setIsCreating(false);
                                        setEditingId(null);
                                        setFormData({ roleId: "", templateId: "", channelId: "" });
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit">Save Trigger</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Active Triggers</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Role</TableHead>
                                <TableHead>Template</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {triggers.map(tr => (
                                <TableRow key={tr.id}>
                                    <TableCell className="font-medium">
                                        {rolesById.get(tr.roleId)?.name || tr.roleId}
                                    </TableCell>
                                    <TableCell>{tr.templateName}</TableCell>
                                    <TableCell>
                                        {tr.channelId ? `#${channelsById.get(tr.channelId)?.name || tr.channelId}` : "DM"}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                checked={tr.enabled}
                                                onCheckedChange={(checked) => toggleTrigger(tr, checked)}
                                            />
                                            {tr.enabled ? (
                                                <span className="flex items-center text-green-500"><Check className="mr-1 h-3 w-3" /> Active</span>
                                            ) : (
                                                <span className="flex items-center text-red-500"><X className="mr-1 h-3 w-3" /> Inactive</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="outline" size="sm" onClick={() => startEdit(tr)}>
                                            <Pencil className="h-3 w-3" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(tr.id)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
