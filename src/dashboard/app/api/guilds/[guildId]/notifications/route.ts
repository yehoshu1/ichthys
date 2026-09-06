import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { db, notificationEvent, notificationUserCursor, notificationUserState } from "@/lib/db";
import { requireGuildManageAccess } from "@/lib/guild-auth";
import { clampLimit } from "@/lib/validation";
import {
    type NotificationSeverity,
    isGuildNotificationEventType,
    isNotificationSeverity,
} from "@shared/notifications/events";
import logger from "@/lib/logger";

interface NotificationListItem {
    id: string;
    eventType: string;
    severity: string;
    source: string;
    title: string;
    body: string | null;
    actorUserId: string | null;
    targetUserId: string | null;
    entityType: string | null;
    entityId: string | null;
    metadata: unknown;
    occurrenceCount: number;
    occurredAt: Date;
    unread: boolean;
    readAt: Date | null;
    archivedAt: Date | null;
}

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;

    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    const { searchParams } = new URL(req.url);
    const limit = clampLimit(searchParams.get("limit"), 20, 1, 50);
    const cursorRaw = searchParams.get("cursor");
    const typeFilter = searchParams.get("type");
    const severityFilter = searchParams.get("severity");
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    let cursorDate: Date | null = null;
    if (cursorRaw) {
        const parsed = new Date(cursorRaw);
        if (Number.isNaN(parsed.getTime())) {
            return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
        }
        cursorDate = parsed;
    }

    if (typeFilter && !isGuildNotificationEventType(typeFilter)) {
        return NextResponse.json({ error: "Invalid type filter" }, { status: 400 });
    }

    if (severityFilter && !isNotificationSeverity(severityFilter)) {
        return NextResponse.json({ error: "Invalid severity filter" }, { status: 400 });
    }

    const safeTypeFilter = typeFilter && isGuildNotificationEventType(typeFilter) ? typeFilter : null;
    const safeSeverityFilter: NotificationSeverity | null = severityFilter && isNotificationSeverity(severityFilter)
        ? severityFilter
        : null;

    try {
        const whereClauses = [
            eq(notificationEvent.guildId, guildId),
            eq(notificationEvent.inAppVisible, true),
        ];

        if (cursorDate) {
            whereClauses.push(lt(notificationEvent.occurredAt, cursorDate));
        }
        if (safeTypeFilter) {
            whereClauses.push(eq(notificationEvent.eventType, safeTypeFilter));
        }
        if (safeSeverityFilter) {
            whereClauses.push(eq(notificationEvent.severity, safeSeverityFilter));
        }

        const fetchLimit = unreadOnly ? Math.min(limit * 5, 200) : limit + 1;
        const events = await db.select()
            .from(notificationEvent)
            .where(and(...whereClauses))
            .orderBy(desc(notificationEvent.occurredAt))
            .limit(fetchLimit);

        const notificationIds = events.map((event) => event.id);
        const userStates = notificationIds.length > 0
            ? await db.select()
                .from(notificationUserState)
                .where(and(
                    eq(notificationUserState.userId, auth.userId),
                    inArray(notificationUserState.notificationId, notificationIds),
                ))
            : [];

        const [cursor] = await db.select()
            .from(notificationUserCursor)
            .where(and(
                eq(notificationUserCursor.guildId, guildId),
                eq(notificationUserCursor.userId, auth.userId),
            ))
            .limit(1);

        const stateByNotificationId = new Map(userStates.map((state) => [state.notificationId, state]));
        const lastReadAt = cursor?.lastReadAt ?? null;

        const mapped: NotificationListItem[] = events.map((event) => {
            const state = stateByNotificationId.get(event.id);
            const isReadByCursor = Boolean(lastReadAt && event.occurredAt <= lastReadAt);
            const unread = !(state?.readAt || isReadByCursor);
            return {
                id: event.id,
                eventType: event.eventType,
                severity: event.severity,
                source: event.source,
                title: event.title,
                body: event.body,
                actorUserId: event.actorUserId,
                targetUserId: event.targetUserId,
                entityType: event.entityType,
                entityId: event.entityId,
                metadata: event.metadata,
                occurrenceCount: event.occurrenceCount,
                occurredAt: event.occurredAt,
                unread,
                readAt: state?.readAt ?? null,
                archivedAt: state?.archivedAt ?? null,
            };
        });

        const filtered = unreadOnly ? mapped.filter((item) => item.unread) : mapped;
        const hasMore = filtered.length > limit;
        const items = filtered.slice(0, limit);
        const nextCursor = hasMore ? items[items.length - 1]?.occurredAt.toISOString() ?? null : null;

        await db.insert(notificationUserCursor).values({
            guildId,
            userId: auth.userId,
            lastSeenAt: new Date(),
            updatedAt: new Date(),
        }).onConflictDoUpdate({
            target: [notificationUserCursor.guildId, notificationUserCursor.userId],
            set: {
                lastSeenAt: new Date(),
                updatedAt: new Date(),
            },
        });

        return NextResponse.json({
            items,
            nextCursor,
        });
    } catch (error) {
        logger.error("Error fetching notifications", {
            guildId,
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
    }
}
