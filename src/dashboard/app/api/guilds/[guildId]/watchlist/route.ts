import { NextRequest, NextResponse } from "next/server";
import { db } from "@shared/database/client";
import { memberWatchlist } from "@shared/database/schema";
import { eq, desc } from "drizzle-orm";
import { requireGuildManageAccess } from "@/lib/guild-auth";
import { parseJsonBody } from "@/lib/validation";
import { getDiscordUsers } from "@/lib/discord-user-cache";
import { z } from "zod";
import logger from "@/lib/logger";

const SEVERITY_VALUES = ["LOW", "MEDIUM", "HIGH"] as const;

const addWatchlistSchema = z.object({
    userId: z.string().trim().regex(/^\d{17,20}$/, "Invalid Discord ID"),
    reason: z.string().trim().min(1).max(500),
    notes: z.string().trim().max(1000).optional(),
    severity: z.enum(SEVERITY_VALUES).default("LOW"),
});

// GET /api/guilds/[guildId]/watchlist - List all watchlist entries
export async function GET(
    req: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    const params = await props.params;
    const { guildId } = params;

    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const entries = await db
            .select()
            .from(memberWatchlist)
            .where(eq(memberWatchlist.guildId, guildId))
            .orderBy(desc(memberWatchlist.createdAt));

        const userIds = entries.map((e) => e.userId);
        const adderIds = entries.map((e) => e.addedBy);
        const allIds = [...new Set([...userIds, ...adderIds])];

        const usersMap = await getDiscordUsers(allIds);

        const enriched = entries.map((entry) => ({
            ...entry,
            user: usersMap.get(entry.userId) ?? null,
            addedByUser: usersMap.get(entry.addedBy) ?? null,
        }));

        return NextResponse.json(enriched);
    } catch (error) {
        logger.error("Error fetching watchlist", { error, guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// POST /api/guilds/[guildId]/watchlist - Add member to watchlist
export async function POST(
    req: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    const params = await props.params;
    const { guildId } = params;

    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    const parsed = await parseJsonBody(req, addWatchlistSchema);
    if (!parsed.success) return parsed.response;

    const { userId, reason, notes, severity } = parsed.data;

    try {
        const [created] = await db
            .insert(memberWatchlist)
            .values({
                guildId,
                userId,
                addedBy: auth.userId,
                reason,
                notes: notes ?? null,
                severity,
            })
            .onConflictDoUpdate({
                target: [memberWatchlist.guildId, memberWatchlist.userId],
                set: {
                    reason,
                    notes: notes ?? null,
                    severity,
                    addedBy: auth.userId,
                    updatedAt: new Date(),
                },
            })
            .returning();

        return NextResponse.json(created, { status: 201 });
    } catch (error) {
        logger.error("Error adding to watchlist", { error, guildId, userId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
