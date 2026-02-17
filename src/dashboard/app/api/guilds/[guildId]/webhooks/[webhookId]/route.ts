import { NextRequest, NextResponse } from 'next/server';
import { db, webhookEndpoint } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import logger from '@/lib/logger';
import { authorizeGuildApiRequest } from '@/lib/guild-api-auth';
import {
    validateWebhookUrl,
    encryptWebhookSecret,
    maskSecretForResponse,
} from '@shared/utils/webhook-security';

const MAX_WEBHOOK_NAME_LENGTH = 100;
const MAX_WEBHOOK_URL_LENGTH = 500;

function toPublicWebhook(row: typeof webhookEndpoint.$inferSelect) {
    return {
        ...row,
        secret: maskSecretForResponse(row.secret),
    };
}

// PATCH /api/guilds/[guildId]/webhooks/[webhookId] - Update webhook
export async function PATCH(
    request: NextRequest,
    props: { params: Promise<{ guildId: string; webhookId: string }> }
) {
    try {
        const { guildId, webhookId } = await props.params;
        const auth = await authorizeGuildApiRequest(request, guildId, 'webhooks:write');
        if ('response' in auth) {
            return auth.response;
        }
        const body = await request.json();

        // Check if webhook exists
        const [existing] = await db
            .select()
            .from(webhookEndpoint)
            .where(and(
                eq(webhookEndpoint.id, webhookId),
                eq(webhookEndpoint.guildId, guildId)
            ));

        if (!existing) {
            return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
        }

        // Validate name if provided
        if (body.name !== undefined) {
            if (body.name.length > MAX_WEBHOOK_NAME_LENGTH) {
                return NextResponse.json(
                    { error: `Name cannot exceed ${MAX_WEBHOOK_NAME_LENGTH} characters` },
                    { status: 400 }
                );
            }
        }

        // Validate URL if provided
        if (body.url !== undefined) {
            if (body.url.length > MAX_WEBHOOK_URL_LENGTH) {
                return NextResponse.json(
                    { error: `URL cannot exceed ${MAX_WEBHOOK_URL_LENGTH} characters` },
                    { status: 400 }
                );
            }

            const validation = await validateWebhookUrl(body.url as string);
            if (!validation.ok) {
                return NextResponse.json({ error: validation.error }, { status: 400 });
            }
        }

        // Build update object
        const updateData: Partial<typeof webhookEndpoint.$inferInsert> = {
            updatedAt: new Date(),
        };

        if (body.name !== undefined) updateData.name = body.name;
        if (body.url !== undefined) updateData.url = body.url;
        if (body.eventTypes !== undefined) updateData.eventTypes = body.eventTypes;
        if (body.enabled !== undefined) updateData.enabled = body.enabled;

        // Handle secret update
        if (body.secret) {
            updateData.secret = encryptWebhookSecret(String(body.secret));
        }

        const [updated] = await db
            .update(webhookEndpoint)
            .set(updateData)
            .where(eq(webhookEndpoint.id, webhookId))
            .returning();

        return NextResponse.json(toPublicWebhook(updated));
    } catch (error) {
        logger.error('Error updating webhook:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/guilds/[guildId]/webhooks/[webhookId] - Delete webhook
export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ guildId: string; webhookId: string }> }
) {
    try {
        const { guildId, webhookId } = await props.params;
        const auth = await authorizeGuildApiRequest(request, guildId, 'webhooks:write');
        if ('response' in auth) {
            return auth.response;
        }

        // Check if webhook exists
        const [existing] = await db
            .select()
            .from(webhookEndpoint)
            .where(and(
                eq(webhookEndpoint.id, webhookId),
                eq(webhookEndpoint.guildId, guildId)
            ));

        if (!existing) {
            return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
        }

        await db.delete(webhookEndpoint).where(eq(webhookEndpoint.id, webhookId));

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('Error deleting webhook:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
