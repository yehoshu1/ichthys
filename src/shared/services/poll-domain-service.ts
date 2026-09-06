import { asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@shared/database/client';
import { poll, pollOption, pollVote, type NewPoll, type NewPollOption, type Poll, type PollOption } from '@shared/database/schema';
import { webhookService } from '../../bot/services/webhook-service';

export interface CreatePollData {
    guildId: string;
    creatorId: string;
    channelId: string;
    question: string;
    description?: string;
    color?: string;
    options: { text: string; emoji?: string; dateTimeValue?: Date }[];
    type: 'STANDARD' | 'TIME' | 'ANONYMOUS';
    allowMultipleVotes?: boolean;
    maxVotesPerUser?: number;
    allowCustomOptions?: boolean;
    allowedRoleIds?: string[];
    mentionRoleIds?: string[];
    mentionOnCreate?: boolean;
    endTime?: Date | null;
}

async function deleteDiscordPollMessage(channelId: string, messageId: string): Promise<void> {
    const token = process.env.DISCORD_TOKEN;
    if (!token) return;

    try {
        await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bot ${token}` },
        });
    } catch {
        // Best effort cleanup.
    }
}

class PollDomainService {
    async createPoll(data: CreatePollData): Promise<Poll> {
        const pollData: NewPoll = {
            guildId: data.guildId,
            creatorId: data.creatorId,
            channelId: data.channelId,
            question: data.question,
            description: data.description,
            color: data.color,
            type: data.type,
            allowMultipleVotes: data.allowMultipleVotes ?? false,
            maxVotesPerUser: data.maxVotesPerUser,
            allowCustomOptions: data.allowCustomOptions ?? false,
            allowedRoleIds: data.allowedRoleIds,
            mentionRoleIds: data.mentionRoleIds,
            mentionOnCreate: data.mentionOnCreate ?? false,
            endTime: data.endTime,
            closed: false,
        };

        const [createdPoll] = await db.insert(poll).values(pollData).returning();

        for (let i = 0; i < data.options.length; i++) {
            const opt = data.options[i];
            const optionData: NewPollOption = {
                pollId: createdPoll.id,
                order: i,
                text: opt.text,
                emoji: opt.emoji,
                dateTimeValue: opt.dateTimeValue,
            };
            await db.insert(pollOption).values(optionData);
        }

        await webhookService.triggerEvent(createdPoll.guildId, 'poll.created', {
            pollId: createdPoll.id,
            question: createdPoll.question,
            type: createdPoll.type,
            channelId: createdPoll.channelId,
            endTime: createdPoll.endTime,
            optionCount: data.options.length,
            creatorId: createdPoll.creatorId,
        });

        return createdPoll;
    }

    async getPollById(pollId: string): Promise<Poll | undefined> {
        const [result] = await db.select().from(poll).where(eq(poll.id, pollId));
        return result;
    }

    async updatePoll(pollId: string, data: Partial<NewPoll>): Promise<Poll | undefined> {
        const [updated] = await db
            .update(poll)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(poll.id, pollId))
            .returning();
        return updated;
    }

    async updatePollWithOptions(
        pollId: string,
        data: Partial<NewPoll>,
        normalizedOptions?: Array<{ text: string; emoji?: string | null; dateTimeValue?: Date | null }>
    ): Promise<Poll | undefined> {
        return await db.transaction(async (tx) => {
            const [updated] = await tx
                .update(poll)
                .set({ ...data, updatedAt: new Date() })
                .where(eq(poll.id, pollId))
                .returning();

            if (!updated || !normalizedOptions) {
                return updated;
            }

            const existingOptions = await tx
                .select()
                .from(pollOption)
                .where(eq(pollOption.pollId, pollId))
                .orderBy(asc(pollOption.order));

            for (let i = 0; i < normalizedOptions.length; i++) {
                const option = normalizedOptions[i];
                const existingOption = existingOptions[i];

                if (existingOption) {
                    await tx
                        .update(pollOption)
                        .set({
                            order: i,
                            text: option.text,
                            emoji: option.emoji ?? null,
                            dateTimeValue: option.dateTimeValue ?? null,
                        })
                        .where(eq(pollOption.id, existingOption.id));
                } else {
                    await tx.insert(pollOption).values({
                        pollId,
                        order: i,
                        text: option.text,
                        emoji: option.emoji ?? null,
                        dateTimeValue: option.dateTimeValue ?? null,
                    });
                }
            }

            if (existingOptions.length > normalizedOptions.length) {
                const optionIdsToRemove = existingOptions
                    .slice(normalizedOptions.length)
                    .map((option) => option.id);

                if (optionIdsToRemove.length > 0) {
                    await tx.delete(pollVote).where(inArray(pollVote.optionId, optionIdsToRemove));
                    await tx.delete(pollOption).where(inArray(pollOption.id, optionIdsToRemove));
                }
            }

            return updated;
        });
    }

    async closePoll(pollId: string): Promise<Poll | undefined> {
        const pollData = await this.getPollById(pollId);
        if (!pollData) return undefined;

        const [updated] = await db
            .update(poll)
            .set({ closed: true, closedAt: new Date(), updatedAt: new Date() })
            .where(eq(poll.id, pollId))
            .returning();

        const result = await db
            .select({ count: sql<number>`count(*)`.mapWith(Number) })
            .from(pollVote)
            .where(eq(pollVote.pollId, pollId));

        await webhookService.triggerEvent(pollData.guildId, 'poll.closed', {
            pollId,
            pollQuestion: pollData.question,
            totalVotes: result[0]?.count ?? 0,
        });

        return updated;
    }

    async deletePollWithRelations(pollId: string): Promise<boolean> {
        return await db.transaction(async (tx) => {
            await tx.delete(pollVote).where(eq(pollVote.pollId, pollId));
            await tx.delete(pollOption).where(eq(pollOption.pollId, pollId));
            const result = await tx.delete(poll).where(eq(poll.id, pollId));
            return (result.rowCount ?? 0) > 0;
        });
    }

    async deletePollWithArtifacts(pollId: string): Promise<boolean> {
        const pollData = await this.getPollById(pollId);
        if (!pollData) return false;

        if (pollData.channelId && pollData.messageId) {
            await deleteDiscordPollMessage(pollData.channelId, pollData.messageId);
        }

        return this.deletePollWithRelations(pollId);
    }

    async setPollMessageId(pollId: string, messageId: string): Promise<void> {
        await db.update(poll).set({ messageId }).where(eq(poll.id, pollId));
    }

    async addPollOption(pollId: string, text: string, emoji?: string): Promise<PollOption> {
        const existingOptions = await db
            .select()
            .from(pollOption)
            .where(eq(pollOption.pollId, pollId))
            .orderBy(asc(pollOption.order));

        const optionData: NewPollOption = {
            pollId,
            order: existingOptions.length,
            text,
            emoji,
        };

        const [created] = await db.insert(pollOption).values(optionData).returning();
        return created;
    }
}

export const pollService = new PollDomainService();
