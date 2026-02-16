import fs from 'fs';
import path from 'path';
import { MODULE_MANIFESTS, type ModuleId } from '../src/shared/modules/registry';

const GUARDED_MODULES = new Set<ModuleId>(['events', 'polls']);
const ROUTES_ROOT = path.resolve(process.cwd(), 'src/dashboard/app/api/guilds/[guildId]');

interface GuardExpectation {
    moduleId: ModuleId;
    routePrefix: string;
}

function collectRouteFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const results: string[] = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...collectRouteFiles(fullPath));
            continue;
        }

        if (entry.isFile() && entry.name === 'route.ts') {
            results.push(fullPath);
        }
    }

    return results;
}

function toApiRoutePrefix(route: string): string {
    return route.replace(/\/$/, '');
}

function toFileApiRoute(filePath: string): string {
    const rel = path.relative(path.resolve(process.cwd(), 'src/dashboard/app'), filePath);
    const withoutRouteSuffix = rel.replace(/\/route\.ts$/, '');
    return `/${withoutRouteSuffix.replace(/\\/g, '/')}`;
}

function getGuardExpectations(): GuardExpectation[] {
    const expectations: GuardExpectation[] = [];

    for (const manifest of MODULE_MANIFESTS) {
        if (!GUARDED_MODULES.has(manifest.id)) continue;
        for (const route of manifest.routes) {
            if (!route.startsWith('/api/guilds/[guildId]/')) continue;
            expectations.push({
                moduleId: manifest.id,
                routePrefix: toApiRoutePrefix(route),
            });
        }
    }

    return expectations;
}

function findExpectedModule(routePath: string, expectations: GuardExpectation[]): GuardExpectation | null {
    const matches = expectations
        .filter((expectation) => routePath.startsWith(expectation.routePrefix))
        .sort((a, b) => b.routePrefix.length - a.routePrefix.length);

    return matches[0] ?? null;
}

function hasModuleGuard(content: string, moduleId: ModuleId): boolean {
    const guardRegex = new RegExp(
        `requireGuildModuleEnabled\\(\\s*guildId\\s*,\\s*['"]${moduleId}['"]\\s*\\)`,
        'm'
    );

    return content.includes('requireGuildModuleEnabled') && guardRegex.test(content);
}

function main(): void {
    const routeFiles = collectRouteFiles(ROUTES_ROOT);
    const expectations = getGuardExpectations();
    const failures: string[] = [];

    for (const filePath of routeFiles) {
        const routePath = toFileApiRoute(filePath);
        const expectation = findExpectedModule(routePath, expectations);
        if (!expectation) continue;

        const content = fs.readFileSync(filePath, 'utf8');
        if (!hasModuleGuard(content, expectation.moduleId)) {
            failures.push(
                `${path.relative(process.cwd(), filePath)} should enforce requireGuildModuleEnabled(guildId, '${expectation.moduleId}')`
            );
        }
    }

    if (failures.length === 0) {
        console.log('✅ Module guard checks passed for events/polls routes.');
        return;
    }

    console.error('❌ Module guard check failed:\n');
    for (const failure of failures) {
        console.error(`- ${failure}`);
    }

    process.exit(1);
}

main();
