import { and, eq } from 'drizzle-orm';
import crypto from 'crypto';
import { db, webhookEndpoint, webhookDelivery } from '@/lib/db';
import logger from '@/lib/logger';
import { decryptWebhookSecret, validateWebhookUrl } from '@shared/utils/webhook-security';

interface WebhookPayload {
    event: string;
    timestamp: string;
    guildId: string;
    data: Record<string, unknown>;
}

export async function dispatchGuildWebhookEvent(
    guildId: string,
    eventType: string,
    data: Record<string, unknown>
): Promise<void> {
    try {
        const webhooks = await db
            .select()
            .from(webhookEndpoint)
            .where(and(
                eq(webhookEndpoint.guildId, guildId),
                eq(webhookEndpoint.enabled, true)
            ));

        const matching = webhooks.filter((webhook) =>
            webhook.eventTypes.includes(eventType) || webhook.eventTypes.includes('*')
        );

        if (matching.length === 0) return;

        const payload: WebhookPayload = {
            event: eventType,
            timestamp: new Date().toISOString(),
            guildId,
            data,
        };

        await Promise.all(
            matching.map(async (webhook) => {
                const validation = await validateWebhookUrl(webhook.url);
                if (!validation.ok) {
                    logger.warn(`Skipping unsafe webhook URL for ${webhook.id}: ${validation.error}`);
                    return;
                }

                const [delivery] = await db.insert(webhookDelivery).values({
                    webhookId: webhook.id,
                    eventType,
                    payload,
                    requestStartedAt: new Date(),
                    success: false,
                }).returning();

                const rawSecret = decryptWebhookSecret(webhook.secret);
                const signature = rawSecret
                    ? crypto.createHmac('sha256', rawSecret).update(JSON.stringify(payload)).digest('hex')
                    : null;

                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    'User-Agent': 'IxoyeDashboard/1.0 WebhookDelivery',
                    'X-Webhook-Event': eventType,
                    'X-Webhook-ID': webhook.id,
                    'X-Webhook-Delivery': delivery.id,
                };
                if (signature) {
                    headers['X-Webhook-Signature'] = `sha256=${signature}`;
                }

                try {
                    const response = await fetch(webhook.url, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(payload),
                        signal: AbortSignal.timeout(30000),
                        redirect: 'manual',
                    });
                    const responseBody = await response.text();

                    await db
                        .update(webhookDelivery)
                        .set({
                            statusCode: response.status,
                            responseBody: responseBody.slice(0, 10000),
                            requestCompletedAt: new Date(),
                            success: response.status >= 200 && response.status < 300,
                            error: response.status >= 200 && response.status < 300 ? null : `HTTP ${response.status}`,
                        })
                        .where(eq(webhookDelivery.id, delivery.id));
                } catch (error) {
                    await db
                        .update(webhookDelivery)
                        .set({
                            requestCompletedAt: new Date(),
                            success: false,
                            error: String((error as Error)?.message || error),
                        })
                        .where(eq(webhookDelivery.id, delivery.id));
                }
            })
        );
    } catch (error) {
        logger.error('Failed to dispatch webhook event from dashboard route:', error);
    }
}
