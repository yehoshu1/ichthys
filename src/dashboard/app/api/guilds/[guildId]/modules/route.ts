import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireGuildManageAccess } from '@/lib/guild-auth';
import logger from '@/lib/logger';
import { MODULE_IDS, MODULE_MANIFEST_MAP, type ModuleId } from '@shared/modules/registry';
import { getGuildModuleStates } from '@shared/modules/state';
import { setGuildModuleStateWithAudit } from '@shared/modules/admin';

const updateModuleSchema = z.object({
    moduleId: z.enum(MODULE_IDS),
    enabled: z.boolean(),
}).strict();

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    const { guildId } = await props.params;

    const auth = await requireGuildManageAccess(guildId, req);
    if ('response' in auth) return auth.response;

    try {
        const states = await getGuildModuleStates(guildId);
        return NextResponse.json({
            modules: states.map((state) => ({
                ...state,
                name: MODULE_MANIFEST_MAP.get(state.moduleId)?.name ?? state.moduleId,
                description: MODULE_MANIFEST_MAP.get(state.moduleId)?.description ?? null,
            })),
        });
    } catch (error) {
        logger.error('Error fetching module states', { guildId, error });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    const { guildId } = await props.params;

    const auth = await requireGuildManageAccess(guildId, req);
    if ('response' in auth) return auth.response;

    let payload: { moduleId: ModuleId; enabled: boolean };
    try {
        const body = await req.json();
        const parsed = updateModuleSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid request body', details: parsed.error.issues },
                { status: 400 }
            );
        }
        payload = parsed.data;
    } catch (error) {
        logger.error('Failed to parse module update payload', { guildId, error });
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    try {
        const updated = await setGuildModuleStateWithAudit({
            guildId,
            moduleId: payload.moduleId,
            enabled: payload.enabled,
            actorUserId: auth.userId,
            source: 'dashboard_api',
        });
        return NextResponse.json({ module: updated });
    } catch (error) {
        if (error instanceof Error && error.message.includes('cannot be disabled')) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        logger.error('Error updating module state', { guildId, payload, error });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
