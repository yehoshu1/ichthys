import { eq, and } from 'drizzle-orm';
import { db } from '@shared/database/client';
import {
    webhookEndpoint,
    webhookDelivery,
    WebhookEndpoint,
} from '@shared/database/schema';
import logger from '../utils/logger';
import crypto from 'crypto';
import {
    decryptWebhookSecret,
    validateWebhookUrl,
} from '@shared/utils/webhook-security';

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export interface WebhookPayload {
    event: string;
    timestamp: string;
    guildId: string;
    data: Record<string, unknown>;
}

export class WebhookService {
    /**
     * Trigger webhooks for a specific event type in a guild
     */
    async triggerEvent(
        guildId: string,
        eventType: string,
        data: Record<string, unknown>
    ): Promise<void> {
        try {
            // Find all enabled webhooks that subscribe to this event type
            const webhooks = await db
                .select()
                .from(webhookEndpoint)
                .where(and(
                    eq(webhookEndpoint.guildId, guildId),
                    eq(webhookEndpoint.enabled, true)
                ));

            // Filter webhooks that are interested in this event type
            const matchingWebhooks = webhooks.filter(wh =>
                wh.eventTypes.includes(eventType) || wh.eventTypes.includes('*')
            );

            if (matchingWebhooks.length === 0) return;

            const payload: WebhookPayload = {
                event: eventType,
                timestamp: new Date().toISOString(),
                guildId,
                data,
            };

            // Fire webhooks asynchronously (don't block the main operation)
            for (const webhook of matchingWebhooks) {
                this.deliverWebhook(webhook, payload).catch(error => {
                    logger.error(`Failed to deliver webhook ${webhook.id}:`, error);
                });
            }
        } catch (error) {
            logger.error('Error triggering webhooks:', error);
            // Don't throw - webhooks shouldn't break main functionality
        }
    }

    /**
     * Deliver a webhook payload to an endpoint
     */
    private async deliverWebhook(
        webhook: WebhookEndpoint,
        payload: WebhookPayload
    ): Promise<void> {
        const startTime = Date.now();

        const urlValidation = await validateWebhookUrl(webhook.url);
        if (!urlValidation.ok) {
            await this.recordFailure(webhook.id, `Unsafe webhook URL: ${urlValidation.error}`);
            return;
        }

        // Generate signature if secret is configured
        const rawSecret = decryptWebhookSecret(webhook.secret);
        const signature = rawSecret
            ? crypto
                  .createHmac('sha256', rawSecret)
                  .update(JSON.stringify(payload))
                  .digest('hex')
            : null;

        // Record delivery attempt
        const [delivery] = await db.insert(webhookDelivery).values({
            webhookId: webhook.id,
            eventType: payload.event,
            payload,
            requestStartedAt: new Date(),
            success: false,
        }).returning();

        // Prepare headers
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'User-Agent': 'IxoyeBot/1.0 WebhookDelivery',
            'X-Webhook-Event': payload.event,
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
                signal: AbortSignal.timeout(30000), // 30 second timeout
                redirect: 'manual',
            });

            const responseBody = await response.text();

            // Update delivery record
            await db
                .update(webhookDelivery)
                .set({
                    statusCode: response.status,
                    responseBody: responseBody.slice(0, 10000), // Limit size
                    requestCompletedAt: new Date(),
                    success: response.status >= 200 && response.status < 300,
                    error: response.status >= 200 && response.status < 300
                        ? null
                        : `HTTP ${response.status}`,
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
                    .where(eq(webhookEndpoint.id, webhook.id));

                logger.debug(`Webhook ${webhook.id} delivered successfully (${Date.now() - startTime}ms)`);
            } else {
                await this.recordFailure(webhook.id, `HTTP ${response.status}`);
                logger.warn(`Webhook ${webhook.id} failed with status ${response.status}`);
            }
        } catch (error: any) {
            const errorMessage = error.message || 'Network error';

            // Update delivery record
            await db
                .update(webhookDelivery)
                .set({
                    requestCompletedAt: new Date(),
                    success: false,
                    error: errorMessage,
                })
                .where(eq(webhookDelivery.id, delivery.id));

            await this.recordFailure(webhook.id, errorMessage);
            logger.warn(`Webhook ${webhook.id} delivery failed: ${errorMessage}`);
        }
    }

    /**
     * Record a webhook failure and disable if too many failures
     */
    private async recordFailure(webhookId: string, error: string): Promise<void> {
        const [webhook] = await db
            .select()
            .from(webhookEndpoint)
            .where(eq(webhookEndpoint.id, webhookId));

        if (!webhook) return;

        const newFailureCount = webhook.failureCount + 1;
        const shouldDisable = newFailureCount >= 10;

        await db
            .update(webhookEndpoint)
            .set({
                lastFailureAt: new Date(),
                failureCount: newFailureCount,
                enabled: shouldDisable ? false : webhook.enabled,
                updatedAt: new Date(),
            })
            .where(eq(webhookEndpoint.id, webhookId));

        if (shouldDisable) {
            logger.error(`Webhook ${webhookId} disabled after ${newFailureCount} failures: ${error}`);
        }
    }

    /**
     * Test a webhook by sending a test payload
     */
    async testWebhook(webhookId: string): Promise<{ success: boolean; message: string }> {
        const [webhook] = await db
            .select()
            .from(webhookEndpoint)
            .where(eq(webhookEndpoint.id, webhookId));

        if (!webhook) {
            return { success: false, message: 'Webhook not found' };
        }

        const testPayload: WebhookPayload = {
            event: 'webhook.test',
            timestamp: new Date().toISOString(),
            guildId: webhook.guildId,
            data: {
                test: true,
                message: 'This is a test webhook delivery',
            },
        };

        try {
            await this.deliverWebhook(webhook, testPayload);
            return { success: true, message: 'Test webhook sent successfully' };
        } catch (error: any) {
            return { success: false, message: error.message || 'Failed to send test webhook' };
        }
    }
}

export const webhookService = new WebhookService();
