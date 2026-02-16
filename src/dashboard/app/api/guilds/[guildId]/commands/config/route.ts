import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireGuildManageAccess } from '@/lib/guild-auth';
import logger from '@/lib/logger';
import { isDiscordId, normalizeDiscordIdList } from '@/lib/validation';
import { db } from '@shared/database/client';
import { commandConfig } from '@shared/database/schema';
import {
    normalizeUniqueList,
    parseCsvList,
    serializeCsvList,
} from '@shared/command-config';
import { getCanonicalCommandIds, getCanonicalCommandIdSet } from '@shared/command-catalog';

const updateCommandConfigSchema = z.object({
    commandId: z.string(),
    enabledRoles: z.array(z.string()).default([]),
    disabledRoles: z.array(z.string()).default([]),
    enabledChannels: z.array(z.string()).default([]),
    disabledChannels: z.array(z.string()).default([]),
    rolesCanSkipMaxLimit: z.array(z.string()).default([]),
    maxLimit: z.number().int().min(1).nullable().optional(),
    autoDeleteInvocation: z.boolean().default(false),
    autoDeleteReplyAfterSeconds: z.number().int().min(0).max(86400).nullable().optional(),
    autoDeleteWithInvocationDeletion: z.boolean().default(false),
}).strict();

function sanitizeDiscordIdField(
    fieldName: string,
    incomingValues: string[],
    existingStoredCsv: string[] | string | null | undefined,
    warnings: string[]
): { ok: true; normalized: string[] } | { ok: false; error: string } {
    const normalizedIncoming = normalizeUniqueList(incomingValues);
    const normalized = normalizeDiscordIdList(normalizedIncoming);
    const normalizedSet = new Set(normalized);
    const invalidIncoming = normalizedIncoming.filter((value) => !normalizedSet.has(value));

    if (invalidIncoming.length === 0) {
        return { ok: true, normalized };
    }

    const legacyInvalid = new Set(
        parseCsvList(existingStoredCsv).filter((value) => !isDiscordId(value))
    );
    const newInvalid = invalidIncoming.filter((value) => !legacyInvalid.has(value));

    if (newInvalid.length > 0) {
        return {
            ok: false,
            error: `Invalid Discord IDs in ${fieldName}: ${newInvalid.join(', ')}`,
        };
    }

    warnings.push(
        `Dropped ${invalidIncoming.length} legacy invalid ID${invalidIncoming.length === 1 ? '' : 's'} from ${fieldName}.`
    );
    return { ok: true, normalized };
}

function toApiConfig(row: typeof commandConfig.$inferSelect) {
    return {
        guildId: row.guildId,
        commandId: row.commandId,
        enabledRoles: parseCsvList(row.enabledRoles),
        disabledRoles: parseCsvList(row.disabledRoles),
        enabledChannels: parseCsvList(row.enabledChannels),
        disabledChannels: parseCsvList(row.disabledChannels),
        rolesCanSkipMaxLimit: parseCsvList(row.rolesCanSkipMaxLimit),
        maxLimit: row.maxLimit,
        autoDeleteInvocation: row.autoDeleteInvocation,
        autoDeleteReplyAfterSeconds: row.autoDeleteReplyAfterSeconds,
        autoDeleteWithInvocationDeletion: row.autoDeleteWithInvocationDeletion,
        updatedAt: row.updatedAt,
    };
}





export async function GET(
    req: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    const params = await props.params;
    const { guildId } = params;

    const auth = await requireGuildManageAccess(guildId, req);
    if ('response' in auth) return auth.response;

    try {
        const commandIds = getCanonicalCommandIds();
        const configs = await db
            .select()
            .from(commandConfig)
            .where(eq(commandConfig.guildId, guildId));

        return NextResponse.json({
            commands: commandIds,
            configs: configs.map(toApiConfig),
        });
    } catch (error) {
        logger.error('Error fetching command configuration', { guildId, error });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    const params = await props.params;
    const { guildId } = params;

    const auth = await requireGuildManageAccess(guildId, req);
    if ('response' in auth) return auth.response;

    let payload: z.infer<typeof updateCommandConfigSchema>;
    try {
        const body = await req.json();
        logger.debug('Command config update request', { guildId, body });
        
        const parsed = updateCommandConfigSchema.safeParse(body);
        if (!parsed.success) {
            logger.warn('Command config validation failed', { 
                guildId, 
                issues: parsed.error.issues,
                receivedBody: body 
            });
            return NextResponse.json(
                { error: 'Invalid request body', details: parsed.error.issues },
                { status: 400 }
            );
        }
        payload = parsed.data;
    } catch (error) {
        logger.error('Failed to parse command config request body', { guildId, error });
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const commandId = payload.commandId.trim().toLowerCase();
    if (!getCanonicalCommandIdSet().has(commandId)) {
        return NextResponse.json(
            { error: `Unknown command "${payload.commandId}"` },
            { status: 400 }
        );
    }

    try {
        const existingConfigs = await db
            .select()
            .from(commandConfig)
            .where(eq(commandConfig.guildId, guildId));

        const existingConfig = existingConfigs.find((config) => config.commandId === commandId);

        const cleanupWarnings: string[] = [];
        const enabledRoles = sanitizeDiscordIdField(
            'enabledRoles',
            payload.enabledRoles,
            existingConfig?.enabledRoles,
            cleanupWarnings
        );
        if (!enabledRoles.ok) {
            return NextResponse.json({ error: enabledRoles.error }, { status: 400 });
        }

        const disabledRoles = sanitizeDiscordIdField(
            'disabledRoles',
            payload.disabledRoles,
            existingConfig?.disabledRoles,
            cleanupWarnings
        );
        if (!disabledRoles.ok) {
            return NextResponse.json({ error: disabledRoles.error }, { status: 400 });
        }

        const enabledChannels = sanitizeDiscordIdField(
            'enabledChannels',
            payload.enabledChannels,
            existingConfig?.enabledChannels,
            cleanupWarnings
        );
        if (!enabledChannels.ok) {
            return NextResponse.json({ error: enabledChannels.error }, { status: 400 });
        }

        const disabledChannels = sanitizeDiscordIdField(
            'disabledChannels',
            payload.disabledChannels,
            existingConfig?.disabledChannels,
            cleanupWarnings
        );
        if (!disabledChannels.ok) {
            return NextResponse.json({ error: disabledChannels.error }, { status: 400 });
        }

        const rolesCanSkipMaxLimit = sanitizeDiscordIdField(
            'rolesCanSkipMaxLimit',
            payload.rolesCanSkipMaxLimit,
            existingConfig?.rolesCanSkipMaxLimit,
            cleanupWarnings
        );
        if (!rolesCanSkipMaxLimit.ok) {
            return NextResponse.json({ error: rolesCanSkipMaxLimit.error }, { status: 400 });
        }

        const normalizedConfig = {
            enabledRoles: serializeCsvList(enabledRoles.normalized),
            disabledRoles: serializeCsvList(disabledRoles.normalized),
            enabledChannels: serializeCsvList(enabledChannels.normalized),
            disabledChannels: serializeCsvList(disabledChannels.normalized),
            rolesCanSkipMaxLimit: serializeCsvList(rolesCanSkipMaxLimit.normalized),
            maxLimit: payload.maxLimit ?? null,
            autoDeleteInvocation: payload.autoDeleteInvocation,
            autoDeleteReplyAfterSeconds: payload.autoDeleteReplyAfterSeconds ?? null,
            autoDeleteWithInvocationDeletion: payload.autoDeleteWithInvocationDeletion,
        };

        await db.insert(commandConfig)
            .values({
                guildId,
                commandId,
                ...normalizedConfig,
            })
            .onConflictDoUpdate({
                target: [commandConfig.guildId, commandConfig.commandId],
                set: {
                    ...normalizedConfig,
                    updatedAt: new Date(),
                },
            });

        const [updated] = await db
            .select()
            .from(commandConfig)
            .where(and(
                eq(commandConfig.guildId, guildId),
                eq(commandConfig.commandId, commandId),
            ))
            .limit(1);

        const responsePayload: { config: ReturnType<typeof toApiConfig>; warning?: string } = {
            config: toApiConfig(updated),
        };
        if (cleanupWarnings.length > 0) {
            responsePayload.warning = cleanupWarnings.join(' ');
        }

        return NextResponse.json(responsePayload);
    } catch (error) {
        logger.error('Error updating command configuration', { guildId, commandId, error });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    const params = await props.params;
    const { guildId } = params;

    const auth = await requireGuildManageAccess(guildId, req);
    if ('response' in auth) return auth.response;

    const { searchParams } = new URL(req.url);
    const commandIdRaw = searchParams.get('commandId');
    if (!commandIdRaw) {
        return NextResponse.json({ error: 'commandId query parameter is required' }, { status: 400 });
    }

    const commandId = commandIdRaw.trim().toLowerCase();
    if (!getCanonicalCommandIdSet().has(commandId)) {
        return NextResponse.json({ error: `Unknown command "${commandIdRaw}"` }, { status: 400 });
    }

    try {
        await db.delete(commandConfig)
            .where(and(
                eq(commandConfig.guildId, guildId),
                eq(commandConfig.commandId, commandId),
            ));

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('Error deleting command configuration', { guildId, commandId, error });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
