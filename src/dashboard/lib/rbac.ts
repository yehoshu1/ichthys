import { db, dashboardRbacConfig, dashboardRbacRules } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import logger from './logger';

// ─── Permission Constants ──────────────────────────────────────────────────────

const ADMINISTRATOR = 0x8n;
const MANAGE_GUILD = 0x20n;

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface DiscordGuildInfo {
    id: string;
    owner: boolean;
    permissions: string;
}

export type RbacAction = 'view' | 'edit';

// ─── Bot Member Role Cache ──────────────────────────────────────────────────────

interface MemberRolesCacheEntry {
    roles: string[];
    expiresAt: number;
}

const memberRolesCache = new Map<string, MemberRolesCacheEntry>();
const MEMBER_CACHE_TTL_MS = 60_000; // 60 seconds
const MAX_MEMBER_CACHE_ENTRIES = 5_000;

function cleanupMemberRolesCache(now: number): void {
    if (memberRolesCache.size <= MAX_MEMBER_CACHE_ENTRIES) return;
    for (const [key, entry] of memberRolesCache.entries()) {
        if (entry.expiresAt <= now) {
            memberRolesCache.delete(key);
        }
    }
}

/**
 * Fetch the role IDs for a guild member via the bot token.
 * Results are cached for 60 seconds to prevent Discord API rate limits.
 */
export async function fetchBotMemberRoles(guildId: string, userId: string): Promise<string[]> {
    const cacheKey = `${guildId}:${userId}`;
    const now = Date.now();
    cleanupMemberRolesCache(now);

    const cached = memberRolesCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
        return cached.roles;
    }

    const botToken = process.env.DISCORD_TOKEN;
    if (!botToken) {
        logger.warn('DISCORD_TOKEN not set; cannot fetch member roles for RBAC');
        return [];
    }

    try {
        const response = await fetch(
            `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
            {
                headers: { Authorization: `Bot ${botToken}` },
                cache: 'no-store',
            }
        );

        if (!response.ok) {
            logger.warn('Failed to fetch member roles from Discord', {
                status: response.status,
                guildId,
                userId,
            });
            return [];
        }

        const member = await response.json() as { roles?: string[] };
        const roles = Array.isArray(member.roles) ? member.roles : [];

        memberRolesCache.set(cacheKey, { roles, expiresAt: now + MEMBER_CACHE_TTL_MS });
        return roles;
    } catch (error) {
        logger.warn('Error fetching member roles for RBAC', {
            error: error instanceof Error ? error.message : String(error),
            guildId,
            userId,
        });
        return [];
    }
}

// ─── Hard Bypass Check ─────────────────────────────────────────────────────────

/**
 * Returns true if the user is a guild owner, has ADMINISTRATOR, or has MANAGE_GUILD.
 * These users have unrestricted access to all modules regardless of RBAC config.
 */
export function isHardBypassUser(guild: DiscordGuildInfo | undefined): boolean {
    if (!guild) return false;
    if (guild.owner) return true;

    const perms = BigInt(guild.permissions);
    if ((perms & ADMINISTRATOR) === ADMINISTRATOR) return true;
    if ((perms & MANAGE_GUILD) === MANAGE_GUILD) return true;

    return false;
}

// ─── Module ID Extraction ──────────────────────────────────────────────────────

/**
 * Extract the dashboard module ID from an API pathname.
 * Example: /api/guilds/123456/welcome/config → 'welcome'
 * Example: /api/guilds/123456/role-actions → 'role-actions'
 */
export function getModuleIdFromPath(pathname: string): string {
    const match = pathname.match(/^\/api\/guilds\/[^/]+\/([^/]+)/);
    return match?.[1] ?? 'core';
}

// ─── RBAC Evaluation ───────────────────────────────────────────────────────────

/**
 * Evaluate whether a user is permitted to perform `action` on `moduleId` in `guildId`.
 *
 * Evaluation order:
 *  A. Hard bypass (owner / ADMINISTRATOR / MANAGE_GUILD) → allow immediately
 *  B. Fetch dashboardRbacConfig; if missing or disabled → deny
 *  C. Fetch user's Discord role IDs via bot token
 *  D. Fetch dashboardRbacRules for (guildId, moduleId)
 *  E. If rule exists: check edit roles (edit implies view), then view roles
 *  F. If no rule: apply default_access (both options deny non-bypass users)
 */
export async function evaluateRbac(
    guildId: string,
    userId: string,
    moduleId: string,
    action: RbacAction,
    guild: DiscordGuildInfo | undefined
): Promise<boolean> {
    // Step A: Hard bypass
    if (isHardBypassUser(guild)) return true;

    // Step B: Fetch RBAC config
    const [config] = await db
        .select()
        .from(dashboardRbacConfig)
        .where(eq(dashboardRbacConfig.guildId, guildId))
        .limit(1);

    if (!config || !config.enabled) {
        return false;
    }

    // Step C: Fetch user's role IDs from Discord
    const userRoles = await fetchBotMemberRoles(guildId, userId);

    // Step D: Fetch rule for this module
    const [rule] = await db
        .select()
        .from(dashboardRbacRules)
        .where(
            and(
                eq(dashboardRbacRules.guildId, guildId),
                eq(dashboardRbacRules.moduleId, moduleId)
            )
        )
        .limit(1);

    // Step E: Rule exists — check role intersections
    if (rule) {
        const editRoles = rule.allowedEditRoles ?? [];
        const viewRoles = rule.allowedViewRoles ?? [];

        // Edit access (edit implies view)
        if (editRoles.some((r) => userRoles.includes(r))) return true;

        // View-only access
        if (action === 'view' && viewRoles.some((r) => userRoles.includes(r))) return true;

        return false;
    }

    // Step F: No rule — apply default_access (both values deny non-bypass users)
    return false;
}
