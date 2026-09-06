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
    birthdayConfig,
    birthdayEntry,
    messageAlias,
    commandConfig,
    moduleState,
    eventTemplate,
    pollTemplate,
    eventPollSettings,
    dashboardRbacConfig,
    dashboardRbacRules,
} from "@/lib/db";
import { eq } from "drizzle-orm";
import { requireGuildManageStrictAccess } from "@/lib/guild-auth";
import logger from "@/lib/logger";
import { emitGuildNotification } from "@shared/services/notification-service";

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const { guildId } = params;

    // Strict access: the export contains the full RBAC configuration (role IDs
    // that could be used to craft a targeted escalation) and member PII such
    // as birthday entries. It must never be delegatable via RBAC.
    const auth = await requireGuildManageStrictAccess(guildId, req);
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
            birthdaySettings,
            birthdayEntries,
            aliases,
            commandConfigs,
            moduleStates,
            eventTemplates,
            pollTemplates,
            eventPollSettingsConfig,
            rbacConfig,
            rbacRules,
        ] = await Promise.all([
            db.query.guildConfig.findFirst({ where: eq(guildConfig.guildId, guildId) }),
            db.query.welcomeTrigger.findMany({ where: eq(welcomeTrigger.guildId, guildId) }),
            db.query.messageTemplate.findMany({ where: eq(messageTemplate.guildId, guildId) }),
            db.query.levelReward.findMany({ where: eq(levelReward.guildId, guildId) }),
            db.query.roleAction.findMany({ where: eq(roleAction.guildId, guildId) }),
            db.query.verificationMessageRule.findMany({ where: eq(verificationMessageRule.guildId, guildId) }),
            db.query.verificationRoleMessage.findMany({ where: eq(verificationRoleMessage.guildId, guildId) }),
            db.query.moderationSettings.findFirst({ where: eq(moderationSettings.guildId, guildId) }),
            db.query.birthdayConfig.findFirst({ where: eq(birthdayConfig.guildId, guildId) }),
            db.query.birthdayEntry.findMany({ where: eq(birthdayEntry.guildId, guildId) }),
            db.query.messageAlias.findMany({ where: eq(messageAlias.guildId, guildId) }),
            db.query.commandConfig.findMany({ where: eq(commandConfig.guildId, guildId) }),
            db.query.moduleState.findMany({ where: eq(moduleState.guildId, guildId) }),
            db.query.eventTemplate.findMany({ where: eq(eventTemplate.guildId, guildId) }),
            db.query.pollTemplate.findMany({ where: eq(pollTemplate.guildId, guildId) }),
            db.query.eventPollSettings.findFirst({ where: eq(eventPollSettings.guildId, guildId) }),
            db.query.dashboardRbacConfig.findFirst({ where: eq(dashboardRbacConfig.guildId, guildId) }),
            db.query.dashboardRbacRules.findMany({ where: eq(dashboardRbacRules.guildId, guildId) }),
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
            birthdayConfig: birthdaySettings,
            birthdayEntries,
            messageAliases: aliases,
            commandConfigs,
            moduleStates,
            eventTemplates,
            pollTemplates,
            eventPollSettings: eventPollSettingsConfig,
            dashboardRbacConfig: rbacConfig,
            dashboardRbacRules: rbacRules,
        };

        await emitGuildNotification({
            guildId,
            eventType: 'DASHBOARD_SETTINGS_EXPORTED',
            severity: 'INFO',
            source: 'DASHBOARD_API',
            title: 'Settings exported',
            actorUserId: auth.userId,
            metadata: {
                version: exportData.version,
            },
            dedupeKey: `dashboard-settings-exported:${guildId}`,
            dedupeWindowSeconds: 60,
        });

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
