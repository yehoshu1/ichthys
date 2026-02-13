import { NextRequest, NextResponse } from 'next/server';
import { db, eventPollSettings } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { authorizeGuildApiRequest } from '@/lib/guild-api-auth';
import logger from '@/lib/logger';

// GET /api/guilds/[guildId]/events/settings - Get event/poll settings
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

        let settings = await db
            .select()
            .from(eventPollSettings)
            .where(eq(eventPollSettings.guildId, guildId))
            .then(rows => rows[0]);

        if (!settings) {
            // Return default settings
            return NextResponse.json({
                defaultEventChannelId: null,
                defaultPollChannelId: null,
                defaultMentionOnCreate: false,
                defaultMentionOnStart: false,
                allowedEventCreators: [],
                allowedPollCreators: [],
                serverTimezone: 'UTC',
                aiEnabled: true,
                aiRateLimitPerHour: 10,
                mirrorToDiscordEvents: true,
            });
        }

        return NextResponse.json(settings);
    } catch (error) {
        logger.error('Error fetching event settings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/guilds/[guildId]/events/settings - Update event/poll settings
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

        // Check if settings exist
        const existingSettings = await db
            .select()
            .from(eventPollSettings)
            .where(eq(eventPollSettings.guildId, guildId))
            .then(rows => rows[0]);

        if (existingSettings) {
            // Update existing
            const [updated] = await db
                .update(eventPollSettings)
                .set({
                    defaultEventChannelId: body.defaultEventChannelId ?? existingSettings.defaultEventChannelId,
                    defaultPollChannelId: body.defaultPollChannelId ?? existingSettings.defaultPollChannelId,
                    defaultMentionOnCreate: body.defaultMentionOnCreate ?? existingSettings.defaultMentionOnCreate,
                    defaultMentionOnStart: body.defaultMentionOnStart ?? existingSettings.defaultMentionOnStart,
                    allowedEventCreators: body.allowedEventCreators ?? existingSettings.allowedEventCreators,
                    allowedPollCreators: body.allowedPollCreators ?? existingSettings.allowedPollCreators,
                    serverTimezone: body.serverTimezone ?? existingSettings.serverTimezone,
                    aiEnabled: body.aiEnabled ?? existingSettings.aiEnabled,
                    aiRateLimitPerHour: body.aiRateLimitPerHour ?? existingSettings.aiRateLimitPerHour,
                    mirrorToDiscordEvents: body.mirrorToDiscordEvents ?? existingSettings.mirrorToDiscordEvents,
                    updatedAt: new Date(),
                })
                .where(eq(eventPollSettings.id, existingSettings.id))
                .returning();

            return NextResponse.json(updated);
        } else {
            // Create new
            const [created] = await db
                .insert(eventPollSettings)
                .values({
                    guildId: guildId as string,
                    defaultEventChannelId: body.defaultEventChannelId,
                    defaultPollChannelId: body.defaultPollChannelId,
                    defaultMentionOnCreate: body.defaultMentionOnCreate ?? false,
                    defaultMentionOnStart: body.defaultMentionOnStart ?? false,
                    allowedEventCreators: body.allowedEventCreators,
                    allowedPollCreators: body.allowedPollCreators,
                    serverTimezone: body.serverTimezone ?? 'UTC',
                    aiEnabled: body.aiEnabled ?? true,
                    aiRateLimitPerHour: body.aiRateLimitPerHour ?? 10,
                    mirrorToDiscordEvents: body.mirrorToDiscordEvents ?? true,
                })
                .returning();

            return NextResponse.json(created);
        }
    } catch (error) {
        logger.error('Error updating event settings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
