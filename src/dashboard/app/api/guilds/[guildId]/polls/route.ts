import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@shared/database/client';
import { poll, pollOption, pollVote } from '@shared/database/schema';
import { eq, and, desc } from 'drizzle-orm';
import logger from '@/lib/logger';

// GET /api/guilds/[guildId]/polls - List all polls for a guild
export async function GET(
    request: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { guildId: guildIdRaw } = await props.params;
        if (!guildIdRaw) {
            return NextResponse.json({ error: 'Guild ID is required' }, { status: 400 });
        }
        const guildId = guildIdRaw;
        const { searchParams } = new URL(request.url);
        const closed = searchParams.get('closed');

        let query = db.select().from(poll).where(eq(poll.guildId, guildId));

        if (closed !== null) {
            query = db.select().from(poll).where(
                and(eq(poll.guildId, guildId), eq(poll.closed, closed === 'true'))
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
                    .orderBy(pollOption.optionIndex);

                const votes = await db
                    .select()
                    .from(pollVote)
                    .where(eq(pollVote.pollId, p.id));

                return {
                    ...p,
                    options: options.map(opt => ({
                        ...opt,
                        voteCount: votes.filter(v => v.optionId === opt.id).length,
                    })),
                    totalVotes: votes.length,
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
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { guildId: guildIdRaw } = await props.params;
        if (!guildIdRaw) {
            return NextResponse.json({ error: 'Guild ID is required' }, { status: 400 });
        }
        const guildId = guildIdRaw;
        const body = await request.json();

        // Validate required fields
        if (!body.question || !body.options || !Array.isArray(body.options) || body.options.length < 2) {
            return NextResponse.json(
                { error: 'Missing required fields: question, options (min 2)' },
                { status: 400 }
            );
        }

        // Create poll
        const newPoll = await db
            .insert(poll)
            .values({
                guildId: guildId as string,
                creatorId: session.user.id as string,
                channelId: body.channelId as string,
                question: body.question as string,
                description: body.description as string | undefined,
                type: (body.type || 'STANDARD') as 'STANDARD' | 'TIME' | 'ANONYMOUS',
                allowMultipleVotes: (body.allowMultipleVotes ?? false) as boolean,
                maxVotesPerUser: body.maxVotesPerUser as number | undefined,
                allowCustomOptions: (body.allowCustomOptions ?? false) as boolean,
                allowedRoleIds: body.allowedRoleIds as string[] | undefined,
                endTime: body.endTime ? new Date(body.endTime) : undefined,
            })
            .returning();

        // Create options
        const pollId = newPoll[0].id;
        for (let i = 0; i < body.options.length; i++) {
            await db.insert(pollOption).values({
                pollId,
                optionIndex: i,
                text: body.options[i].text,
                emoji: body.options[i].emoji,
                dateTimeValue: body.options[i].dateTimeValue ? new Date(body.options[i].dateTimeValue) : undefined,
            });
        }

        return NextResponse.json(newPoll[0]);
    } catch (error) {
        logger.error('Error creating poll:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
