import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { verificationRoleMessage } from "@/lib/db";
import { eq } from "drizzle-orm";

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
        const rules = await db.query.verificationRoleMessage.findMany({
            where: eq(verificationRoleMessage.guildId, guildId)
        });

        return NextResponse.json(rules);
    } catch (error) {
        console.error("Error fetching role messages:", error);
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
        const { roleId, message, messageEmbed, enabled } = body;

        if (!roleId || !message) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const [newRule] = await db.insert(verificationRoleMessage).values({
            guildId,
            roleId,
            message,
            messageEmbed,
            enabled: enabled ?? true
        }).returning();

        return NextResponse.json(newRule);
    } catch (error) {
        console.error("Error creating role message:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
