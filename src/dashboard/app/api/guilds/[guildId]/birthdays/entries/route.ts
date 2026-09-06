import { NextRequest, NextResponse } from "next/server";
import { db, birthdayEntry } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireGuildManageAccess } from "@/lib/guild-auth";
import logger from "@/lib/logger";

const entrySchema = z.object({
    userId: z.string().regex(/^\d{17,20}$/),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    year: z.number().int().min(1900).max(new Date().getFullYear()).nullable().optional(),
    timezone: z.string().default("UTC"),
}).strict();

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const entries = await db.query.birthdayEntry.findMany({
            where: eq(birthdayEntry.guildId, guildId),
            orderBy: [birthdayEntry.month, birthdayEntry.day],
        });

        // Return entries without Discord user data (will be fetched client-side or from cache)
        return NextResponse.json(entries.map(entry => ({
            ...entry,
            username: "User",
            avatar: null,
        })));
    } catch (error) {
        logger.error("Error fetching birthday entries", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const body = await req.json();
        const parsed = entrySchema.safeParse(body);
        
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid request body", details: parsed.error.format() }, { status: 400 });
        }

        const data = parsed.data;

        // Validate day based on month
        const daysInMonth = new Date(2000, data.month, 0).getDate();
        if (data.day > daysInMonth) {
            return NextResponse.json({ error: `Invalid day for month ${data.month}` }, { status: 400 });
        }

        // Insert or update entry
        const result = await db.insert(birthdayEntry).values({
            guildId,
            userId: data.userId,
            month: data.month,
            day: data.day,
            year: data.year || null,
            timezone: data.timezone,
        }).onConflictDoUpdate({
            target: [birthdayEntry.guildId, birthdayEntry.userId],
            set: {
                month: data.month,
                day: data.day,
                year: data.year || null,
                timezone: data.timezone,
                updatedAt: new Date(),
            },
        }).returning();

        return NextResponse.json(result[0]);
    } catch (error) {
        logger.error("Error creating birthday entry", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
        return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
    }

    try {
        await db.delete(birthdayEntry).where(
            and(
                eq(birthdayEntry.id, id),
                eq(birthdayEntry.guildId, guildId)
            )
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error("Error deleting birthday entry", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
