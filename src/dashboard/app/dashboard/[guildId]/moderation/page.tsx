"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Switch } from "../../../../components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { Badge } from "../../../../components/ui/badge";
import { Separator } from "../../../../components/ui/separator";
import { ChannelSelect, RoleSelect } from "../../../../components/DiscordSelectors";
import { ExampleBox, HelperText, LabelWithTooltip } from "../../../../components/HelpTooltip";

import {
    Shield,
    MessageSquare,
    Ban,
    VolumeX,
    Save,
    Loader2,
    Plus,
    Trash2,
    Hash
} from "lucide-react";

interface ModerationConfig {
    autoModEnabled: boolean;
    spamThreshold: number;
    spamAction: string;
    spamMuteDuration: number;
    wordFilterEnabled: boolean;
    wordFilterList: string;
    wordFilterAction: string;
    inviteFilterEnabled: boolean;
    inviteFilterAction: string;
    logChannelId: string | null;
    muteRoleId: string | null;
}

const ACTION_OPTIONS = [
    { value: 'WARN', label: 'Warn' },
    { value: 'MUTE', label: 'Mute' },
    { value: 'KICK', label: 'Kick' },
];

const WORD_FILTER_ACTIONS = [
    { value: 'DELETE', label: 'Delete Only' },
    { value: 'WARN', label: 'Delete & Warn' },
    { value: 'MUTE', label: 'Delete & Mute' },
    { value: 'KICK', label: 'Delete & Kick' },
];

const MODERATION_TABS = ["automod", "words", "settings"] as const;
type ModerationTab = (typeof MODERATION_TABS)[number];

export default function ModerationPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const guildId = params.guildId as string;
    const [saveMessage, setSaveMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
    const requestedTab = searchParams.get("tab");
    const resolvedTab: ModerationTab = (requestedTab && MODERATION_TABS.includes(requestedTab as ModerationTab))
        ? (requestedTab as ModerationTab)
        : "automod";
    const [activeTab, setActiveTab] = useState<ModerationTab>(resolvedTab);

    const [config, setConfig] = useState<ModerationConfig>({
        autoModEnabled: false,
        spamThreshold: 5,
        spamAction: 'WARN',
        spamMuteDuration: 10,
        wordFilterEnabled: false,
        wordFilterList: '',
        wordFilterAction: 'DELETE',
        inviteFilterEnabled: false,
        inviteFilterAction: 'DELETE',
        logChannelId: null,
        muteRoleId: null,
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [bannedWord, setBannedWord] = useState('');
    const [bannedWords, setBannedWords] = useState<string[]>([]);

    useEffect(() => {
        setActiveTab(resolvedTab);
    }, [resolvedTab]);

    useEffect(() => {
        fetchConfig();
    }, [guildId]);

    const fetchConfig = async () => {
        try {
            const res = await fetch(`/api/guilds/${guildId}/moderation/config`);
            if (res.ok) {
                const data = await res.json();
                setConfig(data);
                if (data.wordFilterList) {
                    setBannedWords(data.wordFilterList.split(',').map((w: string) => w.trim()).filter(Boolean));
                }
            }
        } catch (error) {
            console.error('Failed to fetch moderation config:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/guilds/${guildId}/moderation/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...config,
                    wordFilterList: bannedWords.join(','),
                }),
            });

            if (res.ok) {
                setSaveMessage({ type: 'success', text: "Moderation settings have been updated." });
                setTimeout(() => setSaveMessage(null), 3000);
            } else {
                throw new Error('Failed to save');
            }
        } catch (error) {
            setSaveMessage({ type: 'error', text: "Failed to save settings." });
            setTimeout(() => setSaveMessage(null), 3000);
        } finally {
            setSaving(false);
        }
    };

    const addBannedWord = () => {
        if (bannedWord.trim() && !bannedWords.includes(bannedWord.trim().toLowerCase())) {
            setBannedWords([...bannedWords, bannedWord.trim().toLowerCase()]);
            setBannedWord('');
        }
    };

    const removeBannedWord = (word: string) => {
        setBannedWords(bannedWords.filter(w => w !== word));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Moderation</h1>
                <p className="text-muted-foreground">
                    Configure auto-moderation, banned words, and moderation settings.
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ModerationTab)} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="automod" className="gap-2">
                        <Shield className="h-4 w-4" />
                        Auto-Mod
                    </TabsTrigger>
                    <TabsTrigger value="words" className="gap-2">
                        <Ban className="h-4 w-4" />
                        Banned Words
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="gap-2">
                        <VolumeX className="h-4 w-4" />
                        Settings
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="automod" className="space-y-4">
                    <ExampleBox>
                        Set Spam Threshold to 5 messages per 5 seconds. If a user sends 6 messages rapidly, 
                        they&apos;ll receive the configured action (warn/mute/kick). Mute duration only applies 
                        if you select Mute as the action.
                    </ExampleBox>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5" />
                                Spam Protection
                            </CardTitle>
                            <CardDescription>
                                Automatically detect and handle spam messages.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <LabelWithTooltip
                                    label="Enable Spam Protection"
                                    tooltip="Automatically detect users sending too many messages quickly"
                                />
                                <Switch
                                    checked={config.autoModEnabled}
                                    onCheckedChange={(checked) => setConfig({ ...config, autoModEnabled: checked })}
                                />
                            </div>

                            {config.autoModEnabled && (
                                <>
                                    <Separator />
                                    <div className="grid gap-4 md:grid-cols-3">
                                        <div className="space-y-2">
                                            <LabelWithTooltip
                                                label="Spam Threshold"
                                                tooltip="Number of messages allowed per 5-second window. Recommended: 5"
                                            />
                                            <Input
                                                type="number"
                                                min={2}
                                                max={20}
                                                value={config.spamThreshold}
                                                onChange={(e) => setConfig({ ...config, spamThreshold: parseInt(e.target.value) || 5 })}
                                            />
                                            <p className="text-xs text-muted-foreground">Messages per 5 seconds</p>
                                        </div>
                                        <div className="space-y-2">
                                            <LabelWithTooltip
                                                label="Action"
                                                tooltip="What to do when spam is detected"
                                            />
                                            <Select
                                                value={config.spamAction}
                                                onValueChange={(value) => setConfig({ ...config, spamAction: value })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {ACTION_OPTIONS.map(opt => (
                                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <LabelWithTooltip
                                                label="Mute Duration (minutes)"
                                                tooltip="Only applies when Action is set to Mute"
                                            />
                                            <Input
                                                type="number"
                                                min={1}
                                                value={config.spamMuteDuration}
                                                onChange={(e) => setConfig({ ...config, spamMuteDuration: parseInt(e.target.value) || 10 })}
                                            />
                                            <p className="text-xs text-muted-foreground">Only applies if action is Mute</p>
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MessageSquare className="h-5 w-5" />
                                Invite Filter
                            </CardTitle>
                            <CardDescription>
                                Automatically delete messages containing Discord invite links.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <LabelWithTooltip
                                    label="Filter Invite Links"
                                    tooltip="Delete messages containing Discord server invites"
                                />
                                <Switch
                                    checked={config.inviteFilterEnabled}
                                    onCheckedChange={(checked) => setConfig({ ...config, inviteFilterEnabled: checked })}
                                />
                            </div>

                            {config.inviteFilterEnabled && (
                                <>
                                    <Separator />
                                    <div className="space-y-2">
                                        <Label>Action</Label>
                                        <Select
                                            value={config.inviteFilterAction}
                                            onValueChange={(value) => setConfig({ ...config, inviteFilterAction: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="DELETE">Delete Only</SelectItem>
                                                <SelectItem value="WARN">Delete & Warn</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="words" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Ban className="h-5 w-5" />
                                Banned Words
                            </CardTitle>
                            <CardDescription>
                                Words that will be automatically filtered from chat.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <LabelWithTooltip
                                    label="Enable Word Filter"
                                    tooltip="Automatically delete messages containing banned words"
                                />
                                <Switch
                                    checked={config.wordFilterEnabled}
                                    onCheckedChange={(checked) => setConfig({ ...config, wordFilterEnabled: checked })}
                                />
                            </div>

                            {config.wordFilterEnabled && (
                                <>
                                    <Separator />
                                    <div className="space-y-2">
                                        <Label>Action</Label>
                                        <Select
                                            value={config.wordFilterAction}
                                            onValueChange={(value) => setConfig({ ...config, wordFilterAction: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {WORD_FILTER_ACTIONS.map(opt => (
                                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <Separator />

                                    <div className="space-y-4">
                                        <Label>Banned Words List</Label>
                                        <HelperText>Words are case-insensitive.</HelperText>
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="Enter a word to ban..."
                                                value={bannedWord}
                                                onChange={(e) => setBannedWord(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && addBannedWord()}
                                            />
                                            <Button onClick={addBannedWord} size="icon">
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {bannedWords.length === 0 ? (
                                                <p className="text-sm text-muted-foreground">No banned words added yet.</p>
                                            ) : (
                                                bannedWords.map(word => (
                                                    <Badge
                                                        key={word}
                                                        variant="secondary"
                                                        className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                                                        onClick={() => removeBannedWord(word)}
                                                    >
                                                        {word}
                                                        <Trash2 className="h-3 w-3 ml-1" />
                                                    </Badge>
                                                ))
                                            )}
                                        </div>

                                        <p className="text-xs text-muted-foreground">
                                            Click on a word to remove it.
                                        </p>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <VolumeX className="h-5 w-5" />
                                Mute Role
                            </CardTitle>
                            <CardDescription>
                                Configure the role used for muting users.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <LabelWithTooltip
                                    label="Mute Role"
                                    tooltip="The role assigned to muted users. Should have restricted channel permissions."
                                />
                                <RoleSelect
                                    guildId={guildId}
                                    value={config.muteRoleId || ""}
                                    onChange={(value) => setConfig({ ...config, muteRoleId: value || null })}
                                    allowNone={true}
                                />
                                <p className="text-xs text-muted-foreground">
                                    The role that will be assigned to muted users. Leave empty to disable mute functionality.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Hash className="h-5 w-5" />
                                Log Channel
                            </CardTitle>
                            <CardDescription>
                                Channel where moderation actions will be logged.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <LabelWithTooltip
                                    label="Log Channel"
                                    tooltip="All moderation actions will be logged here for audit purposes"
                                />
                                <ChannelSelect
                                    guildId={guildId}
                                    value={config.logChannelId || ""}
                                    onChange={(value) => setConfig({ ...config, logChannelId: value || null })}
                                    allowNone={true}
                                />
                                <p className="text-xs text-muted-foreground">
                                    All moderation actions will be logged to this channel.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <div className="flex justify-between items-center">
                {saveMessage && (
                    <div className={`text-sm ${saveMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                        {saveMessage.text}
                    </div>
                )}
                <div className="flex-1"></div>
                <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Changes
                </Button>
            </div>
        </div>
    );
}
