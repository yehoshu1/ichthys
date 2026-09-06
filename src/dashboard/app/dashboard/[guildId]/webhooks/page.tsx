"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "../../../../components/ui/button";
import { ConfirmDeleteDialog } from "../../../../components/ConfirmDeleteDialog";
import { Input } from "../../../../components/ui/input";
import {
    Card,
    CardHeader,
    CardContent,
    CardTitle,
    CardDescription,
    CardFooter,
} from "../../../../components/ui/card";
import { Label } from "../../../../components/ui/label";
import { Switch } from "../../../../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../../../components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from "../../../../components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../../../../components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../../../components/ui/select";
import {
    Webhook,
    Key,
    Plus,
    MoreVertical,
    Trash,
    Edit,
    Copy,
    CheckCircle,
    XCircle,
    AlertCircle,
    Clock,
    Activity,
    Shield,
    Send,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../../../../components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import { HelperText } from "../../../../components/HelpTooltip";
import { Checkbox } from "../../../../components/ui/checkbox";
import { ScrollArea } from "../../../../components/ui/scroll-area";

// Types
interface WebhookEndpoint {
    id: string;
    guildId: string;
    name: string;
    url: string;
    secret: string | null;
    eventTypes: string[];
    enabled: boolean;
    failureCount: number;
    lastFailureAt: string | null;
    lastSuccessAt: string | null;
    createdAt: string;
    updatedAt: string;
}

interface WebhookDelivery {
    id: string;
    webhookId: string;
    eventType: string;
    payload: Record<string, unknown>;
    statusCode: number | null;
    responseBody: string | null;
    requestStartedAt: string | null;
    requestCompletedAt: string | null;
    success: boolean;
    error: string | null;
    createdAt: string;
}

interface ApiKey {
    id: string;
    guildId: string;
    name: string;
    permissions: string[];
    createdBy: string;
    enabled: boolean;
    lastUsedAt: string | null;
    useCount: number;
    expiresAt: string | null;
    createdAt: string;
    updatedAt: string;
    // Only returned on creation
    key?: string;
}



const WEBHOOK_EVENT_TYPES = [
    { value: "event.created", label: "Event Created", category: "Events" },
    { value: "event.updated", label: "Event Updated", category: "Events" },
    { value: "event.deleted", label: "Event Deleted", category: "Events" },
    { value: "event.started", label: "Event Started", category: "Events" },
    { value: "rsvp.yes", label: "RSVP: Yes", category: "RSVPs" },
    { value: "rsvp.no", label: "RSVP: No", category: "RSVPs" },
    { value: "rsvp.maybe", label: "RSVP: Maybe", category: "RSVPs" },
    { value: "poll.created", label: "Poll Created", category: "Polls" },
    { value: "poll.voted", label: "Poll Voted", category: "Polls" },
    { value: "poll.closed", label: "Poll Closed", category: "Polls" },
];

const API_PERMISSIONS = [
    { value: "events:read", label: "Read Events", description: "View events and RSVPs" },
    { value: "events:write", label: "Write Events", description: "Create and manage events" },
    { value: "polls:read", label: "Read Polls", description: "View polls and votes" },
    { value: "polls:write", label: "Write Polls", description: "Create and manage polls" },
    { value: "webhooks:read", label: "Read Webhooks", description: "View webhook configurations" },
    { value: "webhooks:write", label: "Write Webhooks", description: "Manage webhooks" },
];

const WEBHOOK_TABS = ["webhooks", "api-keys"] as const;
type WebhookTab = (typeof WEBHOOK_TABS)[number];

export default function WebhooksPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const guildId = params.guildId as string;
    const requestedTab = searchParams.get("tab");
    const resolvedTab: WebhookTab =
        requestedTab && WEBHOOK_TABS.includes(requestedTab as WebhookTab)
            ? (requestedTab as WebhookTab)
            : "webhooks";
    const [activeTab, setActiveTab] = useState<WebhookTab>(resolvedTab);

    useEffect(() => {
        setActiveTab(resolvedTab);
    }, [resolvedTab]);

    return (
        <div className="container mx-auto p-6 max-w-6xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <Webhook className="h-8 w-8 text-orange-500" />
                    Webhooks & API
                </h1>
                <p className="text-muted-foreground">
                    Manage webhooks and API keys.
                </p>
            </div>

            <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as WebhookTab)}
                className="space-y-4"
            >
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="webhooks">
                        <Webhook className="h-4 w-4 mr-2" />
                        Webhooks
                    </TabsTrigger>
                    <TabsTrigger value="api-keys">
                        <Key className="h-4 w-4 mr-2" />
                        API Keys
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="webhooks" className="space-y-4">
                    <WebhooksTab guildId={guildId} />
                </TabsContent>

                <TabsContent value="api-keys" className="space-y-4">
                    <ApiKeysTab guildId={guildId} />
                </TabsContent>


            </Tabs>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOKS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function WebhooksTab({ guildId }: { guildId: string }) {
    const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [editingWebhook, setEditingWebhook] = useState<WebhookEndpoint | null>(null);
    const [viewingLogs, setViewingLogs] = useState<WebhookEndpoint | null>(null);

    const fetchWebhooks = useCallback(async () => {
        try {
            const res = await fetch(`/api/guilds/${guildId}/webhooks`);
            if (res.ok) {
                const data = await res.json();
                setWebhooks(data);
            }
        } catch (error) {
            console.error("Error fetching webhooks:", error);
        } finally {
            setLoading(false);
        }
    }, [guildId]);

    useEffect(() => {
        fetchWebhooks();
    }, [fetchWebhooks]);

    async function deleteWebhook(id: string) {
        try {
            const res = await fetch(`/api/guilds/${guildId}/webhooks/${id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                setWebhooks(webhooks.filter((w) => w.id !== id));
                toast.success("Webhook deleted");
            } else {
                toast.error("Failed to delete webhook");
            }
        } catch (error) {
            console.error("Error deleting webhook:", error);
            toast.error("Failed to delete webhook");
        }
    }

    async function toggleWebhook(id: string, enabled: boolean) {
        try {
            const res = await fetch(`/api/guilds/${guildId}/webhooks/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled }),
            });
            if (res.ok) {
                setWebhooks(
                    webhooks.map((w) => (w.id === id ? { ...w, enabled } : w))
                );
                toast.success(enabled ? "Webhook enabled" : "Webhook disabled");
            }
        } catch (error) {
            console.error("Error toggling webhook:", error);
            toast.error("Failed to update webhook");
        }
    }

    async function testWebhook(id: string) {
        try {
            const res = await fetch(`/api/guilds/${guildId}/webhooks/${id}/test`, {
                method: "POST",
            });
            if (res.ok) {
                toast.success("Test webhook sent");
            } else {
                toast.error("Failed to send test webhook");
            }
        } catch (error) {
            console.error("Error testing webhook:", error);
            toast.error("Failed to send test webhook");
        }
    }

    if (loading) {
        return (
            <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                    Loading webhooks...
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-semibold">Webhook Endpoints</h2>
                    <p className="text-sm text-muted-foreground">
                        Receive real-time event notifications via HTTP POST requests.
                    </p>
                </div>
                <Button onClick={() => setShowCreate(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Webhook
                </Button>
            </div>

            {webhooks.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center">
                        <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium mb-2">No webhooks yet</h3>
                        <p className="text-muted-foreground mb-4">
                            Create a webhook to receive real-time notifications when events happen in your server.
                        </p>
                        <Button onClick={() => setShowCreate(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Webhook
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {webhooks.map((webhook) => (
                        <WebhookCard
                            key={webhook.id}
                            webhook={webhook}
                            onEdit={() => setEditingWebhook(webhook)}
                            onDelete={() => deleteWebhook(webhook.id)}
                            onToggle={(enabled) => toggleWebhook(webhook.id, enabled)}
                            onTest={() => testWebhook(webhook.id)}
                            onViewLogs={() => setViewingLogs(webhook)}
                        />
                    ))}
                </div>
            )}

            {/* Create Dialog */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="max-w-2xl p-0 max-h-[90vh] flex flex-col gap-0 overflow-hidden">
                    <div className="flex-1 overflow-y-auto min-h-0">
                        <div className="p-6">
                    <DialogHeader>
                        <DialogTitle>Create Webhook</DialogTitle>
                        <DialogDescription>
                            Set up a new endpoint to receive event notifications.
                        </DialogDescription>
                    </DialogHeader>
                    <WebhookForm
                        guildId={guildId}
                        onSuccess={() => {
                            setShowCreate(false);
                            fetchWebhooks();
                        }}
                    />
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog
                open={!!editingWebhook}
                onOpenChange={(open) => !open && setEditingWebhook(null)}
            >
                <DialogContent className="max-w-2xl p-0 max-h-[90vh] flex flex-col gap-0 overflow-hidden">
                    <div className="flex-1 overflow-y-auto min-h-0">
                        <div className="p-6">
                    <DialogHeader>
                        <DialogTitle>Edit Webhook</DialogTitle>
                    </DialogHeader>
                    {editingWebhook && (
                        <WebhookForm
                            guildId={guildId}
                            webhook={editingWebhook}
                            onSuccess={() => {
                                setEditingWebhook(null);
                                fetchWebhooks();
                            }}
                        />
                    )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* View Logs Dialog */}
            <Dialog
                open={!!viewingLogs}
                onOpenChange={(open) => !open && setViewingLogs(null)}
            >
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
                    <DialogHeader>
                        <DialogTitle>Webhook Delivery Logs</DialogTitle>
                        <DialogDescription>
                            {viewingLogs?.name} - {viewingLogs?.url}
                        </DialogDescription>
                    </DialogHeader>
                    {viewingLogs && <WebhookLogs webhookId={viewingLogs.id} guildId={guildId} />}
                </DialogContent>
            </Dialog>
        </>
    );
}

function WebhookCard({
    webhook,
    onEdit,
    onDelete,
    onToggle,
    onTest,
    onViewLogs,
}: {
    webhook: WebhookEndpoint;
    onEdit: () => void;
    onDelete: () => void;
    onToggle: (enabled: boolean) => void;
    onTest: () => void;
    onViewLogs: () => void;
}) {
    const lastStatus = webhook.lastFailureAt
        ? webhook.lastSuccessAt && new Date(webhook.lastSuccessAt) > new Date(webhook.lastFailureAt)
            ? "recovered"
            : "failing"
        : webhook.lastSuccessAt
        ? "healthy"
        : "unknown";

    return (
        <Card className="overflow-hidden">
            <div className="p-4">
                <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{webhook.name}</h3>
                            <Badge variant={webhook.enabled ? "default" : "secondary"}>
                                {webhook.enabled ? "Active" : "Disabled"}
                            </Badge>
                            {lastStatus === "failing" && (
                                <Badge variant="destructive" className="gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    Failing
                                </Badge>
                            )}
                        </div>

                        <div className="flex items-center gap-2 mt-1">
                            <code className="text-sm bg-muted px-2 py-0.5 rounded truncate max-w-md">
                                {webhook.url}
                            </code>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => {
                                    navigator.clipboard.writeText(webhook.url);
                                    toast.success("URL copied");
                                }}
                            >
                                <Copy className="h-3 w-3" />
                            </Button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-3">
                            {webhook.eventTypes.map((type) => (
                                <Badge key={type} variant="outline" className="text-xs">
                                    {type}
                                </Badge>
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                            {webhook.secret && (
                                <div className="flex items-center gap-1">
                                    <Shield className="h-4 w-4" />
                                    <span>Secret configured</span>
                                </div>
                            )}
                            {webhook.lastSuccessAt && (
                                <div className="flex items-center gap-1">
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                    <span>
                                        Last success{" "}
                                        {formatDistanceToNow(new Date(webhook.lastSuccessAt), {
                                            addSuffix: true,
                                        })}
                                    </span>
                                </div>
                            )}
                            {webhook.lastFailureAt && (
                                <div className="flex items-center gap-1">
                                    <XCircle className="h-4 w-4 text-red-500" />
                                    <span>
                                        Last failure{" "}
                                        {formatDistanceToNow(new Date(webhook.lastFailureAt), {
                                            addSuffix: true,
                                        })}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Switch
                            checked={webhook.enabled}
                            onCheckedChange={onToggle}
                        />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={onViewLogs}>
                                    <Activity className="h-4 w-4 mr-2" />
                                    View Logs
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={onTest}>
                                    <Send className="h-4 w-4 mr-2" />
                                    Send Test
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={onEdit}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                </DropdownMenuItem>
                                <ConfirmDeleteDialog
                                    onConfirm={onDelete}
                                    title="Delete Webhook?"
                                    description="Are you sure you want to delete this webhook? This action cannot be undone."
                                    confirmText="Delete Webhook"
                                >
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
                                        <Trash className="h-4 w-4 mr-2" />
                                        Delete
                                    </DropdownMenuItem>
                                </ConfirmDeleteDialog>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
        </Card>
    );
}

function WebhookForm({
    guildId,
    webhook,
    onSuccess,
}: {
    guildId: string;
    webhook?: WebhookEndpoint;
    onSuccess: () => void;
}) {
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: webhook?.name || "",
        url: webhook?.url || "",
        secret: "",
        eventTypes: webhook?.eventTypes || [] as string[],
        enabled: webhook?.enabled ?? true,
    });

    function toggleEventType(type: string) {
        setFormData((prev) => ({
            ...prev,
            eventTypes: prev.eventTypes.includes(type)
                ? prev.eventTypes.filter((t) => t !== type)
                : [...prev.eventTypes, type],
        }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!formData.name.trim() || !formData.url.trim()) {
            toast.error("Name and URL are required");
            return;
        }

        if (formData.eventTypes.length === 0) {
            toast.error("Select at least one event type");
            return;
        }

        // Validate URL
        try {
            new URL(formData.url);
        } catch {
            toast.error("Invalid URL");
            return;
        }

        setSaving(true);

        try {
            const url = webhook
                ? `/api/guilds/${guildId}/webhooks/${webhook.id}`
                : `/api/guilds/${guildId}/webhooks`;
            const method = webhook ? "PATCH" : "POST";

            const payload = {
                ...formData,
                secret: formData.secret || undefined,
            };

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const error = await res.json();
                toast.error(error.error || "Failed to save webhook");
                return;
            }

            toast.success(webhook ? "Webhook updated" : "Webhook created");
            onSuccess();
        } catch (error) {
            console.error("Error saving webhook:", error);
            toast.error("Failed to save webhook");
        } finally {
            setSaving(false);
        }
    }

    // Group event types by category
    const groupedEvents = WEBHOOK_EVENT_TYPES.reduce((acc, event) => {
        if (!acc[event.category]) {
            acc[event.category] = [];
        }
        acc[event.category].push(event);
        return acc;
    }, {} as Record<string, typeof WEBHOOK_EVENT_TYPES>);

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="webhook-name">
                    Name <span className="text-red-500">*</span>
                </Label>
                <Input
                    id="webhook-name"
                    value={formData.name}
                    onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Event Notifications"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="webhook-url">
                    Endpoint URL <span className="text-red-500">*</span>
                </Label>
                <Input
                    id="webhook-url"
                    value={formData.url}
                    onChange={(e) =>
                        setFormData({ ...formData, url: e.target.value })
                    }
                    placeholder="https://example.com/webhook"
                />
                <HelperText>
                    Must be a valid HTTPS URL that accepts POST requests.
                </HelperText>
            </div>

            <div className="space-y-2">
                <Label htmlFor="webhook-secret">
                    Secret (Optional)
                </Label>
                <Input
                    id="webhook-secret"
                    type="password"
                    value={formData.secret}
                    onChange={(e) =>
                        setFormData({ ...formData, secret: e.target.value })
                    }
                    placeholder="Used to verify webhook signatures"
                />
                <HelperText>
                    {webhook?.secret
                        ? "Leave blank to keep existing secret. Enter new value to change. Secrets are encrypted with AES-256-GCM at rest."
                        : "We'll send an HMAC-SHA256 signature in the X-Webhook-Signature header. Secrets are encrypted with AES-256-GCM and cannot be retrieved later."}
                </HelperText>
            </div>

            <div className="space-y-4">
                <Label>
                    Event Types <span className="text-red-500">*</span>
                </Label>
                <HelperText>Select which events will trigger this webhook.</HelperText>

                {Object.entries(groupedEvents).map(([category, events]) => (
                    <div key={category} className="space-y-2">
                        <h4 className="font-medium text-sm">{category}</h4>
                        <div className="grid grid-cols-2 gap-2">
                            {events.map((event) => (
                                <div
                                    key={event.value}
                                    className="flex items-center space-x-2"
                                >
                                    <Checkbox
                                        id={event.value}
                                        checked={formData.eventTypes.includes(event.value)}
                                        onCheckedChange={() => toggleEventType(event.value)}
                                    />
                                    <Label
                                        htmlFor={event.value}
                                        className="text-sm cursor-pointer"
                                    >
                                        {event.label}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-between border-t pt-4">
                <div className="space-y-0.5">
                    <Label htmlFor="webhook-enabled">Enabled</Label>
                    <HelperText>Receive webhook notifications</HelperText>
                </div>
                <Switch
                    id="webhook-enabled"
                    checked={formData.enabled}
                    onCheckedChange={(checked) =>
                        setFormData({ ...formData, enabled: checked })
                    }
                />
            </div>

            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline">
                        Cancel
                    </Button>
                </DialogClose>
                <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : webhook ? "Update" : "Create"}
                </Button>
            </DialogFooter>
        </form>
    );
}

function WebhookLogs({ webhookId, guildId }: { webhookId: string; guildId: string }) {
    const [logs, setLogs] = useState<WebhookDelivery[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLogs();
    }, [webhookId]);

    async function fetchLogs() {
        try {
            const res = await fetch(
                `/api/guilds/${guildId}/webhooks/${webhookId}/logs`
            );
            if (res.ok) {
                const data = await res.json();
                setLogs(data);
            }
        } catch (error) {
            console.error("Error fetching logs:", error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return <div className="py-8 text-center">Loading logs...</div>;
    }

    return (
        <ScrollArea className="max-h-[60vh]">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Duration</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {logs.map((log) => (
                        <TableRow key={log.id}>
                            <TableCell className="text-xs">
                                {format(new Date(log.createdAt), "MMM d, HH:mm:ss")}
                            </TableCell>
                            <TableCell>
                                <code className="text-xs bg-muted px-1 rounded">
                                    {log.eventType}
                                </code>
                            </TableCell>
                            <TableCell>
                                {log.success ? (
                                    <Badge variant="default" className="gap-1">
                                        <CheckCircle className="h-3 w-3" />
                                        {log.statusCode}
                                    </Badge>
                                ) : (
                                    <Badge variant="destructive" className="gap-1">
                                        <XCircle className="h-3 w-3" />
                                        {log.statusCode || "Error"}
                                    </Badge>
                                )}
                            </TableCell>
                            <TableCell className="text-xs">
                                {log.requestStartedAt && log.requestCompletedAt
                                    ? `${
                                          new Date(log.requestCompletedAt).getTime() -
                                          new Date(log.requestStartedAt).getTime()
                                      }ms`
                                    : "-"}
                            </TableCell>
                        </TableRow>
                    ))}
                    {logs.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                No delivery logs yet
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </ScrollArea>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// API KEYS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function ApiKeysTab({ guildId }: { guildId: string }) {
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newKey, setNewKey] = useState<ApiKey | null>(null);

    const fetchApiKeys = useCallback(async () => {
        try {
            const res = await fetch(`/api/guilds/${guildId}/api-keys`);
            if (res.ok) {
                const data = await res.json();
                setApiKeys(data);
            }
        } catch (error) {
            console.error("Error fetching API keys:", error);
        } finally {
            setLoading(false);
        }
    }, [guildId]);

    useEffect(() => {
        fetchApiKeys();
    }, [fetchApiKeys]);

    async function deleteApiKey(id: string) {
        try {
            const res = await fetch(`/api/guilds/${guildId}/api-keys/${id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                setApiKeys(apiKeys.filter((k) => k.id !== id));
                toast.success("API key deleted");
            } else {
                toast.error("Failed to delete API key");
            }
        } catch (error) {
            console.error("Error deleting API key:", error);
            toast.error("Failed to delete API key");
        }
    }

    async function toggleApiKey(id: string, enabled: boolean) {
        try {
            const res = await fetch(`/api/guilds/${guildId}/api-keys/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled }),
            });
            if (res.ok) {
                setApiKeys(
                    apiKeys.map((k) => (k.id === id ? { ...k, enabled } : k))
                );
                toast.success(enabled ? "API key enabled" : "API key disabled");
            }
        } catch (error) {
            console.error("Error toggling API key:", error);
            toast.error("Failed to update API key");
        }
    }

    if (loading) {
        return (
            <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                    Loading API keys...
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-semibold">API Keys</h2>
                    <p className="text-sm text-muted-foreground">
                        Manage API keys for programmatic access. Keys are hashed with SHA-256 and shown only once.
                    </p>
                </div>
                <Button onClick={() => setShowCreate(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create API Key
                </Button>
            </div>

            {newKey && (
                <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
                    <CardHeader>
                        <CardTitle className="text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                            <Key className="h-5 w-5" />
                            Save Your API Key
                        </CardTitle>
                        <CardDescription className="text-yellow-700 dark:text-yellow-300">
                            This key will only be shown once. It's hashed with SHA-256 before storage and cannot be recovered. Copy it now and store it securely.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-2">
                            <code className="flex-1 bg-black text-green-400 px-4 py-3 rounded font-mono text-sm break-all">
                                {newKey.key}
                            </code>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    navigator.clipboard.writeText(newKey.key!);
                                    toast.success("Copied to clipboard");
                                }}
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button
                            variant="outline"
                            onClick={() => setNewKey(null)}
                            className="w-full"
                        >
                            I&apos;ve saved my key
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {apiKeys.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center">
                        <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium mb-2">No API keys yet</h3>
                        <p className="text-muted-foreground mb-4">
                            Create an API key to access your server data programmatically.
                        </p>
                        <Button onClick={() => setShowCreate(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create API Key
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {apiKeys.map((apiKey) => (
                        <ApiKeyCard
                            key={apiKey.id}
                            apiKey={apiKey}
                            onDelete={() => deleteApiKey(apiKey.id)}
                            onToggle={(enabled) => toggleApiKey(apiKey.id, enabled)}
                        />
                    ))}
                </div>
            )}

            {/* Create Dialog */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="max-w-2xl p-0 max-h-[90vh] flex flex-col gap-0 overflow-hidden">
                    <div className="flex-1 overflow-y-auto min-h-0">
                        <div className="p-6">
                    <DialogHeader>
                        <DialogTitle>Create API Key</DialogTitle>
                        <DialogDescription>
                            Create a new API key with specific permissions.
                        </DialogDescription>
                    </DialogHeader>
                    <ApiKeyForm
                        guildId={guildId}
                        onSuccess={(key) => {
                            setShowCreate(false);
                            setNewKey(key);
                            fetchApiKeys();
                        }}
                    />
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

function ApiKeyCard({
    apiKey,
    onDelete,
    onToggle,
}: {
    apiKey: ApiKey;
    onDelete: () => void;
    onToggle: (enabled: boolean) => void;
}) {
    return (
        <Card className="overflow-hidden">
            <div className="p-4">
                <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{apiKey.name}</h3>
                            <Badge variant={apiKey.enabled ? "default" : "secondary"}>
                                {apiKey.enabled ? "Active" : "Disabled"}
                            </Badge>
                            {apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date() && (
                                <Badge variant="destructive">Expired</Badge>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                            {apiKey.permissions.map((perm) => (
                                <Badge key={perm} variant="outline" className="text-xs">
                                    {perm}
                                </Badge>
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                Created{" "}
                                {formatDistanceToNow(new Date(apiKey.createdAt), {
                                    addSuffix: true,
                                })}
                            </span>
                            {apiKey.lastUsedAt && (
                                <span className="flex items-center gap-1">
                                    <Activity className="h-4 w-4" />
                                    Last used{" "}
                                    {formatDistanceToNow(new Date(apiKey.lastUsedAt), {
                                        addSuffix: true,
                                    })}
                                </span>
                            )}
                            <span>{apiKey.useCount} uses</span>
                            {apiKey.expiresAt && (
                                <span>
                                    Expires{" "}
                                    {formatDistanceToNow(new Date(apiKey.expiresAt), {
                                        addSuffix: true,
                                    })}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Switch checked={apiKey.enabled} onCheckedChange={onToggle} />
                        <ConfirmDeleteDialog
                            onConfirm={onDelete}
                            title="Delete API Key?"
                            description="Are you sure you want to delete this API key? This action cannot be undone."
                            confirmText="Delete API Key"
                        >
                            <Button variant="ghost" size="sm">
                                <Trash className="h-4 w-4 text-red-500" />
                            </Button>
                        </ConfirmDeleteDialog>
                    </div>
                </div>
            </div>
        </Card>
    );
}

function ApiKeyForm({
    guildId,
    onSuccess,
}: {
    guildId: string;
    onSuccess: (key: ApiKey) => void;
}) {
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        permissions: [] as string[],
        expiresInDays: "",
    });

    function togglePermission(permission: string) {
        setFormData((prev) => ({
            ...prev,
            permissions: prev.permissions.includes(permission)
                ? prev.permissions.filter((p) => p !== permission)
                : [...prev.permissions, permission],
        }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!formData.name.trim()) {
            toast.error("Name is required");
            return;
        }

        if (formData.permissions.length === 0) {
            toast.error("Select at least one permission");
            return;
        }

        setSaving(true);

        try {
            const payload: Record<string, unknown> = {
                name: formData.name,
                permissions: formData.permissions,
            };

            if (formData.expiresInDays) {
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + parseInt(formData.expiresInDays));
                payload.expiresAt = expiresAt.toISOString();
            }

            const res = await fetch(`/api/guilds/${guildId}/api-keys`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const error = await res.json();
                toast.error(error.error || "Failed to create API key");
                return;
            }

            const data = await res.json();
            toast.success("API key created");
            onSuccess(data);
        } catch (error) {
            console.error("Error creating API key:", error);
            toast.error("Failed to create API key");
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="key-name">
                    Name <span className="text-red-500">*</span>
                </Label>
                <Input
                    id="key-name"
                    value={formData.name}
                    onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Production Integration"
                />
            </div>

            <div className="space-y-4">
                <Label>
                    Permissions <span className="text-red-500">*</span>
                </Label>
                <HelperText>Select what this API key can access.</HelperText>

                <div className="grid grid-cols-1 gap-3">
                    {API_PERMISSIONS.map((perm) => (
                        <div
                            key={perm.value}
                            className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                            <Checkbox
                                id={perm.value}
                                checked={formData.permissions.includes(perm.value)}
                                onCheckedChange={() => togglePermission(perm.value)}
                                className="mt-0.5"
                            />
                            <div className="flex-1">
                                <Label
                                    htmlFor={perm.value}
                                    className="font-medium cursor-pointer"
                                >
                                    {perm.label}
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    {perm.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="key-expiry">Expiration (Optional)</Label>
                <Select
                    value={formData.expiresInDays}
                    onValueChange={(value) =>
                        setFormData({ ...formData, expiresInDays: value })
                    }
                >
                    <SelectTrigger>
                        <SelectValue placeholder="No expiration" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="">No expiration</SelectItem>
                        <SelectItem value="7">7 days</SelectItem>
                        <SelectItem value="30">30 days</SelectItem>
                        <SelectItem value="90">90 days</SelectItem>
                        <SelectItem value="365">1 year</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline">
                        Cancel
                    </Button>
                </DialogClose>
                <Button type="submit" disabled={saving}>
                    {saving ? "Creating..." : "Create API Key"}
                </Button>
            </DialogFooter>
        </form>
    );
}
