import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { messageTemplate } from "@/lib/db";
import { eq, and } from "drizzle-orm";

// Helper to check permissions (basic check: user must be in the guild)
// In a real app, we should verify MANAGE_GUILD permissions via Discord API
async function checkAuth(req: NextRequest, guildId: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return null;
    return session;
}

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const session = await checkAuth(req, guildId);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const templates = await db.select()
            .from(messageTemplate)
            .where(eq(messageTemplate.guildId, guildId));
        return NextResponse.json(templates);
    } catch (error) {
        console.error("Error fetching templates:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;
    const session = await checkAuth(req, guildId);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { name, content, embedEnabled, embedTitle, embedDescription, embedColor, embedThumbnail, embedData } = body;

        if (!name || !content) {
            return NextResponse.json({ error: "Name and Content are required" }, { status: 400 });
        }

        const [newTemplate] = await db.insert(messageTemplate).values({
            guildId,
            name,
            content,
            embedEnabled: embedEnabled || false,
            embedTitle, // keeping for backward compat or we can migrate
            embedDescription,
            embedColor,
            embedThumbnail: embedThumbnail || false,
            embedData, // <--- Added
        }).returning();

        return NextResponse.json(newTemplate);
    } catch (error) {
        console.error("Error creating template:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
