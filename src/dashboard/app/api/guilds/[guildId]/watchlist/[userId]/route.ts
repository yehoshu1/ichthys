import { NextRequest, NextResponse } from "next/server";
import { db } from "@shared/database/client";
import { memberWatchlist } from "@shared/database/schema";
import { and, eq } from "drizzle-orm";
import { requireGuildManageAccess } from "@/lib/guild-auth";
import { parseJsonBody } from "@/lib/validation";
import { z } from "zod";
import logger from "@/lib/logger";

const SEVERITY_VALUES = ["LOW", "MEDIUM", "HIGH"] as const;

const updateWatchlistSchema = z.object({
    reason: z.string().trim().min(1).max(500).optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    severity: z.enum(SEVERITY_VALUES).optional(),
});

// PATCH /api/guilds/[guildId]/watchlist/[userId] - Update watchlist entry
export async function PATCH(
    req: NextRequest,
    props: { params: Promise<{ guildId: string; userId: string }> }
) {
    const params = await props.params;
    const { guildId, userId } = params;

    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    const parsed = await parseJsonBody(req, updateWatchlistSchema);
    if (!parsed.success) return parsed.response;

    try {
        const [updated] = await db
            .update(memberWatchlist)
            .set({ ...parsed.data, updatedAt: new Date() })
            .where(
                and(
                    eq(memberWatchlist.guildId, guildId),
                    eq(memberWatchlist.userId, userId)
                )
            )
            .returning();

        if (!updated) {
            return NextResponse.json({ error: "Entry not found" }, { status: 404 });
        }

        return NextResponse.json(updated);
    } catch (error) {
        logger.error("Error updating watchlist entry", { error, guildId, userId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// DELETE /api/guilds/[guildId]/watchlist/[userId] - Remove from watchlist
export async function DELETE(
    req: NextRequest,
    props: { params: Promise<{ guildId: string; userId: string }> }
) {
    const params = await props.params;
    const { guildId, userId } = params;

    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const result = await db
            .delete(memberWatchlist)
            .where(
                and(
                    eq(memberWatchlist.guildId, guildId),
                    eq(memberWatchlist.userId, userId)
                )
            );

        if ((result.rowCount ?? 0) === 0) {
            return NextResponse.json({ error: "Entry not found" }, { status: 404 });
        }

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        logger.error("Error removing from watchlist", { error, guildId, userId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
