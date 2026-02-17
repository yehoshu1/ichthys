import { NextRequest, NextResponse } from 'next/server';
import { db, poll, pollOption, pollVote } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { getDiscordUsers } from '@/lib/discord-user-cache';
import logger from '@/lib/logger';
import { authorizeGuildApiRequest } from '@/lib/guild-api-auth';
import { requireGuildModuleEnabled } from '@/lib/module-gate';

// GET /api/guilds/[guildId]/polls/[pollId]/results - Get poll results
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

        // Check if poll exists and belongs to guild
        const [p] = await db
            .select()
            .from(poll)
            .where(and(eq(poll.id, pollId), eq(poll.guildId, guildId)));

        if (!p) {
            return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
        }

        // Get all options
        const options = await db
            .select()
            .from(pollOption)
            .where(eq(pollOption.pollId, pollId))
            .orderBy(pollOption.order);

        // Get vote counts for each option
        const allVotes = await db
            .select()
            .from(pollVote)
            .where(eq(pollVote.pollId, pollId));

        const userMap = p.type === 'ANONYMOUS'
            ? new Map()
            : await getDiscordUsers(allVotes.map((vote) => vote.userId));

        const results = await Promise.all(
            options.map(async (option) => {
                const votes = allVotes.filter((vote) => vote.optionId === option.id);

                return {
                    option,
                    votes: votes.length,
                    voterIds: p.type === 'ANONYMOUS' ? [] : votes.map((vote) => vote.userId),
                    voterUsers: p.type === 'ANONYMOUS'
                        ? []
                        : votes.map((vote) => {
                            const cached = userMap.get(vote.userId);
                            return {
                                userId: vote.userId,
                                displayName: cached?.globalName || cached?.username || `User ${vote.userId.slice(-4)}`,
                                avatarUrl: cached?.avatarUrl || null,
                            };
                        }),
                };
            })
        );

        const uniqueVoters = new Set(allVotes.map((v) => v.userId));

        return NextResponse.json({
            poll: p,
            results,
            totalVotes: allVotes.length,
            uniqueVoters: uniqueVoters.size,
            showVoters: p.type !== 'ANONYMOUS',
        });
    } catch (error) {
        logger.error('Error fetching poll results:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
