import { eq, and, desc, asc, sql, lte } from 'drizzle-orm';
import { db } from '@shared/database/client';
import {
    poll,
    pollOption,
    pollVote,
    Poll,
    PollOption,
    PollVote,
    NewPoll,
    NewPollOption,
    NewPollVote,
} from '@shared/database/schema';

// ═══════════════════════════════════════════════════════════════════════════════
// POLL SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreatePollData {
    guildId: string;
    creatorId: string;
    channelId: string;
    question: string;
    description?: string;
    options: { text: string; emoji?: string; dateTimeValue?: Date }[];
    type: 'STANDARD' | 'TIME' | 'ANONYMOUS';
    allowMultipleVotes?: boolean;
    maxVotesPerUser?: number;
    allowCustomOptions?: boolean;
    allowedRoleIds?: string[];
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
        const pollData: NewPoll = {
            guildId: data.guildId,
            creatorId: data.creatorId,
            channelId: data.channelId,
            question: data.question,
            description: data.description,
            type: data.type,
            allowMultipleVotes: data.allowMultipleVotes ?? false,
            maxVotesPerUser: data.maxVotesPerUser,
            allowCustomOptions: data.allowCustomOptions ?? false,
            allowedRoleIds: data.allowedRoleIds,
            endTime: data.endTime,
            closed: false,
        };

        const [createdPoll] = await db.insert(poll).values(pollData).returning();

        // Create options
        for (let i = 0; i < data.options.length; i++) {
            const opt = data.options[i];
            const optionData: NewPollOption = {
                pollId: createdPoll.id,
                optionIndex: i,
                text: opt.text,
                emoji: opt.emoji,
                dateTimeValue: opt.dateTimeValue,
            };
            await db.insert(pollOption).values(optionData);
        }

        return createdPoll;
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
            .orderBy(asc(pollOption.optionIndex));

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
        const [updated] = await db
            .update(poll)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(poll.id, pollId))
            .returning();
        return updated;
    }

    async deletePoll(pollId: string): Promise<boolean> {
        const result = await db.delete(poll).where(eq(poll.id, pollId));
        return (result.rowCount ?? 0) > 0;
    }

    async setPollMessageId(pollId: string, messageId: string): Promise<void> {
        await db.update(poll).set({ messageId }).where(eq(poll.id, pollId));
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // VOTING
    // ═══════════════════════════════════════════════════════════════════════════════

    async getVote(pollId: string, userId: string, optionId: string): Promise<PollVote | undefined> {
        const [result] = await db
            .select()
            .from(pollVote)
            .where(
                and(
                    eq(pollVote.pollId, pollId),
                    eq(pollVote.userId, userId),
                    eq(pollVote.optionId, optionId)
                )
            );
        return result;
    }

    async getUserVotes(pollId: string, userId: string): Promise<PollVote[]> {
        return await db
            .select()
            .from(pollVote)
            .where(and(eq(pollVote.pollId, pollId), eq(pollVote.userId, userId)));
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

        // Check if user already voted for this option
        const existingVote = await this.getVote(data.pollId, data.userId, data.optionId);
        if (existingVote) {
            // Remove vote (toggle)
            await db.delete(pollVote).where(eq(pollVote.id, existingVote.id));
            return { success: true, message: 'Vote removed' };
        }

        // Check vote limits
        if (!pollData.allowMultipleVotes) {
            // Remove any existing votes first
            const userVotes = await this.getUserVotes(data.pollId, data.userId);
            if (userVotes.length > 0) {
                for (const vote of userVotes) {
                    await db.delete(pollVote).where(eq(pollVote.id, vote.id));
                }
            }
        } else if (pollData.maxVotesPerUser) {
            const userVotes = await this.getUserVotes(data.pollId, data.userId);
            if (userVotes.length >= pollData.maxVotesPerUser) {
                return { success: false, message: `You can only vote for ${pollData.maxVotesPerUser} option(s)` };
            }
        }

        // Cast the vote
        const voteData: NewPollVote = {
            pollId: data.pollId,
            optionId: data.optionId,
            userId: data.userId,
        };
        await db.insert(pollVote).values(voteData);

        return { success: true };
    }

    async removeAllUserVotes(pollId: string, userId: string): Promise<boolean> {
        const result = await db
            .delete(pollVote)
            .where(and(eq(pollVote.pollId, pollId), eq(pollVote.userId, userId)));
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
        const [updated] = await db
            .update(poll)
            .set({ closed: true, closedAt: new Date(), updatedAt: new Date() })
            .where(eq(poll.id, pollId))
            .returning();
        return updated;
    }

    async addCustomOption(pollId: string, text: string, emoji?: string): Promise<PollOption | undefined> {
        const pollData = await this.getPollById(pollId);
        if (!pollData || !pollData.allowCustomOptions) return undefined;

        const existingOptions = await db
            .select()
            .from(pollOption)
            .where(eq(pollOption.pollId, pollId));

        const optionData: NewPollOption = {
            pollId,
            optionIndex: existingOptions.length,
            text,
            emoji,
        };

        const [created] = await db.insert(pollOption).values(optionData).returning();
        return created;
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
