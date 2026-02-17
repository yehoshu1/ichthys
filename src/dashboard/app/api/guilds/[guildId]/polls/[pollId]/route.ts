import { NextRequest, NextResponse } from 'next/server';
import { db, poll, pollOption, pollVote } from '@/lib/db';
import { eq, and, asc, inArray } from 'drizzle-orm';
import logger from '@/lib/logger';
import { authorizeGuildApiRequest } from '@/lib/guild-api-auth';
import { dispatchGuildWebhookEvent } from '@/lib/webhook-dispatch';

// Validation constants
const MAX_POLL_QUESTION_LENGTH = 200;
const MAX_POLL_DESCRIPTION_LENGTH = 1000;
const MAX_POLL_OPTIONS = 20;
const MAX_OPTION_TEXT_LENGTH = 100;

async function deleteDiscordMessage(channelId: string | null | undefined, messageId: string | null | undefined): Promise<void> {
    if (!channelId || !messageId) return;
    const token = process.env.DISCORD_TOKEN;
    if (!token) return;

    try {
        await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bot ${token}`,
            },
        });
    } catch (error) {
        logger.warn('Failed to delete poll message from Discord:', error);
    }
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

        const optionsWithVotes = await Promise.all(
            options.map(async (opt) => {
                const votes = await db
                    .select()
                    .from(pollVote)
                    .where(eq(pollVote.optionId, opt.id));
                return {
                    ...opt,
                    voteCount: votes.length,
                };
            })
        );

        // Get all votes for this poll
        const allVotes = await db
            .select()
            .from(pollVote)
            .where(eq(pollVote.pollId, pollId));

        return NextResponse.json({
            ...pollData,
            options: optionsWithVotes,
            voteCount: allVotes.length,
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
        const body = await request.json();

        // Check if poll exists and belongs to guild
        const [existingPoll] = await db
            .select()
            .from(poll)
            .where(and(eq(poll.id, pollId), eq(poll.guildId, guildId)));

        if (!existingPoll) {
            return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
        }

        // Validate field lengths
        if (body.question && body.question.length > MAX_POLL_QUESTION_LENGTH) {
            return NextResponse.json(
                { error: `Question cannot exceed ${MAX_POLL_QUESTION_LENGTH} characters` },
                { status: 400 }
            );
        }

        if (body.description && body.description.length > MAX_POLL_DESCRIPTION_LENGTH) {
            return NextResponse.json(
                { error: `Description cannot exceed ${MAX_POLL_DESCRIPTION_LENGTH} characters` },
                { status: 400 }
            );
        }

        const closedInput = body.closed ?? body.isClosed;

        const hasOptionsUpdate = Array.isArray(body.options) || Array.isArray(body.timeSlots);
        let normalizedOptions: Array<{ text: string; emoji?: string | null; dateTimeValue?: Date | null }> | undefined;

        if (Array.isArray(body.timeSlots)) {
            normalizedOptions = body.timeSlots.map((slot: string) => {
                const date = new Date(slot);
                return {
                    text: date.toLocaleString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                    }),
                    dateTimeValue: date,
                    emoji: null,
                };
            });
        } else if (Array.isArray(body.options)) {
            normalizedOptions = body.options.map((option: { text: string; emoji?: string }) => ({
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

            const nextType = body.type || (body.isAnonymous ? 'ANONYMOUS' : existingPoll.type);
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

        // Build update object
        const updateData: Partial<typeof poll.$inferInsert> = {
            updatedAt: new Date(),
        };

        if (body.question !== undefined) updateData.question = body.question;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.channelId !== undefined) updateData.channelId = body.channelId;
        if (body.allowMultipleVotes !== undefined) updateData.allowMultipleVotes = body.allowMultipleVotes;
        if (body.maxVotesPerUser !== undefined) updateData.maxVotesPerUser = body.maxVotesPerUser;
        if (body.allowCustomOptions !== undefined) updateData.allowCustomOptions = body.allowCustomOptions;
        if (body.type !== undefined) updateData.type = body.type;
        if (body.isAnonymous === true) updateData.type = 'ANONYMOUS';
        if (body.allowedRoleIds !== undefined) updateData.allowedRoleIds = body.allowedRoleIds;
        if (body.mentionRoleIds !== undefined) updateData.mentionRoleIds = body.mentionRoleIds;
        if (body.mentionOnCreate !== undefined) updateData.mentionOnCreate = body.mentionOnCreate;
        if (body.endTime !== undefined) updateData.endTime = body.endTime ? new Date(body.endTime) : null;
        if (closedInput !== undefined) {
            updateData.closed = closedInput;
            if (closedInput) {
                updateData.closedAt = new Date();
            } else {
                updateData.closedAt = null;
            }
        }

        const updatedPoll = await db.transaction(async (tx) => {
            const [updated] = await tx
                .update(poll)
                .set(updateData)
                .where(eq(poll.id, pollId))
                .returning();

            if (normalizedOptions) {
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
                    const optionsToRemove = existingOptions.slice(normalizedOptions.length);
                    const optionIdsToRemove = optionsToRemove.map((option) => option.id);

                    if (optionIdsToRemove.length > 0) {
                        await tx.delete(pollVote).where(inArray(pollVote.optionId, optionIdsToRemove));
                        await tx.delete(pollOption).where(inArray(pollOption.id, optionIdsToRemove));
                    }
                }
            }

            return updated;
        });

        if (closedInput === true && !existingPoll.closed) {
            const totalVotes = await db
                .select()
                .from(pollVote)
                .where(eq(pollVote.pollId, pollId))
                .then((rows) => rows.length);

            await dispatchGuildWebhookEvent(guildId, 'poll.closed', {
                pollId,
                pollQuestion: updatedPoll.question,
                totalVotes,
            });
        }

        return NextResponse.json(updatedPoll);
    } catch (error) {
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

        // Check if poll exists and belongs to guild
        const [existingPoll] = await db
            .select()
            .from(poll)
            .where(and(eq(poll.id, pollId), eq(poll.guildId, guildId)));

        if (!existingPoll) {
            return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
        }

        await deleteDiscordMessage(existingPoll.channelId, existingPoll.messageId);

        // Delete votes first
        await db.delete(pollVote).where(eq(pollVote.pollId, pollId));

        // Delete options
        await db.delete(pollOption).where(eq(pollOption.pollId, pollId));

        // Delete poll
        await db.delete(poll).where(eq(poll.id, pollId));

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('Error deleting poll:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
