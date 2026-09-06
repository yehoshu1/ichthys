import { NextRequest, NextResponse } from "next/server";
import { requireSession, getGuildInfoForUser } from "@/lib/guild-auth";
import {
    evaluateRbacBatch,
    resolveTrustTier,
} from "@/lib/rbac";
import { RBAC_MODULE_IDS, type RbacModuleId } from "@/lib/rbac-modules";
import logger from "@/lib/logger";

interface ModuleAccess {
    view: boolean;
    edit: boolean;
}

interface AccessResponse {
    isBypassUser: boolean;
    /** True for owner / admin / manage-guild: can open the Access Control page. */
    canManageRbac: boolean;
    modules: Record<RbacModuleId, ModuleAccess>;
}

/**
 * GET /api/guilds/[guildId]/me/access
 *
 * Returns the authenticated user's view/edit access for each dashboard module.
 *  - Bypass users (owner / ADMINISTRATOR) get full access to everything.
 *  - Manage-Guild users are governed by the RBAC config: with the
 *    `manage_guild_only` default they get full access on modules without
 *    explicit rules; with `deny` they are evaluated like members.
 *  - Members are evaluated purely by RBAC rules.
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

    const tier = resolveTrustTier(guild ?? undefined);
    const isBypassUser = tier === "bypass";
    const canManageRbac = tier !== "member";

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
        canManageRbac,
        modules: moduleResults as Record<RbacModuleId, ModuleAccess>,
    };
    return NextResponse.json(response);
}
