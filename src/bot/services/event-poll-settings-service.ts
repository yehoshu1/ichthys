import {
    ChannelType,
    Guild,
    GuildBasedChannel,
    GuildMember,
    PermissionFlagsBits,
} from 'discord.js';
import { eq } from 'drizzle-orm';
import { db } from '@shared/database/client';
import { eventPollSettings } from '@shared/database/schema';

type EventPollSettingsRecord = typeof eventPollSettings.$inferSelect;

function isPostableTextChannel(channel: unknown): channel is GuildBasedChannel {
    if (!channel) return false;
    if (typeof channel !== 'object' || !('type' in channel)) return false;
    const type = (channel as { type: number }).type;
    return type === ChannelType.GuildText || type === ChannelType.GuildAnnouncement;
}

function hasAnyRole(member: GuildMember, roleIds: string[]): boolean {
    return roleIds.some((roleId) => member.roles.cache.has(roleId));
}

export async function getEventPollSettingsForGuild(guildId: string): Promise<EventPollSettingsRecord | null> {
    const [settings] = await db
        .select()
        .from(eventPollSettings)
        .where(eq(eventPollSettings.guildId, guildId));

    return settings ?? null;
}

export function canMemberCreateEvent(member: GuildMember, settings: EventPollSettingsRecord | null): boolean {
    const allowedRoleIds = settings?.allowedEventCreators ?? [];
    if (allowedRoleIds.length === 0) return true;
    if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
    return hasAnyRole(member, allowedRoleIds);
}

export function canMemberCreatePoll(member: GuildMember, settings: EventPollSettingsRecord | null): boolean {
    const allowedRoleIds = settings?.allowedPollCreators ?? [];
    if (allowedRoleIds.length === 0) return true;
    if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
    return hasAnyRole(member, allowedRoleIds);
}

export async function resolveConfiguredPostChannel(
    guild: Guild,
    channelId: string | null | undefined
): Promise<GuildBasedChannel | null> {
    if (!channelId) return null;

    const cached = guild.channels.cache.get(channelId);
    if (cached && isPostableTextChannel(cached)) {
        return cached;
    }

    const fetched = await guild.channels.fetch(channelId).catch(() => null);
    if (!isPostableTextChannel(fetched)) {
        return null;
    }

    return fetched;
}

export function isSupportedPostChannel(channel: unknown): channel is GuildBasedChannel {
    return isPostableTextChannel(channel);
}
