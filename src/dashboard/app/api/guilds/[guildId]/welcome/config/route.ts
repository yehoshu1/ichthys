import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db, guildConfig } from "@/lib/db";
import { eq } from "drizzle-orm";

async function checkAuth(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return null;
    return session;
}

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const { guildId } = params;

    const session = await checkAuth(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const config = await db.query.guildConfig.findFirst({
            where: eq(guildConfig.guildId, guildId)
        });

        if (!config) {
            return NextResponse.json({
                welcomeEnabled: false,
                autoRoleId: null,
                joinMessageChannelId: null,
                joinMessage: null,
                leaveMessageChannelId: null,
                leaveMessage: null
            });
        }

        return NextResponse.json({
            welcomeEnabled: config.welcomeEnabled,
            autoRoleId: config.autoRoleId,
            joinMessageChannelId: config.joinMessageChannelId,
            joinMessage: config.joinMessage,
            joinMessageEmbed: config.joinMessageEmbed,     // <--- Added
            leaveMessageChannelId: config.leaveMessageChannelId,
            leaveMessage: config.leaveMessage,
            leaveMessageEmbed: config.leaveMessageEmbed    // <--- Added
        });

    } catch (error) {
        console.error("Error fetching welcome config:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const { guildId } = params;

    const session = await checkAuth(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const {
            welcomeEnabled,
            autoRoleId,
            joinMessageChannelId,
            joinMessage,
            joinMessageEmbed,     // <--- Added
            leaveMessageChannelId,
            leaveMessage,
            leaveMessageEmbed     // <--- Added
        } = body;

        // Upsert configuration
        await db.insert(guildConfig)
            .values({
                guildId,
                welcomeEnabled: welcomeEnabled ?? false,
                autoRoleId: autoRoleId || null,
                joinMessageChannelId: joinMessageChannelId || null,
                joinMessage: joinMessage || null,
                joinMessageEmbed: joinMessageEmbed || null,     // <--- Added
                leaveMessageChannelId: leaveMessageChannelId || null,
                leaveMessage: leaveMessage || null,
                leaveMessageEmbed: leaveMessageEmbed || null    // <--- Added
            })
            .onConflictDoUpdate({
                target: guildConfig.guildId,
                set: {
                    welcomeEnabled: welcomeEnabled ?? false,
                    autoRoleId: autoRoleId || null,
                    joinMessageChannelId: joinMessageChannelId || null,
                    joinMessage: joinMessage || null,
                    joinMessageEmbed: joinMessageEmbed || null,     // <--- Added
                    leaveMessageChannelId: leaveMessageChannelId || null,
                    leaveMessage: leaveMessage || null,
                    leaveMessageEmbed: leaveMessageEmbed || null,    // <--- Added
                    updatedAt: new Date()
                }
            });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Error updating welcome config:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
