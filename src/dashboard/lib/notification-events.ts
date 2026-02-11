import { emitGuildNotification } from "@shared/services/notification-service";

interface DashboardSettingsChangedInput {
    guildId: string;
    userId: string;
    module: string;
    action: "create" | "update" | "delete";
    title?: string;
    metadata?: Record<string, unknown>;
}

export async function emitDashboardSettingsChanged(input: DashboardSettingsChangedInput): Promise<void> {
    await emitGuildNotification({
        guildId: input.guildId,
        eventType: "DASHBOARD_SETTINGS_CHANGED",
        severity: "INFO",
        source: "DASHBOARD_API",
        title: input.title ?? `${input.module} settings ${input.action}d`,
        actorUserId: input.userId,
        metadata: {
            module: input.module,
            action: input.action,
            ...input.metadata,
        },
        dedupeKey: `dashboard-settings-changed:${input.module}:${input.action}`,
        dedupeWindowSeconds: 60,
    });
}

