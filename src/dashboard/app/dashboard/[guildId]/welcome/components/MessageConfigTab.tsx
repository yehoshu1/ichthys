import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Bot } from 'lucide-react';
import { ImageDesigner } from './ImageDesigner';
import { EmbedDesigner } from './EmbedDesigner';

export function MessageConfigTab({ config, updateConfig, channels, insertVariable, variableExamples, prefix = '', guildId = '' }: {
    config: any;
    updateConfig: (key: string, value: any) => void;
    channels?: any[];
    insertVariable: (name: string) => void;
    variableExamples: any;
    prefix?: string;
    guildId?: string;
}) {
    const enabledKey = prefix ? `${prefix}Enabled` : 'enabled';
    const botsEnabledKey = prefix ? `${prefix}BotsEnabled` : 'welcomeBotsEnabled';


    const channelIdKey = prefix ? `${prefix}ChannelId` : 'channelId';
    const messageTemplateKey = prefix ? `${prefix}MessageTemplate` : 'messageTemplate';
    
    // Private message does not have channel config
    const showChannelConfig = prefix !== 'private';
    
    const isEnabled = config[enabledKey];
    
    return (
        <div className="space-y-6">
            <Card className="border-primary/20">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-full bg-primary/10">
                                <MessageSquare className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">{prefix === 'private' ? 'Private (DM)' : prefix === 'goodbye' ? 'Leave' : 'Welcome'} Message</h3>
                                <p className="text-sm text-muted-foreground">
                                    Configure messages sent to users.
                                </p>
                            </div>
                        </div>
                        <Switch
                            checked={isEnabled}
                            onCheckedChange={(checked) => updateConfig(enabledKey, checked)}
                        />
                    </div>
                </CardContent>
            </Card>

            {isEnabled && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MessageSquare className="w-5 h-5" />
                            Message Configuration
                        </CardTitle>
                        <CardDescription>
                            Configure where and how messages are sent
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        
                        {/* Trigger on Bots (only for Welcome/Leave) */}
                        {showChannelConfig && (
                            <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30">
                                <div className="flex items-center gap-2">
                                    <Bot className="w-4 h-4 text-muted-foreground" />
                                    <div>
                                        <div className="font-medium">Trigger for Bots</div>
                                        <div className="text-sm text-muted-foreground">
                                            Send this message when a bot joins/leaves
                                        </div>
                                    </div>
                                </div>
                                <Switch
                                    checked={config[botsEnabledKey] || false}
                                    onCheckedChange={(checked) => updateConfig(botsEnabledKey, checked)}
                                />
                            </div>
                        )}

                        {/* Channel Selector */}
                        {showChannelConfig && (
                            <div className="space-y-2">
                                <Label htmlFor="channel-select">Select Channel</Label>
                                <Select
                                    value={config[channelIdKey] || ''}
                                    onValueChange={(value) => updateConfig(channelIdKey, value || null)}
                                >
                                    <SelectTrigger id="channel-select">
                                        <SelectValue placeholder="Select a channel" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(channels ?? []).map(channel => (
                                            <SelectItem key={channel.id} value={channel.id}>
                                                # {channel.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {showChannelConfig && <Separator />}

                        {/* Message Template */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="message-template">Message Text</Label>
                                <div className="flex gap-1">
                                    {variableExamples.slice(0, 3).map((v: any) => (
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
                                value={config[messageTemplateKey] || ''}
                                onChange={(e) => updateConfig(messageTemplateKey, e.target.value)}
                                placeholder="Message text here..."
                                className="w-full min-h-[100px] px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            />
                        </div>
                    </CardContent>
                </Card>
            )}

            {isEnabled && (
                <EmbedDesigner config={config} updateConfig={updateConfig} prefix={prefix} />
            )}

            {isEnabled && (
                <ImageDesigner config={config} updateConfig={updateConfig} prefix={prefix} guildId={guildId} />
            )}
        </div>
    );
}
