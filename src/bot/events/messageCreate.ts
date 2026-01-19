
import { Events, Message, TextChannel } from 'discord.js';
import client from '../client';
import logger from '../utils/logger';
import { db } from '../../shared/database/client';
import { guildConfig, levelProfile, messageActivity } from '../../shared/database/schema';
import { eq, and, sql } from 'drizzle-orm';
import { calculateLevel, checkAndAssignLevelRewards } from '../utils/leveling';
import { buildMessage } from '../utils/embeds';

export default function setupMessageCreateHandler() {
    client.on(Events.MessageCreate, async (message: Message) => {
        if (message.author.bot || !message.guild) return;

        // 1. Log Activity Heatmap (regardless of leveling config)
        const timestamp = new Date();
        const hour = timestamp.getHours();
        const day = timestamp.getDay();
        const dateFloor = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate()); // Midnight today

        try {
            await db.insert(messageActivity)
                .values({
                    guildId: message.guild.id,
                    hour,
                    day,
                    date: dateFloor,
                    messageCount: 1
                })
                .onConflictDoUpdate({
                    target: [messageActivity.guildId, messageActivity.date, messageActivity.hour],
                    set: {
                        messageCount: sql`message_count + 1`,
                        updatedAt: timestamp
                    }
                });
        } catch (err) {
            logger.error("Failed to log message activity", err);
        }

        try {
            // Check if leveling is enabled for this guild
            const config = await db.query.guildConfig.findFirst({
                where: eq(guildConfig.guildId, message.guild.id)
            });

            if (!config?.levelingEnabled) return;

            // Get or create user profile
            let profile = await db.query.levelProfile.findFirst({
                where: and(
                    eq(levelProfile.guildId, message.guild.id),
                    eq(levelProfile.userId, message.author.id)
                )
            });

            if (!profile) {
                // Initialize profile
                const [newProfile] = await db.insert(levelProfile).values({
                    guildId: message.guild.id,
                    userId: message.author.id,
                    level: 0,
                    totalXp: 0,
                    textXp: 0,
                    voiceXp: 0,
                }).returning();
                profile = newProfile;
            }

            // Check Cooldown
            const now = new Date();
            if (profile.lastTextXpAt) {
                const diffMs = now.getTime() - profile.lastTextXpAt.getTime();
                const cooldownMs = config.textXpCooldown * 1000;
                if (diffMs < cooldownMs) return;
            }

            // Calculate XP
            const min = config.textXpMin;
            const max = config.textXpMax;
            const xpEarned = Math.floor(Math.random() * (max - min + 1)) + min;

            // Update Profile
            const newTotalXp = profile.totalXp + xpEarned;
            const newTextXp = profile.textXp + xpEarned;
            const newLevel = calculateLevel(newTotalXp);

            await db.update(levelProfile)
                .set({
                    totalXp: newTotalXp,
                    textXp: newTextXp,
                    level: newLevel,
                    lastTextXpAt: now,
                    updatedAt: now
                })
                .where(eq(levelProfile.id, profile.id));

            // Check and assign level rewards
            if (newLevel > profile.level) {
                await checkAndAssignLevelRewards(message.member!, newLevel);
            }

            // Level Up Notification
            if (newLevel > profile.level && config.levelUpNotifEnabled) {
                const channelId = config.levelUpChannelId || message.channelId;
                const channel = message.guild.channels.cache.get(channelId) as TextChannel;

                if (channel && channel.isTextBased()) {
                    const variables = {
                        'user': message.author.toString(),
                        'level': newLevel.toString(),
                        'xp': newTotalXp.toString()
                    };

                    // Default message if plain text is missing
                    const defaultMessage = `🎉 **Level Up!** {user} has reached level **{level}**!`;
                    const content = config.levelUpMessage || defaultMessage;

                    const messageData = buildMessage(
                        content,
                        config.levelUpMessageEmbed as any,
                        variables
                    );

                    if (messageData) {
                        await channel.send(messageData);
                    }
                }
            }

        } catch (error) {
            logger.error(`Error processing XP for message in ${message.guild.name}:`, error);
        }
    });
}
