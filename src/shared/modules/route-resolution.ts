import { MODULE_MANIFESTS, type ModuleId } from './registry';

interface CompiledModuleRoute {
    moduleId: ModuleId;
    manifestRoute: string;
    regex: RegExp;
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

const COMPILED_ROUTES: CompiledModuleRoute[] = MODULE_MANIFESTS.flatMap((manifest) =>
    manifest.routes.map((route) => ({
        moduleId: manifest.id,
        manifestRoute: route,
        regex: compileManifestRoute(route),
    }))
);

export function resolveModuleForApiPath(pathname: string): ModuleId | null {
    const normalized = pathname.replace(/\/$/, '');
    const matches = COMPILED_ROUTES
        .filter((entry) => entry.regex.test(normalized))
        .sort((a, b) => b.manifestRoute.length - a.manifestRoute.length);

    return matches[0]?.moduleId ?? null;
}
