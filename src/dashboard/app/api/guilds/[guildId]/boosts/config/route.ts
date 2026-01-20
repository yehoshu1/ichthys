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
                boostEnabled: false,
                boostAnnouncementChannelId: null,
                boostRoleId: null,
                boostRoleName: null,
                boostRoleColorPrimary: null,
                boostRoleColorSecondary: null,
                boostClaimRequired: true,
                boostWelcomeMessage: "Thank you {user} for boosting {server}! 🚀",
                boostReBoostMessage: "Thank you {user} for renewing your boost for {server}! 🚀",
                boostRoleRemovalDays: 30,
                boostRoleRemovalDmEnabled: true
            });
        }

        return NextResponse.json(config);
    } catch (error) {
        console.error("Error fetching boost config:", error);
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
            boostEnabled,
            boostAnnouncementChannelId,
            boostRoleId,
            boostRoleName,
            boostRoleColorPrimary,
            boostRoleColorSecondary,
            boostClaimRequired,
            boostWelcomeMessage,
            boostWelcomeMessageEmbed, // <--- Added
            boostReBoostMessage,
            boostReBoostMessageEmbed, // <--- Added
            boostRoleRemovalDays,
            boostRoleRemovalDmEnabled
        } = body;

        // Upsert logic
        await db.insert(guildConfig).values({
            guildId,
            boostEnabled,
            boostAnnouncementChannelId,
            boostRoleId,
            boostRoleName,
            boostRoleColorPrimary,
            boostRoleColorSecondary,
            boostClaimRequired,
            boostWelcomeMessage,
            boostWelcomeMessageEmbed,
            boostReBoostMessage,
            boostReBoostMessageEmbed,
            boostRoleRemovalDays,
            boostRoleRemovalDmEnabled
        }).onConflictDoUpdate({
            target: guildConfig.guildId,
            set: {
                boostEnabled,
                boostAnnouncementChannelId,
                boostRoleId,
                boostRoleName,
                boostRoleColorPrimary,
                boostRoleColorSecondary,
                boostClaimRequired,
                boostWelcomeMessage,
                boostWelcomeMessageEmbed,
                boostReBoostMessage,
                boostReBoostMessageEmbed,
                boostRoleRemovalDays,
                boostRoleRemovalDmEnabled,
                updatedAt: new Date()
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating boost config:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
