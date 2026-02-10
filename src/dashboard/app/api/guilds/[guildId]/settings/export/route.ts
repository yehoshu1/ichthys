import { NextRequest, NextResponse } from "next/server";
import {
    db,
    guildConfig,
    welcomeTrigger,
    messageTemplate,
    levelReward,
    roleAction,
    verificationMessageRule,
    verificationRoleMessage,
    moderationSettings,
    reactionRoleMessage,
    reactionRole,
    birthdayConfig,
    birthdayEntry,
    messageAlias,
    commandConfig,
} from "@/lib/db";
import { eq } from "drizzle-orm";
import { requireGuildManageAccess } from "@/lib/guild-auth";
import logger from "@/lib/logger";

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const { guildId } = params;

    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    try {
        const [
            config,
            triggers,
            templates,
            rewards,
            actions,
            verificationRules,
            verificationRoleMessages,
            moderationConfig,
            reactionRoleMessages,
            reactionRoles,
            birthdaySettings,
            birthdayEntries,
            aliases,
            commandConfigs,
        ] = await Promise.all([
            db.query.guildConfig.findFirst({ where: eq(guildConfig.guildId, guildId) }),
            db.query.welcomeTrigger.findMany({ where: eq(welcomeTrigger.guildId, guildId) }),
            db.query.messageTemplate.findMany({ where: eq(messageTemplate.guildId, guildId) }),
            db.query.levelReward.findMany({ where: eq(levelReward.guildId, guildId) }),
            db.query.roleAction.findMany({ where: eq(roleAction.guildId, guildId) }),
            db.query.verificationMessageRule.findMany({ where: eq(verificationMessageRule.guildId, guildId) }),
            db.query.verificationRoleMessage.findMany({ where: eq(verificationRoleMessage.guildId, guildId) }),
            db.query.moderationSettings.findFirst({ where: eq(moderationSettings.guildId, guildId) }),
            db.query.reactionRoleMessage.findMany({ where: eq(reactionRoleMessage.guildId, guildId) }),
            db.query.reactionRole.findMany({ where: eq(reactionRole.guildId, guildId) }),
            db.query.birthdayConfig.findFirst({ where: eq(birthdayConfig.guildId, guildId) }),
            db.query.birthdayEntry.findMany({ where: eq(birthdayEntry.guildId, guildId) }),
            db.query.messageAlias.findMany({ where: eq(messageAlias.guildId, guildId) }),
            db.query.commandConfig.findMany({ where: eq(commandConfig.guildId, guildId) }),
        ]);

        const exportData = {
            version: 3,
            timestamp: new Date().toISOString(),
            guildId,
            config,
            welcomeTriggers: triggers,
            messageTemplates: templates,
            levelRewards: rewards,
            roleActions: actions,
            verificationRules,
            verificationRoleMessages,
            moderationSettings: moderationConfig,
            reactionRoleMessages,
            reactionRoles,
            birthdayConfig: birthdaySettings,
            birthdayEntries,
            messageAliases: aliases,
            commandConfigs,
        };

        return new NextResponse(JSON.stringify(exportData, null, 2), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Content-Disposition": `attachment; filename="guild-settings-${guildId}-${new Date().toISOString().split("T")[0]}.json"`,
            },
        });
    } catch (error) {
        logger.error("Error exporting settings", {
            error: error instanceof Error ? error.message : String(error),
            guildId,
        });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
