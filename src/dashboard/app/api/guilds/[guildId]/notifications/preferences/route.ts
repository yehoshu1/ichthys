import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, notificationPreference } from "@/lib/db";
import { requireGuildManageAccess } from "@/lib/guild-auth";
import logger from "@/lib/logger";
import { parseJsonBody } from "@/lib/validation";
import {
    type NotificationDigestMode,
    type NotificationSeverity,
    isGuildNotificationEventType,
    isNotificationDigestMode,
    isNotificationSeverity,
} from "@shared/notifications/events";
import { emitGuildNotification } from "@shared/services/notification-service";

const preferencePatchSchema = z.object({
    eventType: z.string().min(1),
    enabled: z.boolean().optional(),
    minSeverity: z.string().optional(),
    inAppEnabled: z.boolean().optional(),
    discordChannelEnabled: z.boolean().optional(),
    discordChannelId: z.string().nullable().optional(),
    webhookEnabled: z.boolean().optional(),
    webhookUrl: z.string().url().nullable().optional(),
    digestMode: z.string().optional(),
}).strict();

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;

    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const preferences = await db.select()
            .from(notificationPreference)
            .where(eq(notificationPreference.guildId, guildId))
            .orderBy(asc(notificationPreference.eventType));

        return NextResponse.json(preferences);
    } catch (error) {
        logger.error("Error fetching notification preferences", {
            guildId,
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json({ error: "Failed to fetch notification preferences" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;

    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    const parsedResult = await parseJsonBody(req, preferencePatchSchema);
    if (!parsedResult.success) return parsedResult.response;
    const parsed = parsedResult.data;

    if (!isGuildNotificationEventType(parsed.eventType)) {
        return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
    }

    if (parsed.minSeverity && !isNotificationSeverity(parsed.minSeverity)) {
        return NextResponse.json({ error: "Invalid minSeverity" }, { status: 400 });
    }

    if (parsed.digestMode && !isNotificationDigestMode(parsed.digestMode)) {
        return NextResponse.json({ error: "Invalid digestMode" }, { status: 400 });
    }

    try {
        const now = new Date();
        const [existing] = await db.select()
            .from(notificationPreference)
            .where(and(
                eq(notificationPreference.guildId, guildId),
                eq(notificationPreference.eventType, parsed.eventType),
            ))
            .limit(1);

        const minSeverity: NotificationSeverity = parsed.minSeverity && isNotificationSeverity(parsed.minSeverity)
            ? parsed.minSeverity
            : existing?.minSeverity ?? "INFO";
        const digestMode: NotificationDigestMode = parsed.digestMode && isNotificationDigestMode(parsed.digestMode)
            ? parsed.digestMode
            : existing?.digestMode ?? "OFF";

        const values = {
            guildId,
            eventType: parsed.eventType,
            enabled: parsed.enabled ?? existing?.enabled ?? true,
            minSeverity,
            inAppEnabled: parsed.inAppEnabled ?? existing?.inAppEnabled ?? true,
            discordChannelEnabled: parsed.discordChannelEnabled ?? existing?.discordChannelEnabled ?? false,
            discordChannelId: parsed.discordChannelId ?? existing?.discordChannelId ?? null,
            webhookEnabled: parsed.webhookEnabled ?? existing?.webhookEnabled ?? false,
            webhookUrl: parsed.webhookUrl ?? existing?.webhookUrl ?? null,
            digestMode,
            updatedAt: now,
        } as const;

        if (values.discordChannelEnabled && !values.discordChannelId) {
            return NextResponse.json({ error: "discordChannelId is required when discordChannelEnabled is true" }, { status: 400 });
        }

        if (values.webhookEnabled && !values.webhookUrl) {
            return NextResponse.json({ error: "webhookUrl is required when webhookEnabled is true" }, { status: 400 });
        }

        await db.insert(notificationPreference).values(values).onConflictDoUpdate({
            target: [notificationPreference.guildId, notificationPreference.eventType],
            set: {
                enabled: values.enabled,
                minSeverity: values.minSeverity,
                inAppEnabled: values.inAppEnabled,
                discordChannelEnabled: values.discordChannelEnabled,
                discordChannelId: values.discordChannelId,
                webhookEnabled: values.webhookEnabled,
                webhookUrl: values.webhookUrl,
                digestMode: values.digestMode,
                updatedAt: now,
            },
        });

        await emitGuildNotification({
            guildId,
            eventType: 'DASHBOARD_SETTINGS_CHANGED',
            severity: 'INFO',
            source: 'DASHBOARD_API',
            title: `Notification preference updated for ${parsed.eventType}`,
            actorUserId: auth.userId,
            metadata: {
                module: 'notifications',
                changedEventType: parsed.eventType,
            },
            dedupeKey: `dashboard-settings-changed:notifications:${parsed.eventType}`,
            dedupeWindowSeconds: 120,
        });

        const [updated] = await db.select()
            .from(notificationPreference)
            .where(and(
                eq(notificationPreference.guildId, guildId),
                eq(notificationPreference.eventType, parsed.eventType),
            ))
            .limit(1);

        return NextResponse.json(updated);
    } catch (error) {
        logger.error("Error updating notification preference", {
            guildId,
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json({ error: "Failed to update notification preference" }, { status: 500 });
    }
}
