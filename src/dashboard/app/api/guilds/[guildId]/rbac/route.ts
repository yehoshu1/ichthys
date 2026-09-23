import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, dashboardRbacConfig, dashboardRbacRules } from "@/lib/db";
import { eq } from "drizzle-orm";
import { requireGuildManageStrictAccess } from "@/lib/guild-auth";
import { RBAC_MODULE_IDS } from "@/lib/rbac-modules";
import { invalidateRbacCache } from "@/lib/rbac";
import logger from "@/lib/logger";
import { emitGuildNotification } from "@shared/services/notification-service";

function getRbacStorageError(error: unknown): string | null {
    const message = error instanceof Error ? error.message : String(error);
    if (
        message.includes('dashboard_rbac_config') ||
        message.includes('dashboard_rbac_rules') ||
        message.includes('rbac_default_access')
    ) {
        return "Access control storage is not ready. Run the latest database migrations.";
    }

    return null;
}

// ─── Validation Schemas ────────────────────────────────────────────────────────

// Discord snowflake IDs are 17–20 digits (matches guild-ID validation elsewhere).
const roleIdSchema = z.string().regex(/^\d{17,20}$/, "Invalid Discord role ID");

const rbacRuleSchema = z.object({
    // Only known module IDs are accepted; unknown strings are rejected.
    moduleId: z.enum(RBAC_MODULE_IDS),
    allowedViewRoles: z.array(roleIdSchema).default([]),
    allowedEditRoles: z.array(roleIdSchema).default([]),
});

const rbacConfigSchema = z.object({
    enabled: z.boolean(),
    defaultAccess: z.enum(["manage_guild_only", "deny"]),
    rules: z.array(rbacRuleSchema).default([]),
});

// ─── Discord Role Fetcher ──────────────────────────────────────────────────────

interface DiscordRole {
    id: string;
    name: string;
    position: number;
    permissions: string;
    color: number;
}

async function fetchGuildRoles(guildId: string): Promise<DiscordRole[]> {
    const botToken = process.env.DISCORD_TOKEN;
    if (!botToken) return [];

    try {
        const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
            headers: { Authorization: `Bot ${botToken}` },
            cache: "no-store",
        });

        if (!response.ok) {
            logger.warn("Failed to fetch guild roles", { status: response.status, guildId });
            return [];
        }

        const roles = await response.json() as DiscordRole[];
        return roles
            .filter((r) => r.name !== "@everyone")
            .sort((a, b) => b.position - a.position);
    } catch (error) {
        logger.warn("Error fetching guild roles", {
            error: error instanceof Error ? error.message : String(error),
            guildId,
        });
        return [];
    }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * GET /api/guilds/[guildId]/rbac
 *
 * Returns current RBAC config, module rules, and the list of guild Discord roles.
 * Requires strict MANAGE_GUILD — not delegatable via RBAC.
 */
export async function GET(
    req: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    const params = await props.params;
    const { guildId } = params;

    const auth = await requireGuildManageStrictAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const [config] = await db
            .select()
            .from(dashboardRbacConfig)
            .where(eq(dashboardRbacConfig.guildId, guildId))
            .limit(1);

        const rules = config
            ? await db
                  .select()
                  .from(dashboardRbacRules)
                  .where(eq(dashboardRbacRules.guildId, guildId))
            : [];

        const discordRoles = await fetchGuildRoles(guildId);

        return NextResponse.json({
            config: config ?? null,
            rules,
            discordRoles,
            // Synthetic @everyone entry so the UI can offer "all members" in rules.
            everyoneRoleId: guildId,
        });
    } catch (error) {
        logger.error("Error fetching RBAC config", {
            error: error instanceof Error ? error.message : String(error),
            guildId,
        });
        const storageError = getRbacStorageError(error);
        if (storageError) {
            return NextResponse.json({ error: storageError }, { status: 503 });
        }
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/**
 * PUT /api/guilds/[guildId]/rbac
 *
 * Upserts RBAC config and replaces all module rules atomically.
 * Requires strict MANAGE_GUILD — not delegatable via RBAC.
 */
export async function PUT(
    req: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    const params = await props.params;
    const { guildId } = params;

    const auth = await requireGuildManageStrictAccess(guildId, req);
    if ("response" in auth) return auth.response;

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = rbacConfigSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid request body", details: parsed.error.format() },
            { status: 400 }
        );
    }

    const { enabled, defaultAccess, rules } = parsed.data;

    try {
        await db.transaction(async (tx) => {
            // Upsert config
            await tx
                .insert(dashboardRbacConfig)
                .values({
                    guildId,
                    enabled,
                    defaultAccess,
                    updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                    target: dashboardRbacConfig.guildId,
                    set: {
                        enabled,
                        defaultAccess,
                        updatedAt: new Date(),
                    },
                });

            // Delete existing rules and re-insert
            await tx
                .delete(dashboardRbacRules)
                .where(eq(dashboardRbacRules.guildId, guildId));

            if (rules.length > 0) {
                await tx.insert(dashboardRbacRules).values(
                    rules.map((rule) => ({
                        guildId,
                        moduleId: rule.moduleId,
                        allowedViewRoles: rule.allowedViewRoles,
                        allowedEditRoles: rule.allowedEditRoles,
                    }))
                );
            }
        });

        // Ensure permission changes take effect immediately.
        invalidateRbacCache(guildId);

        // Audit trail: RBAC changes are security-sensitive and must be
        // observable. Failures here are logged but do not fail the request.
        emitGuildNotification({
            guildId,
            eventType: 'DASHBOARD_SETTINGS_CHANGED',
            severity: 'WARNING',
            source: 'DASHBOARD_API',
            title: enabled ? 'Access control updated' : 'Access control disabled',
            body: `Access control ${enabled ? 'enabled' : 'disabled'} (default: ${defaultAccess}); ${rules.length} module rule(s) saved.`,
            actorUserId: auth.userId,
            metadata: {
                enabled,
                defaultAccess,
                ruleCount: rules.length,
                moduleIds: rules.map((r) => r.moduleId),
            },
            dedupeKey: `dashboard-rbac-updated:${guildId}`,
            dedupeWindowSeconds: 60,
        }).catch((err) => {
            logger.warn('Failed to emit RBAC audit notification', {
                error: err instanceof Error ? err.message : String(err),
                guildId,
            });
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error("Error saving RBAC config", {
            error: error instanceof Error ? error.message : String(error),
            guildId,
        });
        const storageError = getRbacStorageError(error);
        if (storageError) {
            return NextResponse.json({ error: storageError }, { status: 503 });
        }
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
