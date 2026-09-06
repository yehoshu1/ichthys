import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, sql } from "drizzle-orm";
import { db, notificationEvent, notificationUserCursor, notificationUserState } from "@/lib/db";
import { requireGuildManageAccess } from "@/lib/guild-auth";
import logger from "@/lib/logger";

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;

    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const [cursor] = await db.select()
            .from(notificationUserCursor)
            .where(and(
                eq(notificationUserCursor.guildId, guildId),
                eq(notificationUserCursor.userId, auth.userId),
            ))
            .limit(1);

        const lastReadAt = cursor?.lastReadAt ?? new Date(0);

        const [base] = await db.select({
            count: sql<number>`count(*)`,
        })
            .from(notificationEvent)
            .where(and(
                eq(notificationEvent.guildId, guildId),
                eq(notificationEvent.inAppVisible, true),
                gt(notificationEvent.occurredAt, lastReadAt),
            ));

        const [alreadyRead] = await db.select({
            count: sql<number>`count(*)`,
        })
            .from(notificationUserState)
            .innerJoin(notificationEvent, eq(notificationEvent.id, notificationUserState.notificationId))
            .where(and(
                eq(notificationEvent.guildId, guildId),
                eq(notificationUserState.userId, auth.userId),
                gt(notificationEvent.occurredAt, lastReadAt),
                sql`${notificationUserState.readAt} is not null`,
            ));

        const unreadCount = Math.max((base?.count || 0) - (alreadyRead?.count || 0), 0);

        return NextResponse.json({ unreadCount });
    } catch (error) {
        logger.error("Error fetching unread notification count", {
            guildId,
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json({ error: "Failed to fetch unread notification count" }, { status: 500 });
    }
}

