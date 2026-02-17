import { NextRequest, NextResponse } from 'next/server';
import { db, poll, pollOption, pollVote } from '@/lib/db';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { authorizeGuildApiRequest } from '@/lib/guild-api-auth';
import logger from '@/lib/logger';
import { requireGuildModuleEnabled } from '@/lib/module-gate';
import { pollService } from '@shared/services/poll-domain-service';

// Validation constants
const MAX_POLL_QUESTION_LENGTH = 200;
const MAX_POLL_DESCRIPTION_LENGTH = 1000;
const MAX_POLL_OPTIONS = 20;
const MAX_OPTION_TEXT_LENGTH = 100;

const pollTypeSchema = z.enum(['STANDARD', 'TIME', 'ANONYMOUS']);

const createPollSchema = z.object({
    channelId: z.string().min(1),
    question: z.string().min(1).max(MAX_POLL_QUESTION_LENGTH),
    description: z.string().max(MAX_POLL_DESCRIPTION_LENGTH).optional(),
    color: z.string().max(32).optional(),
    type: pollTypeSchema.optional(),
    isAnonymous: z.boolean().optional(),
    allowMultipleVotes: z.boolean().optional(),
    maxVotesPerUser: z.number().int().min(1).max(20).optional(),
    allowCustomOptions: z.boolean().optional(),
    allowedRoleIds: z.array(z.string()).optional(),
    mentionRoleIds: z.array(z.string()).optional(),
    mentionOnCreate: z.boolean().optional(),
    endTime: z.string().datetime().optional(),
    options: z.array(z.union([
        z.string(),
        z.object({
            text: z.string(),
            emoji: z.string().optional(),
        }),
    ])).optional(),
    timeSlots: z.array(z.string()).optional(),
}).strict();

function formatDiscordTimestampLabel(date: Date): string {
    const unix = Math.floor(date.getTime() / 1000);
    return `<t:${unix}:F>`;
}

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
        const moduleGuard = await requireGuildModuleEnabled(guildId, 'polls');
        if (moduleGuard) return moduleGuard;

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

        if (polls.length === 0) {
            return NextResponse.json([]);
        }

        const pollIds = polls.map((p) => p.id);
        const options = await db
            .select()
            .from(pollOption)
            .where(inArray(pollOption.pollId, pollIds))
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

        const optionsByPoll = new Map<string, typeof options>();
        for (const option of options) {
            const existing = optionsByPoll.get(option.pollId);
            if (existing) {
                existing.push(option);
            } else {
                optionsByPoll.set(option.pollId, [option]);
            }
        }

        const pollsWithData = polls.map((p) => {
            const pollOptions = optionsByPoll.get(p.id) ?? [];
            const optionsWithVotes = pollOptions.map((opt) => ({
                ...opt,
                voteCount: votesByOption.get(opt.id) ?? 0,
            }));
            const totalVotes = optionsWithVotes.reduce((sum, opt) => sum + opt.voteCount, 0);

            return {
                ...p,
                options: optionsWithVotes,
                voteCount: totalVotes,
            };
        });

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
        const moduleGuard = await requireGuildModuleEnabled(guildId, 'polls');
        if (moduleGuard) return moduleGuard;

        const body = await request.json();
        const parsed = createPollSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid request body', details: parsed.error.issues },
                { status: 400 }
            );
        }
        const data = parsed.data;

        // Validate options for standard/anonymous polls
        const isTimePoll = data.type === 'TIME';
        const options = data.options || data.timeSlots || [];

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
            const optionText = (typeof option === 'string' ? option : option?.text ?? '').toString().trim();
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
        let pollType: 'STANDARD' | 'TIME' | 'ANONYMOUS' = data.type || 'STANDARD';
        if (data.isAnonymous === true) {
            pollType = 'ANONYMOUS';
        }

        const normalizedOptions = isTimePoll && data.timeSlots?.length
            ? data.timeSlots.map((slot: string) => {
                const parsed = new Date(slot);
                if (Number.isNaN(parsed.getTime())) {
                    throw new Error(`Invalid time slot: ${slot}`);
                }
                return {
                    text: formatDiscordTimestampLabel(parsed),
                    dateTimeValue: parsed,
                };
            })
            : (options as Array<{ text: string; emoji?: string; dateTimeValue?: Date }> | undefined);

        const createdPoll = await pollService.createPoll({
            guildId,
            creatorId: auth.userId,
            channelId: data.channelId,
            question: data.question,
            description: data.description,
            color: data.color,
            type: pollType,
            allowMultipleVotes: data.allowMultipleVotes ?? false,
            maxVotesPerUser: data.maxVotesPerUser,
            allowCustomOptions: data.allowCustomOptions ?? false,
            allowedRoleIds: data.allowedRoleIds,
            mentionRoleIds: data.mentionRoleIds,
            mentionOnCreate: data.mentionOnCreate ?? false,
            endTime: data.endTime ? new Date(data.endTime) : undefined,
            options: normalizedOptions ?? [],
        });

        return NextResponse.json(createdPoll);
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('Invalid time slot:')) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        logger.error('Error creating poll:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
