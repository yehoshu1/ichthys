import fs from 'fs';
import path from 'path';
import {
    MODULE_MANIFEST_MAP,
    isValidModuleId,
    type ModuleId,
} from '../src/shared/modules/registry';

const ROOT = process.cwd();
const COMMANDS_DIR = path.resolve(ROOT, 'src/bot/commands');
const COMPONENTS_DIR = path.resolve(ROOT, 'src/bot/components');
const JOBS_DIR = path.resolve(ROOT, 'src/bot/jobs');
const DASHBOARD_APP_ROOT = path.resolve(ROOT, 'src/dashboard/app');
const API_ROUTE_ROOT = path.resolve(ROOT, 'src/dashboard/app/api');

function collectFiles(dir: string, predicate: (name: string) => boolean): string[] {
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

function extractCommandId(filePath: string): string | null {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/\.setName\('([^']+)'\)/);
    return match?.[1] ?? null;
}

function toRepoRelative(filePath: string): string {
    return path.relative(ROOT, filePath).replace(/\\/g, '/');
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

function toApiRoute(filePath: string): string {
    const rel = path.relative(DASHBOARD_APP_ROOT, filePath).replace(/\\/g, '/');
    return `/${rel.replace(/\/route\.ts$/, '')}`;
}

function printSection(title: string, rows: string[]): void {
    console.log(`\n${title}`);
    if (rows.length === 0) {
        console.log('- (none)');
        return;
    }

    for (const row of rows) {
        console.log(`- ${row}`);
    }
}

function run(moduleId: ModuleId): void {
    const manifest = MODULE_MANIFEST_MAP.get(moduleId);
    if (!manifest) {
        throw new Error(`Unknown module: ${moduleId}`);
    }

    const commandFiles = collectFiles(COMMANDS_DIR, (name) => name.endsWith('.ts'));
    const commandFileById = new Map<string, string>();
    for (const filePath of commandFiles) {
        const id = extractCommandId(filePath);
        if (!id) continue;
        commandFileById.set(id, toRepoRelative(filePath));
    }

    const matchedCommandFiles = manifest.commandIds
        .map((id) => `${id} -> ${commandFileById.get(id) ?? '(file not found)'}`);

    const componentFiles = collectFiles(COMPONENTS_DIR, (name) => name.endsWith('.ts'));
    const matchedComponentFiles = componentFiles
        .filter((filePath) => {
            const content = fs.readFileSync(filePath, 'utf8');
            return manifest.componentPrefixes.some((prefix) => content.includes(prefix));
        })
        .map((filePath) => toRepoRelative(filePath));

    const matchedJobFiles = manifest.jobs.map((job) => {
        const filePath = path.resolve(JOBS_DIR, `${job}.ts`);
        return `${job} -> ${fs.existsSync(filePath) ? toRepoRelative(filePath) : '(file not found)'}`;
    });

    const routeFiles = collectFiles(API_ROUTE_ROOT, (name) => name === 'route.ts');
    const routeMatchers = manifest.routes.map((route) => compileManifestRoute(route));
    const matchedRouteFiles = routeFiles
        .filter((filePath) => routeMatchers.some((regex) => regex.test(toApiRoute(filePath))))
        .map((filePath) => `${toApiRoute(filePath)} -> ${toRepoRelative(filePath)}`);

    console.log(`Module remove dry-run: ${manifest.name} (${manifest.id})`);
    console.log(`Description: ${manifest.description}`);
    console.log('No files were changed.');

    printSection('Commands', matchedCommandFiles);
    printSection('Component Prefixes', manifest.componentPrefixes);
    printSection('Component Handlers (matched by prefix usage)', matchedComponentFiles);
    printSection('Jobs', matchedJobFiles);
    printSection('Routes (matched route.ts files)', matchedRouteFiles);
    printSection('Tables', manifest.tables);
    printSection('Required Env', manifest.requiredEnv);
}

function main(): void {
    const rawModuleId = process.argv[2];
    if (!rawModuleId) {
        console.error('Usage: tsx scripts/module-remove-dry-run.ts <module-id>');
        process.exit(1);
    }

    if (!isValidModuleId(rawModuleId)) {
        console.error(`Unknown module id: ${rawModuleId}`);
        process.exit(1);
    }

    run(rawModuleId);
}

main();
