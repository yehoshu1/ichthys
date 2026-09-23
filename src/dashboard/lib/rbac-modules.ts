/**
 * Canonical list of RBAC module IDs used by the dashboard access-control system.
 *
 * Each ID corresponds to the API path segment immediately after
 * /api/guilds/[guildId]/ — e.g. the "welcome" module is served at
 * /api/guilds/[guildId]/welcome.
 *
 * The list is derived from the shared module registry (@shared/modules/registry)
 * so the module system and the RBAC system cannot drift apart:
 *  - registry IDs use underscores (role_actions) while API path segments use
 *    hyphens (role-actions), so IDs are converted with a 1:1 mapping.
 *  - 'core' is not RBAC-manageable (it is the un-delegatable entry layer), and
 *    'settings_backups' maps to the 'settings' RBAC module.
 *
 * Keep this file free of server-only imports so Next.js can safely bundle it
 * in both server (API routes) and client (settings page) contexts.
 */
import { MODULE_MANIFESTS } from "@shared/modules/registry";

const CORE_API_MODULES = new Set(["core"]);

function registryIdToApiModuleId(registryId: string): string | null {
    if (CORE_API_MODULES.has(registryId)) return null;

    // 'settings_backups' is exposed to RBAC as the 'settings' module.
    if (registryId === "settings_backups") return "settings";

    return registryId.replace(/_/g, "-");
}

function deriveRbacModuleIds(): string[] {
    const ids: string[] = [];
    const seen = new Set<string>();

    for (const manifest of MODULE_MANIFESTS) {
        const apiModuleId = registryIdToApiModuleId(manifest.id);
        if (!apiModuleId || seen.has(apiModuleId)) continue;
        seen.add(apiModuleId);
        ids.push(apiModuleId);
    }

    // RBAC modules that have no dedicated registry manifest yet (API-scoped
    // features). Keep alphabetical and remove entries as manifests appear.
    for (const extra of ["boosts", "commands"] as const) {
        if (!seen.has(extra)) {
            seen.add(extra);
            ids.push(extra);
        }
    }

    return ids.sort((a, b) => a.localeCompare(b));
}

export const RBAC_MODULE_IDS = deriveRbacModuleIds() as unknown as readonly [
    string,
    ...string[]
];

export type RbacModuleId = (typeof RBAC_MODULE_IDS)[number];
