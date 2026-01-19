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
                verificationEnabled: false,
                unverifiedRoleId: null,
                verificationRoleId: null,
                verificationGraceDays: 30,
                verificationKickDmEnabled: true,
                verificationMessage: null
            });
        }

        return NextResponse.json(config);
    } catch (error) {
        console.error("Error fetching verification config:", error);
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
        const { verificationEnabled, unverifiedRoleId, verificationRoleId, verificationGraceDays, verificationKickDmEnabled, verificationMessage } = body;

        // Upsert logic
        await db.insert(guildConfig).values({
            guildId,
            verificationEnabled,
            unverifiedRoleId,
            verificationRoleId,
            verificationGraceDays,
            verificationKickDmEnabled,
            verificationMessage
        }).onConflictDoUpdate({
            target: guildConfig.guildId,
            set: {
                verificationEnabled,
                unverifiedRoleId,
                verificationRoleId,
                verificationGraceDays,
                verificationKickDmEnabled,
                verificationMessage,
                lastMemberSync: null, // Force re-sync to recalculate verified status
                updatedAt: new Date()
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating verification config:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
