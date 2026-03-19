import { NextRequest, NextResponse } from "next/server";
import { requireSession, getGuildInfoForUser } from "@/lib/guild-auth";
import { evaluateRbacBatch, isHardBypassUser } from "@/lib/rbac";
import { RBAC_MODULE_IDS, type RbacModuleId } from "@/lib/rbac-modules";
import logger from "@/lib/logger";

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
 *
 * Uses evaluateRbacBatch to fetch config and all rules in a single DB round-trip
 * rather than issuing separate queries for each module.
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

    let moduleResults: Record<string, ModuleAccess>;

    if (isBypassUser) {
        // Bypass users get full access to every module without touching the DB.
        moduleResults = Object.fromEntries(
            RBAC_MODULE_IDS.map((id) => [id, { view: true, edit: true }])
        );
    } else {
        try {
            moduleResults = await evaluateRbacBatch(
                guildId,
                userId,
                RBAC_MODULE_IDS,
                guild ?? undefined
            );
        } catch (error) {
            logger.error("RBAC batch evaluation failed for /me/access", {
                error: error instanceof Error ? error.message : String(error),
                guildId,
                userId,
            });
            // Fail safe: deny all modules on unexpected error.
            moduleResults = Object.fromEntries(
                RBAC_MODULE_IDS.map((id) => [id, { view: false, edit: false }])
            );
        }
    }

    const response: AccessResponse = {
        isBypassUser,
        modules: moduleResults as Record<RbacModuleId, ModuleAccess>,
    };
    return NextResponse.json(response);
}
