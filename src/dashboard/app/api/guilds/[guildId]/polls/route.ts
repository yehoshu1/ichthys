import { NextRequest, NextResponse } from 'next/server';
import { db, poll, pollOption, pollVote } from '@/lib/db';
import { eq, and, desc } from 'drizzle-orm';
import { authorizeGuildApiRequest } from '@/lib/guild-api-auth';
import logger from '@/lib/logger';
import { dispatchGuildWebhookEvent } from '@/lib/webhook-dispatch';

// Validation constants
const MAX_POLL_QUESTION_LENGTH = 200;
const MAX_POLL_DESCRIPTION_LENGTH = 1000;
const MAX_POLL_OPTIONS = 20;
const MAX_OPTION_TEXT_LENGTH = 100;

// GET /api/guilds/[guildId]/polls - List all polls for a guild
export async function GET(
    request: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    try {
        const { guildId: guildIdRaw } = await props.params;
        if (!guildIdRaw) {
            return NextResponse.json({ error: 'Guild ID is required' }, { status: 400 });
        }
        const guildId = guildIdRaw;
        const auth = await authorizeGuildApiRequest(request, guildId, 'polls:read');
        if ('response' in auth) {
            return auth.response;
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'active';

        let query = db.select().from(poll).where(eq(poll.guildId, guildId));

        if (status === 'active') {
            query = db.select().from(poll).where(
                and(
                    eq(poll.guildId, guildId),
                    eq(poll.closed, false)
                )
            );
        } else if (status === 'ended') {
            query = db.select().from(poll).where(
                and(
                    eq(poll.guildId, guildId),
                    eq(poll.closed, true)
                )
            );
        }

        const polls = await query.orderBy(desc(poll.createdAt));

        // Get options and vote counts for each poll
        const pollsWithData = await Promise.all(
            polls.map(async (p) => {
                const options = await db
                    .select()
                    .from(pollOption)
                    .where(eq(pollOption.pollId, p.id))
                    .orderBy(pollOption.order);

                // Get vote counts for each option
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

                const totalVotes = optionsWithVotes.reduce((sum, opt) => sum + opt.voteCount, 0);

                return {
                    ...p,
                    options: optionsWithVotes,
                    voteCount: totalVotes,
                };
            })
        );

        return NextResponse.json(pollsWithData);
    } catch (error) {
        logger.error('Error fetching polls:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/guilds/[guildId]/polls - Create a new poll
export async function POST(
    request: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    try {
        const { guildId: guildIdRaw } = await props.params;
        if (!guildIdRaw) {
            return NextResponse.json({ error: 'Guild ID is required' }, { status: 400 });
        }
        const guildId = guildIdRaw;
        const auth = await authorizeGuildApiRequest(request, guildId, 'polls:write');
        if ('response' in auth) {
            return auth.response;
        }

        const body = await request.json();

        // Validate required fields
        if (!body.question || !body.channelId) {
            return NextResponse.json(
                { error: 'Missing required fields: question, channelId' },
                { status: 400 }
            );
        }

        // Validate field lengths
        if (body.question.length > MAX_POLL_QUESTION_LENGTH) {
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

        // Validate options for standard/anonymous polls
        const isTimePoll = body.type === 'TIME';
        const options = body.options || body.timeSlots || [];

        if (!isTimePoll) {
            if (!options || options.length < 2) {
                return NextResponse.json(
                    { error: 'At least 2 options are required' },
                    { status: 400 }
                );
            }
            if (options.length > MAX_POLL_OPTIONS) {
                return NextResponse.json(
                    { error: `Cannot have more than ${MAX_POLL_OPTIONS} options` },
                    { status: 400 }
                );
            }
        }

        for (const option of options) {
            const optionText = (option?.text ?? '').toString().trim();
            if (!optionText) {
                return NextResponse.json(
                    { error: 'Option text cannot be empty' },
                    { status: 400 }
                );
            }
            if (optionText.length > MAX_OPTION_TEXT_LENGTH) {
                return NextResponse.json(
                    { error: `Option text cannot exceed ${MAX_OPTION_TEXT_LENGTH} characters` },
                    { status: 400 }
                );
            }
        }

        // Determine poll type (handle both body.type and body.isAnonymous)
        let pollType: 'STANDARD' | 'TIME' | 'ANONYMOUS' = body.type || 'STANDARD';
        if (body.isAnonymous === true) {
            pollType = 'ANONYMOUS';
        }

        const [createdPoll] = await db
            .insert(poll)
            .values({
                guildId: guildId as string,
                creatorId: auth.userId,
                channelId: body.channelId as string,
                question: body.question as string,
                description: body.description as string | undefined,
                type: pollType,
                allowMultipleVotes: (body.allowMultipleVotes ?? false) as boolean,
                maxVotesPerUser: body.maxVotesPerUser as number | undefined,
                allowCustomOptions: (body.allowCustomOptions ?? false) as boolean,
                allowedRoleIds: body.allowedRoleIds as string[] | undefined,
                mentionRoleIds: body.mentionRoleIds as string[] | undefined,
                mentionOnCreate: (body.mentionOnCreate ?? false) as boolean,
                endTime: body.endTime ? new Date(body.endTime) : undefined,
                closed: false,
            })
            .returning();

        if (isTimePoll && body.timeSlots?.length) {
            const values = body.timeSlots.map((slot: string, index: number) => {
                const parsed = new Date(slot);
                return {
                    pollId: createdPoll.id,
                    order: index,
                    text: parsed.toLocaleString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                    }),
                    dateTimeValue: parsed,
                };
            });
            await db.insert(pollOption).values(values);
        } else if (options?.length) {
            const values = options.map((opt: { text: string; emoji?: string }, index: number) => ({
                pollId: createdPoll.id,
                order: index,
                text: opt.text,
                emoji: opt.emoji || null,
            }));
            await db.insert(pollOption).values(values);
        }

        await dispatchGuildWebhookEvent(guildId, 'poll.created', {
            pollId: createdPoll.id,
            question: createdPoll.question,
            type: createdPoll.type,
            channelId: createdPoll.channelId,
            endTime: createdPoll.endTime,
            creatorId: createdPoll.creatorId,
        });

        return NextResponse.json(createdPoll);
    } catch (error) {
        logger.error('Error creating poll:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
