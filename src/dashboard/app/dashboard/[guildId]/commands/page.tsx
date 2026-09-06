"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Settings2, Trash2, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { ConfirmDeleteDialog } from "../../../../components/ConfirmDeleteDialog";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Switch } from "../../../../components/ui/switch";
import { Badge } from "../../../../components/ui/badge";
import { Checkbox } from "../../../../components/ui/checkbox";
import { ScrollArea } from "../../../../components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
import { useDiscordData } from "../../../../components/useDiscordData";
import { ExampleBox, HelperText, LabelWithTooltip } from "../../../../components/HelpTooltip";
import { FadeInStagger, FadeInItem } from "../../../../components/MotionWrapper";

interface CommandConfigPayload {
    commandId: string;
    enabledRoles: string[];
    disabledRoles: string[];
    enabledChannels: string[];
    disabledChannels: string[];
    rolesCanSkipMaxLimit: string[];
    maxLimit: number | null;
    autoDeleteInvocation: boolean;
    autoDeleteReplyAfterSeconds: number | null;
    autoDeleteWithInvocationDeletion: boolean;
}

interface ApiResponse {
    commands: string[];
    configs: Array<CommandConfigPayload>;
}

const DEFAULT_FORM: Omit<CommandConfigPayload, "commandId"> = {
    enabledRoles: [],
    disabledRoles: [],
    enabledChannels: [],
    disabledChannels: [],
    rolesCanSkipMaxLimit: [],
    maxLimit: null,
    autoDeleteInvocation: false,
    autoDeleteReplyAfterSeconds: null,
    autoDeleteWithInvocationDeletion: false,
};

const COMMAND_CONFIG_TABS = ["access", "limits", "autodelete"] as const;
type CommandConfigTab = (typeof COMMAND_CONFIG_TABS)[number];

function toggleSelection(values: string[], id: string): string[] {
    return values.includes(id)
        ? values.filter((value) => value !== id)
        : [...values, id];
}

interface IdLabelItem {
    id: string;
    label: string;
}

interface MultiSelectChecklistProps {
    title: string;
    description: string;
    tooltip?: string;
    items: IdLabelItem[];
    selected: string[];
    onChange: (next: string[]) => void;
}

function MultiSelectChecklist({
    title,
    description,
    tooltip,
    items,
    selected,
    onChange,
}: MultiSelectChecklistProps) {
    return (
        <div className="space-y-3 rounded-lg border p-4">
            <div>
                {tooltip ? (
                    <LabelWithTooltip label={title} tooltip={tooltip} className="font-medium" />
                ) : (
                    <p className="font-medium">{title}</p>
                )}
                <HelperText>{description}</HelperText>
            </div>

            {selected.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {selected.map((id) => {
                        const label = items.find((item) => item.id === id)?.label ?? id;
                        return (
                            <Badge key={id} variant="secondary" className="gap-1">
                                {label}
                                <button
                                    type="button"
                                    className="inline-flex"
                                    onClick={() => onChange(selected.filter((value) => value !== id))}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        );
                    })}
                </div>
            )}

            <ScrollArea className="max-h-56 rounded border p-2">
                <div className="space-y-2">
                {items.map((item) => (
                    <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-muted/60">
                        <Checkbox
                            checked={selected.includes(item.id)}
                            onCheckedChange={() => onChange(toggleSelection(selected, item.id))}
                        />
                        <span className="text-sm">{item.label}</span>
                    </label>
                ))}
                </div>
            </ScrollArea>
        </div>
    );
}

export default function CommandConfigPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const guildId = params.guildId as string;
    const requestedTab = searchParams.get("tab");
    const resolvedTab: CommandConfigTab = (requestedTab && COMMAND_CONFIG_TABS.includes(requestedTab as CommandConfigTab))
        ? (requestedTab as CommandConfigTab)
        : "access";

    const { data: discordData, loading: discordDataLoading } = useDiscordData(guildId);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [commands, setCommands] = useState<string[]>([]);
    const [configsByCommand, setConfigsByCommand] = useState<Record<string, CommandConfigPayload>>({});
    const [selectedCommandId, setSelectedCommandId] = useState<string>("");
    const [activeTab, setActiveTab] = useState<CommandConfigTab>(resolvedTab);
    const [form, setForm] = useState(DEFAULT_FORM);

    useEffect(() => {
        // Default to "access" if the requested tab is "aliases" (which no longer exists)
        if (requestedTab === "aliases") {
            setActiveTab("access");
        } else {
            setActiveTab(resolvedTab);
        }
    }, [requestedTab, resolvedTab]);

    const roleItems = useMemo<IdLabelItem[]>(
        () => discordData.roles.map((role) => ({ id: role.id, label: role.name })),
        [discordData.roles]
    );

    const channelItems = useMemo<IdLabelItem[]>(
        () => discordData.channels.map((channel) => ({ id: channel.id, label: `#${channel.name}` })),
        [discordData.channels]
    );

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/guilds/${guildId}/commands/config`);
            if (!res.ok) {
                throw new Error("Failed to load command configuration");
            }

            const payload = await res.json() as ApiResponse;
            setCommands(payload.commands);

            const map: Record<string, CommandConfigPayload> = {};
            for (const config of payload.configs) {
                map[config.commandId] = config;
            }
            setConfigsByCommand(map);

            const nextCommandId = selectedCommandId || payload.commands[0] || "";
            setSelectedCommandId(nextCommandId);
            if (nextCommandId) {
                const existing = map[nextCommandId];
                setForm(existing ? { ...existing } : { ...DEFAULT_FORM });
            }
        } catch (error) {
            toast.error("Failed to load command configuration");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, [guildId]);

    useEffect(() => {
        if (!selectedCommandId) return;
        const existing = configsByCommand[selectedCommandId];
        setForm(existing ? {
            enabledRoles: existing.enabledRoles,
            disabledRoles: existing.disabledRoles,
            enabledChannels: existing.enabledChannels,
            disabledChannels: existing.disabledChannels,
            rolesCanSkipMaxLimit: existing.rolesCanSkipMaxLimit,
            maxLimit: existing.maxLimit,
            autoDeleteInvocation: existing.autoDeleteInvocation,
            autoDeleteReplyAfterSeconds: existing.autoDeleteReplyAfterSeconds,
            autoDeleteWithInvocationDeletion: existing.autoDeleteWithInvocationDeletion,
        } : { ...DEFAULT_FORM });
    }, [selectedCommandId, configsByCommand]);

    const saveConfig = async () => {
        if (!selectedCommandId) return;
        setSaving(true);

        try {
            // Only send the fields the API expects (exclude guildId, updatedAt from form)
            const requestBody = {
                commandId: selectedCommandId,
                enabledRoles: form.enabledRoles,
                disabledRoles: form.disabledRoles,
                enabledChannels: form.enabledChannels,
                disabledChannels: form.disabledChannels,
                rolesCanSkipMaxLimit: form.rolesCanSkipMaxLimit,
                maxLimit: form.maxLimit,
                autoDeleteInvocation: form.autoDeleteInvocation,
                autoDeleteReplyAfterSeconds: form.autoDeleteReplyAfterSeconds,
                autoDeleteWithInvocationDeletion: form.autoDeleteWithInvocationDeletion,
            };

            const res = await fetch(`/api/guilds/${guildId}/commands/config`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
            });

            const responseData = await res.json();
            if (!res.ok) {
                toast.error(responseData.error || "Failed to save command configuration");
                return;
            }

            const updatedConfig = responseData.config as CommandConfigPayload;
            setConfigsByCommand((prev) => ({
                ...prev,
                [selectedCommandId]: updatedConfig,
            }));

            if (responseData.warning) {
                toast.warning(responseData.warning);
            } else {
                toast.success("Command configuration saved");
            }
        } catch {
            toast.error("Failed to save command configuration");
        } finally {
            setSaving(false);
        }
    };

    const resetCommandConfig = async () => {
        if (!selectedCommandId) return;
        setDeleting(true);
        try {
            const res = await fetch(
                `/api/guilds/${guildId}/commands/config?commandId=${encodeURIComponent(selectedCommandId)}`,
                { method: "DELETE" }
            );
            const payload = await res.json();
            if (!res.ok) {
                toast.error(payload.error || "Failed to reset command configuration");
                return;
            }

            setConfigsByCommand((prev) => {
                const next = { ...prev };
                delete next[selectedCommandId];
                return next;
            });
            setForm({ ...DEFAULT_FORM });

            if (payload.warning) {
                toast.warning(payload.warning);
            } else {
                toast.success("Command configuration reset");
            }
        } catch {
            toast.error("Failed to reset command configuration");
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-80 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <FadeInStagger className="space-y-6">
            <FadeInItem>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Command Configuration</h1>
                    <p className="text-muted-foreground">
                        Configure per-command access rules, limits, and auto-delete behavior for this server.
                    </p>
                    <ExampleBox>
                        Restrict the /kick command to only Moderators and Admins by adding those roles to Enabled Roles.
                        Or block the /warn command in #general by adding it to Disabled Channels.
                    </ExampleBox>
                </div>
            </FadeInItem>

            <FadeInItem>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Settings2 className="h-5 w-5" />
                            Select Command
                        </CardTitle>
                        <CardDescription>Each command can be configured independently.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="max-w-sm space-y-2">
                            <Label>Command</Label>
                            <Select value={selectedCommandId} onValueChange={setSelectedCommandId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select command" />
                                </SelectTrigger>
                                <SelectContent>
                                    {commands.map((commandId) => (
                                        <SelectItem key={commandId} value={commandId}>
                                            /{commandId}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>
            </FadeInItem>

            {selectedCommandId && (
                <FadeInItem>
                    <Card>
                    <CardHeader>
                        <CardTitle>/{selectedCommandId} Settings</CardTitle>
                        <CardDescription>
                            Empty enabled lists mean no restriction. Disabled roles/channels always override enabled lists.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as CommandConfigTab)} className="space-y-4">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="access">Access</TabsTrigger>
                                <TabsTrigger value="limits">Limits</TabsTrigger>
                                <TabsTrigger value="autodelete">Auto-Delete</TabsTrigger>
                            </TabsList>

                            <TabsContent value="access" className="space-y-4">
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <MultiSelectChecklist
                                        title="Enabled Roles"
                                        description="Restrict command access to specific roles"
                                        tooltip="If set, user must have at least one of these roles to use the command. Empty = no restriction."
                                        items={roleItems}
                                        selected={form.enabledRoles}
                                        onChange={(next) => setForm((prev) => ({ ...prev, enabledRoles: next }))}
                                    />
                                    <MultiSelectChecklist
                                        title="Disabled Roles"
                                        description="Block specific roles from using this command"
                                        tooltip="Users with these roles are always blocked from using this command"
                                        items={roleItems}
                                        selected={form.disabledRoles}
                                        onChange={(next) => setForm((prev) => ({ ...prev, disabledRoles: next }))}
                                    />
                                    <MultiSelectChecklist
                                        title="Enabled Channels"
                                        description="Limit command to specific channels"
                                        tooltip="If set, command only works in these channels. Empty = all channels allowed."
                                        items={channelItems}
                                        selected={form.enabledChannels}
                                        onChange={(next) => setForm((prev) => ({ ...prev, enabledChannels: next }))}
                                    />
                                    <MultiSelectChecklist
                                        title="Disabled Channels"
                                        description="Block command in specific channels"
                                        tooltip="Command is always blocked in these channels"
                                        items={channelItems}
                                        selected={form.disabledChannels}
                                        onChange={(next) => setForm((prev) => ({ ...prev, disabledChannels: next }))}
                                    />
                                </div>
                                {(discordDataLoading || (roleItems.length === 0 && channelItems.length === 0)) && (
                                    <p className="text-sm text-muted-foreground">Loading Discord role and channel data...</p>
                                )}
                            </TabsContent>

                            <TabsContent value="limits" className="space-y-4">
                                <div className="max-w-sm space-y-2">
                                    <LabelWithTooltip
                                        label="Max Limit"
                                        tooltip="Maximum number of items/targets per command use. For example, limit /move to 5 users at once."
                                    />
                                    <Input
                                        type="number"
                                        min={1}
                                        value={form.maxLimit ?? ""}
                                        onChange={(event) => {
                                            const value = event.target.value.trim();
                                            const num = value ? Number(value) : null;
                                            setForm((prev) => ({
                                                ...prev,
                                                maxLimit: num && !isNaN(num) ? num : null,
                                            }));
                                        }}
                                        placeholder="Leave empty to disable"
                                    />
                                </div>

                                <MultiSelectChecklist
                                    title="Roles That Can Skip Max Limit"
                                    description="Allow certain roles to bypass the max limit"
                                    tooltip="These roles can bypass the max limit restriction"
                                    items={roleItems}
                                    selected={form.rolesCanSkipMaxLimit}
                                    onChange={(next) => setForm((prev) => ({ ...prev, rolesCanSkipMaxLimit: next }))}
                                />
                            </TabsContent>

                            <TabsContent value="autodelete" className="space-y-4">
                                <div className="space-y-4 rounded-lg border p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <LabelWithTooltip
                                                label="Delete Invocation Message"
                                                tooltip="Deletes the initial bot response generated by the command"
                                            />
                                            <HelperText>Removes the command trigger message after execution</HelperText>
                                        </div>
                                        <Switch
                                            checked={form.autoDeleteInvocation}
                                            onCheckedChange={(checked) => setForm((prev) => ({ ...prev, autoDeleteInvocation: checked }))}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <LabelWithTooltip
                                            label="Delete Bot Reply After N Seconds"
                                            tooltip="Automatically delete the bot's response after this many seconds"
                                        />
                                        <Input
                                            type="number"
                                            min={0}
                                            max={86400}
                                            value={form.autoDeleteReplyAfterSeconds ?? ""}
                                            onChange={(event) => {
                                                const value = event.target.value.trim();
                                                const num = value ? Number(value) : null;
                                                setForm((prev) => ({
                                                    ...prev,
                                                    autoDeleteReplyAfterSeconds: num && !isNaN(num) ? num : null,
                                                }));
                                            }}
                                            placeholder="Leave empty to disable"
                                        />
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div>
                                            <LabelWithTooltip
                                                label="Delete Replies When Invocation Is Deleted"
                                                tooltip="If the original command response is removed, linked follow-up replies will also be removed"
                                            />
                                            <HelperText>Cleans up related messages when the main response is deleted</HelperText>
                                        </div>
                                        <Switch
                                            checked={form.autoDeleteWithInvocationDeletion}
                                            onCheckedChange={(checked) => setForm((prev) => ({ ...prev, autoDeleteWithInvocationDeletion: checked }))}
                                        />
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>

                        <div className="flex flex-wrap gap-2">
                            <Button onClick={saveConfig} disabled={saving}>
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save Configuration
                            </Button>
                            <ConfirmDeleteDialog
                                onConfirm={resetCommandConfig}
                                title="Reset Configuration?"
                                description="Are you sure you want to reset this command's configuration to defaults? This action cannot be undone."
                                confirmText="Reset to Defaults"
                            >
                                <Button variant="destructive" disabled={deleting}>
                                    {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                    Reset to Defaults
                                </Button>
                            </ConfirmDeleteDialog>
                        </div>
                    </CardContent>
                    </Card>
                </FadeInItem>
            )}
        </FadeInStagger>
    );
}
