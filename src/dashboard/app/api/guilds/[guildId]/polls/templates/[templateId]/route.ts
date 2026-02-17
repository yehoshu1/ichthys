import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, pollTemplate } from '@/lib/db';
import { authorizeGuildApiRequest } from '@/lib/guild-api-auth';
import logger from '@/lib/logger';

export async function PATCH(
    request: NextRequest,
    props: { params: Promise<{ guildId: string; templateId: string }> }
) {
    try {
        const { guildId, templateId } = await props.params;
        const auth = await authorizeGuildApiRequest(request, guildId, 'polls:write');
        if ('response' in auth) {
            return auth.response;
        }

        const body = await request.json();

        const [existing] = await db
            .select()
            .from(pollTemplate)
            .where(and(
                eq(pollTemplate.id, templateId),
                eq(pollTemplate.guildId, guildId)
            ))
            .limit(1);

        if (!existing) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        const [updated] = await db
            .update(pollTemplate)
            .set({
                name: body.name ?? existing.name,
                description: body.description ?? existing.description,
                question: body.question ?? existing.question,
                pollDescription: body.pollDescription ?? existing.pollDescription,
                type: body.type ?? existing.type,
                allowMultipleVotes: body.allowMultipleVotes ?? existing.allowMultipleVotes,
                maxVotesPerUser: body.maxVotesPerUser ?? existing.maxVotesPerUser,
                allowCustomOptions: body.allowCustomOptions ?? existing.allowCustomOptions,
                defaultOptions: body.defaultOptions ?? existing.defaultOptions,
                updatedAt: new Date(),
            })
            .where(eq(pollTemplate.id, templateId))
            .returning();

        return NextResponse.json(updated);
    } catch (error) {
        logger.error('Error updating poll template:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ guildId: string; templateId: string }> }
) {
    try {
        const { guildId, templateId } = await props.params;
        const auth = await authorizeGuildApiRequest(request, guildId, 'polls:write');
        if ('response' in auth) {
            return auth.response;
        }

        const [existing] = await db
            .select({ id: pollTemplate.id })
            .from(pollTemplate)
            .where(and(
                eq(pollTemplate.id, templateId),
                eq(pollTemplate.guildId, guildId)
            ))
            .limit(1);

        if (!existing) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        await db.delete(pollTemplate).where(eq(pollTemplate.id, templateId));
        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('Error deleting poll template:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
