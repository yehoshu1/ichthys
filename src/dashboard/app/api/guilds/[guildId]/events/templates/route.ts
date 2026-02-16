import { NextRequest, NextResponse } from 'next/server';
import { db, eventTemplate } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { authorizeGuildApiRequest } from '@/lib/guild-api-auth';
import logger from '@/lib/logger';
import { requireGuildModuleEnabled } from '@/lib/module-gate';
import { parseJsonBody } from '@/lib/validation';

const discordIdSchema = z.string().regex(/^\d{17,20}$/);

const createTemplateSchema = z.object({
    name: z.string().trim().min(1).max(100),
    defaultTitle: z.string().max(100).optional(),
    defaultDescription: z.string().max(2000).optional(),
    defaultLocation: z.string().max(100).optional(),
    title: z.string().max(100).optional(),
    description: z.string().max(2000).optional(),
    location: z.string().max(100).optional(),
    defaultColor: z.string().max(32).optional(),
    durationMinutes: z.number().int().min(1).max(60 * 24 * 31).optional(),
    defaultDurationMinutes: z.number().int().min(1).max(60 * 24 * 31).optional(),
    maxAttendees: z.number().int().min(0).max(1000).optional(),
    enableWaitlist: z.boolean().optional(),
    mentionRoleIds: z.array(discordIdSchema).optional(),
    requiredRoleIds: z.array(discordIdSchema).optional(),
    blockedRoleIds: z.array(discordIdSchema).optional(),
    attendeeRoleId: discordIdSchema.optional(),
    imageUrl: z.string().max(2048).optional(),
}).strict();

function toDashboardTemplate(template: typeof eventTemplate.$inferSelect) {
    return {
        ...template,
        defaultTitle: template.title ?? null,
        defaultDescription: template.description ?? null,
        defaultLocation: template.location ?? null,
        defaultDurationMinutes: template.durationMinutes ?? null,
    };
}

function isTemplateNameConflict(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('event_template_guild_name_unique') || message.includes('duplicate key value');
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
        const moduleGuard = await requireGuildModuleEnabled(guildId, 'events');
        if (moduleGuard) return moduleGuard;

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
        const moduleGuard = await requireGuildModuleEnabled(guildId, 'events');
        if (moduleGuard) return moduleGuard;

        const parsed = await parseJsonBody(request, createTemplateSchema);
        if (!parsed.success) return parsed.response;
        const body = parsed.data;

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
        if (isTemplateNameConflict(error)) {
            return NextResponse.json(
                { error: 'A template with that name already exists in this server' },
                { status: 409 }
            );
        }
        logger.error('Error creating event template:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
