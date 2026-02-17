import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, eventTemplate } from '@/lib/db';
import { z } from 'zod';
import { authorizeGuildApiRequest } from '@/lib/guild-api-auth';
import logger from '@/lib/logger';
import { requireGuildModuleEnabled } from '@/lib/module-gate';
import { parseJsonBody } from '@/lib/validation';

const discordIdSchema = z.string().regex(/^\d{17,20}$/);

const updateTemplateSchema = z.object({
    name: z.string().trim().min(1).max(100).optional(),
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
        const moduleGuard = await requireGuildModuleEnabled(guildId, 'events');
        if (moduleGuard) return moduleGuard;

        const parsed = await parseJsonBody(request, updateTemplateSchema);
        if (!parsed.success) return parsed.response;
        const body = parsed.data;

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
        if (isTemplateNameConflict(error)) {
            return NextResponse.json(
                { error: 'A template with that name already exists in this server' },
                { status: 409 }
            );
        }
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
        const moduleGuard = await requireGuildModuleEnabled(guildId, 'events');
        if (moduleGuard) return moduleGuard;

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
