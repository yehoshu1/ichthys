import { NextRequest, NextResponse } from 'next/server';
import { db, pollTemplate } from '@/lib/db';
import { eq } from 'drizzle-orm';
import logger from '@/lib/logger';
import { z } from 'zod';
import { authorizeGuildApiRequest } from '@/lib/guild-api-auth';
import { requireGuildModuleEnabled } from '@/lib/module-gate';
import { parseJsonBody } from '@/lib/validation';

const pollTypeSchema = z.enum(['STANDARD', 'TIME', 'ANONYMOUS']);

const createTemplateSchema = z.object({
    name: z.string().trim().min(1).max(100),
    description: z.string().max(1000).optional(),
    question: z.string().max(200).optional(),
    pollDescription: z.string().max(1000).optional(),
    type: pollTypeSchema.optional(),
    allowMultipleVotes: z.boolean().optional(),
    maxVotesPerUser: z.number().int().min(1).max(20).optional(),
    allowCustomOptions: z.boolean().optional(),
    defaultOptions: z.array(z.string().min(1).max(100)).max(20).optional(),
}).strict();

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
        const moduleGuard = await requireGuildModuleEnabled(guildId, 'polls');
        if (moduleGuard) return moduleGuard;

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
        const moduleGuard = await requireGuildModuleEnabled(guildId, 'polls');
        if (moduleGuard) return moduleGuard;

        const parsed = await parseJsonBody(request, createTemplateSchema);
        if (!parsed.success) return parsed.response;
        const body = parsed.data;

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
