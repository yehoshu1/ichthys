import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ColorPicker } from '@/components/ui/color-picker';
import { 
    Image as ImageIcon, 
    AlignLeft, AlignCenter, AlignRight, Layout, AlertCircle
} from 'lucide-react';

export function ImageDesigner({ config, updateConfig, prefix = '', guildId = '' }: any) {
    const enabledKey = prefix ? `${prefix}ImageEnabled` : 'imageEnabled';
    const isEnabled = config[enabledKey];
    const setEnabled = (val: boolean) => updateConfig(enabledKey, val);

    const [showPreview, setShowPreview] = useState(true);
    const [preview, setPreview] = useState<{ loading: boolean; url: string | null; error: string | null }>({
        loading: false,
        url: null,
        error: null
    });

    const generatePreview = useCallback(async () => {
        if (!guildId) return;
        try {
            setPreview(prev => ({ ...prev, loading: true, error: null }));
            const response = await fetch(`/api/guilds/${guildId}/welcome/preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate preview');
            }

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
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }, [config, guildId]);

    useEffect(() => {
        if (!showPreview || !isEnabled) return;

        const timer = setTimeout(() => {
            generatePreview();
        }, 500); 

        return () => clearTimeout(timer);
    }, [
        isEnabled, config.canvasWidth, config.canvasHeight, config.backgroundType,
        config.backgroundValue, config.avatarShape, config.avatarX,
        config.avatarY, config.avatarSize, config.avatarBorderColor,
        config.avatarBorderWidth, config.usernameX, config.usernameY,
        config.usernameFont, config.usernameSize, config.usernameColor,
        config.usernameAlign, config.subtitleEnabled, config.subtitleTemplate,
        config.subtitleX, config.subtitleY, config.subtitleFont,
        config.subtitleSize, config.subtitleColor, config.showServerName,
        config.serverNameX, config.serverNameY, config.serverNameFont,
        config.serverNameSize, config.serverNameColor, generatePreview, showPreview
    ]);

    const applyLayout = (type: string) => {
        const cx = config.canvasWidth / 2;
        const cy = config.canvasHeight / 2;
        
        // Calculate total block height for center layout to ensure vertical centering
        const gap = 15;
        const avatarH = config.avatarSize || 90;
        const userH = config.usernameSize || 18;
        const subH = config.subtitleEnabled ? (config.subtitleSize || 16) : 0;
        
        let totalH = avatarH + gap + userH;
        if (subH > 0) totalH += gap + subH;

        if (type === 'left') {
            const startX = Math.max(20, config.canvasWidth * 0.08);
            updateConfig('avatarX', startX);
            updateConfig('avatarY', cy - (avatarH / 2));
            updateConfig('usernameX', startX + avatarH + 30);
            updateConfig('usernameY', cy - 5);
            updateConfig('usernameAlign', 'left');
            updateConfig('subtitleX', startX + avatarH + 30);
            updateConfig('subtitleY', cy + 25);
            updateConfig('serverNameX', startX + avatarH + 30);
            updateConfig('serverNameY', cy + 55);
        } else if (type === 'center') {
            const startY = cy - (totalH / 2);
            updateConfig('avatarX', cx - (avatarH / 2));
            updateConfig('avatarY', startY);
            updateConfig('usernameX', cx);
            updateConfig('usernameY', startY + avatarH + gap + userH);
            updateConfig('usernameAlign', 'center');
            updateConfig('subtitleX', cx);
            updateConfig('subtitleY', startY + avatarH + gap * 2 + userH + subH);
            updateConfig('serverNameX', cx);
            updateConfig('serverNameY', startY - gap - 25);
        } else if (type === 'right') {
            const endX = config.canvasWidth - Math.max(20, config.canvasWidth * 0.08);
            updateConfig('avatarX', endX - avatarH);
            updateConfig('avatarY', cy - (avatarH / 2));
            updateConfig('usernameX', endX - avatarH - 30);
            updateConfig('usernameY', cy - 5);
            updateConfig('usernameAlign', 'right');
            updateConfig('subtitleX', endX - avatarH - 30);
            updateConfig('subtitleY', cy + 25);
            updateConfig('serverNameX', endX - avatarH - 30);
            updateConfig('serverNameY', cy + 55);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    {prefix === 'private' ? 'Private' : prefix === 'goodbye' ? 'Leave' : 'Welcome'} Image Card
                </CardTitle>
                <CardDescription>
                    Generate a customizable image card
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30">
                    <div>
                        <div className="font-medium">Enable Image Card</div>
                        <div className="text-sm text-muted-foreground">
                            Include an image card in this message
                        </div>
                    </div>
                    <Switch checked={isEnabled} onCheckedChange={setEnabled} />
                </div>

                {isEnabled && (
                    <div className="space-y-6">
                        {/* Canvas Settings */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Canvas Width (px)</Label>
                                <Input type="number" value={config.canvasWidth} onChange={(e) => updateConfig('canvasWidth', parseInt(e.target.value) || 1024)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Canvas Height (px)</Label>
                                <Input type="number" value={config.canvasHeight} onChange={(e) => updateConfig('canvasHeight', parseInt(e.target.value) || 500)} />
                            </div>
                        </div>

                        {/* Layout Presets */}
                        <div className="space-y-3">
                            <Label className="flex items-center gap-2">
                                <Layout className="w-4 h-4" />
                                Quick Layout Presets
                            </Label>
                            <div className="grid grid-cols-3 gap-2">
                                <Button variant="outline" className="flex flex-col gap-1 h-auto py-3" onClick={() => applyLayout('left')}>
                                    <AlignLeft className="w-5 h-5 text-muted-foreground" />
                                    <span className="text-xs">Left Align</span>
                                </Button>
                                <Button variant="outline" className="flex flex-col gap-1 h-auto py-3" onClick={() => applyLayout('center')}>
                                    <AlignCenter className="w-5 h-5 text-muted-foreground" />
                                    <span className="text-xs">Center Align</span>
                                </Button>
                                <Button variant="outline" className="flex flex-col gap-1 h-auto py-3" onClick={() => applyLayout('right')}>
                                    <AlignRight className="w-5 h-5 text-muted-foreground" />
                                    <span className="text-xs">Right Align</span>
                                </Button>
                            </div>
                        </div>

                        <Tabs defaultValue="background" className="w-full">
                            <TabsList className="grid grid-cols-4">
                                <TabsTrigger value="background">Background</TabsTrigger>
                                <TabsTrigger value="avatar">Avatar</TabsTrigger>
                                <TabsTrigger value="username">Username</TabsTrigger>
                                <TabsTrigger value="text">Extra Text</TabsTrigger>
                            </TabsList>

                            <TabsContent value="background" className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label>Background Type</Label>
                                    <Select value={config.backgroundType} onValueChange={(v) => updateConfig('backgroundType', v)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="COLOR">Solid Color</SelectItem>
                                            <SelectItem value="GRADIENT">Gradient</SelectItem>
                                            <SelectItem value="IMAGE">Image URL</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {config.backgroundType !== 'IMAGE' && (
                                    <div className="space-y-2">
                                        <Label>Background Color</Label>
                                        <ColorPicker value={config.backgroundValue} onChange={(v) => updateConfig('backgroundValue', v)} />
                                    </div>
                                )}
                                {config.backgroundType === 'IMAGE' && (
                                    <div className="space-y-2">
                                        <Label>Image URL</Label>
                                        <Input value={config.backgroundValue} onChange={(e) => updateConfig('backgroundValue', e.target.value)} />
                                    </div>
                                )}
                                <div className="space-y-2 pt-2 border-t mt-4">
                                    <Label className="flex justify-between">
                                        <span>Overlay Opacity (%)</span>
                                        <span className="text-muted-foreground">{config.overlayOpacity ?? 50}%</span>
                                    </Label>
                                    <Slider 
                                        value={[config.overlayOpacity ?? 50]} 
                                        min={0} 
                                        max={100} 
                                        step={5}
                                        onValueChange={(v) => updateConfig('overlayOpacity', v[0])} 
                                    />
                                    <p className="text-xs text-muted-foreground">Sets the darkness of the inner rounded overlay behind text and avatar.</p>
                                </div>
                            </TabsContent>

                            <TabsContent value="avatar" className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label>Shape</Label>
                                    <Select value={config.avatarShape} onValueChange={(v) => updateConfig('avatarShape', v)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CIRCLE">Circle</SelectItem>
                                            <SelectItem value="SQUARE">Square</SelectItem>
                                            <SelectItem value="ROUNDED">Rounded</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>X Position</Label>
                                        <Slider value={[config.avatarX]} min={0} max={config.canvasWidth} onValueChange={(v) => updateConfig('avatarX', v[0])} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Y Position</Label>
                                        <Slider value={[config.avatarY]} min={0} max={config.canvasHeight} onValueChange={(v) => updateConfig('avatarY', v[0])} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Size (px)</Label>
                                    <Slider value={[config.avatarSize]} min={16} max={config.canvasHeight} onValueChange={(v) => updateConfig('avatarSize', v[0])} />
                                </div>
                            </TabsContent>

                            <TabsContent value="username" className="space-y-4 mt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>X Position</Label>
                                        <Slider value={[config.usernameX]} min={0} max={config.canvasWidth} onValueChange={(v) => updateConfig('usernameX', v[0])} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Y Position</Label>
                                        <Slider value={[config.usernameY]} min={0} max={config.canvasHeight} onValueChange={(v) => updateConfig('usernameY', v[0])} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Font Size (px)</Label>
                                    <Slider value={[config.usernameSize]} min={12} max={200} onValueChange={(v) => updateConfig('usernameSize', v[0])} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Text Color</Label>
                                    <ColorPicker value={config.usernameColor} onChange={(v) => updateConfig('usernameColor', v)} />
                                </div>
                            </TabsContent>

                            <TabsContent value="text" className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label>Subtitle Enabled</Label>
                                    <Switch checked={config.subtitleEnabled} onCheckedChange={(v) => updateConfig('subtitleEnabled', v)} />
                                </div>
                                {config.subtitleEnabled && (
                                    <div className="space-y-2 border-l-2 pl-4">
                                        <Label>Subtitle Text</Label>
                                        <Input value={config.subtitleTemplate} onChange={(e) => updateConfig('subtitleTemplate', e.target.value)} />
                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                            <div className="space-y-2">
                                                <Label>X Position</Label>
                                                <Slider value={[config.subtitleX]} min={0} max={config.canvasWidth} onValueChange={(v) => updateConfig('subtitleX', v[0])} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Y Position</Label>
                                                <Slider value={[config.subtitleY]} min={0} max={config.canvasHeight} onValueChange={(v) => updateConfig('subtitleY', v[0])} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>

                        <div className="space-y-4 pt-6 border-t mt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium text-lg tracking-tight">Live Preview</h3>
                                    <p className="text-sm text-muted-foreground">Preview how the generated image card will look.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="preview-toggle" className="text-sm cursor-pointer">Show Preview</Label>
                                    <Switch 
                                        id="preview-toggle" 
                                        checked={showPreview} 
                                        onCheckedChange={setShowPreview} 
                                    />
                                </div>
                            </div>

                            {showPreview && (
                                <div className="border border-border/50 rounded-lg overflow-hidden bg-muted/20 relative min-h-[300px] flex items-center justify-center p-4">
                                    {preview.loading && (
                                        <div className="absolute inset-0 bg-background/50 flex flex-col items-center justify-center z-10">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                                            <span className="text-sm font-medium">Generating...</span>
                                        </div>
                                    )}
                                    
                                    {preview.error && !preview.loading && (
                                        <div className="p-6 flex flex-col items-center text-center text-destructive">
                                            <AlertCircle className="w-8 h-8 mb-2" />
                                            <p className="font-medium">Failed to generate preview</p>
                                            <p className="text-xs opacity-80 mt-1">{preview.error}</p>
                                        </div>
                                    )}
                                    
                                    {preview.url && !preview.error && (
                                        <img 
                                            src={preview.url} 
                                            alt="Welcome Card Preview" 
                                            className={`w-full max-w-3xl h-auto object-contain transition-opacity duration-300 ${preview.loading ? 'opacity-30' : 'opacity-100'}`}
                                        />
                                    )}
                                    
                                    {!preview.url && !preview.loading && !preview.error && (
                                        <div className="p-6 text-center text-muted-foreground flex flex-col items-center">
                                            <ImageIcon className="w-12 h-12 mb-3 opacity-20" />
                                            <p className="font-medium">No Preview Available</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
