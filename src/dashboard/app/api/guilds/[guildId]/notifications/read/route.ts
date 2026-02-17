import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, notificationEvent, notificationUserCursor, notificationUserState } from "@/lib/db";
import { requireGuildManageAccess } from "@/lib/guild-auth";
import logger from "@/lib/logger";
import { parseJsonBody } from "@/lib/validation";

const markReadSchema = z.object({
    markAll: z.boolean().default(false),
    notificationIds: z.array(z.string().uuid()).max(100).default([]),
}).strict();

export async function POST(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;

    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    const parsedResult = await parseJsonBody(req, markReadSchema);
    if (!parsedResult.success) return parsedResult.response;
    const parsed = parsedResult.data;

    if (!parsed.markAll && parsed.notificationIds.length === 0) {
        return NextResponse.json({ error: "Provide notificationIds or markAll=true" }, { status: 400 });
    }

    try {
        if (parsed.markAll) {
            await db.insert(notificationUserCursor).values({
                guildId,
                userId: auth.userId,
                lastReadAt: new Date(),
                lastSeenAt: new Date(),
                updatedAt: new Date(),
            }).onConflictDoUpdate({
                target: [notificationUserCursor.guildId, notificationUserCursor.userId],
                set: {
                    lastReadAt: new Date(),
                    lastSeenAt: new Date(),
                    updatedAt: new Date(),
                },
            });

            return NextResponse.json({ ok: true });
        }

        const existing = await db.select({
            id: notificationEvent.id,
        })
            .from(notificationEvent)
            .where(and(
                eq(notificationEvent.guildId, guildId),
                inArray(notificationEvent.id, parsed.notificationIds),
            ));

        if (existing.length === 0) {
            return NextResponse.json({ ok: true, updated: 0 });
        }

        const now = new Date();
        const values = existing.map((event) => ({
            notificationId: event.id,
            userId: auth.userId,
            readAt: now,
            updatedAt: now,
        }));

        await db.insert(notificationUserState).values(values).onConflictDoUpdate({
            target: [notificationUserState.notificationId, notificationUserState.userId],
            set: {
                readAt: now,
                updatedAt: now,
            },
        });

        return NextResponse.json({ ok: true, updated: existing.length });
    } catch (error) {
        logger.error("Error marking notifications as read", {
            guildId,
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json({ error: "Failed to update notification read state" }, { status: 500 });
    }
}

