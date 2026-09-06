import { NextRequest, NextResponse } from 'next/server';
import { db, apiKey } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import logger from '@/lib/logger';
import crypto from 'crypto';
import { z } from 'zod';
import { requireGuildManageAccess } from '@/lib/guild-auth';
import { parseJsonBody } from '@/lib/validation';

const apiPermissionSchema = z.union([
    z.literal('*'),
    z.literal('events:read'),
    z.literal('events:write'),
    z.literal('polls:read'),
    z.literal('polls:write'),
    z.literal('webhooks:read'),
    z.literal('webhooks:write'),
]);

const createApiKeySchema = z.object({
    name: z.string().trim().min(1).max(100),
    permissions: z.array(apiPermissionSchema).min(1).max(50),
    expiresAt: z.string().datetime().optional(),
}).strict().superRefine((value, ctx) => {
    const unique = new Set(value.permissions);
    if (unique.size !== value.permissions.length) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["permissions"],
            message: "permissions must not contain duplicates",
        });
    }

    if (unique.has('*') && unique.size > 1) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["permissions"],
            message: "'*' cannot be combined with other permissions",
        });
    }
});

// Generate a secure API key
function generateApiKey(): string {
    return 'ix_' + crypto.randomBytes(32).toString('hex');
}

// Hash an API key
function hashApiKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
}

function toPublicApiKey(row: typeof apiKey.$inferSelect) {
    return {
        id: row.id,
        guildId: row.guildId,
        name: row.name,
        permissions: row.permissions,
        createdBy: row.createdBy,
        enabled: row.enabled,
        lastUsedAt: row.lastUsedAt,
        useCount: row.useCount,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

// GET /api/guilds/[guildId]/api-keys - List API keys
export async function GET(
    request: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    try {
        const { guildId: guildIdRaw } = await props.params;
        if (!guildIdRaw) {
            return NextResponse.json({ error: 'Guild ID is required' }, { status: 400 });
        }
        const guildId = guildIdRaw;
        const auth = await requireGuildManageAccess(guildId, request);
        if ('response' in auth) {
            return auth.response;
        }

        const keys = await db
            .select()
            .from(apiKey)
            .where(eq(apiKey.guildId, guildId))
            .orderBy(desc(apiKey.createdAt));

        return NextResponse.json(keys.map(toPublicApiKey));
    } catch (error) {
        logger.error('Error fetching API keys:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/guilds/[guildId]/api-keys - Create API key
export async function POST(
    request: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    try {
        const { guildId: guildIdRaw } = await props.params;
        if (!guildIdRaw) {
            return NextResponse.json({ error: 'Guild ID is required' }, { status: 400 });
        }
        const guildId = guildIdRaw;
        const auth = await requireGuildManageAccess(guildId, request);
        if ('response' in auth) {
            return auth.response;
        }

        const parsed = await parseJsonBody(request, createApiKeySchema);
        if (!parsed.success) return parsed.response;
        const body = parsed.data;

        // Generate key (only shown once)
        const key = generateApiKey();
        const keyHash = hashApiKey(key);

        const [created] = await db
            .insert(apiKey)
            .values({
                guildId: guildId as string,
                name: body.name,
                keyHash: keyHash,
                permissions: body.permissions,
                createdBy: auth.userId,
                enabled: true,
                expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
            })
            .returning();

        // Return the key only once
        return NextResponse.json({
            ...toPublicApiKey(created),
            key,
        });
    } catch (error) {
        logger.error('Error creating API key:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
