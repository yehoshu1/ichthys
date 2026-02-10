import { Events, Message, PermissionFlagsBits } from 'discord.js';
import type { Event } from '../types/Event';
import logger from '../utils/logger';
import { db } from '../../shared/database/client';
import { moderationSettings, moderationCase } from '../../shared/database/schema';
import { eq, sql } from 'drizzle-orm';

// In-memory spam tracking
const spamTracker = new Map<string, { count: number; timestamp: number }>();
const SPAM_WINDOW_MS = 5_000;
const MAX_SPAM_TRACKER_ENTRIES = 20_000;

async function getNextCaseNumber(guildId: string): Promise<number> {
    const result = await db
        .select({ maxCase: sql<number>`max(${moderationCase.caseNumber})` })
        .from(moderationCase)
        .where(eq(moderationCase.guildId, guildId));
    return ((result[0] as any)?.maxCase || 0) + 1;
}

async function createAutoModCase(
    guildId: string,
    userId: string,
    action: 'WARN' | 'MUTE' | 'KICK',
    reason: string,
    duration?: number | null,
    expiresAt?: Date | null
) {
    const caseNumber = await getNextCaseNumber(guildId);

    await db.insert(moderationCase).values({
        guildId,
        caseNumber,
        userId,
        moderatorId: 'AUTO_MOD',
        action,
        reason,
        duration: duration ?? null,
        expiresAt: expiresAt ?? null,
        active: action !== 'KICK',
    });
}

function containsBannedWords(content: string, wordList: string[]): boolean {
    const lowerContent = content.toLowerCase();
    return wordList.some(word => {
        const lowerWord = word.toLowerCase().trim();
        // Use word boundaries to avoid partial matches
        const regex = new RegExp(`\\b${escapeRegex(lowerWord)}\\b`, 'i');
        return regex.test(lowerContent);
    });
}

function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsInviteLink(content: string): boolean {
    const inviteRegex = /(discord\.gg\/[a-zA-Z0-9-]+|discord\.com\/invite\/[a-zA-Z0-9-]+|discordapp\.com\/invite\/[a-zA-Z0-9-]+)/i;
    return inviteRegex.test(content);
}

function checkSpam(userId: string, guildId: string, threshold: number): boolean {
    const key = `${userId}:${guildId}`;
    const now = Date.now();
    const windowMs = SPAM_WINDOW_MS; // 5 seconds

    if (spamTracker.size > MAX_SPAM_TRACKER_ENTRIES) {
        for (const [trackerKey, trackerEntry] of spamTracker.entries()) {
            if (now - trackerEntry.timestamp > windowMs) {
                spamTracker.delete(trackerKey);
            }
        }

        if (spamTracker.size > MAX_SPAM_TRACKER_ENTRIES) {
            const oldest = Array.from(spamTracker.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
            const overflow = spamTracker.size - MAX_SPAM_TRACKER_ENTRIES;
            for (let i = 0; i < overflow; i += 1) {
                const [oldestKey] = oldest[i] ?? [];
                if (oldestKey) {
                    spamTracker.delete(oldestKey);
                }
            }
        }
    }

    const existing = spamTracker.get(key);

    if (!existing || now - existing.timestamp > windowMs) {
        spamTracker.set(key, { count: 1, timestamp: now });
        return false;
    }

    existing.count++;

    if (existing.count >= threshold) {
        spamTracker.delete(key);
        return true;
    }

    return false;
}

const event: Event<Events.MessageCreate> = {
    name: Events.MessageCreate,
    async execute(message: Message) {
        // Ignore bots, DMs, and messages without guild
        if (message.author.bot || !message.guild) return;

        // Ignore users with Manage Messages permission
        const member = message.member;
        if (member?.permissions.has(PermissionFlagsBits.ManageMessages)) return;

        try {
            const settings = await db.query.moderationSettings.findFirst({
                where: eq(moderationSettings.guildId, message.guild.id)
            });

            if (!settings) return;

            const content = message.content;

            // Check banned words
            if (settings.wordFilterEnabled && settings.wordFilterList) {
                const bannedWords = settings.wordFilterList.split(',').map(w => w.trim()).filter(Boolean);
                if (bannedWords.length > 0 && containsBannedWords(content, bannedWords)) {
                    await handleBannedWord(message, settings);
                    return;
                }
            }

            // Check invite links
            if (settings.inviteFilterEnabled && containsInviteLink(content)) {
                await handleInviteLink(message, settings);
                return;
            }

            // Check spam
            if (settings.autoModEnabled && settings.spamThreshold) {
                if (checkSpam(message.author.id, message.guild.id, settings.spamThreshold)) {
                    await handleSpam(message, settings);
                    return;
                }
            }
        } catch (error) {
            logger.error('Error in auto-moderation:', error);
        }
    }
};

async function handleBannedWord(message: Message, settings: any) {
    try {
        // Delete message
        await message.delete();

        const action = settings.wordFilterAction || 'WARN';

        switch (action) {
            case 'WARN':
                await message.author.send(`⚠️ Your message in **${message.guild!.name}** was deleted for containing banned words.`).catch(() => null);
                await createAutoModCase(message.guild!.id, message.author.id, 'WARN', 'Used banned words');
                break;
            case 'MUTE':
                await applyMute(message, settings, 'Used banned words');
                break;
            case 'KICK':
                await message.author.send(`👢 You have been kicked from **${message.guild!.name}** for using banned words.`).catch(() => null);
                await message.member!.kick('Used banned words');
                await createAutoModCase(message.guild!.id, message.author.id, 'KICK', 'Used banned words');
                break;
        }

        logger.info(`Auto-moderation: Deleted message with banned words from ${message.author.tag}`);
    } catch (error) {
        logger.error('Error handling banned word:', error);
    }
}

async function handleInviteLink(message: Message, settings: any) {
    try {
        await message.delete();

        const action = settings.inviteFilterAction || 'DELETE';

        if (action === 'WARN') {
            await message.author.send(`⚠️ Your message in **${message.guild!.name}** was deleted for containing invite links.`).catch(() => null);
            await createAutoModCase(message.guild!.id, message.author.id, 'WARN', 'Posted invite link');
        }

        logger.info(`Auto-moderation: Deleted invite link from ${message.author.tag}`);
    } catch (error) {
        logger.error('Error handling invite link:', error);
    }
}

async function handleSpam(message: Message, settings: any) {
    try {
        const action = settings.spamAction || 'WARN';

        switch (action) {
            case 'WARN':
                await message.author.send(`⚠️ Please slow down in **${message.guild!.name}**. Spamming is not allowed.`).catch(() => null);
                await createAutoModCase(message.guild!.id, message.author.id, 'WARN', 'Spamming');
                break;
            case 'MUTE':
                await applyMute(message, settings, 'Spamming');
                break;
            case 'KICK':
                await message.author.send(`👢 You have been kicked from **${message.guild!.name}** for spamming.`).catch(() => null);
                await message.member!.kick('Spamming');
                await createAutoModCase(message.guild!.id, message.author.id, 'KICK', 'Spamming');
                break;
        }

        logger.info(`Auto-moderation: Handled spam from ${message.author.tag}`);
    } catch (error) {
        logger.error('Error handling spam:', error);
    }
}

async function applyMute(message: Message, settings: any, reason: string) {
    if (!settings.muteRoleId) return;

    const muteRole = message.guild!.roles.cache.get(settings.muteRoleId);
    if (!muteRole) return;

    const duration = settings.spamMuteDuration || 10;
    const expiresAt = new Date(Date.now() + duration * 60 * 1000);

    await message.member!.roles.add(muteRole);
    await message.author.send(`🔇 You have been muted in **${message.guild!.name}** for ${duration} minutes${reason ? `: ${reason}` : ''}.`).catch(() => null);

    await createAutoModCase(
        message.guild!.id,
        message.author.id,
        'MUTE',
        reason,
        duration,
        expiresAt
    );
}

export default event;
