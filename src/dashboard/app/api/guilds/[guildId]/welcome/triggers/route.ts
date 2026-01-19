import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { welcomeTrigger, messageTemplate } from "@/lib/db";
import { eq, and } from "drizzle-orm";

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
        // Fetch triggers with their associated template names
        const triggers = await db.select({
            id: welcomeTrigger.id,
            roleId: welcomeTrigger.roleId,
            channelId: welcomeTrigger.channelId,
            templateId: welcomeTrigger.templateId,
            enabled: welcomeTrigger.enabled,
            templateName: messageTemplate.name
        })
            .from(welcomeTrigger)
            .innerJoin(messageTemplate, eq(welcomeTrigger.templateId, messageTemplate.id))
            .where(eq(welcomeTrigger.guildId, guildId));

        return NextResponse.json(triggers);
    } catch (error) {
        console.error("Error fetching triggers:", error);
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
        const { roleId, templateId, channelId, enabled } = body;

        if (!roleId || !templateId) {
            return NextResponse.json({ error: "Role ID and Template ID are required" }, { status: 400 });
        }

        const [newTrigger] = await db.insert(welcomeTrigger).values({
            guildId,
            roleId,
            templateId,
            channelId: channelId || null,
            enabled: enabled !== undefined ? enabled : true,
        }).returning();

        return NextResponse.json(newTrigger);
    } catch (error) {
        console.error("Error creating trigger:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
