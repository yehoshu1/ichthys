import { NextRequest, NextResponse } from 'next/server';
import { db, eventTemplate } from '@/lib/db';
import { eq } from 'drizzle-orm';
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

// GET /api/guilds/[guildId]/events/templates - List event templates
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
        const auth = await authorizeGuildApiRequest(request, guildId, 'events:read');
        if ('response' in auth) {
            return auth.response;
        }

        const templates = await db
            .select()
            .from(eventTemplate)
            .where(eq(eventTemplate.guildId, guildId));

        return NextResponse.json(templates.map(toDashboardTemplate));
    } catch (error) {
        logger.error('Error fetching event templates:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/guilds/[guildId]/events/templates - Create a new template
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
        const auth = await authorizeGuildApiRequest(request, guildId, 'events:write');
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
            .insert(eventTemplate)
            .values({
                guildId: guildId as string,
                creatorId: auth.userId,
                name: body.name as string,
                description: (body.defaultDescription ?? body.description) as string | undefined,
                title: (body.defaultTitle ?? body.title) as string | undefined,
                location: (body.defaultLocation ?? body.location) as string | undefined,
                defaultColor: body.defaultColor as string | undefined,
                durationMinutes: (body.defaultDurationMinutes ?? body.durationMinutes) as number | undefined,
                maxAttendees: body.maxAttendees as number | undefined,
                enableWaitlist: (body.enableWaitlist ?? false) as boolean,
                mentionRoleIds: body.mentionRoleIds as string[] | undefined,
                requiredRoleIds: body.requiredRoleIds as string[] | undefined,
                blockedRoleIds: body.blockedRoleIds as string[] | undefined,
                attendeeRoleId: body.attendeeRoleId as string | undefined,
                imageUrl: body.imageUrl as string | undefined,
            })
            .returning();

        return NextResponse.json(toDashboardTemplate(newTemplate[0]));
    } catch (error) {
        logger.error('Error creating event template:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
