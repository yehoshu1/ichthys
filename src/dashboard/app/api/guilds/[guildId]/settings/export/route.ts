import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "../../../../../../lib/auth";
import { db, guildConfig, welcomeTrigger, messageTemplate, levelReward, roleAction } from "../../../../../../lib/db";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const { guildId } = params;

    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        // Fetch all config data
        const config = await db.query.guildConfig.findFirst({ where: eq(guildConfig.guildId, guildId) });
        const triggers = await db.query.welcomeTrigger.findMany({ where: eq(welcomeTrigger.guildId, guildId) });
        const templates = await db.query.messageTemplate.findMany({ where: eq(messageTemplate.guildId, guildId) });
        const rewards = await db.query.levelReward.findMany({ where: eq(levelReward.guildId, guildId) });
        const actions = await db.query.roleAction.findMany({ where: eq(roleAction.guildId, guildId) });

        const exportData = {
            version: 1,
            timestamp: new Date().toISOString(),
            guildId: guildId,
            config: config,
            welcomeTriggers: triggers,
            messageTemplates: templates,
            levelRewards: rewards,
            roleActions: actions
        };

        const json = JSON.stringify(exportData, null, 2);

        return new NextResponse(json, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="guild-config-${guildId}-${new Date().toISOString().split('T')[0]}.json"`
            }
        });

    } catch (error) {
        console.error("Error exporting config:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
