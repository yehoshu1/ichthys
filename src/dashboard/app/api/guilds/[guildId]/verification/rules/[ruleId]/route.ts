import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { verificationMessageRule } from "@/lib/db";
import { eq, and } from "drizzle-orm";

async function checkAuth(req: NextRequest, guildId: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return null;
    return session;
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ guildId: string, ruleId: string }> }) {
    const params = await props.params;
    const { guildId, ruleId } = params;

    const session = await checkAuth(req, guildId);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        await db.delete(verificationMessageRule)
            .where(and(
                eq(verificationMessageRule.id, ruleId),
                eq(verificationMessageRule.guildId, guildId)
            ));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting verification rule:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
