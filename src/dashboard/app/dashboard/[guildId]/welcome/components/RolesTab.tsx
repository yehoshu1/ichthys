import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RoleMultiSelect } from '@/components/DiscordSelectors';
import { Shield } from 'lucide-react';

export function RolesTab({ autoRoleId, setAutoRoleId, guildId }: any) {
    // If autoRoleId is a string (e.g. from DB) we treat it as an array of 1 element for RoleMultiSelect
    const value = autoRoleId ? (Array.isArray(autoRoleId) ? autoRoleId : autoRoleId.split(',')) : [];
    
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5" />
                        Auto-Assign Roles
                    </CardTitle>
                    <CardDescription>
                        Select roles to automatically assign to new members when they join.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label>Roles to Assign</Label>
                        <RoleMultiSelect
                            guildId={guildId}
                            values={value}
                            onChange={(vals) => setAutoRoleId(vals.join(','))}
                            placeholder="Select roles..."
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                            Ensure the bot role is placed higher than the roles you want to assign in your server settings.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
