import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, eventTemplate } from '@/lib/db';
import { authorizeGuildApiRequest } from '@/lib/guild-api-auth';
import logger from '@/lib/logger';

function toDashboardTemplate(template: typeof eventTemplate.$inferSelect) {
    return {
        ...template,
        defaultTitle: template.title ?? null,
        defaultDescription: template.description ?? null,
        defaultLocation: template.location ?? null,
        defaultDurationMinutes: template.durationMinutes ?? null,
    };
}

export async function PATCH(
    request: NextRequest,
    props: { params: Promise<{ guildId: string; templateId: string }> }
) {
    try {
        const { guildId, templateId } = await props.params;
        const auth = await authorizeGuildApiRequest(request, guildId, 'events:write');
        if ('response' in auth) {
            return auth.response;
        }

        const body = await request.json();

        const [existing] = await db
            .select()
            .from(eventTemplate)
            .where(and(
                eq(eventTemplate.id, templateId),
                eq(eventTemplate.guildId, guildId)
            ))
            .limit(1);

        if (!existing) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        const [updated] = await db
            .update(eventTemplate)
            .set({
                name: body.name ?? existing.name,
                description: body.defaultDescription ?? body.description ?? existing.description,
                title: body.defaultTitle ?? body.title ?? existing.title,
                location: body.defaultLocation ?? body.location ?? existing.location,
                defaultColor: body.defaultColor ?? existing.defaultColor,
                durationMinutes: body.defaultDurationMinutes ?? body.durationMinutes ?? existing.durationMinutes,
                maxAttendees: body.maxAttendees ?? existing.maxAttendees,
                enableWaitlist: body.enableWaitlist ?? existing.enableWaitlist,
                mentionRoleIds: body.mentionRoleIds ?? existing.mentionRoleIds,
                requiredRoleIds: body.requiredRoleIds ?? existing.requiredRoleIds,
                blockedRoleIds: body.blockedRoleIds ?? existing.blockedRoleIds,
                attendeeRoleId: body.attendeeRoleId ?? existing.attendeeRoleId,
                imageUrl: body.imageUrl ?? existing.imageUrl,
                updatedAt: new Date(),
            })
            .where(eq(eventTemplate.id, templateId))
            .returning();

        return NextResponse.json(toDashboardTemplate(updated));
    } catch (error) {
        logger.error('Error updating event template:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ guildId: string; templateId: string }> }
) {
    try {
        const { guildId, templateId } = await props.params;
        const auth = await authorizeGuildApiRequest(request, guildId, 'events:write');
        if ('response' in auth) {
            return auth.response;
        }

        const [existing] = await db
            .select({ id: eventTemplate.id })
            .from(eventTemplate)
            .where(and(
                eq(eventTemplate.id, templateId),
                eq(eventTemplate.guildId, guildId)
            ))
            .limit(1);

        if (!existing) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        await db.delete(eventTemplate).where(eq(eventTemplate.id, templateId));
        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('Error deleting event template:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
