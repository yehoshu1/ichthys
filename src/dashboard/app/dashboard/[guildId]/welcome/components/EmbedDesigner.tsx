import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ColorPicker } from '@/components/ui/color-picker';
import { LayoutTemplate, Image as ImageIcon } from 'lucide-react';

export function EmbedDesigner({ config, updateConfig, prefix = '' }: any) {
    const embedEnabledKey = prefix ? `${prefix}EmbedEnabled` : 'embedEnabled';
    const embedConfigKey = prefix ? `${prefix}EmbedConfig` : 'embedConfig';
    
    const isEnabled = config[embedEnabledKey] || false;
    const embedConfig = config[embedConfigKey] || {
        title: '',
        description: 'Welcome to the server!',
        color: '#5865F2',
        showAvatar: true
    };

    const setEnabled = (val: boolean) => updateConfig(embedEnabledKey, val);
    
    const updateEmbedConfig = (key: string, value: any) => {
        updateConfig(embedConfigKey, {
            ...embedConfig,
            [key]: value
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <LayoutTemplate className="w-5 h-5" />
                    {prefix === 'private' ? 'Private' : prefix === 'goodbye' ? 'Leave' : 'Welcome'} Embed
                </CardTitle>
                <CardDescription>
                    Configure the Discord embed attached to the message. This is sent along with the main message text.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30">
                    <div>
                        <div className="font-medium">Enable Embed</div>
                        <div className="text-sm text-muted-foreground">
                            Include a rich embed in this message
                        </div>
                    </div>
                    <Switch checked={isEnabled} onCheckedChange={setEnabled} />
                </div>

                {isEnabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Edit Section */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Embed Title</Label>
                                <Input 
                                    placeholder="e.g. Welcome {user}!" 
                                    value={embedConfig.title || ''} 
                                    onChange={(e) => updateEmbedConfig('title', e.target.value)} 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Embed Description</Label>
                                <Textarea 
                                    placeholder="Embed description text..." 
                                    value={embedConfig.description || ''} 
                                    onChange={(e) => updateEmbedConfig('description', e.target.value)} 
                                    rows={5}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Embed Color</Label>
                                <ColorPicker 
                                    value={embedConfig.color || '#5865F2'} 
                                    onChange={(v) => updateEmbedConfig('color', v)} 
                                />
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                                <div className="space-y-0.5">
                                    <Label>Show User Avatar</Label>
                                    <div className="text-xs text-muted-foreground">Display the user's avatar as the thumbnail</div>
                                </div>
                                <Switch 
                                    checked={embedConfig.showAvatar !== false} 
                                    onCheckedChange={(v) => updateEmbedConfig('showAvatar', v)} 
                                />
                            </div>
                        </div>

                        {/* Preview Section */}
                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Embed Preview</Label>
                            <div className="rounded-md border border-border bg-[#313338] p-4 flex gap-4 max-w-sm">
                                <div 
                                    className="w-1 rounded-full flex-shrink-0 self-stretch"
                                    style={{ backgroundColor: embedConfig.color || '#5865F2' }}
                                />
                                <div className="space-y-2 w-full pt-1">
                                    {embedConfig.title && (
                                        <div className="font-semibold text-white/90 text-[15px]">
                                            {embedConfig.title.replace(/\{[a-zA-Z]+\}/g, 'JohnDoe')}
                                        </div>
                                    )}
                                    {embedConfig.description && (
                                        <div className="text-[14px] text-white/80 whitespace-pre-wrap">
                                            {embedConfig.description.replace(/\{[a-zA-Z]+\}/g, 'JohnDoe')}
                                        </div>
                                    )}
                                </div>
                                {embedConfig.showAvatar !== false && (
                                    <div className="flex-shrink-0 w-16 h-16 bg-white/10 rounded-md flex items-center justify-center">
                                        <ImageIcon className="w-6 h-6 text-white/30" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
