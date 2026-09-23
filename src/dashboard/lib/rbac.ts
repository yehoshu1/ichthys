import { db, dashboardRbacConfig, dashboardRbacRules } from '@/lib/db';
import { eq } from 'drizzle-orm';
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
export type RbacDefaultAccess = 'manage_guild_only' | 'deny';

/**
 * Trust tiers for dashboard access.
 *
 *  - `bypass`  : guild owner or ADMINISTRATOR — always full access, RBAC never applies.
 *  - `manage`  : has MANAGE_GUILD (but not owner/admin) — governed by RBAC config:
 *                with `manage_guild_only` default they get view+edit on modules
 *                without explicit rules; with `deny` they need a rule like everyone else.
 *  - `member`  : everyone else — needs explicit RBAC rules granting access.
 */
export type TrustTier = 'bypass' | 'manage' | 'member';

export function resolveTrustTier(guild: DiscordGuildInfo | undefined): TrustTier {
    if (!guild) return 'member';
    if (guild.owner) return 'bypass';

    const perms = BigInt(guild.permissions);
    if ((perms & ADMINISTRATOR) === ADMINISTRATOR) return 'bypass';
    if ((perms & MANAGE_GUILD) === MANAGE_GUILD) return 'manage';

    return 'member';
}

/**
 * True only for guild owners and ADMINISTRATOR holders.
 *
 * Previously this also returned true for MANAGE_GUILD holders, which made the
 * `manage_guild_only` default-access setting unreachable (those users were
 * short-circuited in Step A before the fallback was ever evaluated) and made
 * RBAC rules meaningless for the Manage-Server tier. Use `resolveTrustTier`
 * or `isManageGuildUser` depending on the behaviour you need.
 */
export function isHardBypassUser(guild: DiscordGuildInfo | undefined): boolean {
    return resolveTrustTier(guild) === 'bypass';
}

/** True for guild owners, ADMINISTRATOR holders, and MANAGE_GUILD holders. */
export function isManageGuildUser(guild: DiscordGuildInfo | undefined): boolean {
    return resolveTrustTier(guild) !== 'member';
}

// ─── Bot Member Role Cache ──────────────────────────────────────────────────────

interface MemberRolesCacheEntry {
    roles: string[];
    expiresAt: number;
}

const memberRolesCache = new Map<string, MemberRolesCacheEntry>();
const MEMBER_CACHE_TTL_MS = 60_000; // 60 seconds
const MAX_MEMBER_CACHE_ENTRIES = 5_000;

/**
 * Evicts all expired entries, then — if still over capacity — removes the
 * entries that will expire soonest (i.e. those with the oldest cached data).
 *
 * Previously this only ran when the cache exceeded its maximum size, meaning
 * expired entries would persist indefinitely in low-traffic deployments and
 * grant stale permissions until the process restarted.
 */
function cleanupMemberRolesCache(now: number): void {
    // Always evict expired entries to enforce the 60-second TTL.
    for (const [key, entry] of memberRolesCache.entries()) {
        if (entry.expiresAt <= now) {
            memberRolesCache.delete(key);
        }
    }

    // If still over capacity after expiry cleanup, evict the entries that
    // expire soonest (they hold the oldest cached data).
    if (memberRolesCache.size > MAX_MEMBER_CACHE_ENTRIES) {
        const entries = Array.from(memberRolesCache.entries())
            .sort((a, b) => a[1].expiresAt - b[1].expiresAt);
        const overflow = memberRolesCache.size - MAX_MEMBER_CACHE_ENTRIES;
        for (let i = 0; i < overflow; i++) {
            memberRolesCache.delete(entries[i][0]);
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

/**
 * Build the effective role list used for RBAC rule matching.
 *
 * Discord's API does not include the @everyone role (the guild ID) in a
 * member's role list, so we inject it explicitly. This lets guilds express
 * "all members can view X" by adding the @everyone role to a rule.
 */
export function getUserRolesForRules(guildId: string, memberRoles: string[]): string[] {
    return [guildId, ...memberRoles];
}

// ─── RBAC Config Cache ─────────────────────────────────────────────────────────

interface RbacConfigCacheEntry {
    config: typeof dashboardRbacConfig.$inferSelect | null;
    rules: (typeof dashboardRbacRules.$inferSelect)[];
    expiresAt: number;
}

const rbacConfigCache = new Map<string, RbacConfigCacheEntry>();
const RBAC_CONFIG_CACHE_TTL_MS = 30_000; // 30 seconds
const MAX_RBAC_CONFIG_CACHE_ENTRIES = 2_000;

/**
 * Invalidate the cached RBAC config for a guild.
 * Must be called whenever RBAC config or rules are written (rbac route,
 * settings import) so permission changes take effect immediately.
 */
export function invalidateRbacCache(guildId: string): void {
    rbacConfigCache.delete(guildId);
}

/**
 * Whether RBAC is enabled for a guild. False when no config row exists or
 * the config is disabled. Cached alongside the config/rules state.
 */
export async function isRbacEnabled(guildId: string): Promise<boolean> {
    const state = await getRbacState(guildId);
    return !!state.config && state.config.enabled;
}

function cleanupRbacConfigCache(now: number): void {
    for (const [key, entry] of rbacConfigCache.entries()) {
        if (entry.expiresAt <= now) {
            rbacConfigCache.delete(key);
        }
    }

    if (rbacConfigCache.size > MAX_RBAC_CONFIG_CACHE_ENTRIES) {
        const entries = Array.from(rbacConfigCache.entries())
            .sort((a, b) => a[1].expiresAt - b[1].expiresAt);
        const overflow = rbacConfigCache.size - MAX_RBAC_CONFIG_CACHE_ENTRIES;
        for (let i = 0; i < overflow; i++) {
            rbacConfigCache.delete(entries[i][0]);
        }
    }
}

async function getRbacState(
    guildId: string
): Promise<RbacConfigCacheEntry> {
    const now = Date.now();
    cleanupRbacConfigCache(now);

    const cached = rbacConfigCache.get(guildId);
    if (cached && cached.expiresAt > now) {
        return cached;
    }

    const [config] = await db
        .select()
        .from(dashboardRbacConfig)
        .where(eq(dashboardRbacConfig.guildId, guildId))
        .limit(1);

    let rules: (typeof dashboardRbacRules.$inferSelect)[] = [];
    if (config) {
        rules = await db
            .select()
            .from(dashboardRbacRules)
            .where(eq(dashboardRbacRules.guildId, guildId));
    }

    const entry: RbacConfigCacheEntry = { config: config ?? null, rules, expiresAt: now + RBAC_CONFIG_CACHE_TTL_MS };
    rbacConfigCache.set(guildId, entry);
    return entry;
}

// ─── Access Resolution ─────────────────────────────────────────────────────────

export interface ModuleAccessResult {
    view: boolean;
    edit: boolean;
}

function resolveRuleAccess(rule: { allowedViewRoles?: string[] | null; allowedEditRoles?: string[] | null }, userRoles: string[]): ModuleAccessResult {
    const editRoles = rule.allowedEditRoles ?? [];
    const viewRoles = rule.allowedViewRoles ?? [];

    const canEdit = editRoles.some((r) => userRoles.includes(r));
    // Edit roles implicitly grant view access.
    const canView = canEdit || viewRoles.some((r) => userRoles.includes(r));

    return { view: canView, edit: canEdit };
}

/**
 * Resolve the fallback access for a module when no explicit RBAC rule exists.
 *
 * Semantics by trust tier:
 *  - `bypass`      : always view+edit (hard bypass).
 *  - `manage`      : view+edit when defaultAccess is `manage_guild_only`
 *                    (this is what makes the setting meaningful), deny when `deny`.
 *  - `member`      : always deny — members need an explicit rule.
 */
export function resolveDefaultModuleAccess(
    defaultAccess: RbacDefaultAccess,
    guild: DiscordGuildInfo | undefined
): ModuleAccessResult {
    const tier = resolveTrustTier(guild);

    if (tier === 'bypass') {
        return { view: true, edit: true };
    }

    if (tier === 'manage' && defaultAccess === 'manage_guild_only') {
        return { view: true, edit: true };
    }

    return { view: false, edit: false };
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
 *  A. Hard bypass (owner / ADMINISTRATOR) → allow immediately
 *  B. Fetch RBAC config; if missing or disabled → deny
 *  C. Fetch user's Discord role IDs via bot token (+ synthetic @everyone)
 *  D. Match rule for (guildId, moduleId) from cached config/rules
 *  E. If rule exists: check edit roles (edit implies view), then view roles
 *  F. If no rule exists: fall back to dashboardRbacConfig.defaultAccess,
 *     which now respects the Manage-Guild trust tier.
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

    // Step B: Fetch RBAC config (cached)
    const state = await getRbacState(guildId);
    if (!state.config || !state.config.enabled) {
        return false;
    }

    // Step C: Fetch user's role IDs from Discord
    const memberRoles = await fetchBotMemberRoles(guildId, userId);
    const userRoles = getUserRolesForRules(guildId, memberRoles);

    // Step D: Match rule for this module
    const rule = state.rules.find((r) => r.moduleId === moduleId);

    // Step E: Rule exists — check role intersections
    if (rule) {
        const access = resolveRuleAccess(rule, userRoles);
        return action === 'edit' ? access.edit : access.view;
    }

    // Step F: No rule — use configured fallback.
    const fallbackAccess = resolveDefaultModuleAccess(state.config.defaultAccess, guild);
    return action === 'edit' ? fallbackAccess.edit : fallbackAccess.view;
}

// ─── Batch RBAC Evaluation ─────────────────────────────────────────────────────

/**
 * Evaluate a user's access for multiple modules in a single operation.
 *
 * Config and rules are fetched once (with a 30-second cache) and the user's
 * Discord roles once (60-second cache), then everything is evaluated in memory.
 *
 * Use this in the /me/access endpoint to avoid O(n) database round-trips.
 */
export async function evaluateRbacBatch(
    guildId: string,
    userId: string,
    moduleIds: readonly string[],
    guild: DiscordGuildInfo | undefined
): Promise<Record<string, ModuleAccessResult>> {
    const allow = (): ModuleAccessResult => ({ view: true, edit: true });

    // Step A: Hard bypass — all modules get full access immediately.
    if (isHardBypassUser(guild)) {
        return Object.fromEntries(moduleIds.map((id) => [id, allow()]));
    }

    // Step B: Fetch RBAC config once (cached).
    const state = await getRbacState(guildId);
    if (!state.config || !state.config.enabled) {
        return Object.fromEntries(moduleIds.map((id) => [id, { view: false, edit: false }]));
    }

    // Step C: Fetch user's role IDs once (uses 60-second cache).
    const memberRoles = await fetchBotMemberRoles(guildId, userId);
    const userRoles = getUserRolesForRules(guildId, memberRoles);

    const rulesByModule = new Map(state.rules.map((r) => [r.moduleId, r]));

    // Step E/F: Evaluate each module against the fetched rules.
    const result: Record<string, ModuleAccessResult> = {};
    for (const moduleId of moduleIds) {
        const rule = rulesByModule.get(moduleId);

        if (!rule) {
            // Step F: No rule → use configured fallback (tier-aware).
            result[moduleId] = resolveDefaultModuleAccess(state.config.defaultAccess, guild);
            continue;
        }

        result[moduleId] = resolveRuleAccess(rule, userRoles);
    }

    return result;
}

/**
 * Evaluate access for every RBAC module using a single batched evaluation
 * and report whether the user has *any* view or edit access at all.
 *
 * Used by entry-gate routes (e.g. guild info) to decide whether a member
 * without Discord-level Manage Server permission should be allowed into the
 * dashboard at all.
 */
export async function evaluateRbacBatchHasAnyAccess(
    guildId: string,
    userId: string,
    moduleIds: readonly string[],
    guild: DiscordGuildInfo | undefined
): Promise<boolean> {
    if (isHardBypassUser(guild)) return true;

    const results = await evaluateRbacBatch(guildId, userId, moduleIds, guild);
    return Object.values(results).some((access) => access.view || access.edit);
}
