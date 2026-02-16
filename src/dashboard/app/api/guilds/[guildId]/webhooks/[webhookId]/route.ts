import { NextRequest, NextResponse } from 'next/server';
import { db, webhookEndpoint } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import logger from '@/lib/logger';
import { z } from 'zod';
import { authorizeGuildApiRequest } from '@/lib/guild-api-auth';
import { parseJsonBody } from '@/lib/validation';
import {
    validateWebhookUrl,
    encryptWebhookSecret,
    maskSecretForResponse,
} from '@shared/utils/webhook-security';

const MAX_WEBHOOK_NAME_LENGTH = 100;
const MAX_WEBHOOK_URL_LENGTH = 500;
const MAX_WEBHOOK_SECRET_LENGTH = 200;

const webhookEventSchema = z.enum([
    'event.created',
    'event.updated',
    'event.deleted',
    'event.started',
    'rsvp.yes',
    'rsvp.no',
    'rsvp.maybe',
    'rsvp.waitlist',
    'poll.created',
    'poll.voted',
    'poll.closed',
]);

const updateWebhookSchema = z.object({
    name: z.string().trim().min(1).max(MAX_WEBHOOK_NAME_LENGTH).optional(),
    url: z.string().trim().min(1).max(MAX_WEBHOOK_URL_LENGTH).optional(),
    eventTypes: z.array(webhookEventSchema).min(1).max(30).optional(),
    enabled: z.boolean().optional(),
    secret: z.string().max(MAX_WEBHOOK_SECRET_LENGTH).optional(),
}).strict();

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
        const parsed = await parseJsonBody(request, updateWebhookSchema);
        if (!parsed.success) return parsed.response;
        const body = parsed.data;

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

        if (body.url !== undefined) {
            const validation = await validateWebhookUrl(body.url);
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
