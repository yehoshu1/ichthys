"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { RoleSelect, ChannelSelect, RoleMultiSelect } from "../../../../components/DiscordSelectors";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Card, CardHeader, CardContent, CardFooter, CardTitle } from "../../../../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
import { Label } from "../../../../components/ui/label";
import { PlusCircle, Pencil, Trash2, X } from "lucide-react";
import { MessageEditor, EmbedData } from "../../../../components/MessageEditor";
import { Switch } from "../../../../components/ui/switch";
import { useDiscordData } from "../../../../components/useDiscordData";
import { ExampleBox, HelperText, LabelWithTooltip } from "../../../../components/HelpTooltip";
import { ConfirmDeleteDialog } from "../../../../components/ConfirmDeleteDialog";

interface RoleAction {
    id: string;
    roleId: string;
    triggerType: "ADD" | "REMOVE";
    actionType: "DM" | "KICK" | "LOG" | "MSG";
    actionDelay: number;
    dmMessage: string | null;
    dmMessageEmbed?: EmbedData;
    channelId: string | null;
    kickReason: string | null;
    logChannelId: string | null;
    enabled: boolean;
    requiredRoleIds: string[];
    requiredRoleLogic: "AND" | "OR";
}

export default function RoleActionsPage() {
    const params = useParams();
    const guildId = params.guildId as string;

    const [actions, setActions] = useState<RoleAction[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingAction, setEditingAction] = useState<Partial<RoleAction> | null>(null);
    const [saving, setSaving] = useState(false);
    const { rolesById, channelsById } = useDiscordData(guildId);

    useEffect(() => {
        fetchActions();
    }, [guildId]);

    async function fetchActions() {
        try {
            const res = await fetch(`/api/guilds/${guildId}/role-actions`);
            if (res.ok) setActions(await res.json());
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    const [error, setError] = useState<string | null>(null);

    async function handleSave() {
        if (!editingAction?.roleId || !editingAction?.actionType) return;
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/guilds/${guildId}/role-actions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingAction),
            });
            if (res.ok) {
                await fetchActions();
                setModalOpen(false);
                setEditingAction(null);
            } else {
                const data = await res.json().catch(() => null);
                const msg = data?.details
                    ? data.details.map((d: any) => `${d.path}: ${d.message}`).join(", ")
                    : data?.error || `Save failed (${res.status})`;
                setError(msg);
                console.error("Role action save failed:", data);
            }
        } catch (err) {
            console.error(err);
            setError("Network error — please try again.");
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string) {
        try {
            const res = await fetch(`/api/guilds/${guildId}/role-actions?id=${id}`, {
                method: "DELETE",
            });
            if (res.ok) await fetchActions();
        } catch (err) {
            console.error(err);
        }
    }

    async function toggleAction(action: RoleAction, enabled: boolean) {
        try {
            await fetch(`/api/guilds/${guildId}/role-actions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...action, enabled }),
            });
            await fetchActions();
        } catch (err) {
            console.error(err);
        }
    }

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading role actions...</div>;

    return (
        <div className="container mx-auto p-6 max-w-5xl">
            <ExampleBox>
                When someone receives the <strong>@Muted</strong> role (ADD), immediately send them a DM explaining why. 
                Or when <strong>@Temporary Access</strong> is removed (REMOVE), log it to #audit-log. 
                You can also set a delay - useful for sending reminders before kicking inactive users.
            </ExampleBox>

            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Automated Role Actions</h1>
                    <p className="text-muted-foreground">Trigger automated responses when members receive specific roles.</p>
                </div>
                <Button
                    onClick={() => {
                        setEditingAction({
                            roleId: "",
                            triggerType: "ADD",
                            actionType: "DM",
                            actionDelay: 0,
                            dmMessage: "",
                            dmMessageEmbed: {},
                            channelId: "",
                            kickReason: "",
                            logChannelId: "",
                            enabled: true,
                            requiredRoleIds: [],
                            requiredRoleLogic: "AND",
                        });
                        setError(null);
                        setModalOpen(true);
                    }}
                >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Action
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {actions.map((action) => (
                    <Card key={action.id} className="relative overflow-hidden">
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col gap-2">
                                    <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium ring-1 ring-inset ring-gray-500/10">
                                        Role: {rolesById.get(action.roleId)?.name || action.roleId}
                                    </span>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Switch
                                            checked={action.enabled}
                                            onCheckedChange={(checked) => toggleAction(action, checked)}
                                        />
                                        {action.enabled ? "Enabled" : "Disabled"}
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium text-white ring-1 ring-inset ring-gray-500/10 ${action.triggerType === 'REMOVE' ? 'bg-orange-500' : 'bg-blue-500'}`}>
                                        {action.triggerType === 'REMOVE' ? 'REMOVED' : 'ADDED'}
                                    </span>
                                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium text-white ring-1 ring-inset ring-gray-500/10 ${action.actionType === 'KICK' ? 'bg-destructive'
                                        : action.actionType === 'MSG' ? 'bg-purple-500'
                                            : action.actionType === 'DM' ? 'bg-primary'
                                                : 'bg-green-600'
                                        }`}>
                                        {action.actionType}
                                    </span>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pb-3 text-sm">
                            <div className="space-y-1">
                                <p><span className="font-semibold text-muted-foreground">Delay:</span> {action.actionDelay} minutes</p>
                                {action.dmMessage && (
                                    <p className="line-clamp-2"><span className="font-semibold text-muted-foreground">Message:</span> {action.dmMessage}</p>
                                )}
                                {action.channelId && (
                                    <p><span className="font-semibold text-muted-foreground">Channel:</span> #{channelsById.get(action.channelId)?.name || action.channelId}</p>
                                )}
                                {action.kickReason && (
                                    <p><span className="font-semibold text-muted-foreground">Reason:</span> {action.kickReason}</p>
                                )}
                            </div>
                        </CardContent>
                        <CardFooter className="flex gap-2 pt-3">
                            <Button variant="secondary" size="sm" className="w-full" onClick={() => {
                                setEditingAction(action);
                                setError(null);
                                setModalOpen(true);
                            }}>
                                <Pencil className="mr-2 h-3 w-3" /> Edit
                            </Button>
                            <ConfirmDeleteDialog
                                onConfirm={() => handleDelete(action.id)}
                                title="Delete Role Action"
                                description="Are you sure you want to delete this automated role action?"
                                confirmText="Delete"
                            >
                                <Button variant="outline" size="sm" className="w-full text-destructive hover:text-destructive">
                                    <Trash2 className="mr-2 h-3 w-3" /> Delete
                                </Button>
                            </ConfirmDeleteDialog>
                        </CardFooter>
                    </Card>
                ))}

                {actions.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center animate-in fade-in-50">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                            <PlusCircle className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h3 className="mt-4 text-lg font-semibold">No actions configured</h3>
                        <p className="mb-4 text-sm text-muted-foreground">Create your first automated action to get started.</p>
                        <Button
                            onClick={() => {
                                setEditingAction({
                                    roleId: "",
                                    triggerType: "ADD",
                                    actionType: "DM",
                                    actionDelay: 0,
                                    dmMessage: "",
                                    dmMessageEmbed: {},
                                    channelId: "",
                                    kickReason: "",
                                    logChannelId: "",
                                    enabled: true,
                                    requiredRoleIds: [],
                                    requiredRoleLogic: "AND",
                                });
                                setModalOpen(true);
                            }}
                        >
                            Add Action
                        </Button>
                    </div>
                )}
            </div>

            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                    <Card className="w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto min-h-0">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                            <CardTitle>{editingAction?.id ? "Edit Action" : "New Role Action"}</CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => setModalOpen(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <LabelWithTooltip
                                        label="Trigger"
                                        tooltip="Choose whether the action runs when a role is ADDED or REMOVED from a user."
                                    />
                                    <Select
                                        value={editingAction?.triggerType || "ADD"}
                                        onValueChange={(value) => setEditingAction({ ...editingAction!, triggerType: value as any })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ADD">Role Added</SelectItem>
                                            <SelectItem value="REMOVE">Role Removed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <LabelWithTooltip
                                        label="Role"
                                        tooltip="The role to watch. When this role is added or removed, the action will trigger."
                                    />
                                    <RoleSelect
                                        guildId={guildId}
                                        value={editingAction?.roleId || ""}
                                        onChange={(value) => setEditingAction({ ...editingAction!, roleId: value })}
                                        allowNone={false}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <LabelWithTooltip
                                    label="Action Type"
                                    tooltip="DM = Private message to user. MSG = Public channel post. KICK = Remove user from server. LOG = Silent audit log entry."
                                />
                                <Select
                                    value={editingAction?.actionType || "DM"}
                                    onValueChange={(value) => setEditingAction({ ...editingAction!, actionType: value as any })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select action type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="DM">Send Direct Message</SelectItem>
                                        <SelectItem value="MSG">Send Channel Message</SelectItem>
                                        <SelectItem value="KICK">Kick Member</SelectItem>
                                        <SelectItem value="LOG">Post to Log Channel</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <LabelWithTooltip
                                    label="Delay (Minutes)"
                                    tooltip="Wait this many minutes before executing the action. Useful for grace periods or reminders."
                                />
                                <Input
                                    type="number"
                                    value={editingAction?.actionDelay || 0}
                                    onChange={(e) => setEditingAction({ ...editingAction!, actionDelay: parseInt(e.target.value) })}
                                    min={0}
                                />
                                <HelperText>Set to 0 for immediate action, or use 60 to wait 1 hour.</HelperText>
                            </div>

                            <div className="space-y-2">
                                <LabelWithTooltip
                                    label="Required Roles (Optional)"
                                    tooltip="The action only triggers if the user has these roles at the time of the role change. Leave empty to always trigger."
                                />
                                <RoleMultiSelect
                                    guildId={guildId}
                                    values={editingAction?.requiredRoleIds || []}
                                    onChange={(values) => setEditingAction({ ...editingAction!, requiredRoleIds: values })}
                                    placeholder="No condition — always trigger"
                                />
                                {(editingAction?.requiredRoleIds?.length ?? 0) > 0 && (
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Logic</Label>
                                        <Select
                                            value={editingAction?.requiredRoleLogic || "AND"}
                                            onValueChange={(value) => setEditingAction({ ...editingAction!, requiredRoleLogic: value as "AND" | "OR" })}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="AND">AND — user must have ALL selected roles</SelectItem>
                                                <SelectItem value="OR">OR — user must have ANY selected role</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                <HelperText>Only trigger this action if the member currently holds these roles.</HelperText>
                            </div>

                            {(editingAction?.actionType === "DM" || editingAction?.actionType === "LOG" || editingAction?.actionType === "KICK" || editingAction?.actionType === "MSG") && (
                                <div className="space-y-2">
                                    <Label>
                                        {editingAction.actionType === "KICK" ? "DM Message (Optional)" : "Message Content"}
                                    </Label>
                                    <MessageEditor
                                        content={editingAction?.dmMessage || ""}
                                        embed={editingAction?.dmMessageEmbed}
                                        embedEnabled={!!(editingAction?.dmMessageEmbed as any)?.enabled}
                                        onChange={(content, enabled, embed) => setEditingAction({
                                            ...editingAction!,
                                            dmMessage: content,
                                            dmMessageEmbed: { ...embed, enabled } as any
                                        })}
                                        variables={['{user}', '{username}', '{server}', '{memberCount}']}
                                        placeholder="Enter message content..."
                                    />
                                </div>
                            )}

                            {editingAction?.actionType === "MSG" && (
                                <div className="space-y-2">
                                    <Label>Target Channel</Label>
                                    <ChannelSelect
                                        guildId={guildId}
                                        value={editingAction?.channelId || ""}
                                        onChange={(value) => setEditingAction({ ...editingAction!, channelId: value })}
                                    />
                                </div>
                            )}

                            {editingAction?.actionType === "KICK" && (
                                <div className="space-y-2">
                                    <LabelWithTooltip
                                        label="Kick Reason (Internal)"
                                        tooltip="This reason appears in Discord's audit log. Users will see this if they try to rejoin."
                                    />
                                    <Input
                                        value={editingAction?.kickReason || ""}
                                        onChange={(e) => setEditingAction({ ...editingAction!, kickReason: e.target.value })}
                                        placeholder="Reason for audit log"
                                    />
                                </div>
                            )}

                            {editingAction?.actionType === "LOG" && (
                                <div className="space-y-2">
                                    <Label>Log Channel</Label>
                                    <ChannelSelect
                                        guildId={guildId}
                                        value={editingAction?.logChannelId || ""}
                                        onChange={(value) => setEditingAction({ ...editingAction!, logChannelId: value })}
                                    />
                                </div>
                            )}
                        </CardContent>
                        {error && (
                            <div className="mx-6 rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                                {error}
                            </div>
                        )}
                        <CardFooter className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleSave} disabled={saving}>
                                {saving ? "Saving..." : "Save Action"}
                            </Button>
                        </CardFooter>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
