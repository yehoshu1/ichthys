import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { guildConfig } from "@/lib/db";
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
        const config = await db.query.guildConfig.findFirst({
            where: eq(guildConfig.guildId, guildId)
        });

        if (!config) {
            return NextResponse.json({
                levelingEnabled: false,
                textXpMin: 15,
                textXpMax: 25,
                textXpCooldown: 60,
                voiceXpPerMinute: 10,
                levelUpNotifEnabled: true,
                levelUpChannelId: null,
                levelUpMessage: null
            });
        }

        return NextResponse.json(config);
    } catch (error) {
        console.error("Error fetching leveling config:", error);
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
        const {
            levelingEnabled = false,
            textXpMin = 15,
            textXpMax = 25,
            textXpCooldown = 60,
            voiceXpPerMinute = 10,
            levelUpNotifEnabled = true,
            levelUpChannelId,
            levelUpMessage,
            levelUpMessageEmbed // <--- Added
        } = body;

        // Ensure we don't save NaN/null to notNull fields
        const safeTextXpMin = textXpMin ?? 15;
        const safeTextXpMax = textXpMax ?? 25;
        const safeTextXpCooldown = textXpCooldown ?? 60;
        const safeVoiceXpPerMinute = voiceXpPerMinute ?? 10;

        await db.insert(guildConfig).values({
            guildId,
            levelingEnabled,
            textXpMin: safeTextXpMin,
            textXpMax: safeTextXpMax,
            textXpCooldown: safeTextXpCooldown,
            voiceXpPerMinute: safeVoiceXpPerMinute,
            levelUpNotifEnabled,
            levelUpChannelId,
            levelUpMessage,
            levelUpMessageEmbed // <--- Added
        }).onConflictDoUpdate({
            target: guildConfig.guildId,
            set: {
                levelingEnabled,
                textXpMin: safeTextXpMin,
                textXpMax: safeTextXpMax,
                textXpCooldown: safeTextXpCooldown,
                voiceXpPerMinute: safeVoiceXpPerMinute,
                levelUpNotifEnabled,
                levelUpChannelId,
                levelUpMessage,
                levelUpMessageEmbed, // <--- Added
                updatedAt: new Date()
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating leveling config:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
