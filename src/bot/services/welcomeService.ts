import { GuildMember, TextChannel, AttachmentBuilder } from 'discord.js';
import { db } from '../../shared/database/client';
import { welcomeConfig, WelcomeConfig } from '../../shared/database/schema';
import { eq } from 'drizzle-orm';
import { generateWelcomeImage, processWelcomeTemplate } from './welcomeImageGenerator';
import logger from '../utils/logger';

// Cooldown tracking
const welcomeCooldowns = new Map<string, number>();

/**
 * Get welcome configuration for a guild
 */
export async function getWelcomeConfig(guildId: string): Promise<WelcomeConfig | null> {
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
 * Helper to build and send a message payload
 */
async function sendConfiguredMessage(
    member: GuildMember,
    config: any,
    type: 'welcome' | 'private' | 'goodbye',
    target: 'CHANNEL' | 'DM' = 'CHANNEL',
    channelId: string | null = null,
    isBot: boolean
): Promise<boolean> {
    const isPrivate = type === 'private';
    const isGoodbye = type === 'goodbye';

    const enabledKey = isPrivate ? 'privateEnabled' : isGoodbye ? 'goodbyeEnabled' : 'enabled';
    const botsKey = isPrivate ? null : isGoodbye ? 'goodbyeBotsEnabled' : 'welcomeBotsEnabled';
    const msgKey = isPrivate ? 'privateMessageTemplate' : isGoodbye ? 'goodbyeMessageTemplate' : 'messageTemplate';
    const embedEnabledKey = isPrivate ? 'privateEmbedEnabled' : isGoodbye ? 'goodbyeEmbedEnabled' : 'embedEnabled';
    const embedConfigKey = isPrivate ? 'privateEmbedConfig' : isGoodbye ? 'goodbyeEmbedConfig' : 'embedConfig';
    const imageEnabledKey = isPrivate ? 'privateImageEnabled' : isGoodbye ? 'goodbyeImageEnabled' : 'imageEnabled';

    if (!config[enabledKey]) return false;
    if (isBot && botsKey && !config[botsKey]) return false;

    // Check cooldown for public welcome/leave (skip private)
    if (!isPrivate && config.cooldownEnabled && config.cooldownSeconds) {
        const cooldownKey = `${member.guild.id}:${type}`;
        const lastSent = welcomeCooldowns.get(cooldownKey) || 0;
        const now = Date.now();

        if (now - lastSent < config.cooldownSeconds * 1000) {
            logger.debug(`${type} cooldown active for guild ${member.guild.id}`);
            return false;
        }

        welcomeCooldowns.set(cooldownKey, now);
    }

    const variables = {
        user: member.toString(),
        username: member.user.username,
        tag: member.user.tag,
        server: member.guild.name,
        memberCount: member.guild.memberCount,
        accountCreated: member.user.createdAt.toLocaleDateString(),
        joinDate: new Date().toLocaleDateString()
    };

    let imageAttachment: AttachmentBuilder | null = null;
    if (config[imageEnabledKey]) {
        const imageResult = await generateWelcomeImage({
            username: member.user.username,
            discriminator: member.user.discriminator,
            avatarUrl: member.user.displayAvatarURL({ extension: 'png', size: 256 }),
            serverName: member.guild.name,
            memberCount: member.guild.memberCount,
            config,
            prefix: isPrivate ? 'private' : isGoodbye ? 'goodbye' : ''
        });

        if (imageResult) {
            imageAttachment = new AttachmentBuilder(imageResult.buffer, {
                name: `${type}-${member.user.username}.png`
            });
        }
    }

    let content: string | undefined;
    let embeds: any[] = [];

    const template = config[msgKey];
    if (template) {
        content = processWelcomeTemplate(template, variables);
    }

    if (config[embedEnabledKey] && config[embedConfigKey]) {
        const embedConfig = config[embedConfigKey] as any;
        const embedTitle = embedConfig.title ? processWelcomeTemplate(embedConfig.title, variables) : undefined;
        const embedDesc = embedConfig.description ? processWelcomeTemplate(embedConfig.description, variables) : undefined;
        
        let colorInt = 0x7289da;
        if (embedConfig.color) {
            const hex = embedConfig.color.replace('#', '');
            if (hex) colorInt = parseInt(hex, 16);
        }

        embeds = [{
            title: embedTitle,
            description: embedDesc,
            color: colorInt,
            timestamp: new Date().toISOString(),
            thumbnail: embedConfig.showAvatar ? {
                url: member.user.displayAvatarURL()
            } : undefined
        }];
    }

    const payload: any = {};
    if (imageAttachment && config.imageSendMode === 'IMAGE_ONLY') {
        payload.files = [imageAttachment];
    } else {
        if (content) payload.content = content;
        if (embeds.length) payload.embeds = embeds;
        if (imageAttachment) payload.files = [imageAttachment];
    }

    if (Object.keys(payload).length === 0) return false;

    if (target === 'DM') {
        try {
            await member.send(payload);
            return true;
        } catch (error) {
            logger.warn(`Failed to send ${type} DM to ${member.user.tag}:`, error);
            return false;
        }
    } else {
        if (!channelId) return false;
        const channel = member.guild.channels.cache.get(channelId) as TextChannel;
        if (!channel || !channel.isTextBased()) return false;

        const permissions = channel.permissionsFor(member.guild.members.me!);
        if (!permissions?.has('SendMessages') || (imageAttachment && !permissions?.has('AttachFiles'))) {
            return false;
        }

        try {
            await channel.send(payload);
            return true;
        } catch (error) {
            logger.error(`Failed to send ${type} message for ${member.user.tag}:`, error);
            return false;
        }
    }
}

/**
 * Send welcome messages (both channel and DM) for a new member
 */
export async function sendWelcomeMessage(member: GuildMember): Promise<boolean> {
    try {
        const config = await getWelcomeConfig(member.guild.id);
        if (!config) return false;

        const isBot = member.user.bot;
        let sentAny = false;

        // 1. Send public welcome message
        if (config.enabled) {
            const sent = await sendConfiguredMessage(member, config, 'welcome', 'CHANNEL', config.channelId, isBot);
            if (sent) sentAny = true;
        }

        // 2. Send private welcome message
        if (config.privateEnabled) {
            // we don't pass botsKey for private since bots can't be DMed anyway
            if (!isBot) {
                const sent = await sendConfiguredMessage(member, config, 'private', 'DM', null, false);
                if (sent) sentAny = true;
            }
        }

        return sentAny;
    } catch (error) {
        logger.error('Error sending welcome message:', error);
        return false;
    }
}

/**
 * Send leave message for a member that left
 */
export async function sendLeaveMessage(member: GuildMember): Promise<boolean> {
    try {
        const config = await getWelcomeConfig(member.guild.id);
        if (!config) return false;

        const isBot = member.user.bot;
        
        if (config.goodbyeEnabled) {
            return await sendConfiguredMessage(member, config, 'goodbye', 'CHANNEL', config.goodbyeChannelId, isBot);
        }

        return false;
    } catch (error) {
        logger.error('Error sending leave message:', error);
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
