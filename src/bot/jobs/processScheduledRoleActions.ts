import cron from "node-cron";
import { and, eq, lte, sql } from "drizzle-orm";
import { TextChannel } from "discord.js";
import client from "../client";
import logger from "../utils/logger";
import { buildMessage } from "../utils/embeds";
import { db } from "../../shared/database/client";
import { scheduledRoleAction, roleAction, actionLog } from "../../shared/database/schema";
import { emitGuildNotificationSafe } from "../services/notificationEmitter";
import { isModuleEnabled } from "@shared/modules/state";

const MAX_PER_RUN = 100;
let isRunning = false;

async function executeScheduledAction(entry: typeof scheduledRoleAction.$inferSelect): Promise<void> {
    const [action] = await db.select()
        .from(roleAction)
        .where(eq(roleAction.id, entry.actionId))
        .limit(1);

    if (!action || !action.enabled) {
        await db.update(scheduledRoleAction)
            .set({
                status: "CANCELLED",
                lastError: "Action missing or disabled",
                updatedAt: new Date(),
            })
            .where(eq(scheduledRoleAction.id, entry.id));
        await emitGuildNotificationSafe({
            guildId: entry.guildId,
            eventType: 'SCHEDULED_ROLE_ACTION_CANCELLED',
            severity: 'WARNING',
            source: 'BOT_JOB',
            title: `Scheduled role action cancelled`,
            body: 'Action missing or disabled',
            targetUserId: entry.userId,
            metadata: {
                scheduledId: entry.id,
                actionId: entry.actionId,
            },
            dedupeKey: `scheduled-role-action-cancelled:${entry.id}`,
            dedupeWindowSeconds: 1800,
        });
        return;
    }

    const guild = await client.guilds.fetch(entry.guildId).catch((error) => { logger.warn(`Failed to fetch guild ${entry.guildId} for scheduled role action:`, error); return null; });
    if (!guild) {
        await db.update(scheduledRoleAction)
            .set({
                status: "FAILED",
                lastError: "Guild unavailable",
                updatedAt: new Date(),
            })
            .where(eq(scheduledRoleAction.id, entry.id));
        await emitGuildNotificationSafe({
            guildId: entry.guildId,
            eventType: 'SCHEDULED_ROLE_ACTION_FAILED',
            severity: 'ERROR',
            source: 'BOT_JOB',
            title: `Scheduled role action failed`,
            body: 'Guild unavailable',
            targetUserId: entry.userId,
            metadata: {
                scheduledId: entry.id,
                actionId: entry.actionId,
            },
            dedupeKey: `scheduled-role-action-failed:${entry.id}`,
            dedupeWindowSeconds: 1800,
        });
        return;
    }

    const member = await guild.members.fetch(entry.userId).catch((error) => { logger.warn(`Failed to fetch member ${entry.userId} for scheduled role action:`, error); return null; });
    if (!member) {
        await db.update(scheduledRoleAction)
            .set({
                status: "CANCELLED",
                lastError: "Member not found",
                updatedAt: new Date(),
            })
            .where(eq(scheduledRoleAction.id, entry.id));
        await emitGuildNotificationSafe({
            guildId: entry.guildId,
            eventType: 'SCHEDULED_ROLE_ACTION_CANCELLED',
            severity: 'WARNING',
            source: 'BOT_JOB',
            title: `Scheduled role action cancelled`,
            body: 'Member not found',
            targetUserId: entry.userId,
            metadata: {
                scheduledId: entry.id,
                actionId: entry.actionId,
            },
            dedupeKey: `scheduled-role-action-cancelled:${entry.id}`,
            dedupeWindowSeconds: 1800,
        });
        return;
    }

    if (!member.roles.cache.has(action.roleId)) {
        await db.update(scheduledRoleAction)
            .set({
                status: "CANCELLED",
                lastError: "Role removed before execution",
                updatedAt: new Date(),
            })
            .where(eq(scheduledRoleAction.id, entry.id));
        await emitGuildNotificationSafe({
            guildId: entry.guildId,
            eventType: 'SCHEDULED_ROLE_ACTION_CANCELLED',
            severity: 'WARNING',
            source: 'BOT_JOB',
            title: `Scheduled role action cancelled`,
            body: 'Role removed before execution',
            targetUserId: entry.userId,
            metadata: {
                scheduledId: entry.id,
                actionId: entry.actionId,
                roleId: action.roleId,
            },
            dedupeKey: `scheduled-role-action-cancelled:${entry.id}`,
            dedupeWindowSeconds: 1800,
        });
        return;
    }

    let success = true;
    let errorMessage: string | null = null;

    const variables = {
        user: member.toString(),
        username: member.user.username,
        server: member.guild.name,
        memberCount: member.guild.memberCount.toString(),
    };

    const messageData = buildMessage(action.dmMessage, action.dmMessageEmbed as any, variables);

    try {
        switch (action.actionType) {
            case "DM":
                if (messageData) {
                    await member.send(messageData);
                }
                break;

            case "MSG":
            case "MESSAGE":
                if (action.channelId && messageData) {
                    const channel = await member.guild.channels.fetch(action.channelId);
                    if (channel && channel.isTextBased()) {
                        await (channel as TextChannel).send(messageData);
                    } else {
                        success = false;
                        errorMessage = "Channel not found or not text-based";
                    }
                }
                break;

            case "KICK":
                if (messageData) {
                    await member.send(messageData).catch((error) => { logger.warn(`Failed to send DM to ${member.user.tag} for scheduled KICK action:`, error); return null; });
                }
                await member.kick(action.kickReason || "Automated role action");
                break;

            case "LOG":
                if (action.logChannelId && messageData) {
                    const channel = await member.guild.channels.fetch(action.logChannelId);
                    if (channel && channel.isTextBased()) {
                        await (channel as TextChannel).send(messageData);
                    }
                }
                break;

            default:
                success = false;
                errorMessage = `Unsupported action type ${action.actionType}`;
                break;
        }
    } catch (error) {
        success = false;
        errorMessage = (error as Error).message || "Execution failed";
    }

    await db.insert(actionLog).values({
        guildId: member.guild.id,
        actionType: action.actionType,
        targetUserId: member.id,
        success,
        errorMessage,
        metadata: JSON.stringify({ actionId: action.id, roleId: action.roleId, scheduledId: entry.id }),
    });

    await db.update(scheduledRoleAction)
        .set({
            status: success ? "DONE" : "FAILED",
            lastError: errorMessage,
            updatedAt: new Date(),
        })
        .where(eq(scheduledRoleAction.id, entry.id));

    if (!success) {
        await emitGuildNotificationSafe({
            guildId: entry.guildId,
            eventType: 'SCHEDULED_ROLE_ACTION_FAILED',
            severity: 'ERROR',
            source: 'BOT_JOB',
            title: `Scheduled role action failed`,
            body: errorMessage,
            targetUserId: entry.userId,
            metadata: {
                scheduledId: entry.id,
                actionId: entry.actionId,
                roleId: action.roleId,
            },
            dedupeKey: `scheduled-role-action-failed:${entry.id}`,
            dedupeWindowSeconds: 1800,
        });
    }
}

export async function processScheduledRoleActionsOnce(): Promise<void> {
    const now = new Date();

    const pending = await db.select()
        .from(scheduledRoleAction)
        .where(and(
            eq(scheduledRoleAction.status, "PENDING"),
            lte(scheduledRoleAction.executeAt, now)
        ))
        .limit(MAX_PER_RUN);

    if (pending.length === 0) {
        return;
    }

    logger.info(`Processing ${pending.length} scheduled role action(s)`);

    const moduleEnabledCache = new Map<string, boolean>();

    for (const entry of pending) {
        let roleActionsEnabled = moduleEnabledCache.get(entry.guildId);
        if (roleActionsEnabled === undefined) {
            roleActionsEnabled = await isModuleEnabled(entry.guildId, 'role_actions');
            moduleEnabledCache.set(entry.guildId, roleActionsEnabled);
        }

        if (!roleActionsEnabled) {
            continue;
        }

        await db.update(scheduledRoleAction)
            .set({
                status: "PROCESSING",
                attempts: sql`${scheduledRoleAction.attempts} + 1`,
                updatedAt: new Date(),
            })
            .where(eq(scheduledRoleAction.id, entry.id));

        try {
            await executeScheduledAction(entry);
        } catch (error) {
            logger.error(`Failed to process scheduled role action ${entry.id}:`, error);
            await db.update(scheduledRoleAction)
                .set({
                    status: "FAILED",
                    lastError: (error as Error).message || "Processing failed",
                    updatedAt: new Date(),
                })
                .where(eq(scheduledRoleAction.id, entry.id));
            await emitGuildNotificationSafe({
                guildId: entry.guildId,
                eventType: 'SCHEDULED_ROLE_ACTION_FAILED',
                severity: 'ERROR',
                source: 'BOT_JOB',
                title: `Scheduled role action processing failed`,
                body: error instanceof Error ? error.message : 'Unknown error',
                targetUserId: entry.userId,
                metadata: {
                    scheduledId: entry.id,
                    actionId: entry.actionId,
                },
                dedupeKey: `scheduled-role-action-failed:${entry.id}`,
                dedupeWindowSeconds: 1800,
            });
        }
    }
}

export function setupScheduledRoleActionsJob(): void {
    cron.schedule("* * * * *", async () => {
        if (isRunning) {
            return;
        }

        isRunning = true;
        try {
            await processScheduledRoleActionsOnce();
        } catch (error) {
            logger.error("Scheduled role action job failed:", error);
        } finally {
            isRunning = false;
        }
    });
}
