"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { RoleSelect } from "../../../../components/DiscordSelectors";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "../../../../components/ui/card";
import { Label } from "../../../../components/ui/label";
import { Switch } from "../../../../components/ui/switch";
import { Trash2, Plus, ShieldCheck, UserX, UserCheck } from "lucide-react";

// Types
interface VerificationConfig {
    verificationEnabled: boolean;
    unverifiedRoleId: string | null;
    verificationRoleId: string | null;
    verificationGraceDays: number;
    verificationKickDmEnabled: boolean;
    verificationMessage: string | null;
}

interface VerificationRule {
    id: string;
    roleId: string;
    message: string;
}

interface VerificationStats {
    verified: number;
    unverified: number;
    kicked: number;
}

export default function VerificationPage() {
    const params = useParams();
    const guildId = params.guildId as string;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [config, setConfig] = useState<VerificationConfig>({
        verificationEnabled: false,
        unverifiedRoleId: "",
        verificationRoleId: "",
        verificationGraceDays: 30,
        verificationKickDmEnabled: true,
        verificationMessage: "",
    });

    const [rules, setRules] = useState<VerificationRule[]>([]);
    const [newRuleRoleId, setNewRuleRoleId] = useState("");
    const [newRuleMessage, setNewRuleMessage] = useState("");
    const [addingRule, setAddingRule] = useState(false);

    const [stats, setStats] = useState<VerificationStats>({
        verified: 0,
        unverified: 0,
        kicked: 0
    });

    useEffect(() => {
        fetchData();
    }, [guildId]);

    async function fetchData() {
        try {
            const [configRes, statsRes, rulesRes] = await Promise.all([
                fetch(`/api/guilds/${guildId}/verification/config`),
                fetch(`/api/guilds/${guildId}/verification/stats`),
                fetch(`/api/guilds/${guildId}/verification/rules`)
            ]);

            if (configRes.ok) setConfig(await configRes.json());
            if (statsRes.ok) setStats(await statsRes.json());
            if (rulesRes.ok) setRules(await rulesRes.json());
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            await fetch(`/api/guilds/${guildId}/verification/config`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });
            alert("Settings saved!");
        } catch (err) {
            console.error(err);
            alert("Failed to save settings.");
        } finally {
            setSaving(false);
        }
    }

    async function handleAddRule() {
        if (!newRuleRoleId || !newRuleMessage) return;
        setAddingRule(true);
        try {
            const res = await fetch(`/api/guilds/${guildId}/verification/rules`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    roleId: newRuleRoleId,
                    message: newRuleMessage
                }),
            });

            if (res.ok) {
                const newRule = await res.json();
                setRules([...rules, newRule]);
                setNewRuleRoleId("");
                setNewRuleMessage("");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setAddingRule(false);
        }
    }

    async function handleDeleteRule(ruleId: string) {
        if (!confirm("Are you sure you want to delete this rule?")) return;
        try {
            const res = await fetch(`/api/guilds/${guildId}/verification/rules/${ruleId}`, {
                method: "DELETE"
            });

            if (res.ok) {
                setRules(rules.filter(r => r.id !== ruleId));
            }
        } catch (err) {
            console.error(err);
        }
    }

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading verification settings...</div>;

    const totalMembers = stats.verified + stats.unverified || 1;
    const verifiedPercent = (stats.verified / totalMembers) * 100;

    return (
        <div className="container mx-auto p-6 max-w-5xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Verification System</h1>
                <p className="text-muted-foreground">Automatically kick unverified members after a grace period.</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Configuration</CardTitle>
                            <CardDescription>Manage automated verification enforcement.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSave} className="space-y-6">
                                <div className="flex items-center space-x-2 rounded-lg border p-4">
                                    <Switch
                                        id="kick-enabled"
                                        checked={config.verificationEnabled}
                                        onCheckedChange={(checked) => setConfig({ ...config, verificationEnabled: checked })}
                                    />
                                    <div className="space-y-0.5">
                                        <Label htmlFor="kick-enabled" className="text-base">Enable Auto-Kick System</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Automatically kick members who remain unverified.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Unverified Role (Assigned to new members)</Label>
                                    <RoleSelect
                                        guildId={guildId}
                                        value={config.unverifiedRoleId || ""}
                                        onChange={(value) => setConfig({ ...config, unverifiedRoleId: value })}
                                        allowNone={true}
                                    />
                                    <p className="text-[0.8rem] text-muted-foreground">Optional. This role will be removed when a user is verified.</p>
                                </div>

                                <div className="space-y-2">
                                    <Label>Verification Role (User gets this when verified)</Label>
                                    <RoleSelect
                                        guildId={guildId}
                                        value={config.verificationRoleId || ""}
                                        onChange={(value) => setConfig({ ...config, verificationRoleId: value })}
                                        allowNone={false}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Grace Period (Days)</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        max="365"
                                        value={config.verificationGraceDays}
                                        onChange={(e) => setConfig({ ...config, verificationGraceDays: parseInt(e.target.value) })}
                                    />
                                    <p className="text-[0.8rem] text-muted-foreground">Users joined longer than this without verification will be kicked.</p>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id="dm-enabled"
                                        checked={config.verificationKickDmEnabled}
                                        onCheckedChange={(checked) => setConfig({ ...config, verificationKickDmEnabled: checked })}
                                    />
                                    <Label htmlFor="dm-enabled">Send DM before kicking</Label>
                                </div>

                                <div className="space-y-2">
                                    <Label>Default Verification Message (Optional)</Label>
                                    <div className="relative">
                                        <textarea
                                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            placeholder="Example: Welcome {user}! You are now verified."
                                            value={config.verificationMessage || ""}
                                            onChange={(e) => setConfig({ ...config, verificationMessage: e.target.value })}
                                        />
                                    </div>
                                    <p className="text-[0.8rem] text-muted-foreground">
                                        Message sent to the channel when a user is verified. Use <code>{'{user}'}</code> to mention the user.
                                    </p>
                                </div>

                                <Button type="submit" disabled={saving}>
                                    {saving ? "Saving..." : "Save Settings"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Role-Specific Messages</CardTitle>
                            <CardDescription>Send different messages based on the user's role.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                {rules.map(rule => (
                                    <div key={rule.id} className="flex items-start justify-between rounded-lg border p-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium">Role:</span>
                                                <RoleSelect
                                                    guildId={guildId}
                                                    value={rule.roleId}
                                                    onChange={() => { }} // Read-only in list
                                                    allowNone={false}
                                                // disabled // Component doesn't support disabled prop yet? Assuming it might not
                                                />
                                            </div>
                                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{rule.message}</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteRule(rule.id)}
                                            className="text-destructive hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}

                                {rules.length === 0 && (
                                    <div className="text-center text-sm text-muted-foreground py-4">
                                        No role-specific messages configured.
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4 rounded-lg border border-dashed p-4">
                                <h4 className="text-sm font-medium">Add New Rule</h4>
                                <div className="space-y-2">
                                    <Label>If user has role:</Label>
                                    <RoleSelect
                                        guildId={guildId}
                                        value={newRuleRoleId}
                                        onChange={setNewRuleRoleId}
                                        allowNone={false}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Send this message:</Label>
                                    <textarea
                                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="Welcome VIP {user}!"
                                        value={newRuleMessage}
                                        onChange={(e) => setNewRuleMessage(e.target.value)}
                                    />
                                </div>
                                <Button
                                    onClick={handleAddRule}
                                    disabled={addingRule || !newRuleRoleId || !newRuleMessage}
                                    className="w-full"
                                >
                                    <Plus className="mr-2 h-4 w-4" /> Add Rule
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Statistics</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center text-muted-foreground"><ShieldCheck className="mr-2 h-4 w-4" /> Verified</span>
                                    <span className="font-bold text-green-500">{stats.verified}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center text-muted-foreground"><UserCheck className="mr-2 h-4 w-4" /> Unverified</span>
                                    <span className="font-bold text-orange-500">{stats.unverified}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center text-muted-foreground"><UserX className="mr-2 h-4 w-4" /> Auto-Kicked</span>
                                    <span className="font-bold text-destructive">{stats.kicked}</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Server Verification Level</Label>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                                    <div
                                        className="h-full bg-primary transition-all duration-500"
                                        style={{ width: `${verifiedPercent}%` }}
                                    />
                                </div>
                                <p className="text-right text-xs text-muted-foreground">{verifiedPercent.toFixed(1)}% Verified</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
