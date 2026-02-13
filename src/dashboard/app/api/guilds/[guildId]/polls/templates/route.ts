import { NextRequest, NextResponse } from 'next/server';
import { db, pollTemplate } from '@/lib/db';
import { eq } from 'drizzle-orm';
import logger from '@/lib/logger';
import { authorizeGuildApiRequest } from '@/lib/guild-api-auth';

// GET /api/guilds/[guildId]/polls/templates - List poll templates
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

        const templates = await db
            .select()
            .from(pollTemplate)
            .where(eq(pollTemplate.guildId, guildId));

        return NextResponse.json(templates);
    } catch (error) {
        logger.error('Error fetching poll templates:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/guilds/[guildId]/polls/templates - Create a new poll template
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

        if (!body.name) {
            return NextResponse.json(
                { error: 'Template name is required' },
                { status: 400 }
            );
        }

        const newTemplate = await db
            .insert(pollTemplate)
            .values({
                guildId: guildId as string,
                creatorId: auth.userId,
                name: body.name as string,
                description: body.description as string | undefined,
                question: body.question as string | undefined,
                pollDescription: body.pollDescription as string | undefined,
                type: (body.type || 'STANDARD') as 'STANDARD' | 'TIME' | 'ANONYMOUS',
                allowMultipleVotes: (body.allowMultipleVotes ?? false) as boolean,
                maxVotesPerUser: body.maxVotesPerUser as number | undefined,
                allowCustomOptions: (body.allowCustomOptions ?? false) as boolean,
                defaultOptions: body.defaultOptions as string[] | undefined,
            })
            .returning();

        return NextResponse.json(newTemplate[0]);
    } catch (error) {
        logger.error('Error creating poll template:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
