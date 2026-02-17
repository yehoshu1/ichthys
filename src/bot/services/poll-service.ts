import { eq, and, desc, asc, sql, lte } from 'drizzle-orm';
import { db } from '@shared/database/client';
import { pollService as pollDomainService } from '@shared/services/poll-domain-service';
import crypto from 'crypto';
import { webhookService } from './webhook-service';
import {
    poll,
    pollOption,
    pollVote,
    Poll,
    PollOption,
    PollVote,
    NewPoll,
    NewPollVote,
} from '@shared/database/schema';

// Helper to anonymize user IDs for anonymous polls
function anonymizeUserId(userId: string, pollId: string): string {
    const secret = process.env.ANONYMIZE_SECRET;
    if (!secret || secret.trim().length < 16) {
        throw new Error('ANONYMIZE_SECRET is required and must be at least 16 characters');
    }

    // Create a deterministic hash that's unique per poll but can't be reversed
    return crypto
        .createHmac('sha256', secret)
        .update(`${pollId}:${userId}`)
        .digest('hex');
}

// ═══════════════════════════════════════════════════════════════════════════════
// POLL SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

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

export interface VoteData {
    pollId: string;
    optionId: string;
    userId: string;
}

export interface PollResults {
    totalVotes: number;
    options: {
        option: PollOption;
        voteCount: number;
        percentage: number;
        voters?: string[]; // Empty if anonymous
    }[];
}

export class PollService {
    // ═══════════════════════════════════════════════════════════════════════════════
    // POLL CRUD
    // ═══════════════════════════════════════════════════════════════════════════════

    async createPoll(data: CreatePollData): Promise<Poll> {
        return pollDomainService.createPoll(data);
    }

    async getPollById(pollId: string): Promise<Poll | undefined> {
        const [result] = await db.select().from(poll).where(eq(poll.id, pollId));
        return result;
    }

    async getPollWithOptions(pollId: string): Promise<{ poll: Poll; options: PollOption[] } | undefined> {
        const [pollData] = await db.select().from(poll).where(eq(poll.id, pollId));
        if (!pollData) return undefined;

        const options = await db
            .select()
            .from(pollOption)
            .where(eq(pollOption.pollId, pollId))
            .orderBy(asc(pollOption.order));

        return { poll: pollData, options };
    }

    async getPollsByGuild(guildId: string, options?: { closed?: boolean; limit?: number }): Promise<Poll[]> {
        const conditions = [eq(poll.guildId, guildId)];

        if (options?.closed !== undefined) {
            conditions.push(eq(poll.closed, options.closed));
        }

        const baseQuery = db.select().from(poll).where(and(...conditions));
        
        // Apply ordering
        const orderedQuery = baseQuery.orderBy(desc(poll.createdAt));
        
        // Apply limit if specified
        if (options?.limit) {
            return await orderedQuery.limit(options.limit);
        }
        
        return await orderedQuery;
    }

    async updatePoll(pollId: string, data: Partial<NewPoll>): Promise<Poll | undefined> {
        return pollDomainService.updatePoll(pollId, data);
    }

    async updatePollWithOptions(
        pollId: string,
        data: Partial<NewPoll>,
        normalizedOptions?: Array<{ text: string; emoji?: string | null; dateTimeValue?: Date | null }>
    ): Promise<Poll | undefined> {
        return pollDomainService.updatePollWithOptions(pollId, data, normalizedOptions);
    }

    async deletePoll(pollId: string): Promise<boolean> {
        return pollDomainService.deletePollWithRelations(pollId);
    }

    async deletePollWithRelations(pollId: string): Promise<boolean> {
        return pollDomainService.deletePollWithRelations(pollId);
    }

    async deletePollWithArtifacts(pollId: string): Promise<boolean> {
        return pollDomainService.deletePollWithArtifacts(pollId);
    }

    async setPollMessageId(pollId: string, messageId: string): Promise<void> {
        await pollDomainService.setPollMessageId(pollId, messageId);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // VOTING
    // ═══════════════════════════════════════════════════════════════════════════════

    async getVote(pollId: string, userId: string, optionId: string, isAnonymous: boolean = false): Promise<PollVote | undefined> {
        const lookupUserId = isAnonymous ? anonymizeUserId(userId, pollId) : userId;
        const [result] = await db
            .select()
            .from(pollVote)
            .where(
                and(
                    eq(pollVote.pollId, pollId),
                    eq(pollVote.userId, lookupUserId),
                    eq(pollVote.optionId, optionId)
                )
            );
        return result;
    }

    async getUserVotes(pollId: string, userId: string, isAnonymous: boolean = false): Promise<PollVote[]> {
        const lookupUserId = isAnonymous ? anonymizeUserId(userId, pollId) : userId;
        return await db
            .select()
            .from(pollVote)
            .where(and(eq(pollVote.pollId, pollId), eq(pollVote.userId, lookupUserId)));
    }

    async getVotesByOption(optionId: string): Promise<(typeof pollVote.$inferSelect)[]> {
        return await db
            .select()
            .from(pollVote)
            .where(eq(pollVote.optionId, optionId));
    }

    async castVote(data: VoteData): Promise<{ success: boolean; message?: string }> {
        const pollData = await this.getPollById(data.pollId);
        if (!pollData) {
            return { success: false, message: 'Poll not found' };
        }

        if (pollData.closed) {
            return { success: false, message: 'This poll is closed' };
        }

        if (pollData.endTime && new Date() > pollData.endTime) {
            await this.closePoll(data.pollId);
            return { success: false, message: 'This poll has ended' };
        }

        const option = await db
            .select()
            .from(pollOption)
            .where(and(eq(pollOption.id, data.optionId), eq(pollOption.pollId, data.pollId)))
            .then(rows => rows[0]);

        if (!option) {
            return { success: false, message: 'Invalid option' };
        }

        const isAnonymous = pollData.type === 'ANONYMOUS';
        const lookupUserId = isAnonymous ? anonymizeUserId(data.userId, data.pollId) : data.userId;

        // Check if user already voted for this option
        const existingVote = await this.getVote(data.pollId, data.userId, data.optionId, isAnonymous);
        if (existingVote) {
            // Remove vote (toggle)
            await db.delete(pollVote).where(eq(pollVote.id, existingVote.id));
            return { success: true, message: 'Vote removed' };
        }

        // Check vote limits
        if (!pollData.allowMultipleVotes) {
            // Remove any existing votes first
            const userVotes = await this.getUserVotes(data.pollId, data.userId, isAnonymous);
            if (userVotes.length > 0) {
                for (const vote of userVotes) {
                    await db.delete(pollVote).where(eq(pollVote.id, vote.id));
                }
            }
        } else if (pollData.maxVotesPerUser) {
            const userVotes = await this.getUserVotes(data.pollId, data.userId, isAnonymous);
            if (userVotes.length >= pollData.maxVotesPerUser) {
                return { success: false, message: `You can only vote for ${pollData.maxVotesPerUser} option(s)` };
            }
        }

        // Cast the vote
        const voteData: NewPollVote = {
            pollId: data.pollId,
            optionId: data.optionId,
            userId: lookupUserId, // Use anonymized ID for anonymous polls
        };
        await db.insert(pollVote).values(voteData);

        // Trigger webhook for poll vote
        await webhookService.triggerEvent(pollData.guildId, 'poll.voted', {
            pollId: data.pollId,
            pollQuestion: pollData.question,
            optionId: data.optionId,
            userId: data.userId,
            isAnonymous: isAnonymous,
        });

        return { success: true };
    }

    async removeAllUserVotes(pollId: string, userId: string, isAnonymous: boolean = false): Promise<boolean> {
        const lookupUserId = isAnonymous ? anonymizeUserId(userId, pollId) : userId;
        const result = await db
            .delete(pollVote)
            .where(and(eq(pollVote.pollId, pollId), eq(pollVote.userId, lookupUserId)));
        return (result.rowCount ?? 0) > 0;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // RESULTS
    // ═══════════════════════════════════════════════════════════════════════════════

    async getResults(pollId: string): Promise<PollResults> {
        const pollWithOptions = await this.getPollWithOptions(pollId);
        if (!pollWithOptions) {
            return { totalVotes: 0, options: [] };
        }

        const { poll: pollData, options } = pollWithOptions;

        // Get all votes for this poll
        const allVotes = await db
            .select()
            .from(pollVote)
            .where(eq(pollVote.pollId, pollId));

        const totalVotes = allVotes.length;

        const optionResults = await Promise.all(
            options.map(async (opt) => {
                const optionVotes = allVotes.filter(v => v.optionId === opt.id);
                const voteCount = optionVotes.length;
                const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;

                return {
                    option: opt,
                    voteCount,
                    percentage,
                    voters: pollData.type === 'ANONYMOUS' ? undefined : optionVotes.map(v => v.userId),
                };
            })
        );

        // Sort by vote count descending
        optionResults.sort((a, b) => b.voteCount - a.voteCount);

        return {
            totalVotes,
            options: optionResults,
        };
    }

    async getWinningOptions(pollId: string): Promise<PollOption[]> {
        const results = await this.getResults(pollId);
        if (results.options.length === 0) return [];

        const maxVotes = results.options[0].voteCount;
        if (maxVotes === 0) return [];

        return results.options
            .filter(o => o.voteCount === maxVotes)
            .map(o => o.option);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // POLL MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════════

    async closePoll(pollId: string): Promise<Poll | undefined> {
        return pollDomainService.closePoll(pollId);
    }

    async addCustomOption(pollId: string, text: string, emoji?: string): Promise<PollOption | undefined> {
        const pollData = await this.getPollById(pollId);
        if (!pollData || !pollData.allowCustomOptions) return undefined;

        return pollDomainService.addPollOption(pollId, text, emoji);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // SCHEDULED JOBS
    // ═══════════════════════════════════════════════════════════════════════════════

    async getPollsEndingBefore(time: Date): Promise<Poll[]> {
        return await db
            .select()
            .from(poll)
            .where(
                and(
                    sql`${poll.endTime} IS NOT NULL`,
                    lte(poll.endTime, time),
                    eq(poll.closed, false)
                )
            );
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // TIME POLLS HELPERS
    // ═══════════════════════════════════════════════════════════════════════════════

    async createTimePoll(
        guildId: string,
        creatorId: string,
        channelId: string,
        question: string,
        timeOptions: Date[],
        options?: {
            description?: string;
            allowMultipleVotes?: boolean;
            anonymous?: boolean;
            endTime?: Date;
        }
    ): Promise<Poll> {
        const optionsData = timeOptions.map((date, index) => ({
            text: `Option ${index + 1}`,
            dateTimeValue: date,
        }));

        return this.createPoll({
            guildId,
            creatorId,
            channelId,
            question,
            description: options?.description,
            options: optionsData,
            type: options?.anonymous ? 'ANONYMOUS' : 'TIME',
            allowMultipleVotes: options?.allowMultipleVotes ?? false,
            endTime: options?.endTime,
        });
    }

    // Get the most popular time from a time poll
    async getMostPopularTime(pollId: string): Promise<Date | null> {
        const winningOptions = await this.getWinningOptions(pollId);
        if (winningOptions.length === 0) return null;

        // Return the first winning option's dateTimeValue
        return winningOptions[0].dateTimeValue ?? null;
    }
}

export const pollService = new PollService();
