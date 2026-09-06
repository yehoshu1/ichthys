import { NextRequest, NextResponse } from 'next/server';
import { db, webhookEndpoint, webhookDelivery } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import logger from '@/lib/logger';
import crypto from 'crypto';
import { authorizeGuildApiRequest } from '@/lib/guild-api-auth';
import {
    decryptWebhookSecret,
    validateWebhookUrl,
} from '@shared/utils/webhook-security';

// POST /api/guilds/[guildId]/webhooks/[webhookId]/test - Send test webhook
export async function POST(
    request: NextRequest,
    props: { params: Promise<{ guildId: string; webhookId: string }> }
) {
    try {
        const { guildId, webhookId } = await props.params;
        const auth = await authorizeGuildApiRequest(request, guildId, 'webhooks:write');
        if ('response' in auth) {
            return auth.response;
        }

        // Check if webhook exists and belongs to guild
        const [webhook] = await db
            .select()
            .from(webhookEndpoint)
            .where(and(
                eq(webhookEndpoint.id, webhookId),
                eq(webhookEndpoint.guildId, guildId)
            ));

        if (!webhook) {
            return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
        }

        const urlValidation = await validateWebhookUrl(webhook.url);
        if (!urlValidation.ok) {
            return NextResponse.json({ error: `Unsafe webhook URL: ${urlValidation.error}` }, { status: 400 });
        }

        // Create test payload
        const testPayload = {
            event: 'webhook.test',
            timestamp: new Date().toISOString(),
            guildId: guildId,
            webhookId: webhookId,
            message: 'This is a test webhook delivery',
            data: {
                test: true,
                triggeredBy: auth.userId,
            },
        };

        // Generate signature if secret is configured
        const rawSecret = decryptWebhookSecret(webhook.secret);
        const signature = rawSecret
            ? crypto
                  .createHmac('sha256', rawSecret)
                  .update(JSON.stringify(testPayload))
                  .digest('hex')
            : null;

        // Record delivery attempt start
        const [delivery] = await db
            .insert(webhookDelivery)
            .values({
                webhookId: webhookId,
                eventType: 'webhook.test',
                payload: testPayload,
                requestStartedAt: new Date(),
                success: false,
            })
            .returning();

        // Send the webhook
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'User-Agent': 'IxoyeBot/1.0 WebhookDelivery',
            'X-Webhook-Event': 'webhook.test',
            'X-Webhook-ID': webhookId,
            'X-Webhook-Delivery': delivery.id,
        };

        if (signature) {
            headers['X-Webhook-Signature'] = `sha256=${signature}`;
        }

        try {
            const response = await fetch(webhook.url, {
                method: 'POST',
                headers,
                body: JSON.stringify(testPayload),
                signal: AbortSignal.timeout(30000), // 30 second timeout
                redirect: 'manual',
            });

            const responseBody = await response.text();
            const completedAt = new Date();

            // Update delivery record
            await db
                .update(webhookDelivery)
                .set({
                    statusCode: response.status,
                    responseBody: responseBody.slice(0, 10000), // Limit response size
                    requestCompletedAt: completedAt,
                    success: response.status >= 200 && response.status < 300,
                    error: response.status >= 200 && response.status < 300 ? null : `HTTP ${response.status}`,
                })
                .where(eq(webhookDelivery.id, delivery.id));

            // Update webhook stats
            if (response.status >= 200 && response.status < 300) {
                await db
                    .update(webhookEndpoint)
                    .set({
                        lastSuccessAt: new Date(),
                        failureCount: 0,
                        updatedAt: new Date(),
                    })
                    .where(eq(webhookEndpoint.id, webhookId));

                return NextResponse.json({
                    success: true,
                    statusCode: response.status,
                    message: 'Test webhook delivered successfully',
                });
            } else {
                await db
                    .update(webhookEndpoint)
                    .set({
                        lastFailureAt: new Date(),
                        failureCount: webhook.failureCount + 1,
                        updatedAt: new Date(),
                    })
                    .where(eq(webhookEndpoint.id, webhookId));

                return NextResponse.json({
                    success: false,
                    statusCode: response.status,
                    message: `Test webhook failed with status ${response.status}`,
                }, { status: 502 });
            }
        } catch (fetchError: any) {
            const completedAt = new Date();

            // Update delivery record with error
            await db
                .update(webhookDelivery)
                .set({
                    requestCompletedAt: completedAt,
                    success: false,
                    error: fetchError.message || 'Network error',
                })
                .where(eq(webhookDelivery.id, delivery.id));

            // Update webhook stats
            await db
                .update(webhookEndpoint)
                .set({
                    lastFailureAt: new Date(),
                    failureCount: webhook.failureCount + 1,
                    updatedAt: new Date(),
                })
                .where(eq(webhookEndpoint.id, webhookId));

            return NextResponse.json({
                success: false,
                message: fetchError.message || 'Failed to deliver test webhook',
            }, { status: 502 });
        }
    } catch (error) {
        logger.error('Error sending test webhook:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
