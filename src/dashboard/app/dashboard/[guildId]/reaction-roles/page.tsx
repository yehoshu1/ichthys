"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { RoleSelect, ChannelSelect } from "../../../../components/DiscordSelectors";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "../../../../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
import { Textarea } from "../../../../components/ui/textarea";
import { Label } from "../../../../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { PlusCircle, Trash2, Pencil, X, Send, MessageSquare, Smile } from "lucide-react";
import { useDiscordData } from "../../../../components/useDiscordData";
import { toast } from "sonner";
import { MessageEditor, EmbedData } from "../../../../components/MessageEditor";
import { Badge } from "../../../../components/ui/badge";
import { Switch } from "../../../../components/ui/switch";

// Reaction role types
const REACTION_TYPES = [
    { value: "TOGGLE", label: "Toggle (Add/Remove)", description: "Members can toggle the role on/off" },
    { value: "ADD_ONLY", label: "Add Only", description: "Role can only be added, not removed" },
    { value: "REMOVE_ONLY", label: "Remove Only", description: "Role can only be removed, not added" },
    { value: "UNIQUE", label: "Unique (Only one)", description: "Member can only have one role from this message" },
];

interface ReactionRoleMessage {
    id: string;
    guildId: string;
    messageId: string | null;
    channelId: string;
    title: string | null;
    content: string | null;
    embed: any;
    color: number | null;
    enabled: boolean;
    createdAt: string;
}

interface ReactionRole {
    id: string;
    reactionRoleMessageId: string | null;
    messageId: string;
    channelId: string;
    emoji: string;
    roleId: string;
    type: "TOGGLE" | "ADD_ONLY" | "REMOVE_ONLY" | "UNIQUE";
    description: string | null;
    enabled: boolean;
}

interface MessageFormData {
    id?: string;
    channelId: string;
    title: string;
    content: string;
    embed: EmbedData;
    embedEnabled: boolean;
    color: number;
}

interface ReactionRoleFormData {
    id?: string;
    reactionRoleMessageId: string;
    messageId: string;
    channelId: string;
    emoji: string;
    roleId: string;
    type: "TOGGLE" | "ADD_ONLY" | "REMOVE_ONLY" | "UNIQUE";
    description: string;
}

const REACTION_ROLE_TABS = ["messages", "roles"] as const;
type ReactionRoleTab = (typeof REACTION_ROLE_TABS)[number];

export default function ReactionRolesPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const guildId = params.guildId as string;
    const requestedTab = searchParams.get("tab");
    const resolvedTab: ReactionRoleTab = (requestedTab && REACTION_ROLE_TABS.includes(requestedTab as ReactionRoleTab))
        ? (requestedTab as ReactionRoleTab)
        : "messages";

    const [activeTab, setActiveTab] = useState<ReactionRoleTab>(resolvedTab);
    const [messages, setMessages] = useState<ReactionRoleMessage[]>([]);
    const [reactionRoles, setReactionRoles] = useState<ReactionRole[]>([]);
    const [loading, setLoading] = useState(true);
    const { rolesById, channelsById } = useDiscordData(guildId);

    // Message form state
    const [isEditingMessage, setIsEditingMessage] = useState(false);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [messageForm, setMessageForm] = useState<MessageFormData>({
        channelId: "",
        title: "",
        content: "",
        embed: {},
        embedEnabled: false,
        color: 0x5865F2,
    });

    // Reaction role form state
    const [isEditingRole, setIsEditingRole] = useState(false);
    const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
    const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
    const [roleForm, setRoleForm] = useState<ReactionRoleFormData>({
        reactionRoleMessageId: "",
        messageId: "",
        channelId: "",
        emoji: "",
        roleId: "",
        type: "TOGGLE",
        description: "",
    });

    useEffect(() => {
        fetchData();
    }, [guildId]);

    useEffect(() => {
        setActiveTab(resolvedTab);
    }, [resolvedTab]);

    async function fetchData() {
        try {
            const [messagesRes, rolesRes] = await Promise.all([
                fetch(`/api/guilds/${guildId}/reaction-roles/messages`),
                fetch(`/api/guilds/${guildId}/reaction-roles`),
            ]);

            if (messagesRes.ok) setMessages(await messagesRes.json());
            if (rolesRes.ok) setReactionRoles(await rolesRes.json());
        } catch (err) {
            console.error("Failed to fetch data:", err);
            toast.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    }

    // Message handlers
    async function handleSaveMessage(e: React.FormEvent) {
        e.preventDefault();
        try {
            const res = await fetch(`/api/guilds/${guildId}/reaction-roles/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: editingMessageId,
                    channelId: messageForm.channelId,
                    title: messageForm.title || null,
                    content: messageForm.content || null,
                    embed: messageForm.embedEnabled ? messageForm.embed : null,
                    color: messageForm.color,
                }),
            });

            if (res.ok) {
                setIsEditingMessage(false);
                setEditingMessageId(null);
                toast.success(editingMessageId ? "Message updated" : "Message created");
                fetchData();
                resetMessageForm();
            } else {
                const error = await res.text();
                toast.error(`Failed to save: ${error}`);
            }
        } catch (err) {
            console.error(err);
            toast.error("Error saving message");
        }
    }

    async function handleSendMessage(messageId: string) {
        try {
            const res = await fetch(`/api/guilds/${guildId}/reaction-roles/messages`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messageId }),
            });

            if (res.ok) {
                const data = await res.json();
                toast.success("Message sent to Discord!");
                fetchData();

                // If this is the selected message for adding roles, update the messageId
                if (selectedMessageId === messageId) {
                    const message = messages.find(m => m.id === messageId);
                    if (message) {
                        setRoleForm(prev => ({
                            ...prev,
                            messageId: data.discordMessageId,
                            channelId: message.channelId,
                        }));
                    }
                }
            } else {
                const error = await res.json();
                toast.error(error.error || "Failed to send message");
            }
        } catch (err) {
            console.error(err);
            toast.error("Error sending message");
        }
    }

    async function handleDeleteMessage(id: string) {
        if (!confirm("Are you sure you want to delete this message? This will also delete it from Discord if it was sent.")) return;
        try {
            const res = await fetch(`/api/guilds/${guildId}/reaction-roles/messages?id=${id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                toast.success("Message deleted");
                fetchData();
            } else {
                toast.error("Failed to delete message");
            }
        } catch (err) {
            console.error(err);
            toast.error("Error deleting message");
        }
    }

    function resetMessageForm() {
        setMessageForm({
            channelId: "",
            title: "",
            content: "",
            embed: {},
            embedEnabled: false,
            color: 0x5865F2,
        });
    }

    function editMessage(message: ReactionRoleMessage) {
        setEditingMessageId(message.id);
        setMessageForm({
            channelId: message.channelId,
            title: message.title || "",
            content: message.content || "",
            embed: message.embed || {},
            embedEnabled: !!message.embed,
            color: message.color || 0x5865F2,
        });
        setIsEditingMessage(true);
    }

    // Reaction role handlers
    async function handleSaveRole(e: React.FormEvent) {
        e.preventDefault();

        const message = messages.find(m => m.id === roleForm.reactionRoleMessageId);
        if (!message) {
            toast.error("Please select a message");
            return;
        }

        // Use the Discord message ID if sent, otherwise use our internal ID
        const discordMessageId = message.messageId || roleForm.reactionRoleMessageId;

        try {
            const res = await fetch(`/api/guilds/${guildId}/reaction-roles`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: editingRoleId,
                    reactionRoleMessageId: roleForm.reactionRoleMessageId,
                    messageId: discordMessageId,
                    channelId: message.channelId,
                    emoji: roleForm.emoji,
                    roleId: roleForm.roleId,
                    type: roleForm.type,
                    description: roleForm.description || null,
                }),
            });

            if (res.ok) {
                setIsEditingRole(false);
                setEditingRoleId(null);
                toast.success(editingRoleId ? "Reaction role updated" : "Reaction role added");
                fetchData();
                resetRoleForm();
            } else {
                const error = await res.text();
                toast.error(`Failed to save: ${error}`);
            }
        } catch (err) {
            console.error(err);
            toast.error("Error saving reaction role");
        }
    }

    async function handleDeleteRole(id: string) {
        if (!confirm("Are you sure you want to delete this reaction role?")) return;
        try {
            const res = await fetch(`/api/guilds/${guildId}/reaction-roles?id=${id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                toast.success("Reaction role deleted");
                fetchData();
            } else {
                toast.error("Failed to delete reaction role");
            }
        } catch (err) {
            console.error(err);
            toast.error("Error deleting reaction role");
        }
    }

    function resetRoleForm() {
        setRoleForm({
            reactionRoleMessageId: "",
            messageId: "",
            channelId: "",
            emoji: "",
            roleId: "",
            type: "TOGGLE",
            description: "",
        });
        setSelectedMessageId(null);
    }

    function startAddingRole(messageId: string) {
        const message = messages.find(m => m.id === messageId);
        if (!message) return;

        setSelectedMessageId(messageId);
        setRoleForm({
            reactionRoleMessageId: messageId,
            messageId: message.messageId || "",
            channelId: message.channelId,
            emoji: "",
            roleId: "",
            type: "TOGGLE",
            description: "",
        });
        setIsEditingRole(true);
        setActiveTab("roles");
    }

    function getTypeLabel(type: string) {
        return REACTION_TYPES.find(t => t.value === type)?.label || type;
    }

    // Get roles for a specific message
    function getRolesForMessage(messageId: string) {
        return reactionRoles.filter(r => r.reactionRoleMessageId === messageId);
    }

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

    return (
        <div className="container mx-auto p-6 max-w-5xl">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Reaction Roles</h1>
                    <p className="text-muted-foreground">Create messages and assign roles based on reactions.</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ReactionRoleTab)} className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                    <TabsTrigger value="messages" className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Messages
                    </TabsTrigger>
                    <TabsTrigger value="roles" className="flex items-center gap-2">
                        <Smile className="h-4 w-4" />
                        Reaction Roles
                    </TabsTrigger>
                </TabsList>

                {/* Messages Tab */}
                <TabsContent value="messages" className="space-y-6">
                    {!isEditingMessage ? (
                        <>
                            <div className="flex justify-end">
                                <Button onClick={() => setIsEditingMessage(true)}>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Create Message
                                </Button>
                            </div>

                            {messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                                        <MessageSquare className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <h3 className="mt-4 text-lg font-semibold">No messages created</h3>
                                    <p className="mb-4 text-sm text-muted-foreground max-w-sm">
                                        Create a message to send to Discord. Then add reaction roles to it.
                                    </p>
                                    <Button onClick={() => setIsEditingMessage(true)}>
                                        <PlusCircle className="mr-2 h-4 w-4" />
                                        Create Message
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid gap-6 md:grid-cols-2">
                                    {messages.map((message) => {
                                        const roles = getRolesForMessage(message.id);
                                        const isSent = !!message.messageId;

                                        return (
                                            <Card key={message.id} className={isSent ? "border-green-500/50" : ""}>
                                                <CardHeader>
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <CardTitle className="text-lg flex items-center gap-2">
                                                                {message.title || "Untitled Message"}
                                                                {isSent && (
                                                                    <Badge variant="default" className="bg-green-500">Sent</Badge>
                                                                )}
                                                            </CardTitle>
                                                            <CardDescription>
                                                                Channel: #{channelsById.get(message.channelId)?.name || message.channelId}
                                                            </CardDescription>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => editMessage(message)}
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="text-destructive hover:text-destructive"
                                                                onClick={() => handleDeleteMessage(message.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="space-y-4">
                                                    {/* Preview */}
                                                    <div className="rounded-md border bg-muted/50 p-3">
                                                        {message.content && (
                                                            <p className="text-sm mb-2">{message.content}</p>
                                                        )}
                                                        {message.embed && (
                                                            <div
                                                                className="rounded-md p-3 text-sm"
                                                                style={{
                                                                    borderLeft: `4px solid #${(message.color || 0x5865F2).toString(16).padStart(6, '0')}`,
                                                                    backgroundColor: 'rgba(0,0,0,0.1)',
                                                                }}
                                                            >
                                                                {(message.embed as any)?.title && (
                                                                    <div className="font-bold mb-1">{(message.embed as any).title}</div>
                                                                )}
                                                                {(message.embed as any)?.description && (
                                                                    <div className="text-muted-foreground">{(message.embed as any).description}</div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Roles */}
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="secondary">
                                                                {roles.length} role{roles.length !== 1 ? 's' : ''}
                                                            </Badge>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => startAddingRole(message.id)}
                                                        >
                                                            <PlusCircle className="mr-1 h-3 w-3" />
                                                            Add Role
                                                        </Button>
                                                    </div>

                                                    {/* Send button */}
                                                    {!isSent ? (
                                                        <Button
                                                            className="w-full"
                                                            onClick={() => handleSendMessage(message.id)}
                                                        >
                                                            <Send className="mr-2 h-4 w-4" />
                                                            Send to Discord
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="outline"
                                                            className="w-full"
                                                            onClick={() => handleSendMessage(message.id)}
                                                        >
                                                            <Send className="mr-2 h-4 w-4" />
                                                            Update in Discord
                                                        </Button>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    ) : (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle>{editingMessageId ? "Edit Message" : "Create New Message"}</CardTitle>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                            setIsEditingMessage(false);
                                            setEditingMessageId(null);
                                            resetMessageForm();
                                        }}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                                <CardDescription>
                                    Create a message to send to Discord. You can add reaction roles after sending.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSaveMessage} className="space-y-6">
                                    <div className="space-y-2">
                                        <Label>Target Channel</Label>
                                        <ChannelSelect
                                            guildId={guildId}
                                            value={messageForm.channelId}
                                            onChange={(value) => setMessageForm({ ...messageForm, channelId: value })}
                                            allowNone={false}
                                            placeholder="Select channel to send message"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Title (Optional)</Label>
                                        <Input
                                            value={messageForm.title}
                                            onChange={(e) => setMessageForm({ ...messageForm, title: e.target.value })}
                                            placeholder="e.g., Pick Your Roles!"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Message Content</Label>
                                        <Textarea
                                            value={messageForm.content}
                                            onChange={(e) => setMessageForm({ ...messageForm, content: e.target.value })}
                                            placeholder="Enter your message content..."
                                            rows={4}
                                        />
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <Label>Include Embed</Label>
                                            <Switch
                                                checked={messageForm.embedEnabled}
                                                onCheckedChange={(checked) => setMessageForm({ ...messageForm, embedEnabled: checked })}
                                            />
                                        </div>

                                        {messageForm.embedEnabled && (
                                            <div className="pl-4 border-l-2 space-y-4">
                                                <MessageEditor
                                                    content=""
                                                    embed={messageForm.embed}
                                                    embedEnabled={true}
                                                    onChange={(_, enabled, embed) =>
                                                        setMessageForm({
                                                            ...messageForm,
                                                            embed: embed as EmbedData,
                                                            embedEnabled: enabled,
                                                        })
                                                    }
                                                    variables={[]}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-end gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                setIsEditingMessage(false);
                                                setEditingMessageId(null);
                                                resetMessageForm();
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                        <Button type="submit">
                                            {editingMessageId ? "Update Message" : "Create Message"}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Roles Tab */}
                <TabsContent value="roles" className="space-y-6">
                    {!isEditingRole ? (
                        <>
                            <div className="flex justify-between items-center">
                                <p className="text-muted-foreground">
                                    Manage reaction roles for your messages.
                                </p>
                                {messages.length > 0 && (
                                    <Select
                                        value={selectedMessageId || ""}
                                        onValueChange={(value) => {
                                            if (value) startAddingRole(value);
                                        }}
                                    >
                                        <SelectTrigger className="w-[250px]">
                                            <SelectValue placeholder="Select message to add role..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {messages.map((msg) => (
                                                <SelectItem key={msg.id} value={msg.id}>
                                                    {msg.title || "Untitled"} ({getRolesForMessage(msg.id).length} roles)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>

                            {reactionRoles.length === 0 ? (
                                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                                        <Smile className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <h3 className="mt-4 text-lg font-semibold">No reaction roles configured</h3>
                                    <p className="mb-4 text-sm text-muted-foreground max-w-sm">
                                        Add reaction roles to your messages. Users will get roles when they react with the specified emoji.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {messages.map((message) => {
                                        const roles = getRolesForMessage(message.id);
                                        if (roles.length === 0) return null;

                                        return (
                                            <Card key={message.id}>
                                                <CardHeader>
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <CardTitle className="text-lg">
                                                                {message.title || "Untitled Message"}
                                                            </CardTitle>
                                                            <CardDescription>
                                                                #{channelsById.get(message.channelId)?.name || message.channelId}
                                                                {message.messageId && (
                                                                    <Badge variant="outline" className="ml-2">Sent</Badge>
                                                                )}
                                                            </CardDescription>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => startAddingRole(message.id)}
                                                        >
                                                            <PlusCircle className="mr-1 h-3 w-3" />
                                                            Add Role
                                                        </Button>
                                                    </div>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="space-y-2">
                                                        {roles.map((role) => (
                                                            <div
                                                                key={role.id}
                                                                className="flex items-center justify-between p-3 rounded-lg border bg-card"
                                                            >
                                                                <div className="flex items-center gap-4">
                                                                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-2xl">
                                                                        {role.emoji.length > 10 ? "😀" : role.emoji}
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-medium">
                                                                            {rolesById.get(role.roleId)?.name || role.roleId}
                                                                        </div>
                                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                            <Badge variant="secondary" className="text-xs">
                                                                                {getTypeLabel(role.type)}
                                                                            </Badge>
                                                                            {role.description && (
                                                                                <span className="truncate max-w-xs">{role.description}</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-destructive hover:text-destructive"
                                                                    onClick={() => handleDeleteRole(role.id)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    ) : (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle>{editingRoleId ? "Edit Reaction Role" : "Add Reaction Role"}</CardTitle>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                            setIsEditingRole(false);
                                            setEditingRoleId(null);
                                            resetRoleForm();
                                        }}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                                <CardDescription>
                                    Configure a reaction for this message. Users will receive the role when they react.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSaveRole} className="space-y-6">
                                    <div className="space-y-2">
                                        <Label>Message</Label>
                                        <Select
                                            value={roleForm.reactionRoleMessageId}
                                            onValueChange={(value) => {
                                                const msg = messages.find(m => m.id === value);
                                                if (msg) {
                                                    setRoleForm({
                                                        ...roleForm,
                                                        reactionRoleMessageId: value,
                                                        messageId: msg.messageId || "",
                                                        channelId: msg.channelId,
                                                    });
                                                    setSelectedMessageId(value);
                                                }
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a message" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {messages.map((msg) => (
                                                    <SelectItem key={msg.id} value={msg.id}>
                                                        {msg.title || "Untitled"}
                                                        {!msg.messageId && " (Not sent yet)"}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid gap-6 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="emoji">Emoji</Label>
                                            <Input
                                                id="emoji"
                                                value={roleForm.emoji}
                                                onChange={(e) => setRoleForm({ ...roleForm, emoji: e.target.value })}
                                                placeholder="e.g. 🎮 or :custom_emoji:"
                                                required
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Use Unicode emoji (🎮) or custom emoji format
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Role to Assign</Label>
                                            <RoleSelect
                                                guildId={guildId}
                                                value={roleForm.roleId}
                                                onChange={(value) => setRoleForm({ ...roleForm, roleId: value })}
                                                allowNone={false}
                                                placeholder="Select role"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Reaction Type</Label>
                                        <Select
                                            value={roleForm.type}
                                            onValueChange={(value) => setRoleForm({ ...roleForm, type: value as any })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select reaction type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {REACTION_TYPES.map((type) => (
                                                    <SelectItem key={type.value} value={type.value}>
                                                        <div className="flex flex-col">
                                                            <span>{type.label}</span>
                                                            <span className="text-xs text-muted-foreground">{type.description}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="description">Description (Optional)</Label>
                                        <Textarea
                                            id="description"
                                            value={roleForm.description}
                                            onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                                            placeholder="Description shown to users about this reaction role"
                                            rows={2}
                                        />
                                    </div>

                                    <div className="flex justify-end gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                setIsEditingRole(false);
                                                setEditingRoleId(null);
                                                resetRoleForm();
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                        <Button type="submit">
                                            {editingRoleId ? "Update Reaction Role" : "Add Reaction Role"}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
