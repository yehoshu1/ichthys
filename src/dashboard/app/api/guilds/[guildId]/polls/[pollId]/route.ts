import { NextRequest, NextResponse } from 'next/server';
import { db, poll, pollOption, pollVote } from '@/lib/db';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import logger from '@/lib/logger';
import { authorizeGuildApiRequest } from '@/lib/guild-api-auth';
import { requireGuildModuleEnabled } from '@/lib/module-gate';
import { pollService } from '@shared/services/poll-domain-service';

// Validation constants
const MAX_POLL_QUESTION_LENGTH = 200;
const MAX_POLL_DESCRIPTION_LENGTH = 1000;
const MAX_POLL_OPTIONS = 20;
const MAX_OPTION_TEXT_LENGTH = 100;

const updatePollSchema = z.object({
    question: z.string().min(1).max(MAX_POLL_QUESTION_LENGTH).optional(),
    description: z.string().max(MAX_POLL_DESCRIPTION_LENGTH).optional(),
    channelId: z.string().min(1).optional(),
    allowMultipleVotes: z.boolean().optional(),
    maxVotesPerUser: z.number().int().min(1).max(20).optional(),
    allowCustomOptions: z.boolean().optional(),
    type: z.enum(['STANDARD', 'TIME', 'ANONYMOUS']).optional(),
    isAnonymous: z.boolean().optional(),
    allowedRoleIds: z.array(z.string()).optional(),
    mentionRoleIds: z.array(z.string()).optional(),
    mentionOnCreate: z.boolean().optional(),
    endTime: z.string().datetime().nullable().optional(),
    options: z.array(z.object({
        text: z.string(),
        emoji: z.string().optional(),
    })).optional(),
    timeSlots: z.array(z.string()).optional(),
    closed: z.boolean().optional(),
    isClosed: z.boolean().optional(),
}).strict();

function formatDiscordTimestampLabel(date: Date): string {
    const unix = Math.floor(date.getTime() / 1000);
    return `<t:${unix}:F>`;
}

// GET /api/guilds/[guildId]/polls/[pollId] - Get a specific poll
export async function GET(
    request: NextRequest,
    props: { params: Promise<{ guildId: string; pollId: string }> }
) {
    try {
        const { guildId, pollId } = await props.params;
        const auth = await authorizeGuildApiRequest(request, guildId, 'polls:read');
        if ('response' in auth) {
            return auth.response;
        }
        const moduleGuard = await requireGuildModuleEnabled(guildId, 'polls');
        if (moduleGuard) return moduleGuard;

        const [pollData] = await db
            .select()
            .from(poll)
            .where(and(eq(poll.id, pollId), eq(poll.guildId, guildId)));

        if (!pollData) {
            return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
        }

        // Get options with vote counts
        const options = await db
            .select()
            .from(pollOption)
            .where(eq(pollOption.pollId, pollId))
            .orderBy(pollOption.order);

        const optionIds = options.map((opt) => opt.id);
        const voteCounts = optionIds.length
            ? await db
                .select({
                    optionId: pollVote.optionId,
                    count: sql<number>`count(*)`,
                })
                .from(pollVote)
                .where(inArray(pollVote.optionId, optionIds))
                .groupBy(pollVote.optionId)
            : [];

        const votesByOption = new Map<string, number>();
        for (const row of voteCounts) {
            votesByOption.set(row.optionId, Number(row.count ?? 0));
        }

        const optionsWithVotes = options.map((opt) => ({
            ...opt,
            voteCount: votesByOption.get(opt.id) ?? 0,
        }));

        const [totalVotesRow] = await db
            .select({ count: sql<number>`count(*)` })
            .from(pollVote)
            .where(eq(pollVote.pollId, pollId));

        return NextResponse.json({
            ...pollData,
            options: optionsWithVotes,
            voteCount: Number(totalVotesRow?.count ?? 0),
        });
    } catch (error) {
        logger.error('Error fetching poll:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/guilds/[guildId]/polls/[pollId] - Update a poll
export async function PATCH(
    request: NextRequest,
    props: { params: Promise<{ guildId: string; pollId: string }> }
) {
    try {
        const { guildId, pollId } = await props.params;
        const auth = await authorizeGuildApiRequest(request, guildId, 'polls:write');
        if ('response' in auth) {
            return auth.response;
        }
        const moduleGuard = await requireGuildModuleEnabled(guildId, 'polls');
        if (moduleGuard) return moduleGuard;
        const body = await request.json();
        const parsed = updatePollSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid request body', details: parsed.error.issues },
                { status: 400 }
            );
        }
        const data = parsed.data;

        // Check if poll exists and belongs to guild
        const [existingPoll] = await db
            .select()
            .from(poll)
            .where(and(eq(poll.id, pollId), eq(poll.guildId, guildId)));

        if (!existingPoll) {
            return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
        }

        // Validate field lengths
        const closedInput = data.closed ?? data.isClosed;

        const hasOptionsUpdate = Array.isArray(data.options) || Array.isArray(data.timeSlots);
        let normalizedOptions: Array<{ text: string; emoji?: string | null; dateTimeValue?: Date | null }> | undefined;

        if (Array.isArray(data.timeSlots)) {
            normalizedOptions = data.timeSlots.map((slot: string) => {
                const date = new Date(slot);
                if (Number.isNaN(date.getTime())) {
                    throw new Error(`Invalid time slot: ${slot}`);
                }
                return {
                    text: formatDiscordTimestampLabel(date),
                    dateTimeValue: date,
                    emoji: null,
                };
            });
        } else if (Array.isArray(data.options)) {
            normalizedOptions = data.options.map((option: { text: string; emoji?: string }) => ({
                text: option.text,
                emoji: option.emoji || null,
                dateTimeValue: null,
            }));
        }

        if (hasOptionsUpdate && normalizedOptions) {
            if (normalizedOptions.length === 0) {
                return NextResponse.json(
                    { error: 'Poll must have at least one option' },
                    { status: 400 }
                );
            }

            if (normalizedOptions.length > MAX_POLL_OPTIONS) {
                return NextResponse.json(
                    { error: `Cannot have more than ${MAX_POLL_OPTIONS} options` },
                    { status: 400 }
                );
            }

            const nextType = data.type || (data.isAnonymous ? 'ANONYMOUS' : existingPoll.type);
            if (nextType !== 'TIME' && normalizedOptions.length < 2) {
                return NextResponse.json(
                    { error: 'At least 2 options are required' },
                    { status: 400 }
                );
            }

            for (const option of normalizedOptions) {
                if (!option.text?.trim()) {
                    return NextResponse.json(
                        { error: 'Option text cannot be empty' },
                        { status: 400 }
                    );
                }
                if (option.text.length > MAX_OPTION_TEXT_LENGTH) {
                    return NextResponse.json(
                        { error: `Option text cannot exceed ${MAX_OPTION_TEXT_LENGTH} characters` },
                        { status: 400 }
                    );
                }
            }
        }

        const updateData: Partial<typeof poll.$inferInsert> = {
            updatedAt: new Date(),
        };

        if (data.question !== undefined) updateData.question = data.question;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.channelId !== undefined) updateData.channelId = data.channelId;
        if (data.allowMultipleVotes !== undefined) updateData.allowMultipleVotes = data.allowMultipleVotes;
        if (data.maxVotesPerUser !== undefined) updateData.maxVotesPerUser = data.maxVotesPerUser;
        if (data.allowCustomOptions !== undefined) updateData.allowCustomOptions = data.allowCustomOptions;
        if (data.type !== undefined) updateData.type = data.type;
        if (data.isAnonymous === true) updateData.type = 'ANONYMOUS';
        if (data.allowedRoleIds !== undefined) updateData.allowedRoleIds = data.allowedRoleIds;
        if (data.mentionRoleIds !== undefined) updateData.mentionRoleIds = data.mentionRoleIds;
        if (data.mentionOnCreate !== undefined) updateData.mentionOnCreate = data.mentionOnCreate;
        if (data.endTime !== undefined) updateData.endTime = data.endTime ? new Date(data.endTime) : null;

        if (closedInput !== undefined) {
            delete updateData.closed;
            delete updateData.closedAt;
        }

        const updatedPoll = await pollService.updatePollWithOptions(pollId, updateData, normalizedOptions);
        if (!updatedPoll) {
            return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
        }

        if (closedInput === true && !existingPoll.closed) {
            const closedPoll = await pollService.closePoll(pollId);
            if (!closedPoll) {
                return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
            }
            return NextResponse.json(closedPoll);
        }

        if (closedInput === false && existingPoll.closed) {
            const reopened = await pollService.updatePoll(pollId, { closed: false, closedAt: null });
            if (!reopened) {
                return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
            }
            return NextResponse.json(reopened);
        }

        return NextResponse.json(updatedPoll);
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('Invalid time slot:')) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        logger.error('Error updating poll:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/guilds/[guildId]/polls/[pollId] - Delete a poll
export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ guildId: string; pollId: string }> }
) {
    try {
        const { guildId, pollId } = await props.params;
        const auth = await authorizeGuildApiRequest(request, guildId, 'polls:write');
        if ('response' in auth) {
            return auth.response;
        }
        const moduleGuard = await requireGuildModuleEnabled(guildId, 'polls');
        if (moduleGuard) return moduleGuard;

        // Check if poll exists and belongs to guild
        const [existingPoll] = await db
            .select()
            .from(poll)
            .where(and(eq(poll.id, pollId), eq(poll.guildId, guildId)));

        if (!existingPoll) {
            return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
        }

        await pollService.deletePollWithArtifacts(pollId);

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('Error deleting poll:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
