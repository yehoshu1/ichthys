'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import logger from '../../../../lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
    Info,
    Image as ImageIcon,
    User,
    Type,
    Palette,
    Save,
    Eye,
    MessageSquare,
    Send,
    Variable,
    UserPlus,
    Hash,
    Sparkles,
    X
} from 'lucide-react';

interface WelcomeConfig {
    id?: string;
    guildId: string;
    enabled: boolean;
    targetType: 'DM' | 'CHANNEL';
    channelId: string | null;
    messageTemplate: string | null;
    embedEnabled: boolean;
    embedConfig?: Record<string, unknown>;
    imageEnabled: boolean;
    imageSendMode: 'WITH_TEXT' | 'BEFORE_TEXT' | 'TO_CHANNEL' | 'IMAGE_ONLY';
    imageChannelId: string | null;
    canvasWidth: number;
    canvasHeight: number;
    backgroundType: 'COLOR' | 'GRADIENT' | 'IMAGE';
    backgroundValue: string;
    avatarShape: 'CIRCLE' | 'SQUARE' | 'ROUNDED';
    avatarX: number;
    avatarY: number;
    avatarSize: number;
    // UI-only fields for separate width/height controls
    avatarWidth?: number;
    avatarHeight?: number;
    avatarBorderColor: string;
    avatarBorderWidth: number;
    usernameX: number;
    usernameY: number;
    usernameFont: string;
    usernameSize: number;
    usernameColor: string;
    usernameAlign: string;
    // UI-only field for text width control
    usernameWidth?: number;
    subtitleEnabled: boolean;
    subtitleTemplate: string;
    subtitleX: number;
    subtitleY: number;
    subtitleFont: string;
    subtitleSize: number;
    subtitleColor: string;
    showServerName: boolean;
    serverNameX: number;
    serverNameY: number;
    serverNameFont: string;
    serverNameSize: number;
    serverNameColor: string;
    cooldownEnabled: boolean;
    cooldownSeconds: number;
}

interface DiscordChannel {
    id: string;
    name: string;
    type: number;
}

interface PreviewState {
    loading: boolean;
    url: string | null;
    error: string | null;
}

const defaultConfig: Partial<WelcomeConfig> = {
    enabled: false,
    targetType: 'CHANNEL',
    messageTemplate: 'Welcome {user} to {server}! You are member #{memberCount}.',
    embedEnabled: false,
    imageEnabled: false,
    imageSendMode: 'WITH_TEXT',
    // ProBot-style canvas size (2:1 aspect ratio)
    canvasWidth: 400,
    canvasHeight: 200,
    backgroundType: 'COLOR',
    backgroundValue: 'transparent',
    // Avatar - centered at top (ProBot style)
    avatarShape: 'CIRCLE',
    avatarX: 155,
    avatarY: 10,
    avatarSize: 90,
    avatarBorderColor: '#ffffff',
    avatarBorderWidth: 0,
    // Username - centered below avatar
    usernameX: 200,
    usernameY: 115,
    usernameFont: 'Arial',
    usernameSize: 18,
    usernameColor: '#ffffff',
    usernameAlign: 'center',
    // Subtitle - centered below username
    subtitleEnabled: true,
    subtitleTemplate: 'Welcome to {server}!',
    subtitleX: 200,
    subtitleY: 140,
    subtitleFont: 'Arial',
    subtitleSize: 16,
    subtitleColor: '#ffffff',
    // Server name (hidden by default)
    showServerName: false,
    serverNameX: 200,
    serverNameY: 30,
    serverNameFont: 'Arial',
    serverNameSize: 20,
    serverNameColor: '#ffffff',
    cooldownEnabled: false,
    cooldownSeconds: 5,
};

const variableExamples = [
    { code: '{user}', desc: 'Mention the user (@Username)', example: '@JohnDoe' },
    { code: '{username}', desc: 'Username without mention', example: 'JohnDoe' },
    { code: '{tag}', desc: 'Full Discord tag', example: 'JohnDoe#1234' },
    { code: '{server}', desc: 'Server name', example: 'My Awesome Server' },
    { code: '{memberCount}', desc: 'Total member count', example: '1,234' },
];

export default function WelcomePage() {
    const params = useParams();
    const guildId = params.guildId as string;


    const [config, setConfig] = useState<WelcomeConfig>(defaultConfig as WelcomeConfig);
    const [originalConfig, setOriginalConfig] = useState<WelcomeConfig>(defaultConfig as WelcomeConfig);
    const [channels, setChannels] = useState<DiscordChannel[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [preview, setPreview] = useState<PreviewState>({ loading: false, url: null, error: null });
    const [hasChanges, setHasChanges] = useState(false);

    // Fetch config and channels
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [configRes, channelsRes] = await Promise.all([
                    fetch(`/api/guilds/${guildId}/welcome/config`),
                    fetch(`/api/guilds/${guildId}/channels`)
                ]);

                if (configRes.ok) {
                    const data = await configRes.json();
                    const mergedConfig = { ...defaultConfig, ...data.config };
                    setConfig(mergedConfig as WelcomeConfig);
                    setOriginalConfig(mergedConfig as WelcomeConfig);
                }

                if (channelsRes.ok) {
                    const data = await channelsRes.json();
                    setChannels(data.channels || []);
                }
            } catch (error) {
                logger.error('Failed to fetch data:', error);
                toast.error('Failed to load welcome configuration');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [guildId, toast]);

    // Check for changes
    useEffect(() => {
        setHasChanges(JSON.stringify(config) !== JSON.stringify(originalConfig));
    }, [config, originalConfig]);

    const updateConfig = useCallback(<K extends keyof WelcomeConfig>(
        key: K,
        value: WelcomeConfig[K]
    ) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    }, []);

    const generatePreview = useCallback(async () => {
        setPreview({ loading: true, url: null, error: null });

        try {
            const response = await fetch(`/api/guilds/${guildId}/welcome/preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config })
            });

            if (!response.ok) throw new Error('Failed to generate preview');

            const data = await response.json();
            if (data.image) {
                setPreview({ loading: false, url: data.image, error: null });
            } else {
                throw new Error('No image in response');
            }
        } catch (error) {
            setPreview({
                loading: false,
                url: null,
                error: error instanceof Error ? error.message : 'Preview generation failed'
            });
        }
    }, [config, guildId]);

    // Live preview - regenerate when config changes (debounced)
    useEffect(() => {
        if (!config.imageEnabled) return;

        const timer = setTimeout(() => {
            generatePreview();
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [
        config.imageEnabled,
        config.canvasWidth,
        config.canvasHeight,
        config.backgroundType,
        config.backgroundValue,
        config.avatarShape,
        config.avatarX,
        config.avatarY,
        config.avatarSize,
        config.avatarBorderColor,
        config.avatarBorderWidth,
        config.usernameX,
        config.usernameY,
        config.usernameFont,
        config.usernameSize,
        config.usernameColor,
        config.usernameAlign,
        config.subtitleEnabled,
        config.subtitleTemplate,
        config.subtitleX,
        config.subtitleY,
        config.subtitleFont,
        config.subtitleSize,
        config.subtitleColor,
        config.showServerName,
        config.serverNameX,
        config.serverNameY,
        config.serverNameFont,
        config.serverNameSize,
        config.serverNameColor,
        guildId,
        generatePreview
    ]);

    const saveConfig = useCallback(async () => {
        // Client-side validation
        if (config.enabled && config.targetType === 'CHANNEL' && !config.channelId) {
            toast.error('Please select a text channel for welcome messages', {
                description: 'Go to "Message Configuration" and select a channel from the dropdown.'
            });
            return;
        }

        setSaving(true);
        try {
            const response = await fetch(`/api/guilds/${guildId}/welcome/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                logger.error('Save failed:', errorData);
                const userMessage = errorData.field === 'channelId' 
                    ? 'Please select a text channel for welcome messages'
                    : errorData.error || 'Failed to save configuration';
                throw new Error(userMessage);
            }

            const data = await response.json();
            setOriginalConfig(data.config);
            setHasChanges(false);
            toast.success('Welcome configuration saved successfully!');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to save configuration');
        } finally {
            setSaving(false);
        }
    }, [config, guildId, toast]);

    const insertVariable = useCallback((variable: string) => {
        const template = config.messageTemplate || '';
        updateConfig('messageTemplate', template + variable);
    }, [config.messageTemplate, updateConfig]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Welcome Messages</h1>
                    <p className="text-muted-foreground">
                        Customize welcome messages for new members
                    </p>
                </div>
                <Button
                    onClick={saveConfig}
                    disabled={!hasChanges || saving}
                >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>

            {hasChanges && (
                <Alert className="bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-300">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                        You have unsaved changes. Don&apos;t forget to save!
                    </AlertDescription>
                </Alert>
            )}

            {/* Main Enable Toggle */}
            <Card className="border-primary/20">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-full bg-primary/10">
                                <UserPlus className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">Welcome System</h3>
                                <p className="text-sm text-muted-foreground">
                                    Send welcome messages when new members join
                                </p>
                            </div>
                        </div>
                        <Switch
                            checked={config.enabled}
                            onCheckedChange={(checked: boolean) => updateConfig('enabled', checked)}
                        />
                    </div>
                </CardContent>
            </Card>

            {config.enabled && (
                <>
                    {/* Message Configuration */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MessageSquare className="w-5 h-5" />
                                Message Configuration
                            </CardTitle>
                            <CardDescription>
                                Configure where and how welcome messages are sent
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Send To */}
                            <div className="space-y-3">
                                <Label>Send Welcome Message To</Label>
                                <RadioGroup
                                    value={config.targetType}
                                    onValueChange={(value: string) => updateConfig('targetType', value as 'DM' | 'CHANNEL')}
                                    className="flex flex-col gap-3"
                                >
                                    <div className="flex items-center space-x-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
                                        <RadioGroupItem value="CHANNEL" id="channel" />
                                        <Label htmlFor="channel" className="flex-1 cursor-pointer">
                                            <div className="font-medium">Text Channel</div>
                                            <div className="text-sm text-muted-foreground">Send in a server channel</div>
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
                                        <RadioGroupItem value="DM" id="dm" />
                                        <Label htmlFor="dm" className="flex-1 cursor-pointer">
                                            <div className="font-medium">Direct Message</div>
                                            <div className="text-sm text-muted-foreground">Send via DM to the new member</div>
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            {/* Channel Selector */}
                            {config.targetType === 'CHANNEL' && (
                                <div className="space-y-2">
                                    <Label htmlFor="channel-select">Select Channel</Label>
                                    <Select
                                        value={config.channelId || ''}
                                        onValueChange={(value: string) => updateConfig('channelId', value || null)}
                                    >
                                        <SelectTrigger id="channel-select">
                                            <SelectValue placeholder="Select a channel" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {channels.map(channel => (
                                                <SelectItem key={channel.id} value={channel.id}>
                                                    # {channel.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <Separator />

                            {/* Message Template */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="message-template">Welcome Message</Label>
                                    <div className="flex gap-1">
                                        {variableExamples.slice(0, 3).map(v => (
                                            <Badge
                                                key={v.code}
                                                variant="secondary"
                                                className="cursor-pointer hover:bg-primary/20"
                                                onClick={() => insertVariable(v.code)}
                                            >
                                                {v.code}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                                <textarea
                                    id="message-template"
                                    value={config.messageTemplate || ''}
                                    onChange={(e) => updateConfig('messageTemplate', e.target.value)}
                                    placeholder="Welcome [user] to [server]!"
                                    className="w-full min-h-[100px] px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Use variables like {'{user}'}, {'{username}'}, {'{server}'}, {'{memberCount}'} to personalize messages
                                </p>
                            </div>

                            {/* Embed Toggle */}
                            <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                                <div>
                                    <div className="font-medium">Send as Embed</div>
                                    <div className="text-sm text-muted-foreground">Format the message as a Discord embed</div>
                                </div>
                                <Switch
                                    checked={config.embedEnabled}
                                    onCheckedChange={(checked: boolean) => updateConfig('embedEnabled', checked)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Image Card Configuration */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ImageIcon className="w-5 h-5" />
                                Welcome Image Card
                            </CardTitle>
                            <CardDescription>
                                Generate a customizable welcome image card
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Enable Image Toggle */}
                            <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30">
                                <div>
                                    <div className="font-medium">Send Welcome Image</div>
                                    <div className="text-sm text-muted-foreground">
                                        Generate a welcome card image when users join
                                    </div>
                                </div>
                                <Switch
                                    checked={config.imageEnabled}
                                    onCheckedChange={(checked: boolean) => updateConfig('imageEnabled', checked)}
                                />
                            </div>

                            {config.imageEnabled && (
                                <>
                                    {/* Send Mode */}
                                    <div className="space-y-3">
                                        <Label>Image Send Mode</Label>
                                        <RadioGroup
                                            value={config.imageSendMode}
                                            onValueChange={(value: string) => updateConfig('imageSendMode', value as WelcomeConfig['imageSendMode'])}
                                            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                                        >
                                            <div className="flex items-center space-x-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
                                                <RadioGroupItem value="WITH_TEXT" id="with-text" />
                                                <Label htmlFor="with-text" className="flex-1 cursor-pointer">
                                                    <div className="font-medium flex items-center gap-2">
                                                        <Send className="w-4 h-4" />
                                                        WITH TEXT MESSAGE
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">Image and text together</div>
                                                </Label>
                                            </div>
                                            <div className="flex items-center space-x-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
                                                <RadioGroupItem value="BEFORE_TEXT" id="before-text" />
                                                <Label htmlFor="before-text" className="flex-1 cursor-pointer">
                                                    <div className="font-medium flex items-center gap-2">
                                                        <MessageSquare className="w-4 h-4" />
                                                        BEFORE TEXT MESSAGE
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">Image first, then text</div>
                                                </Label>
                                            </div>
                                            <div className="flex items-center space-x-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
                                                <RadioGroupItem value="TO_CHANNEL" id="to-channel" />
                                                <Label htmlFor="to-channel" className="flex-1 cursor-pointer">
                                                    <div className="font-medium flex items-center gap-2">
                                                        <Hash className="w-4 h-4" />
                                                        TO A CHANNEL
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">Send image to specific channel</div>
                                                </Label>
                                            </div>
                                            <div className="flex items-center space-x-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
                                                <RadioGroupItem value="IMAGE_ONLY" id="image-only" />
                                                <Label htmlFor="image-only" className="flex-1 cursor-pointer">
                                                    <div className="font-medium flex items-center gap-2">
                                                        <ImageIcon className="w-4 h-4" />
                                                        IMAGE ONLY
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">Only send the image</div>
                                                </Label>
                                            </div>
                                        </RadioGroup>
                                    </div>

                                    {/* Image Channel Selector */}
                                    {config.imageSendMode === 'TO_CHANNEL' && (
                                        <div className="space-y-2">
                                            <Label htmlFor="image-channel-select">Image Channel</Label>
                                            <Select
                                                value={config.imageChannelId || ''}
                                                onValueChange={(value: string) => updateConfig('imageChannelId', value || null)}
                                            >
                                                <SelectTrigger id="image-channel-select">
                                                    <SelectValue placeholder="Select a channel for the image" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {channels.map(channel => (
                                                        <SelectItem key={channel.id} value={channel.id}>
                                                            # {channel.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    {/* Image Dimensions */}
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Width */}
                                            <div className="space-y-2">
                                                <Label className="text-xs uppercase tracking-wider">Width</Label>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-10 w-10 shrink-0"
                                                        onClick={() => updateConfig('canvasWidth', Math.max(200, config.canvasWidth - 10))}
                                                    >
                                                        -
                                                    </Button>
                                                    <Input
                                                        type="number"
                                                        value={config.canvasWidth}
                                                        onChange={(e) => updateConfig('canvasWidth', parseInt(e.target.value) || 400)}
                                                        className="text-center"
                                                    />
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-10 w-10 shrink-0"
                                                        onClick={() => updateConfig('canvasWidth', Math.min(1920, config.canvasWidth + 10))}
                                                    >
                                                        +
                                                    </Button>
                                                </div>
                                                <p className="text-xs text-muted-foreground">You can use the mouse to edit it.</p>
                                            </div>
                                            {/* Height */}
                                            <div className="space-y-2">
                                                <Label className="text-xs uppercase tracking-wider">Height</Label>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-10 w-10 shrink-0"
                                                        onClick={() => updateConfig('canvasHeight', Math.max(100, config.canvasHeight - 10))}
                                                    >
                                                        -
                                                    </Button>
                                                    <Input
                                                        type="number"
                                                        value={config.canvasHeight}
                                                        onChange={(e) => updateConfig('canvasHeight', parseInt(e.target.value) || 200)}
                                                        className="text-center"
                                                    />
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-10 w-10 shrink-0"
                                                        onClick={() => updateConfig('canvasHeight', Math.min(1080, config.canvasHeight + 10))}
                                                    >
                                                        +
                                                    </Button>
                                                </div>
                                                <p className="text-xs text-muted-foreground">You can use the mouse to edit it.</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Image Editor Tabs */}
                                    <Tabs defaultValue="background" className="w-full">
                                        <div className="flex items-center justify-between mb-4">
                                            <TabsList className="grid grid-cols-4">
                                                <TabsTrigger value="background" className="flex items-center gap-1">
                                                    <Palette className="w-4 h-4" />
                                                    <span className="hidden sm:inline">Background</span>
                                                </TabsTrigger>
                                                <TabsTrigger value="avatar" className="flex items-center gap-1">
                                                    <User className="w-4 h-4" />
                                                    <span className="hidden sm:inline">Avatar</span>
                                                </TabsTrigger>
                                                <TabsTrigger value="username" className="flex items-center gap-1">
                                                    <Type className="w-4 h-4" />
                                                    <span className="hidden sm:inline">Username</span>
                                                </TabsTrigger>
                                                <TabsTrigger value="text" className="flex items-center gap-1">
                                                    <Sparkles className="w-4 h-4" />
                                                    <span className="hidden sm:inline">Text</span>
                                                </TabsTrigger>
                                            </TabsList>
                                            <Button variant="secondary" size="sm" onClick={() => toast.info('Templates coming soon!')}>
                                                Use Template
                                            </Button>
                                        </div>

                                        {/* Background Tab */}
                                        <TabsContent value="background" className="space-y-4 mt-4">
                                            <div className="space-y-3">
                                                <Label>Background Type</Label>
                                                <Select
                                                    value={config.backgroundType}
                                                    onValueChange={(value: string) => updateConfig('backgroundType', value as WelcomeConfig['backgroundType'])}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="COLOR">Color</SelectItem>
                                                        <SelectItem value="GRADIENT">Gradient</SelectItem>
                                                        <SelectItem value="IMAGE">Image URL</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {config.backgroundType === 'COLOR' && (
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <Label>Background Color</Label>
                                                        {config.backgroundValue === 'transparent' ? (
                                                            <Badge variant="secondary">Transparent</Badge>
                                                        ) : (
                                                            <div
                                                                className="w-6 h-6 rounded border"
                                                                style={{ backgroundColor: config.backgroundValue }}
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            type="text"
                                                            value={config.backgroundValue}
                                                            onChange={(e) => updateConfig('backgroundValue', e.target.value)}
                                                            placeholder="#36393f or transparent"
                                                            className="flex-1"
                                                        />
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => updateConfig('backgroundValue', 'transparent')}
                                                            className={config.backgroundValue === 'transparent' ? 'bg-primary/20' : ''}
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        Use &quot;transparent&quot; for a see-through background, or enter a hex color like #36393f
                                                    </p>
                                                </div>
                                            )}

                                            {config.backgroundType === 'GRADIENT' && (
                                                <div className="space-y-3">
                                                    <Label>Gradient Colors</Label>
                                                    <Input
                                                        type="text"
                                                        value={config.backgroundValue}
                                                        onChange={(e) => updateConfig('backgroundValue', e.target.value)}
                                                        placeholder="#7289da,#4e5d94,45"
                                                    />
                                                    <p className="text-xs text-muted-foreground">
                                                        Format: color1,color2,angle (e.g., #7289da,#4e5d94,45)
                                                    </p>
                                                </div>
                                            )}

                                            {config.backgroundType === 'IMAGE' && (
                                                <div className="space-y-3">
                                                    <Label>Background Image URL</Label>
                                                    <Input
                                                        type="text"
                                                        value={config.backgroundValue}
                                                        onChange={(e) => updateConfig('backgroundValue', e.target.value)}
                                                        placeholder="https://example.com/background.png"
                                                    />
                                                </div>
                                            )}
                                        </TabsContent>

                                        {/* Avatar Tab */}
                                        <TabsContent value="avatar" className="space-y-4 mt-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                {/* Avatar Type */}
                                                <div className="space-y-2">
                                                    <Label className="text-xs uppercase tracking-wider">Avatar Type</Label>
                                                    <Select
                                                        value={config.avatarShape}
                                                        onValueChange={(value: string) => updateConfig('avatarShape', value as WelcomeConfig['avatarShape'])}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="CIRCLE">Circle</SelectItem>
                                                            <SelectItem value="SQUARE">Square</SelectItem>
                                                            <SelectItem value="ROUNDED">Rounded</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                {/* Avatar Width */}
                                                <div className="space-y-2">
                                                    <Label className="text-xs uppercase tracking-wider">Avatar Width</Label>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-10 w-10 shrink-0"
                                                            onClick={() => updateConfig('avatarSize', Math.max(32, (config.avatarSize || 90) - 5))}
                                                        >
                                                            -
                                                        </Button>
                                                        <Input
                                                            type="number"
                                                            value={config.avatarSize || 90}
                                                            onChange={(e) => updateConfig('avatarSize', parseInt(e.target.value) || 90)}
                                                            className="text-center"
                                                        />
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-10 w-10 shrink-0"
                                                            onClick={() => updateConfig('avatarSize', Math.min(400, (config.avatarSize || 90) + 5))}
                                                        >
                                                            +
                                                        </Button>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">You can use the mouse to edit it.</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                {/* Avatar Height */}
                                                <div className="space-y-2">
                                                    <Label className="text-xs uppercase tracking-wider">Avatar Height</Label>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-10 w-10 shrink-0"
                                                            onClick={() => updateConfig('avatarSize', Math.max(32, (config.avatarSize || 90) - 5))}
                                                        >
                                                            -
                                                        </Button>
                                                        <Input
                                                            type="number"
                                                            value={config.avatarSize || 90}
                                                            onChange={(e) => updateConfig('avatarSize', parseInt(e.target.value) || 90)}
                                                            className="text-center"
                                                        />
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-10 w-10 shrink-0"
                                                            onClick={() => updateConfig('avatarSize', Math.min(400, (config.avatarSize || 90) + 5))}
                                                        >
                                                            +
                                                        </Button>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">You can use the mouse to edit it.</p>
                                                </div>
                                                {/* Coordinate (Left) */}
                                                <div className="space-y-2">
                                                    <Label className="text-xs uppercase tracking-wider">Coordinate (Left)</Label>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-10 w-10 shrink-0"
                                                            onClick={() => updateConfig('avatarX', Math.max(0, config.avatarX - 5))}
                                                        >
                                                            -
                                                        </Button>
                                                        <Input
                                                            type="number"
                                                            value={config.avatarX}
                                                            onChange={(e) => updateConfig('avatarX', parseInt(e.target.value) || 0)}
                                                            className="text-center"
                                                        />
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-10 w-10 shrink-0"
                                                            onClick={() => updateConfig('avatarX', Math.min(config.canvasWidth, config.avatarX + 5))}
                                                        >
                                                            +
                                                        </Button>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">You can use the mouse to edit it.</p>
                                                </div>
                                            </div>

                                            {/* Coordinate (Top) */}
                                            <div className="space-y-2">
                                                <Label className="text-xs uppercase tracking-wider">Coordinate (Top)</Label>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-10 w-10 shrink-0"
                                                        onClick={() => updateConfig('avatarY', Math.max(0, config.avatarY - 5))}
                                                    >
                                                        -
                                                    </Button>
                                                    <Input
                                                        type="number"
                                                        value={config.avatarY}
                                                        onChange={(e) => updateConfig('avatarY', parseInt(e.target.value) || 0)}
                                                        className="text-center"
                                                    />
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-10 w-10 shrink-0"
                                                        onClick={() => updateConfig('avatarY', Math.min(config.canvasHeight, config.avatarY + 5))}
                                                    >
                                                        +
                                                    </Button>
                                                </div>
                                                <p className="text-xs text-muted-foreground">You can use the mouse to edit it.</p>
                                            </div>
                                        </TabsContent>

                                        {/* Username Tab */}
                                        <TabsContent value="username" className="space-y-4 mt-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                {/* Coordinate (Left) */}
                                                <div className="space-y-2">
                                                    <Label className="text-xs uppercase tracking-wider">Coordinate (Left)</Label>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-10 w-10 shrink-0"
                                                            onClick={() => updateConfig('usernameX', Math.max(0, config.usernameX - 5))}
                                                        >
                                                            -
                                                        </Button>
                                                        <Input
                                                            type="number"
                                                            value={config.usernameX}
                                                            onChange={(e) => updateConfig('usernameX', parseInt(e.target.value) || 0)}
                                                            className="text-center"
                                                        />
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-10 w-10 shrink-0"
                                                            onClick={() => updateConfig('usernameX', Math.min(config.canvasWidth, config.usernameX + 5))}
                                                        >
                                                            +
                                                        </Button>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">You can use the mouse to edit it.</p>
                                                </div>
                                                {/* Coordinate (Top) */}
                                                <div className="space-y-2">
                                                    <Label className="text-xs uppercase tracking-wider">Coordinate (Top)</Label>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-10 w-10 shrink-0"
                                                            onClick={() => updateConfig('usernameY', Math.max(0, config.usernameY - 5))}
                                                        >
                                                            -
                                                        </Button>
                                                        <Input
                                                            type="number"
                                                            value={config.usernameY}
                                                            onChange={(e) => updateConfig('usernameY', parseInt(e.target.value) || 0)}
                                                            className="text-center"
                                                        />
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-10 w-10 shrink-0"
                                                            onClick={() => updateConfig('usernameY', Math.min(config.canvasHeight, config.usernameY + 5))}
                                                        >
                                                            +
                                                        </Button>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">You can use the mouse to edit it.</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                {/* Width */}
                                                <div className="space-y-2">
                                                    <Label className="text-xs uppercase tracking-wider">Width</Label>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-10 w-10 shrink-0"
                                                            onClick={() => updateConfig('usernameWidth', Math.max(50, (config.usernameWidth || 200) - 10))}
                                                        >
                                                            -
                                                        </Button>
                                                        <Input
                                                            type="number"
                                                            value={config.usernameWidth || 200}
                                                            onChange={(e) => updateConfig('usernameWidth', parseInt(e.target.value) || 200)}
                                                            className="text-center"
                                                        />
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-10 w-10 shrink-0"
                                                            onClick={() => updateConfig('usernameWidth', Math.min(config.canvasWidth, (config.usernameWidth || 200) + 10))}
                                                        >
                                                            +
                                                        </Button>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">You can use the mouse to edit it.</p>
                                                </div>
                                                {/* Text Size */}
                                                <div className="space-y-2">
                                                    <Label className="text-xs uppercase tracking-wider">Text Size</Label>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-10 w-10 shrink-0"
                                                            onClick={() => updateConfig('usernameSize', Math.max(8, config.usernameSize - 2))}
                                                        >
                                                            -
                                                        </Button>
                                                        <Input
                                                            type="number"
                                                            value={config.usernameSize}
                                                            onChange={(e) => updateConfig('usernameSize', parseInt(e.target.value) || 18)}
                                                            className="text-center"
                                                        />
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-10 w-10 shrink-0"
                                                            onClick={() => updateConfig('usernameSize', Math.min(120, config.usernameSize + 2))}
                                                        >
                                                            +
                                                        </Button>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">You can use the mouse to edit it.</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                {/* Text Alignment */}
                                                <div className="space-y-2">
                                                    <Label className="text-xs uppercase tracking-wider">Text Alignment</Label>
                                                    <Select
                                                        value={config.usernameAlign}
                                                        onValueChange={(value: string) => updateConfig('usernameAlign', value)}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="left">Left</SelectItem>
                                                            <SelectItem value="center">Center</SelectItem>
                                                            <SelectItem value="right">Right</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                {/* Text Color */}
                                                <div className="space-y-2">
                                                    <Label className="text-xs uppercase tracking-wider">Text Color</Label>
                                                    <Input
                                                        type="color"
                                                        value={config.usernameColor}
                                                        onChange={(e) => updateConfig('usernameColor', e.target.value)}
                                                        className="h-10 w-full"
                                                    />
                                                </div>
                                            </div>
                                        </TabsContent>

                                        {/* Text Tab */}
                                        <TabsContent value="text" className="space-y-4 mt-4">
                                            {/* Subtitle Toggle */}
                                            <div className="flex items-center justify-between">
                                                <Label>Show Subtitle</Label>
                                                <Switch
                                                    checked={config.subtitleEnabled}
                                                    onCheckedChange={(checked: boolean) => updateConfig('subtitleEnabled', checked)}
                                                />
                                            </div>

                                            {config.subtitleEnabled && (
                                                <>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        {/* Text Input */}
                                                        <div className="space-y-2">
                                                            <Label className="text-xs uppercase tracking-wider">Text</Label>
                                                            <Input
                                                                value={config.subtitleTemplate}
                                                                onChange={(e) => updateConfig('subtitleTemplate', e.target.value)}
                                                                placeholder="Welcome to {server}!"
                                                            />
                                                        </div>
                                                        {/* Coordinate (Left) */}
                                                        <div className="space-y-2">
                                                            <Label className="text-xs uppercase tracking-wider">Coordinate (Left)</Label>
                                                            <div className="flex items-center gap-2">
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-10 w-10 shrink-0"
                                                                    onClick={() => updateConfig('subtitleX', Math.max(0, config.subtitleX - 5))}
                                                                >
                                                                    -
                                                                </Button>
                                                                <Input
                                                                    type="number"
                                                                    value={config.subtitleX}
                                                                    onChange={(e) => updateConfig('subtitleX', parseInt(e.target.value) || 0)}
                                                                    className="text-center"
                                                                />
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-10 w-10 shrink-0"
                                                                    onClick={() => updateConfig('subtitleX', Math.min(config.canvasWidth, config.subtitleX + 5))}
                                                                >
                                                                    +
                                                                </Button>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">You can use the mouse to edit it.</p>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        {/* Coordinate (Top) */}
                                                        <div className="space-y-2">
                                                            <Label className="text-xs uppercase tracking-wider">Coordinate (Top)</Label>
                                                            <div className="flex items-center gap-2">
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-10 w-10 shrink-0"
                                                                    onClick={() => updateConfig('subtitleY', Math.max(0, config.subtitleY - 5))}
                                                                >
                                                                    -
                                                                </Button>
                                                                <Input
                                                                    type="number"
                                                                    value={config.subtitleY}
                                                                    onChange={(e) => updateConfig('subtitleY', parseInt(e.target.value) || 0)}
                                                                    className="text-center"
                                                                />
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-10 w-10 shrink-0"
                                                                    onClick={() => updateConfig('subtitleY', Math.min(config.canvasHeight, config.subtitleY + 5))}
                                                                >
                                                                    +
                                                                </Button>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">You can use the mouse to edit it.</p>
                                                        </div>
                                                        {/* Text Size */}
                                                        <div className="space-y-2">
                                                            <Label className="text-xs uppercase tracking-wider">Text Size</Label>
                                                            <div className="flex items-center gap-2">
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-10 w-10 shrink-0"
                                                                    onClick={() => updateConfig('subtitleSize', Math.max(8, config.subtitleSize - 2))}
                                                                >
                                                                    -
                                                                </Button>
                                                                <Input
                                                                    type="number"
                                                                    value={config.subtitleSize}
                                                                    onChange={(e) => updateConfig('subtitleSize', parseInt(e.target.value) || 16)}
                                                                    className="text-center"
                                                                />
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-10 w-10 shrink-0"
                                                                    onClick={() => updateConfig('subtitleSize', Math.min(100, config.subtitleSize + 2))}
                                                                >
                                                                    +
                                                                </Button>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">You can use the mouse to edit it.</p>
                                                        </div>
                                                    </div>

                                                    {/* Text Color */}
                                                    <div className="space-y-2">
                                                        <Label className="text-xs uppercase tracking-wider">Text Color</Label>
                                                        <Input
                                                            type="color"
                                                            value={config.subtitleColor}
                                                            onChange={(e) => updateConfig('subtitleColor', e.target.value)}
                                                            className="h-10 w-full"
                                                        />
                                                    </div>
                                                </>
                                            )}

                                            {/* Server Name Toggle */}
                                            <div className="flex items-center justify-between pt-4 border-t">
                                                <Label>Show Server Name</Label>
                                                <Switch
                                                    checked={config.showServerName}
                                                    onCheckedChange={(checked: boolean) => updateConfig('showServerName', checked)}
                                                />
                                            </div>

                                            {config.showServerName && (
                                                <>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label className="text-xs">Font Family</Label>
                                                            <Input
                                                                value={config.serverNameFont}
                                                                onChange={(e) => updateConfig('serverNameFont', e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs">Font Size (px)</Label>
                                                            <Input
                                                                type="number"
                                                                value={config.serverNameSize}
                                                                onChange={(e) => updateConfig('serverNameSize', parseInt(e.target.value) || 28)}
                                                                min={10}
                                                                max={100}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label className="text-xs">Text Color</Label>
                                                        <div className="flex gap-2">
                                                            <Input
                                                                type="text"
                                                                value={config.serverNameColor}
                                                                onChange={(e) => updateConfig('serverNameColor', e.target.value)}
                                                            />
                                                            <div
                                                                className="w-10 h-10 rounded border flex-shrink-0"
                                                                style={{ backgroundColor: config.serverNameColor }}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label className="text-xs">X Position</Label>
                                                            <Slider
                                                                value={[config.serverNameX]}
                                                                onValueChange={(values: number[]) => updateConfig('serverNameX', values[0])}
                                                                min={0}
                                                                max={config.canvasWidth}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs">Y Position</Label>
                                                            <Slider
                                                                value={[config.serverNameY]}
                                                                onValueChange={(values: number[]) => updateConfig('serverNameY', values[0])}
                                                                min={0}
                                                                max={config.canvasHeight}
                                                            />
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </TabsContent>
                                    </Tabs>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Variables Help Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Variable className="w-5 h-5" />
                                Available Variables
                            </CardTitle>
                            <CardDescription>
                                Use these variables in your message templates
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {variableExamples.map((variable) => (
                                    <div
                                        key={variable.code}
                                        className="p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                                        onClick={() => insertVariable(variable.code)}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <code className="px-1.5 py-0.5 bg-primary/10 rounded text-sm font-mono text-primary">
                                                {variable.code}
                                            </code>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{variable.desc}</p>
                                        <p className="text-xs text-muted-foreground mt-1">Example: {variable.example}</p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Live Preview */}
                    {config.imageEnabled && (
                        <Card className="overflow-hidden border-primary/20">
                            <CardHeader className="bg-muted/30">
                                <CardTitle className="flex items-center gap-2">
                                    <Eye className="w-5 h-5 text-primary" />
                                    Live Preview
                                    {preview.loading && (
                                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                                            (updating...)
                                        </span>
                                    )}
                                </CardTitle>
                                <CardDescription>
                                    Preview how your welcome image will look when a new member joins
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-6">
                                {preview.loading && !preview.url && (
                                    <div className="flex items-center justify-center h-64 bg-muted/50 rounded-lg">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                            <p className="text-sm text-muted-foreground">Generating preview...</p>
                                        </div>
                                    </div>
                                )}
                                {preview.url && (
                                    <div className="flex justify-center p-4 bg-gradient-to-br from-muted/50 to-muted rounded-lg">
                                        <img
                                            src={preview.url}
                                            alt="Welcome preview"
                                            className="max-w-full rounded-lg shadow-lg border"
                                            style={{
                                                maxHeight: '400px',
                                                objectFit: 'contain'
                                            }}
                                        />
                                    </div>
                                )}
                                {preview.error && (
                                    <Alert variant="destructive" className="mt-4">
                                        <Info className="h-4 w-4" />
                                        <AlertDescription>{preview.error}</AlertDescription>
                                    </Alert>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
