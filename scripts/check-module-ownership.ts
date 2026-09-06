import fs from 'fs';
import path from 'path';
import { MODULE_MANIFESTS } from '../src/shared/modules/registry';

const DASHBOARD_APP_ROOT = path.resolve(process.cwd(), 'src/dashboard/app');
const GUILD_ROUTE_ROOT = path.resolve(process.cwd(), 'src/dashboard/app/api/guilds/[guildId]');
const JOBS_DIR = path.resolve(process.cwd(), 'src/bot/jobs');

interface CompiledRoute {
    moduleId: string;
    route: string;
    regex: RegExp;
}

function collectFiles(dir: string, predicate: (file: string) => boolean): string[] {
    if (!fs.existsSync(dir)) return [];

    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...collectFiles(fullPath, predicate));
            continue;
        }

        if (entry.isFile() && predicate(entry.name)) {
            results.push(fullPath);
        }
    }

    return results;
}

function toApiRoute(filePath: string): string {
    const rel = path.relative(DASHBOARD_APP_ROOT, filePath);
    const normalized = rel.replace(/\\/g, '/');
    return `/${normalized.replace(/\/route\.ts$/, '')}`;
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileManifestRoute(route: string): RegExp {
    const normalized = route.replace(/\/$/, '');
    const isExactGuildRoot = normalized === '/api/guilds/[guildId]';

    const pattern = normalized
        .split('/')
        .map((segment) => {
            if (!segment) return '';
            if (segment.startsWith('[') && segment.endsWith(']')) {
                return '[^/]+';
            }
            return escapeRegex(segment);
        })
        .join('/');

    if (isExactGuildRoot) {
        return new RegExp(`^${pattern}$`);
    }

    return new RegExp(`^${pattern}(?:/|$)`);
}

function listRouteOwnershipFailures(): string[] {
    const routeFiles = collectFiles(GUILD_ROUTE_ROOT, (name) => name === 'route.ts');
    const compiledRoutes: CompiledRoute[] = MODULE_MANIFESTS.flatMap((manifest) =>
        manifest.routes.map((route) => ({
            moduleId: manifest.id,
            route,
            regex: compileManifestRoute(route),
        }))
    ).filter((compiled) => compiled.route.startsWith('/api/guilds/[guildId]/') || compiled.route === '/api/guilds/[guildId]');

    const failures: string[] = [];

    for (const routeFile of routeFiles) {
        const routePath = toApiRoute(routeFile);
        const matches = compiledRoutes.filter((compiled) => compiled.regex.test(routePath));
        const content = fs.readFileSync(routeFile, 'utf8');

        if (matches.length === 0) {
            failures.push(
                `${path.relative(process.cwd(), routeFile)} is not claimed by any module manifest route.`
            );
            continue;
        }

        if (matches.length > 1) {
            failures.push(
                `${path.relative(process.cwd(), routeFile)} matches multiple module routes: ${matches.map((m) => `${m.moduleId}:${m.route}`).join(', ')}`
            );
            continue;
        }

        const hasAccessGuard = /requireGuildManageAccess\(|requireGuildManageRolesAccess\(|authorizeGuildApiRequest\(|requireGuildModuleEnabled\(/.test(content);
        if (!hasAccessGuard) {
            failures.push(
                `${path.relative(process.cwd(), routeFile)} is module-owned but has no recognized access/module guard call.`
            );
        }
    }

    for (const compiled of compiledRoutes) {
        const hasOwner = routeFiles.some((file) => compiled.regex.test(toApiRoute(file)));
        if (!hasOwner) {
            failures.push(
                `Module ${compiled.moduleId} declares route ${compiled.route} but no matching route.ts file exists.`
            );
        }
    }

    return failures;
}

function listJobOwnershipFailures(): string[] {
    const jobFiles = collectFiles(JOBS_DIR, (name) => name.endsWith('.ts'));
    const jobFileNames = new Set(jobFiles.map((file) => path.basename(file, '.ts')));

    const jobOwners = new Map<string, string[]>();
    for (const manifest of MODULE_MANIFESTS) {
        for (const jobName of manifest.jobs) {
            const owners = jobOwners.get(jobName) ?? [];
            owners.push(manifest.id);
            jobOwners.set(jobName, owners);
        }
    }

    const failures: string[] = [];

    for (const [jobName, owners] of jobOwners.entries()) {
        if (owners.length > 1) {
            failures.push(`Job ${jobName} is assigned to multiple modules: ${owners.join(', ')}`);
        }

        if (!jobFileNames.has(jobName)) {
            failures.push(`Manifest declares job ${jobName} but src/bot/jobs/${jobName}.ts does not exist.`);
            continue;
        }

        const moduleId = owners[0];
        if (moduleId !== 'core') {
            const jobFilePath = path.resolve(JOBS_DIR, `${jobName}.ts`);
            const content = fs.readFileSync(jobFilePath, 'utf8');
            const guardRegex = new RegExp(
                `isModuleEnabled\\([\\s\\S]*['"]${moduleId}['"]`,
                'm'
            );
            if (!guardRegex.test(content)) {
                failures.push(
                    `Job src/bot/jobs/${jobName}.ts is owned by ${moduleId} but does not contain isModuleEnabled(..., '${moduleId}') guard.`
                );
            }
        }
    }

    for (const fileName of jobFileNames) {
        if (!jobOwners.has(fileName)) {
            failures.push(`Job file src/bot/jobs/${fileName}.ts is not owned by any module manifest.`);
        }
    }

    return failures;
}

function main(): void {
    const failures = [
        ...listRouteOwnershipFailures(),
        ...listJobOwnershipFailures(),
    ];

    if (failures.length === 0) {
        console.log('✅ Module ownership checks passed for routes and jobs.');
        return;
    }

    console.error('❌ Module ownership checks failed:\n');
    for (const failure of failures) {
        console.error(`- ${failure}`);
    }

    process.exit(1);
}

main();
