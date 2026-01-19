import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "../../../../../../lib/auth";
import { db, guildConfig, welcomeTrigger, messageTemplate, levelReward, roleAction } from "../../../../../../lib/db";
import { eq } from "drizzle-orm";

interface ImportData {
    version: number;
    guildId: string;
    config: any;
    welcomeTriggers: any[];
    messageTemplates: any[];
    levelRewards: any[];
    roleActions: any[];
}

export async function POST(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const { guildId } = params;

    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json() as ImportData;

        if (!body.version || !body.config) {
            return NextResponse.json({ error: "Invalid configuration file" }, { status: 400 });
        }

        // Security check: Ensure we are importing into the correct guild
        // OR override the guildId in the imported objects to match the current guild.
        // Overriding is safer so you can import one guild's config into another.

        // Start transaction
        await db.transaction(async (tx: any) => {
            // 1. Update Main Config
            // We use the imported config but force the guildId to match the target
            await tx
                .update(guildConfig)
                .set({ ...body.config, guildId: guildId, id: undefined }) // Don't allow overwriting ID/GuildID via spread
                .where(eq(guildConfig.guildId, guildId));

            // 2. Clear existing lists (Triggers, Templates, Rewards, Actions)
            await tx.delete(welcomeTrigger).where(eq(welcomeTrigger.guildId, guildId));
            await tx.delete(messageTemplate).where(eq(messageTemplate.guildId, guildId));
            await tx.delete(levelReward).where(eq(levelReward.guildId, guildId));
            await tx.delete(roleAction).where(eq(roleAction.guildId, guildId));

            // 3. Insert new lists
            // We must ensure the guildId is set to the target guild for all items

            if (body.messageTemplates?.length > 0) {
                const templatesToInsert = body.messageTemplates.map(t => ({ ...t, guildId: guildId }));
                await tx.insert(messageTemplate).values(templatesToInsert);
            }

            if (body.welcomeTriggers?.length > 0) {
                const triggersToInsert = body.welcomeTriggers.map(t => ({ ...t, guildId: guildId }));
                await tx.insert(welcomeTrigger).values(triggersToInsert);
            }

            if (body.levelRewards?.length > 0) {
                const rewardsToInsert = body.levelRewards.map(r => ({ ...r, guildId: guildId }));
                await tx.insert(levelReward).values(rewardsToInsert);
            }

            if (body.roleActions?.length > 0) {
                const actionsToInsert = body.roleActions.map(a => ({ ...a, guildId: guildId }));
                await tx.insert(roleAction).values(actionsToInsert);
            }
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Error importing config:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
