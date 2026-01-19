import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { verificationMessageRule } from "@/lib/db";
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
        const rules = await db.query.verificationMessageRule.findMany({
            where: eq(verificationMessageRule.guildId, guildId)
        });

        return NextResponse.json(rules);
    } catch (error) {
        console.error("Error fetching verification rules:", error);
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
        const { roleId, message } = body;

        if (!roleId || !message) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const [newRule] = await db.insert(verificationMessageRule).values({
            guildId,
            roleId,
            message
        }).returning();

        return NextResponse.json(newRule);
    } catch (error) {
        console.error("Error creating verification rule:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
