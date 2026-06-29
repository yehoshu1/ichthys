const fs = require('fs');
const path = require('path');

const pagePath = path.join('/home/josh/Projects/ixoye/src/dashboard/app/dashboard/[guildId]/welcome/page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

// Find start and end of Image Card Configuration
const startIndex = content.indexOf('{/* Image Card Configuration */}');
const endIndex = content.indexOf('{/* Variables Help Card */}');

if (startIndex === -1 || endIndex === -1) {
    console.error('Could not find Image Card block');
    process.exit(1);
}

const imageCardBlock = content.substring(startIndex, endIndex);

// We'll replace `config.` with `config.` and `updateConfig(` with `updateConfig(` 
// Actually, they use the exact same names, so we just need to wrap it in a component.

const componentContent = `import React from 'react';
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
    Palette, User, Type, AlignLeft, AlignCenter, AlignRight, Layout, Sparkles, X 
} from 'lucide-react';

export function ImageDesigner({ config, updateConfig, prefix = '' }) {
    const enabledKey = prefix ? \`\${prefix}ImageEnabled\` : 'imageEnabled';
    const isEnabled = config[enabledKey];
    const setEnabled = (val) => updateConfig(enabledKey, val);

    // Apply layout presets
    const applyLayout = (type) => {
        const cx = config.canvasWidth / 2;
        const cy = config.canvasHeight / 2;

        if (type === 'left') {
            updateConfig('avatarX', 50);
            updateConfig('avatarY', cy - (config.avatarSize / 2));
            
            updateConfig('usernameX', 50 + config.avatarSize + 40);
            updateConfig('usernameY', cy - 10);
            updateConfig('usernameAlign', 'left');
            
            updateConfig('subtitleX', 50 + config.avatarSize + 40);
            updateConfig('subtitleY', cy + 30);
            
            updateConfig('serverNameX', 50 + config.avatarSize + 40);
            updateConfig('serverNameY', cy - 50);
        } else if (type === 'center') {
            updateConfig('avatarX', cx - (config.avatarSize / 2));
            updateConfig('avatarY', cy - config.avatarSize + 20);
            
            updateConfig('usernameX', cx);
            updateConfig('usernameY', cy + 50);
            updateConfig('usernameAlign', 'center');
            
            updateConfig('subtitleX', cx);
            updateConfig('subtitleY', cy + 90);
            
            updateConfig('serverNameX', cx);
            updateConfig('serverNameY', cy - config.avatarSize - 20);
        } else if (type === 'right') {
            updateConfig('avatarX', config.canvasWidth - config.avatarSize - 50);
            updateConfig('avatarY', cy - (config.avatarSize / 2));
            
            updateConfig('usernameX', config.canvasWidth - config.avatarSize - 90);
            updateConfig('usernameY', cy - 10);
            updateConfig('usernameAlign', 'right');
            
            updateConfig('subtitleX', config.canvasWidth - config.avatarSize - 90);
            updateConfig('subtitleY', cy + 30);
            
            updateConfig('serverNameX', config.canvasWidth - config.avatarSize - 90);
            updateConfig('serverNameY', cy - 50);
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
                    <Switch
                        checked={isEnabled}
                        onCheckedChange={setEnabled}
                    />
                </div>

                {isEnabled && (
                    ${imageCardBlock.replace(/config\.imageEnabled/g, 'true').replace(/<Card>/, '<div className="space-y-6">').replace(/<\/Card>/, '</div>').replace(/<CardHeader>.*?<\/CardHeader>/s, '').replace(/<CardContent.*?>/s, '<div>').replace(/<\/CardContent>/, '</div>')}
                )}
            </CardContent>
        </Card>
    );
}
`;

fs.writeFileSync(path.join(path.dirname(pagePath), 'components', 'ImageDesigner.tsx'), componentContent);
console.log('ImageDesigner.tsx created successfully');
