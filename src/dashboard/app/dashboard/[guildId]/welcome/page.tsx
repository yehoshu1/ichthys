"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageConfigTab } from './components/MessageConfigTab';
import { RolesTab } from './components/RolesTab';

interface WelcomeConfig {
    id?: string;
    guildId: string;
    enabled: boolean;
    targetType: 'DM' | 'CHANNEL';
    channelId: string | null;
    messageTemplate: string | null;
    embedEnabled: boolean;
    embedConfig: Record<string, unknown> | null;
    
    welcomeBotsEnabled: boolean;
    goodbyeEnabled: boolean;
    goodbyeChannelId: string | null;
    goodbyeMessageTemplate: string | null;
    goodbyeEmbedEnabled: boolean;
    goodbyeEmbedConfig: Record<string, unknown> | null;
    goodbyeBotsEnabled: boolean;
    goodbyeImageEnabled: boolean;

    privateEnabled: boolean;
    privateMessageTemplate: string | null;
    privateEmbedEnabled: boolean;
    privateEmbedConfig: Record<string, unknown> | null;
    privateImageEnabled: boolean;
    
    imageEnabled: boolean;
    imageSendMode: 'WITH_TEXT' | 'BEFORE_TEXT' | 'TO_CHANNEL' | 'IMAGE_ONLY';
    imageChannelId: string | null;
    canvasWidth: number;
    canvasHeight: number;
    backgroundType: 'COLOR' | 'GRADIENT' | 'IMAGE';
    backgroundValue: string;
    overlayOpacity: number;
    avatarShape: 'CIRCLE' | 'SQUARE' | 'ROUNDED';
    avatarX: number;
    avatarY: number;
    avatarSize: number;
    avatarBorderColor: string | null;
    avatarBorderWidth: number;
    usernameX: number;
    usernameY: number;
    usernameFont: string;
    usernameSize: number;
    usernameColor: string;
    usernameAlign: 'left' | 'center' | 'right';
    subtitleEnabled: boolean;
    subtitleTemplate: string | null;
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

const variableExamples = [
    { code: '{user}', description: 'Mentions the user (@username)' },
    { code: '{username}', description: 'The user\'s name without mention' },
    { code: '{server}', description: 'The name of the server' },
    { code: '{memberCount}', description: 'Total member count' },
    { code: '{date}', description: 'Current date' },
    { code: '{time}', description: 'Current time' },
];

const defaultConfig: Partial<WelcomeConfig> = {
    enabled: false,
    targetType: 'CHANNEL',
    channelId: null,
    messageTemplate: 'Welcome {user} to {server}! You are member #{memberCount}.',
    embedEnabled: false,
    embedConfig: null,
    welcomeBotsEnabled: false,
    goodbyeEnabled: false,
    goodbyeChannelId: null,
    goodbyeMessageTemplate: '{user} has left the server.',
    goodbyeEmbedEnabled: false,
    goodbyeEmbedConfig: null,
    goodbyeBotsEnabled: false,
    goodbyeImageEnabled: false,
    privateEnabled: false,
    privateMessageTemplate: 'Welcome {user} to {server}!',
    privateEmbedEnabled: false,
    privateEmbedConfig: null,
    privateImageEnabled: false,
    imageEnabled: false,
    imageSendMode: 'WITH_TEXT',
    imageChannelId: null,
    canvasWidth: 400,
    canvasHeight: 200,
    backgroundType: 'COLOR',
    backgroundValue: '#1a1a2e',
    overlayOpacity: 50,
    avatarShape: 'CIRCLE',
    avatarX: 155,
    avatarY: 10,
    avatarSize: 90,
    avatarBorderColor: '#ffffff',
    avatarBorderWidth: 0,
    usernameX: 200,
    usernameY: 115,
    usernameFont: 'Arial',
    usernameSize: 18,
    usernameColor: '#ffffff',
    usernameAlign: 'center',
    subtitleEnabled: true,
    subtitleTemplate: 'Welcome to {server}',
    subtitleX: 200,
    subtitleY: 140,
    subtitleFont: 'Arial',
    subtitleSize: 16,
    subtitleColor: '#aaaaaa',
    showServerName: false,
    serverNameX: 200,
    serverNameY: 30,
    serverNameFont: 'Arial',
    serverNameSize: 20,
    serverNameColor: '#ffffff',
    cooldownEnabled: false,
    cooldownSeconds: 5
};

export default function WelcomePage() {
    const params = useParams();
    const guildId = params.guildId as string;

    const [guildConfig, setGuildConfig] = useState<any>({});
    const [config, setConfig] = useState<WelcomeConfig>(defaultConfig as WelcomeConfig);
    const [originalConfig, setOriginalConfig] = useState<WelcomeConfig | null>(null);
    const [channels, setChannels] = useState<{ id: string; name: string; type: number }[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [configRes, channelsRes, guildRes] = await Promise.all([
                fetch(`/api/guilds/${guildId}/welcome/config`),
                fetch(`/api/guilds/${guildId}/channels`),
                fetch(`/api/guilds/${guildId}`)
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

            if (guildRes.ok) {
                const data = await guildRes.json();
                setGuildConfig(data.guild || {});
            }
        } catch (error) {
            toast.error('Failed to load configuration');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [guildId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const updateConfig = useCallback((key: string, value: any) => {
        setConfig(prev => {
            const next = { ...prev, [key]: value };
            
            if (key === 'enabled' && value === true) {
                if (next.targetType === 'CHANNEL' && channels.length > 0 && !next.channelId) {
                    next.channelId = channels[0].id;
                }
            }
            
            return next;
        });
        setHasChanges(true);
    }, [channels]);

    const saveConfig = useCallback(async () => {
        try {
            setSaving(true);
            if (config.enabled && config.targetType === 'CHANNEL' && !config.channelId) {
                toast.error('Please select a channel for the welcome message');
                return;
            }

            const response = await fetch(`/api/guilds/${guildId}/welcome/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || 'Failed to save configuration');
            }
            
            await fetch(`/api/guilds/${guildId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ autoRoleId: guildConfig.autoRoleId || null })
            });

            const data = await response.json();
            setOriginalConfig(data.config);
            setHasChanges(false);
            toast.success('Configuration saved successfully!');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to save configuration');
        } finally {
            setSaving(false);
        }
    }, [config, guildConfig.autoRoleId, guildId]);

    const insertVariable = useCallback((variable: string, key?: string) => {
        const templateKey = key ?? 'messageTemplate';
        const template = (config as any)[templateKey] || '';
        updateConfig(templateKey as string, template + variable);
    }, [config, updateConfig]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Welcome & Leave</h1>
                    <p className="text-muted-foreground">
                        Configure welcome and leave messages, automatic roles, and more.
                    </p>
                </div>

                <div className="flex gap-2">
                    <Button 
                        variant="outline" 
                        onClick={() => {
                            if (originalConfig) setConfig(originalConfig);
                            setHasChanges(false);
                        }}
                        disabled={!hasChanges || saving}
                    >
                        Discard Changes
                    </Button>
                    <Button 
                        onClick={saveConfig}
                        disabled={!hasChanges || saving}
                        className="gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </div>

            {hasChanges && (
                <Alert className="bg-primary/10 text-primary border-primary/20">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Unsaved Changes</AlertTitle>
                    <AlertDescription>
                        You have unsaved changes. Don't forget to save before leaving this page.
                    </AlertDescription>
                </Alert>
            )}

            <div className="space-y-8">
                <Tabs defaultValue="welcome" className="space-y-6">
                    <TabsList className="grid grid-cols-4 w-full md:w-[600px] bg-muted">
                        <TabsTrigger value="welcome">Welcome</TabsTrigger>
                        <TabsTrigger value="private">Private</TabsTrigger>
                        <TabsTrigger value="leave">Leave</TabsTrigger>
                        <TabsTrigger value="roles">Roles</TabsTrigger>
                    </TabsList>

                    <TabsContent value="welcome" className="space-y-6">
                        <MessageConfigTab 
                            config={config} 
                            updateConfig={updateConfig} 
                            channels={channels} 
                            insertVariable={insertVariable} 
                            variableExamples={variableExamples} 
                            prefix="" 
                            guildId={guildId}
                        />
                    </TabsContent>
                    
                    <TabsContent value="private" className="space-y-6">
                        <MessageConfigTab 
                            config={config} 
                            updateConfig={updateConfig} 
                            channels={channels} 
                            insertVariable={insertVariable} 
                            variableExamples={variableExamples} 
                            prefix="private" 
                            guildId={guildId}
                        />
                    </TabsContent>
                    
                    <TabsContent value="leave" className="space-y-6">
                        <MessageConfigTab 
                            config={config} 
                            updateConfig={updateConfig} 
                            channels={channels} 
                            insertVariable={insertVariable} 
                            variableExamples={variableExamples} 
                            prefix="goodbye" 
                            guildId={guildId}
                        />
                    </TabsContent>
                    
                    <TabsContent value="roles" className="space-y-6">
                        <RolesTab 
                            autoRoleId={guildConfig.autoRoleId} 
                            setAutoRoleId={(val: string) => {
                                setGuildConfig({...guildConfig, autoRoleId: val});
                                setHasChanges(true);
                            }}
                            guildId={guildId} 
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
