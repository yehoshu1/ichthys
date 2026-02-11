import type { Message, PartialMessage, TextBasedChannel } from 'discord.js';
import client from '../client';
import logger from '../utils/logger';

interface ReplyReference {
    channelId: string;
    messageId: string;
}

interface InvocationEntry {
    replies: ReplyReference[];
    createdAt: number;
}

export class CommandReplyCleanupService {
    private readonly invocationReplyMap = new Map<string, InvocationEntry>();
    private readonly MAX_TRACKED_INVOCATIONS = 5_000;
    private readonly INVOCATION_TTL_MS = 60 * 60 * 1_000;

    private cleanupInvocationMap(now: number): void {
        for (const [key, entry] of this.invocationReplyMap.entries()) {
            if (now - entry.createdAt > this.INVOCATION_TTL_MS) {
                this.invocationReplyMap.delete(key);
            }
        }

        if (this.invocationReplyMap.size <= this.MAX_TRACKED_INVOCATIONS) {
            return;
        }

        const entries = Array.from(this.invocationReplyMap.entries()).sort((a, b) => a[1].createdAt - b[1].createdAt);
        const overflow = this.invocationReplyMap.size - this.MAX_TRACKED_INVOCATIONS;
        for (let i = 0; i < overflow; i += 1) {
            const [key] = entries[i] ?? [];
            if (key) {
                this.invocationReplyMap.delete(key);
            }
        }
    }

    async deleteMessageSafe(message: Message): Promise<void> {
        try {
            await message.delete();
        } catch (error) {
            logger.debug(`Unable to delete message ${message.id}:`, error);
        }
    }

    scheduleDelete(message: Message, seconds: number): void {
        if (seconds <= 0) return;

        setTimeout(() => {
            void this.deleteMessageSafe(message);
        }, seconds * 1_000);
    }

    linkReplyToInvocation(invocationMessageId: string, replyMessage: Message): void {
        const now = Date.now();
        this.cleanupInvocationMap(now);

        const existing = this.invocationReplyMap.get(invocationMessageId) ?? {
            replies: [],
            createdAt: now,
        };

        if (existing.replies.some((ref) => ref.messageId === replyMessage.id)) {
            return;
        }

        existing.replies.push({
            channelId: replyMessage.channelId,
            messageId: replyMessage.id,
        });
        this.invocationReplyMap.set(invocationMessageId, existing);
    }

    async handleMessageDeleted(message: Message | PartialMessage): Promise<void> {
        const entry = this.invocationReplyMap.get(message.id);
        const linkedReplies = entry?.replies ?? [];
        if (linkedReplies.length === 0) {
            return;
        }

        this.invocationReplyMap.delete(message.id);
        await Promise.all(linkedReplies.map((ref) => this.deleteLinkedReply(ref)));
    }

    private async deleteLinkedReply(reference: ReplyReference): Promise<void> {
        try {
            const channel = client.channels.cache.get(reference.channelId)
                ?? await client.channels.fetch(reference.channelId).catch((error) => { logger.warn(`Failed to fetch channel ${reference.channelId} for reply cleanup:`, error); return null; });
            if (!channel || !channel.isTextBased()) {
                return;
            }

            const textChannel = channel as TextBasedChannel;
            const message = await textChannel.messages.fetch(reference.messageId).catch((error) => { logger.warn(`Failed to fetch message ${reference.messageId} for reply cleanup:`, error); return null; });
            if (!message) {
                return;
            }

            await this.deleteMessageSafe(message);
        } catch (error) {
            logger.debug(`Failed deleting linked reply ${reference.messageId}:`, error);
        }
    }
}

export const commandReplyCleanupService = new CommandReplyCleanupService();
