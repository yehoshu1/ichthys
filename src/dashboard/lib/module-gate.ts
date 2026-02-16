import { NextResponse } from 'next/server';
import type { ModuleId } from '@shared/modules/registry';
import { isModuleEnabled } from '@shared/modules/state';
import { resolveModuleForApiPath } from '@shared/modules/route-resolution';

export async function requireGuildModuleEnabled(
    guildId: string,
    moduleId: ModuleId
): Promise<NextResponse | null> {
    const enabled = await isModuleEnabled(guildId, moduleId);
    if (enabled) return null;

    return NextResponse.json(
        { error: `The ${moduleId.replace(/_/g, ' ')} module is disabled for this server.` },
        { status: 403 }
    );
}

export async function requireGuildModuleEnabledForPath(
    guildId: string,
    pathname: string
): Promise<NextResponse | null> {
    const moduleId = resolveModuleForApiPath(pathname);
    if (!moduleId || moduleId === 'core') {
        return null;
    }

    return requireGuildModuleEnabled(guildId, moduleId);
}
