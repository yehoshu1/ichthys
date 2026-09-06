"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "../../../../components/ui/card";
import { Label } from "../../../../components/ui/label";
import { Switch } from "../../../../components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../../../../components/ui/dialog";
import { MessageSquare, Plus, Trash, Edit, Eye, EyeOff, Clock, Hash, User, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "../../../../components/ConfirmDeleteDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
import { Badge } from "../../../../components/ui/badge";
import { Textarea } from "../../../../components/ui/textarea";
import { ChannelMultiSelect, RoleMultiSelect } from "../../../../components/DiscordSelectors";
import { MessageEditor, EmbedData } from "../../../../components/MessageEditor";
import { ExampleBox, HelperText, LabelWithTooltip } from "../../../../components/HelpTooltip";

// Types
interface MessageAlias {
    id: string;
    guildId: string;
    trigger: string;
    response: string;
    responseEmbed: Record<string, unknown> | string | null;
    enabled: boolean;
    caseSensitive: boolean;
    deleteTrigger: boolean;
    requirePrefix: string | null;
    allowedChannels: string[] | null;
    allowedRoles: string[] | null;
    cooldownSeconds: number;
    usageCount: number;
    createdBy: string;
    createdAt: string;
}

const PRESET_TRIGGERS = [
    { label: "Custom", value: "" },
    { label: "Rules", value: "rules" },
    { label: "Help", value: "help" },
    { label: "Invite", value: "invite" },
    { label: "Roles", value: "roles" },
    { label: "FAQ", value: "faq" },
    { label: "Socials", value: "socials" },
    { label: "Support", value: "support" },
];

const PREFIX_OPTIONS = [
    { label: "None (anywhere in message)", value: "none" },
    { label: "! (exclamation)", value: "!" },
    { label: ". (period)", value: "." },
    { label: "? (question)", value: "?" },
    { label: "- (dash)", value: "-" },
];

const COOLDOWN_OPTIONS = [
    { label: "No cooldown", value: 0 },
    { label: "5 seconds", value: 5 },
    { label: "10 seconds", value: 10 },
    { label: "30 seconds", value: 30 },
    { label: "1 minute", value: 60 },
    { label: "5 minutes", value: 300 },
];

function normalizeIdList(values: string[]): string[] {
    const unique = new Set<string>();
    for (const value of values) {
        const normalized = value.trim();
        if (!normalized) continue;
        unique.add(normalized);
    }
    return [...unique];
}

function parseStoredIdList(value: string[] | string | null): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return normalizeIdList(value);
    return normalizeIdList(value.split(","));
}

export default function AliasesPage() {
    const params = useParams();
    const guildId = params.guildId as string;
    
    const [aliases, setAliases] = useState<MessageAlias[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingAlias, setEditingAlias] = useState<MessageAlias | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    // Form state
    const [formData, setFormData] = useState({
        trigger: "",
        response: "",
        responseEmbed: null as EmbedData | null,
        embedEnabled: false,
        enabled: true,
        caseSensitive: false,
        deleteTrigger: false,
        requirePrefix: "!" as string | null,
        allowedChannels: [] as string[],
        allowedRoles: [] as string[],
        cooldownSeconds: 5,
    });

    useEffect(() => {
        fetchAliases();
    }, [guildId]);

    async function fetchAliases() {
        try {
            setLoading(true);
            const res = await fetch(`/api/guilds/${guildId}/aliases`);
            if (res.ok) {
                const data = await res.json();
                setAliases(data);
            } else {
                toast.error("Failed to load aliases");
            }
        } catch (error) {
            console.error("Error fetching aliases:", error);
            toast.error("Failed to load aliases");
        } finally {
            setLoading(false);
        }
    }

    function resetForm() {
        setFormData({
            trigger: "",
            response: "",
            responseEmbed: null,
            embedEnabled: false,
            enabled: true,
            caseSensitive: false,
            deleteTrigger: false,
            requirePrefix: "!",
            allowedChannels: [],
            allowedRoles: [],
            cooldownSeconds: 5,
        });
        setEditingAlias(null);
    }

    function handleEdit(alias: MessageAlias) {
        setEditingAlias(alias);
        // Parse embed JSON into EmbedData if present
        let embedData: EmbedData | null = null;
        let embedEnabled = false;
        if (alias.responseEmbed) {
            try {
                const parsed = typeof alias.responseEmbed === "string"
                    ? JSON.parse(alias.responseEmbed)
                    : alias.responseEmbed;
                embedData = {
                    title: parsed.title || "",
                    description: parsed.description || "",
                    color: parsed.color ? `#${parsed.color.toString(16).padStart(6, '0')}` : "#5865F2",
                    url: parsed.url || "",
                    timestamp: parsed.timestamp || false,
                    footer: parsed.footer || undefined,
                    thumbnail: parsed.thumbnail || undefined,
                    image: parsed.image || undefined,
                    author: parsed.author || undefined,
                };
                embedEnabled = true;
            } catch {
                embedData = null;
                embedEnabled = false;
            }
        }
        setFormData({
            trigger: alias.trigger,
            response: alias.response,
            responseEmbed: embedData,
            embedEnabled,
            enabled: alias.enabled,
            caseSensitive: alias.caseSensitive,
            deleteTrigger: alias.deleteTrigger,
            requirePrefix: alias.requirePrefix,
            allowedChannels: parseStoredIdList(alias.allowedChannels),
            allowedRoles: parseStoredIdList(alias.allowedRoles),
            cooldownSeconds: alias.cooldownSeconds,
        });
        setIsDialogOpen(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!formData.trigger.trim()) {
            toast.error("Trigger word is required");
            return;
        }

        if (!formData.response.trim() && !formData.embedEnabled) {
            toast.error("Response message or embed is required");
            return;
        }

        // Convert EmbedData to API payload shape
        let responseEmbedPayload: Record<string, unknown> | null = null;
        if (formData.embedEnabled && formData.responseEmbed) {
            const embedForApi = {
                ...formData.responseEmbed,
                color: formData.responseEmbed.color 
                    ? parseInt(formData.responseEmbed.color.replace('#', ''), 16) 
                    : 0x5865F2,
            };
            responseEmbedPayload = embedForApi;
        }

        try {
            const payload = {
                trigger: formData.trigger,
                response: formData.response,
                responseEmbed: responseEmbedPayload,
                enabled: formData.enabled,
                caseSensitive: formData.caseSensitive,
                deleteTrigger: formData.deleteTrigger,
                requirePrefix: formData.requirePrefix === "none" ? null : formData.requirePrefix,
                allowedChannels: normalizeIdList(formData.allowedChannels),
                allowedRoles: normalizeIdList(formData.allowedRoles),
                cooldownSeconds: formData.cooldownSeconds,
            };

            let res;
            if (editingAlias) {
                res = await fetch(`/api/guilds/${guildId}/aliases`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: editingAlias.id, ...payload }),
                });
            } else {
                res = await fetch(`/api/guilds/${guildId}/aliases`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            }

            if (res.ok) {
                toast.success(editingAlias ? "Alias updated" : "Alias created");
                await fetchAliases();
                setIsDialogOpen(false);
                resetForm();
            } else {
                const error = await res.json();
                toast.error(error.error || "Failed to save alias");
            }
        } catch (error) {
            console.error("Error saving alias:", error);
            toast.error("Failed to save alias");
        }
    }

    async function handleDelete(id: string) {
        try {
            const res = await fetch(`/api/guilds/${guildId}/aliases?id=${id}`, {
                method: "DELETE",
            });

            if (res.ok) {
                toast.success("Alias deleted");
                await fetchAliases();
            } else {
                toast.error("Failed to delete alias");
            }
        } catch (error) {
            console.error("Error deleting alias:", error);
            toast.error("Failed to delete alias");
        }
    }

    async function handleToggle(id: string) {
        try {
            const res = await fetch(`/api/guilds/${guildId}/aliases`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, enabled: !aliases.find(a => a.id === id)?.enabled }),
            });

            if (res.ok) {
                toast.success("Alias status updated");
                await fetchAliases();
            } else {
                toast.error("Failed to update alias");
            }
        } catch (error) {
            console.error("Error toggling alias:", error);
            toast.error("Failed to update alias");
        }
    }

    const filteredAliases = aliases.filter(
        (alias) =>
            alias.trigger.toLowerCase().includes(searchTerm.toLowerCase()) ||
            alias.response.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="container mx-auto p-6 max-w-6xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <MessageSquare className="h-8 w-8 text-indigo-500" />
                    Message Aliases
                </h1>
                <p className="text-muted-foreground">
                    Create custom trigger words that make the bot respond with predefined messages.
                </p>
                <ExampleBox>
                    Create a &quot;rules&quot; alias that responds with server rules when users type &quot;!rules&quot;. 
                    Enable &quot;Delete Trigger&quot; to clean up the command message automatically. 
                    Set a 30-second cooldown so users can&apos;t spam the command.
                </ExampleBox>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div>
                        <CardTitle>Auto-Responder Aliases</CardTitle>
                        <CardDescription>
                            {aliases.length} alias{aliases.length !== 1 ? "es" : ""} configured
                        </CardDescription>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={resetForm}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Alias
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl p-0 max-h-[90vh] flex flex-col gap-0 overflow-hidden">
                            <div className="flex-1 overflow-y-auto min-h-0">
                                <div className="p-6">
                            <DialogHeader>
                                <DialogTitle>{editingAlias ? "Edit Alias" : "Create New Alias"}</DialogTitle>
                                <DialogDescription>
                                    Configure a trigger word and the bot&apos;s response.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-6 pt-4">
                                {/* Trigger Word */}
                                <div className="space-y-2">
                                    <LabelWithTooltip
                                        htmlFor="trigger"
                                        tooltip="The word or phrase that triggers the bot to respond"
                                    >
                                        <Hash className="h-4 w-4 inline mr-1" />
                                        Trigger Word
                                    </LabelWithTooltip>
                                    <div className="flex gap-2">
                                        <Select
                                            value="custom"
                                            onValueChange={(value) => {
                                                if (value !== "custom") {
                                                    setFormData({ ...formData, trigger: value });
                                                }
                                            }}
                                        >
                                            <SelectTrigger className="w-[200px]">
                                                <SelectValue placeholder="Presets..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {PRESET_TRIGGERS.map((preset) => (
                                                    <SelectItem key={preset.value || "custom"} value={preset.value || "custom"}>
                                                        {preset.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Input
                                            id="trigger"
                                            value={formData.trigger}
                                            onChange={(e) => setFormData({ ...formData, trigger: e.target.value })}
                                            placeholder="e.g., rules, help, faq"
                                            className="flex-1"
                                            maxLength={50}
                                        />
                                    </div>
                                </div>

                                {/* Response Message */}
                                <div className="space-y-2">
                                    <LabelWithTooltip
                                        htmlFor="response"
                                        tooltip="The message the bot will send when the trigger is detected"
                                    >
                                        <MessageCircle className="h-4 w-4 inline mr-1" />
                                        Response Message
                                    </LabelWithTooltip>
                                    <Textarea
                                        id="response"
                                        value={formData.response}
                                        onChange={(e) => setFormData({ ...formData, response: e.target.value })}
                                        placeholder="Type your response here... Supports Discord markdown."
                                        rows={4}
                                        maxLength={2000}
                                    />
                                    <p className="text-xs text-muted-foreground text-right">
                                        {formData.response.length}/2000
                                    </p>
                                </div>

                                {/* Response with Embed Editor */}
                                <div className="space-y-4 border-t pt-4">
                                    <Label className="text-base">Response Configuration</Label>
                                    <MessageEditor
                                        content={formData.response}
                                        embed={formData.responseEmbed || {}}
                                        embedEnabled={formData.embedEnabled}
                                        onChange={(content, embedEnabled, embed) =>
                                            setFormData({
                                                ...formData,
                                                response: content,
                                                embedEnabled,
                                                responseEmbed: embedEnabled ? embed : null,
                                            })
                                        }
                                        variables={[]}
                                        placeholder="Type your response here... Supports Discord markdown."
                                    />
                                </div>

                                {/* Prefix */}
                                <div className="space-y-2">
                                    <LabelWithTooltip tooltip="Optionally require a prefix like ! before the trigger word">
                                        Require Prefix
                                    </LabelWithTooltip>
                                    <Select
                                        value={formData.requirePrefix || "none"}
                                        onValueChange={(value) => setFormData({ ...formData, requirePrefix: value === "none" ? null : value })}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select prefix..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PREFIX_OPTIONS.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Cooldown */}
                                <div className="space-y-2">
                                    <LabelWithTooltip
                                        className="flex items-center gap-2"
                                        tooltip="How long each user must wait before using this alias again"
                                    >
                                        <Clock className="h-4 w-4" />
                                        Cooldown
                                    </LabelWithTooltip>
                                    <Select
                                        value={formData.cooldownSeconds.toString()}
                                        onValueChange={(value) => setFormData({ ...formData, cooldownSeconds: parseInt(value) })}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select cooldown..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {COOLDOWN_OPTIONS.map((option) => (
                                                <SelectItem key={option.value} value={option.value.toString()}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Channel Restrictions */}
                                <div className="space-y-2">
                                    <LabelWithTooltip
                                        className="flex items-center gap-2"
                                        tooltip="Restrict this alias to specific channels only. Leave empty for all channels."
                                    >
                                        <Hash className="h-4 w-4" />
                                        Allowed Channels (Optional)
                                    </LabelWithTooltip>
                                    <ChannelMultiSelect
                                        guildId={guildId}
                                        values={formData.allowedChannels}
                                        onChange={(values) => setFormData({ ...formData, allowedChannels: values })}
                                    />
                                </div>

                                {/* Role Restrictions */}
                                <div className="space-y-2">
                                    <LabelWithTooltip
                                        className="flex items-center gap-2"
                                        tooltip="Only users with these roles can trigger this alias. Leave empty for all users."
                                    >
                                        <User className="h-4 w-4" />
                                        Required Role (Optional)
                                    </LabelWithTooltip>
                                    <RoleMultiSelect
                                        guildId={guildId}
                                        values={formData.allowedRoles}
                                        onChange={(values) => setFormData({ ...formData, allowedRoles: values })}
                                    />
                                </div>

                                {/* Toggles */}
                                <div className="space-y-4 pt-4 border-t">
                                    <div className="flex items-center justify-between space-x-2">
                                        <div className="space-y-0.5">
                                            <Label>Enabled</Label>
                                            <HelperText>Whether this alias is active and responding to trigger words.</HelperText>
                                        </div>
                                        <Switch
                                            checked={formData.enabled}
                                            onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between space-x-2">
                                        <div className="space-y-0.5">
                                            <Label>Case Sensitive</Label>
                                            <HelperText>Require exact capitalization match for the trigger word.</HelperText>
                                        </div>
                                        <Switch
                                            checked={formData.caseSensitive}
                                            onCheckedChange={(checked) => setFormData({ ...formData, caseSensitive: checked })}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between space-x-2">
                                        <div className="space-y-0.5">
                                            <Label>Delete Trigger</Label>
                                            <HelperText>Automatically delete the message that triggered the alias.</HelperText>
                                        </div>
                                        <Switch
                                            checked={formData.deleteTrigger}
                                            onCheckedChange={(checked) => setFormData({ ...formData, deleteTrigger: checked })}
                                        />
                                    </div>
                                </div>

                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button type="submit">
                                        {editingAlias ? "Save Changes" : "Create Alias"}
                                    </Button>
                                </DialogFooter>
                            </form>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </CardHeader>

                <CardContent>
                    <div className="mb-4">
                        <Input
                            placeholder="Search by trigger word or response..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="max-w-sm"
                        />
                    </div>

                    {loading ? (
                        <div className="h-48 flex items-center justify-center text-muted-foreground">
                            Loading aliases...
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[150px]">Trigger</TableHead>
                                    <TableHead>Response</TableHead>
                                    <TableHead className="w-[100px]">Prefix</TableHead>
                                    <TableHead className="w-[100px]">Status</TableHead>
                                    <TableHead className="w-[100px]">Used</TableHead>
                                    <TableHead className="w-[120px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredAliases.map((alias) => (
                                    <TableRow key={alias.id}>
                                        <TableCell>
                                            <code className="bg-muted px-2 py-1 rounded text-sm">
                                                {alias.requirePrefix || ""}{alias.trigger}
                                            </code>
                                            {alias.caseSensitive && (
                                                <Badge variant="outline" className="ml-2 text-xs">Aa</Badge>
                                            )}
                                            {alias.deleteTrigger && (
                                                <Badge variant="outline" className="ml-2 text-xs">del</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="max-w-md truncate text-muted-foreground">
                                                {alias.response}
                                            </div>
                                            {alias.responseEmbed && (
                                                <Badge variant="outline" className="mt-1 text-xs">embed</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {alias.requirePrefix ? (
                                                <code className="text-sm">{alias.requirePrefix}</code>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">None</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={alias.enabled ? "default" : "secondary"}
                                                className="cursor-pointer"
                                                onClick={() => handleToggle(alias.id)}
                                            >
                                                {alias.enabled ? "Enabled" : "Disabled"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-muted-foreground text-sm">
                                                {alias.usageCount.toLocaleString()}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleEdit(alias)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleToggle(alias.id)}
                                                >
                                                    {alias.enabled ? (
                                                        <EyeOff className="h-4 w-4 text-yellow-500" />
                                                    ) : (
                                                        <Eye className="h-4 w-4 text-green-500" />
                                                    )}
                                                </Button>
                                                <ConfirmDeleteDialog
                                                    onConfirm={() => handleDelete(alias.id)}
                                                    title="Delete Alias"
                                                    description={`Are you sure you want to delete the alias for ${alias.trigger}?`}
                                                    confirmText="Delete"
                                                >
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                    >
                                                        <Trash className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </ConfirmDeleteDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredAliases.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            {searchTerm
                                                ? "No aliases found matching your search."
                                                : "No aliases configured yet. Click 'Add Alias' to create one."}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="mt-6">
                <CardHeader>
                    <CardTitle className="text-base">How to Use</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                    <p>
                        <strong>Auto-responder aliases</strong> let you create custom trigger words that the bot will respond to in chat.
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                        <li>Users type the trigger word (with optional prefix like <code>!</code>) to receive the response</li>
                        <li>Supports plain text responses and optional Discord embeds in JSON format</li>
                        <li>Set channel and role restrictions to control who can use which aliases</li>
                        <li>Enable &quot;Delete Trigger&quot; to clean up the trigger message automatically</li>
                        <li>Cooldowns prevent spam - each user has their own cooldown timer</li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}
