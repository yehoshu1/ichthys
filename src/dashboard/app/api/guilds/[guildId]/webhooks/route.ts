import { NextRequest, NextResponse } from 'next/server';
import { db, webhookEndpoint } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import logger from '@/lib/logger';
import { z } from 'zod';
import { authorizeGuildApiRequest } from '@/lib/guild-api-auth';
import { parseJsonBody } from '@/lib/validation';
import {
    validateWebhookUrl,
    encryptWebhookSecret,
    maskSecretForResponse,
} from '@shared/utils/webhook-security';

// Max lengths for webhook fields
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

const createWebhookSchema = z.object({
    name: z.string().trim().min(1).max(MAX_WEBHOOK_NAME_LENGTH),
    url: z.string().trim().min(1).max(MAX_WEBHOOK_URL_LENGTH),
    eventTypes: z.array(webhookEventSchema).min(1).max(30),
    enabled: z.boolean().optional(),
    secret: z.string().max(MAX_WEBHOOK_SECRET_LENGTH).optional(),
}).strict();

function toPublicWebhook(row: typeof webhookEndpoint.$inferSelect) {
    return {
        ...row,
        secret: maskSecretForResponse(row.secret),
    };
}

// GET /api/guilds/[guildId]/webhooks - List webhooks
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
        const auth = await authorizeGuildApiRequest(request, guildId, 'webhooks:read');
        if ('response' in auth) {
            return auth.response;
        }

        const webhooks = await db
            .select()
            .from(webhookEndpoint)
            .where(eq(webhookEndpoint.guildId, guildId))
            .orderBy(desc(webhookEndpoint.createdAt));

        return NextResponse.json(webhooks.map(toPublicWebhook));
    } catch (error) {
        logger.error('Error fetching webhooks:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/guilds/[guildId]/webhooks - Create webhook
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
        const auth = await authorizeGuildApiRequest(request, guildId, 'webhooks:write');
        if ('response' in auth) {
            return auth.response;
        }

        const parsed = await parseJsonBody(request, createWebhookSchema);
        if (!parsed.success) return parsed.response;
        const body = parsed.data;

        const validation = await validateWebhookUrl(body.url);
        if (!validation.ok) {
            return NextResponse.json({ error: validation.error }, { status: 400 });
        }

        let encryptedSecret = null;
        if (body.secret) {
            encryptedSecret = encryptWebhookSecret(String(body.secret));
        }

        const [webhook] = await db
            .insert(webhookEndpoint)
            .values({
                guildId: guildId as string,
                name: body.name,
                url: body.url,
                secret: encryptedSecret,
                eventTypes: body.eventTypes,
                enabled: body.enabled ?? true,
            })
            .returning();

        return NextResponse.json(toPublicWebhook(webhook));
    } catch (error) {
        logger.error('Error creating webhook:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
