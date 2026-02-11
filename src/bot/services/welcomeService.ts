import { GuildMember, TextChannel, AttachmentBuilder } from 'discord.js';
import { db } from '../../shared/database/client';
import { welcomeConfig } from '../../shared/database/schema';
import { eq } from 'drizzle-orm';
import { generateWelcomeImage, processWelcomeTemplate } from './welcomeImageGenerator';
import logger from '../utils/logger';
import { emitGuildNotificationSafe } from './notificationEmitter';

// Cooldown tracking
const welcomeCooldowns = new Map<string, number>();

/**
 * Get welcome configuration for a guild
 */
export async function getWelcomeConfig(guildId: string) {
    const config = await db.query.welcomeConfig.findFirst({
        where: eq(welcomeConfig.guildId, guildId)
    });

    return config || null;
}

/**
 * Save or update welcome configuration
 */
export async function saveWelcomeConfig(
    guildId: string,
    data: Partial<typeof welcomeConfig.$inferInsert>
) {
    const existing = await getWelcomeConfig(guildId);

    if (existing) {
        // Update
        const [updated] = await db
            .update(welcomeConfig)
            .set({
                ...data,
                updatedAt: new Date()
            })
            .where(eq(welcomeConfig.id, existing.id))
            .returning();
        return updated;
    } else {
        // Create
        const [created] = await db
            .insert(welcomeConfig)
            .values({
                guildId,
                ...data,
                createdAt: new Date(),
                updatedAt: new Date()
            })
            .returning();
        return created;
    }
}

/**
 * Send welcome message for a new member
 */
export async function sendWelcomeMessage(member: GuildMember): Promise<boolean> {
    try {
        const config = await getWelcomeConfig(member.guild.id);

        if (!config?.enabled) {
            return false;
        }

        // Check cooldown
        if (config.cooldownEnabled && config.cooldownSeconds) {
            const cooldownKey = `${member.guild.id}:welcome`;
            const lastWelcome = welcomeCooldowns.get(cooldownKey) || 0;
            const now = Date.now();

            if (now - lastWelcome < config.cooldownSeconds * 1000) {
                logger.debug(`Welcome cooldown active for guild ${member.guild.id}`);
                return false;
            }

            welcomeCooldowns.set(cooldownKey, now);
        }

        // Prepare variables
        const variables = {
            user: member.toString(),
            username: member.user.username,
            tag: member.user.tag,
            server: member.guild.name,
            memberCount: member.guild.memberCount,
            accountCreated: member.user.createdAt.toLocaleDateString(),
            joinDate: new Date().toLocaleDateString()
        };

        // Generate welcome image if enabled
        let imageAttachment: AttachmentBuilder | null = null;
        if (config.imageEnabled) {
            const imageResult = await generateWelcomeImage({
                username: member.user.username,
                discriminator: member.user.discriminator,
                avatarUrl: member.user.displayAvatarURL({ extension: 'png', size: 256 }),
                serverName: member.guild.name,
                memberCount: member.guild.memberCount,
                config
            });

            if (imageResult) {
                imageAttachment = new AttachmentBuilder(imageResult.buffer, {
                    name: `welcome-${member.user.username}.png`
                });
            }
        }

        // Prepare message content
        let content: string | undefined;
        let embeds: any[] = [];

        if (config.messageTemplate) {
            const processedMessage = processWelcomeTemplate(config.messageTemplate, variables);

            if (config.embedEnabled && config.embedConfig) {
                // Send as embed
                const embedConfig = config.embedConfig as any;
                embeds = [{
                    description: processedMessage,
                    color: embedConfig.color || 0x7289da,
                    timestamp: new Date().toISOString(),
                    thumbnail: embedConfig.showAvatar ? {
                        url: member.user.displayAvatarURL()
                    } : undefined
                }];
            } else {
                // Send as plain text
                content = processedMessage;
            }
        }

        // Send message based on target type
        if (config.targetType === 'DM') {
            // Send DM
            try {
                const dmPayload: any = {};

                if (imageAttachment && config.imageSendMode === 'IMAGE_ONLY') {
                    dmPayload.files = [imageAttachment];
                } else {
                    if (content) dmPayload.content = content;
                    if (embeds.length) dmPayload.embeds = embeds;
                    if (imageAttachment) dmPayload.files = [imageAttachment];
                }

                await member.send(dmPayload);

                logger.info(`Sent welcome DM to ${member.user.tag} in ${member.guild.name}`);
                await emitGuildNotificationSafe({
                    guildId: member.guild.id,
                    eventType: 'WELCOME_MESSAGE_SENT',
                    severity: 'INFO',
                    source: 'BOT_EVENT',
                    title: `Welcome DM sent to ${member.user.tag}`,
                    targetUserId: member.id,
                    metadata: {
                        targetType: 'DM',
                        hasImage: !!imageAttachment
                    }
                });

                return true;
            } catch (error) {
                logger.warn(`Failed to send welcome DM to ${member.user.tag}:`, error);
                await emitGuildNotificationSafe({
                    guildId: member.guild.id,
                    eventType: 'WELCOME_MESSAGE_FAILED',
                    severity: 'WARNING',
                    source: 'BOT_EVENT',
                    title: `Welcome DM failed for ${member.user.tag}`,
                    body: 'User may have DMs disabled',
                    targetUserId: member.id,
                    metadata: { targetType: 'DM' }
                });
                return false;
            }
        } else {
            // Send to channel
            if (!config.channelId) {
                logger.warn(`Welcome channel not set for guild ${member.guild.id}`);
                return false;
            }

            const channel = member.guild.channels.cache.get(config.channelId) as TextChannel;
            if (!channel || !channel.isTextBased()) {
                logger.warn(`Welcome channel ${config.channelId} not found or not text-based`);
                return false;
            }

            // Check bot permissions
            const permissions = channel.permissionsFor(member.guild.members.me!);
            if (!permissions?.has('SendMessages') || !permissions?.has('AttachFiles')) {
                logger.warn(`Bot lacks permissions to send welcome message in ${channel.name}`);
                await emitGuildNotificationSafe({
                    guildId: member.guild.id,
                    eventType: 'WELCOME_MESSAGE_FAILED',
                    severity: 'ERROR',
                    source: 'BOT_EVENT',
                    title: `Welcome message failed - missing permissions`,
                    body: `Cannot send messages in ${channel.name}`,
                    targetUserId: member.id,
                    metadata: { channelId: config.channelId }
                });
                return false;
            }

            try {
                const messagePayload: any = {};

                // Handle image send mode
                if (imageAttachment && config.imageSendMode === 'IMAGE_ONLY') {
                    messagePayload.files = [imageAttachment];
                } else {
                    if (content) messagePayload.content = content;
                    if (embeds.length) messagePayload.embeds = embeds;
                    if (imageAttachment) messagePayload.files = [imageAttachment];
                }

                await channel.send(messagePayload);

                logger.info(`Sent welcome message for ${member.user.tag} in ${member.guild.name}`);
                await emitGuildNotificationSafe({
                    guildId: member.guild.id,
                    eventType: 'WELCOME_MESSAGE_SENT',
                    severity: 'INFO',
                    source: 'BOT_EVENT',
                    title: `Welcome message sent for ${member.user.tag}`,
                    targetUserId: member.id,
                    metadata: {
                        targetType: 'CHANNEL',
                        channelId: config.channelId,
                        hasImage: !!imageAttachment
                    }
                });

                return true;
            } catch (error) {
                logger.error(`Failed to send welcome message for ${member.user.tag}:`, error);
                await emitGuildNotificationSafe({
                    guildId: member.guild.id,
                    eventType: 'WELCOME_MESSAGE_FAILED',
                    severity: 'ERROR',
                    source: 'BOT_EVENT',
                    title: `Welcome message failed for ${member.user.tag}`,
                    body: error instanceof Error ? error.message : 'Unknown error',
                    targetUserId: member.id,
                    metadata: { channelId: config.channelId }
                });
                return false;
            }
        }
    } catch (error) {
        logger.error('Error sending welcome message:', error);
        return false;
    }
}

/**
 * Generate preview welcome image for dashboard
 */
export async function generateWelcomePreview(
    _guildId: string,
    _userId: string,
    config: typeof welcomeConfig.$inferSelect
): Promise<Buffer | null> {
    try {
        // Use placeholder data for preview
        const imageResult = await generateWelcomeImage({
            username: 'Preview User',
            discriminator: '1234',
            avatarUrl: `https://cdn.discordapp.com/embed/avatars/${Math.floor(Math.random() * 5)}.png`,
            serverName: 'Preview Server',
            memberCount: 100,
            config
        });

        return imageResult?.buffer || null;
    } catch (error) {
        logger.error('Failed to generate welcome preview:', error);
        return null;
    }
}

/**
 * Get or create default welcome config
 */
export async function getOrCreateWelcomeConfig(guildId: string) {
    let config = await getWelcomeConfig(guildId);

    if (!config) {
        config = await saveWelcomeConfig(guildId, {
            enabled: false,
            targetType: 'CHANNEL',
            messageTemplate: 'Welcome {user} to {server}! You are member #{memberCount}.',
            embedEnabled: false,
            imageEnabled: false,
            imageSendMode: 'WITH_TEXT',
            // ProBot-style canvas size (2:1 aspect ratio)
            canvasWidth: 400,
            canvasHeight: 200,
            backgroundType: 'COLOR',
            backgroundValue: 'transparent',
            // Avatar - centered at top (ProBot style)
            avatarShape: 'CIRCLE',
            avatarX: 155,
            avatarY: 10,
            avatarSize: 90,
            avatarBorderColor: '#ffffff',
            avatarBorderWidth: 0,
            // Username - centered below avatar
            usernameX: 200,
            usernameY: 115,
            usernameFont: 'Arial',
            usernameSize: 18,
            usernameColor: '#ffffff',
            usernameAlign: 'center',
            // Subtitle - centered below username
            subtitleEnabled: true,
            subtitleTemplate: 'Welcome to {server}!',
            subtitleX: 200,
            subtitleY: 140,
            subtitleFont: 'Arial',
            subtitleSize: 16,
            subtitleColor: '#ffffff',
            // Server name (hidden by default)
            showServerName: false,
            serverNameX: 200,
            serverNameY: 30,
            serverNameFont: 'Arial',
            serverNameSize: 20,
            serverNameColor: '#ffffff',
            cooldownEnabled: false,
            cooldownSeconds: 5
        });
    }

    return config;
}
