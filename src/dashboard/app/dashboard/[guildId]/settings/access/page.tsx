"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "../../../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Label } from "../../../../../components/ui/label";
import { Switch } from "../../../../../components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "../../../../../components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../../components/ui/select";
import { MultiSelect } from "../../../../../components/ui/multi-select";
import { AlertTriangle, CheckCircle2, KeyRound, Loader2, Save, Info, Eye, Pencil } from "lucide-react";
import { RBAC_MODULE_IDS } from "../../../../../lib/rbac-modules";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface DiscordRole {
    id: string;
    name: string;
    position: number;
    permissions: string;
    color: number;
}

interface RbacRule {
    moduleId: string;
    allowedViewRoles: string[];
    allowedEditRoles: string[];
}

interface RbacConfig {
    guildId: string;
    enabled: boolean;
    defaultAccess: "manage_guild_only" | "deny";
    updatedAt: string;
}

interface RbacPayload {
    config: RbacConfig | null;
    rules: RbacRule[];
    discordRoles: DiscordRole[];
}

// ─── Module Definitions ─────────────────────────────────────────────────────────

interface ModuleDef {
    id: string;
    name: string;
    description: string;
}

/**
 * Display metadata for each RBAC module.  The `id` values MUST match the
 * entries in RBAC_MODULE_IDS so they remain in sync with the API.
 */
const MODULE_META: Record<string, Pick<ModuleDef, "name" | "description">> = {
    welcome:       { name: "Welcome",        description: "Join/leave messages and welcome cards" },
    verification:  { name: "Verification",   description: "Verification workflow and auto-kick" },
    leveling:      { name: "Leveling",       description: "XP, levels, and role rewards" },
    boosts:        { name: "Boosts",         description: "Boost tracking and rewards" },
    birthdays:     { name: "Birthdays",      description: "Birthday announcements" },
    "role-actions":{ name: "Role Actions",   description: "Automated actions on role changes" },
    aliases:       { name: "Aliases",        description: "Auto-responder triggers" },
    commands:      { name: "Commands",       description: "Per-command configuration" },
    moderation:    { name: "Moderation",     description: "Warnings, mutes, bans, and cases" },
    settings:      { name: "Settings",       description: "Import/export and backups" },
    webhooks:      { name: "Webhooks & API", description: "Outgoing webhooks and API keys" },
    events:        { name: "Events",         description: "Events, RSVPs, and reminders" },
    polls:         { name: "Polls",          description: "Standard, time, and anonymous polls" },
    notifications: { name: "Logs",           description: "Notification events and deliveries" },
    analytics:     { name: "Analytics",      description: "Growth and activity analytics" },
};

// Derive the display list from the authoritative RBAC_MODULE_IDS constant so
// the two never drift out of sync.
const MODULES: ModuleDef[] = RBAC_MODULE_IDS.map((id) => ({
    id,
    name: MODULE_META[id]?.name ?? id,
    description: MODULE_META[id]?.description ?? "",
}));

// ─── Component ─────────────────────────────────────────────────────────────────

export default function AccessControlPage() {
    const params = useParams();
    const guildId = params.guildId as string;

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loadErrorTitle, setLoadErrorTitle] = useState("Access Denied");
    const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

    // Config state
    const [enabled, setEnabled] = useState(false);
    const [defaultAccess, setDefaultAccess] = useState<"manage_guild_only" | "deny">("manage_guild_only");
    const [discordRoles, setDiscordRoles] = useState<DiscordRole[]>([]);
    const [rules, setRules] = useState<Map<string, RbacRule>>(new Map());

    // Load data
    const loadData = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);
        setLoadErrorTitle("Access Denied");
        try {
            const res = await fetch(`/api/guilds/${guildId}/rbac`);
            if (!res.ok) {
                const body = await res.json().catch(() => ({ error: null })) as { error?: string | null };
                if (res.status === 403) {
                    setLoadErrorTitle("Access Denied");
                    setLoadError(body.error ?? "You need Manage Server permission to configure access control.");
                } else {
                    setLoadErrorTitle("Unable to Load Access Control");
                    setLoadError(body.error ?? `Failed to load access control settings (HTTP ${res.status}).`);
                }
                return;
            }
            const payload = await res.json() as RbacPayload;

            setEnabled(payload.config?.enabled ?? false);
            setDefaultAccess(payload.config?.defaultAccess ?? "manage_guild_only");
            setDiscordRoles(payload.discordRoles ?? []);

            const rulesMap = new Map<string, RbacRule>();
            for (const rule of payload.rules ?? []) {
                rulesMap.set(rule.moduleId, rule);
            }
            setRules(rulesMap);
        } catch (err: unknown) {
            setLoadError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setIsLoading(false);
        }
    }, [guildId]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    // Update a single module rule
    function setModuleRoles(moduleId: string, field: "allowedViewRoles" | "allowedEditRoles", roleIds: string[]) {
        setRules((prev) => {
            const next = new Map(prev);
            const existing = next.get(moduleId) ?? { moduleId, allowedViewRoles: [], allowedEditRoles: [] };
            next.set(moduleId, { ...existing, [field]: roleIds });
            return next;
        });
    }

    // Save handler
    async function handleSave() {
        setIsSaving(true);
        setSaveStatus(null);
        try {
            const rulesArray = Array.from(rules.values()).filter(
                (r) => r.allowedViewRoles.length > 0 || r.allowedEditRoles.length > 0
            );

            const res = await fetch(`/api/guilds/${guildId}/rbac`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled, defaultAccess, rules: rulesArray }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({ error: "Unknown error" })) as { error?: string };
                setSaveStatus({ type: "error", message: body.error ?? "Failed to save settings." });
                return;
            }

            setSaveStatus({ type: "success", message: "Access control settings saved successfully." });
        } catch (err: unknown) {
            setSaveStatus({ type: "error", message: `Network error: ${err instanceof Error ? err.message : "Please try again."}` });
        } finally {
            setIsSaving(false);
        }
    }

    // Role options for MultiSelect. @everyone (the guild id) is offered as a
    // synthetic option — fetchBotMemberRoles injects it during evaluation, so
    // rules targeting it apply to every member of the server.
    const roleOptions = [
        { value: guildId, label: "@everyone" },
        ...discordRoles.map((r) => ({
            value: r.id,
            label: r.name,
        })),
    ];

    // ─── Render ──────────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="container max-w-4xl py-8">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{loadErrorTitle}</AlertTitle>
                    <AlertDescription>{loadError}</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="container max-w-4xl py-8 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <KeyRound className="h-8 w-8 text-primary" />
                <div>
                    <h1 className="text-2xl font-bold">Access Control</h1>
                    <p className="text-muted-foreground text-sm">
                        Delegate dashboard access to Discord roles without granting Manage Server.
                    </p>
                </div>
            </div>

            {/* Info Banner */}
            <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>How it works</AlertTitle>
                <AlertDescription>
                    Server owners, Administrators, and users with Manage Server always have full access.
                    When RBAC is enabled, you can grant View or Edit access to specific modules for
                    other Discord roles. Edit access automatically implies View access.
                </AlertDescription>
            </Alert>

            {/* Save status */}
            {saveStatus && (
                <Alert variant={saveStatus.type === "error" ? "destructive" : "default"}>
                    {saveStatus.type === "success" ? (
                        <CheckCircle2 className="h-4 w-4" />
                    ) : (
                        <AlertTriangle className="h-4 w-4" />
                    )}
                    <AlertTitle>{saveStatus.type === "success" ? "Saved" : "Error"}</AlertTitle>
                    <AlertDescription>{saveStatus.message}</AlertDescription>
                </Alert>
            )}

            {/* Global Config Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Global Settings</CardTitle>
                    <CardDescription>
                        Enable RBAC and set the fallback behaviour when no specific rule matches.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <Label htmlFor="rbac-enabled" className="text-base font-medium">
                                Enable Role-Based Access Control
                            </Label>
                            <p className="text-sm text-muted-foreground mt-1">
                                When disabled, only users with Manage Server can access the dashboard.
                            </p>
                        </div>
                        <Switch
                            id="rbac-enabled"
                            checked={enabled}
                            onCheckedChange={setEnabled}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="default-access">Default Behaviour</Label>
                        <p className="text-sm text-muted-foreground">
                            What happens when a user has no matching rule for a module.
                        </p>
                        <Select
                            value={defaultAccess}
                            onValueChange={(v) => setDefaultAccess(v as "manage_guild_only" | "deny")}
                            disabled={!enabled}
                        >
                            <SelectTrigger id="default-access" className="w-full md:w-72">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="manage_guild_only">
                                    Require Manage Server (default)
                                </SelectItem>
                                <SelectItem value="deny">Deny All</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Per-Module Rules */}
            <Card>
                <CardHeader>
                    <CardTitle>Module Permissions</CardTitle>
                    <CardDescription>
                        Configure which Discord roles can view or edit each module. Leave empty to use the
                        default behaviour above.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Legend */}
                    <div className="flex flex-col sm:flex-row gap-3 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4 shrink-0" />
                            <span><strong>View</strong> — read-only access to a module.</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Pencil className="h-4 w-4 shrink-0" />
                            <span><strong>Edit</strong> — full access (automatically includes View).</span>
                        </div>
                    </div>

                    {MODULES.map((mod) => {
                        const rule = rules.get(mod.id);
                        const viewRoles = rule?.allowedViewRoles ?? [];
                        const editRoles = rule?.allowedEditRoles ?? [];

                        return (
                            <div key={mod.id} className="border rounded-lg p-4 space-y-4">
                                <div>
                                    <p className="font-medium">{mod.name}</p>
                                    <p className="text-sm text-muted-foreground">{mod.description}</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                                            <Eye className="h-3 w-3" /> View Roles
                                        </Label>
                                        <MultiSelect
                                            options={roleOptions}
                                            values={viewRoles}
                                            onChange={(vals) =>
                                                setModuleRoles(mod.id, "allowedViewRoles", vals)
                                            }
                                            placeholder="No restriction"
                                            disabled={!enabled}
                                            maxCount={5}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                                            <Pencil className="h-3 w-3" /> Edit Roles <span className="normal-case">(includes View)</span>
                                        </Label>
                                        <MultiSelect
                                            options={roleOptions}
                                            values={editRoles}
                                            onChange={(vals) =>
                                                setModuleRoles(mod.id, "allowedEditRoles", vals)
                                            }
                                            placeholder="No restriction"
                                            disabled={!enabled}
                                            maxCount={5}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving} size="lg">
                    {isSaving ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving…
                        </>
                    ) : (
                        <>
                            <Save className="mr-2 h-4 w-4" />
                            Save Changes
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
