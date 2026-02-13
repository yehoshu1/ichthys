import { NextRequest, NextResponse } from 'next/server';
import { db, webhookEndpoint } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import logger from '@/lib/logger';
import { authorizeGuildApiRequest } from '@/lib/guild-api-auth';
import {
    validateWebhookUrl,
    encryptWebhookSecret,
    maskSecretForResponse,
} from '@shared/utils/webhook-security';

// Max lengths for webhook fields
const MAX_WEBHOOK_NAME_LENGTH = 100;
const MAX_WEBHOOK_URL_LENGTH = 500;

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

        const body = await request.json();

        if (!body.name || !body.url || !body.eventTypes?.length) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Validate name length
        if (body.name.length > MAX_WEBHOOK_NAME_LENGTH) {
            return NextResponse.json(
                { error: `Name cannot exceed ${MAX_WEBHOOK_NAME_LENGTH} characters` },
                { status: 400 }
            );
        }

        // Validate URL length
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

        let encryptedSecret = null;
        if (body.secret) {
            encryptedSecret = encryptWebhookSecret(String(body.secret));
        }

        const [webhook] = await db
            .insert(webhookEndpoint)
            .values({
                guildId: guildId as string,
                name: body.name as string,
                url: body.url as string,
                secret: encryptedSecret,
                eventTypes: body.eventTypes as string[],
                enabled: body.enabled ?? true,
            })
            .returning();

        return NextResponse.json(toPublicWebhook(webhook));
    } catch (error) {
        logger.error('Error creating webhook:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
