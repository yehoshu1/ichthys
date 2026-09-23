import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Architectural guard-rail: every route file under app/api/guilds/[guildId]/
 * must call an authorization guard. This prevents new routes from shipping
 * without auth (the API surface is too large for manual review to catch).
 *
 * A route passes when its source contains one of:
 *  - requireGuildManageAccess / Strict / Roles variants
 *  - requireGuildEntryAccess (entry-gated shell routes)
 *  - requireSession (session-only endpoints like /me/access)
 *  - authorizeGuildApiRequest (API-key or session auth)
 */
const GUARD_PATTERNS = [
    'requireGuildManageAccess',
    'requireGuildManageStrictAccess',
    'requireGuildManageRolesAccess',
    'requireGuildEntryAccess',
    'requireSession',
    'authorizeGuildApiRequest',
];

const ROUTES_DIR = join(process.cwd(), 'src', 'dashboard', 'app', 'api', 'guilds', '[guildId]');

function listRouteFiles(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            out.push(...listRouteFiles(full));
        } else if (name === 'route.ts') {
            out.push(full);
        }
    }
    return out;
}

describe('guild API route guard coverage', () => {
    const routeFiles = listRouteFiles(ROUTES_DIR);

    it('discovers route files', () => {
        expect(routeFiles.length).toBeGreaterThan(40);
    });

    it('every guild route calls an authorization guard', () => {
        const unguarded = routeFiles.filter((file) => {
            const source = readFileSync(file, 'utf8');
            return !GUARD_PATTERNS.some((p) => source.includes(p));
        });

        expect(
            unguarded,
            `Routes missing an auth guard:\n${unguarded.join('\n')}`
        ).toEqual([]);
    });
});
