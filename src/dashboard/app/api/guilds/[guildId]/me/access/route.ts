import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/guild-auth";
import { getGuildInfoForUser } from "@/lib/guild-auth";
import { evaluateRbac, isHardBypassUser } from "@/lib/rbac";
import logger from "@/lib/logger";

// The definitive list of modules exposed for RBAC evaluation.
// These map to the API path segment immediately after /api/guilds/[guildId]/.
const RBAC_MODULES = [
    "welcome",
    "verification",
    "leveling",
    "boosts",
    "birthdays",
    "role-actions",
    "aliases",
    "commands",
    "moderation",
    "settings",
    "webhooks",
    "events",
    "polls",
    "notifications",
    "analytics",
] as const;

type RbacModuleId = (typeof RBAC_MODULES)[number];

interface ModuleAccess {
    view: boolean;
    edit: boolean;
}

interface AccessResponse {
    isBypassUser: boolean;
    modules: Record<RbacModuleId, ModuleAccess>;
}

/**
 * GET /api/guilds/[guildId]/me/access
 *
 * Returns the authenticated user's view/edit access for each dashboard module.
 * Hard-bypass users (owner / ADMINISTRATOR / MANAGE_GUILD) get full access to
 * everything.  All others are evaluated via the RBAC system.
 */
export async function GET(
    req: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    const params = await props.params;
    const { guildId } = params;

    const sessionResult = await requireSession(req);
    if ("response" in sessionResult) {
        return sessionResult.response;
    }

    const { userId, accessToken } = sessionResult;

    let guild;
    try {
        guild = await getGuildInfoForUser(userId, accessToken, guildId);
    } catch (error) {
        logger.error("Failed to fetch guild info for /me/access", {
            error: error instanceof Error ? error.message : String(error),
            guildId,
            userId,
        });
        return NextResponse.json({ error: "Failed to fetch guild permissions" }, { status: 503 });
    }

    const isBypassUser = isHardBypassUser(guild ?? undefined);

    // Build module access map
    const modules = {} as Record<RbacModuleId, ModuleAccess>;

    if (isBypassUser) {
        for (const moduleId of RBAC_MODULES) {
            modules[moduleId] = { view: true, edit: true };
        }
    } else {
        await Promise.all(
            RBAC_MODULES.map(async (moduleId) => {
                const [canView, canEdit] = await Promise.all([
                    evaluateRbac(guildId, userId, moduleId, "view", guild ?? undefined).catch((err) => {
                        logger.warn("RBAC view evaluation failed", { moduleId, guildId, userId, error: err instanceof Error ? err.message : String(err) });
                        return false;
                    }),
                    evaluateRbac(guildId, userId, moduleId, "edit", guild ?? undefined).catch((err) => {
                        logger.warn("RBAC edit evaluation failed", { moduleId, guildId, userId, error: err instanceof Error ? err.message : String(err) });
                        return false;
                    }),
                ]);
                modules[moduleId] = { view: canView, edit: canEdit };
            })
        );
    }

    const response: AccessResponse = { isBypassUser, modules };
    return NextResponse.json(response);
}
