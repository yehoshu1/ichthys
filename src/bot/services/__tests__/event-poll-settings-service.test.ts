import { describe, expect, it, vi } from 'vitest';
import { ChannelType, PermissionFlagsBits, type GuildMember } from 'discord.js';

vi.mock('@shared/database/client', () => ({
    db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
    pool: {},
}));

import {
    canMemberCreateEvent,
    canMemberCreatePoll,
    isSupportedPostChannel,
} from '../event-poll-settings-service';

function createMockMember(options?: {
    roleIds?: string[];
    hasManageGuild?: boolean;
}): GuildMember {
    const roleIds = options?.roleIds ?? [];
    const hasManageGuild = options?.hasManageGuild ?? false;
    return {
        roles: {
            cache: new Map(roleIds.map((roleId) => [roleId, {}])),
        },
        permissions: {
            has: (permission: bigint) => hasManageGuild && permission === PermissionFlagsBits.ManageGuild,
        },
    } as unknown as GuildMember;
}

describe('event-poll-settings-service permission checks', () => {
    it('allows event creation when no role restriction exists', () => {
        const member = createMockMember();
        expect(canMemberCreateEvent(member, null)).toBe(true);
    });

    it('blocks event creation when restricted and member has no allowed role', () => {
        const member = createMockMember({ roleIds: ['role-a'] });
        const settings = { allowedEventCreators: ['role-b'] } as any;
        expect(canMemberCreateEvent(member, settings)).toBe(false);
    });

    it('allows event creation when member has an allowed role', () => {
        const member = createMockMember({ roleIds: ['role-allowed'] });
        const settings = { allowedEventCreators: ['role-allowed'] } as any;
        expect(canMemberCreateEvent(member, settings)).toBe(true);
    });

    it('allows poll creation for Manage Guild members even if role list does not match', () => {
        const member = createMockMember({ roleIds: ['role-a'], hasManageGuild: true });
        const settings = { allowedPollCreators: ['role-b'] } as any;
        expect(canMemberCreatePoll(member, settings)).toBe(true);
    });
});

describe('event-poll-settings-service channel checks', () => {
    it('accepts guild text and announcement channel types', () => {
        expect(isSupportedPostChannel({ type: ChannelType.GuildText })).toBe(true);
        expect(isSupportedPostChannel({ type: ChannelType.GuildAnnouncement })).toBe(true);
    });

    it('rejects unsupported channel types', () => {
        expect(isSupportedPostChannel({ type: ChannelType.GuildVoice })).toBe(false);
        expect(isSupportedPostChannel(null)).toBe(false);
    });
});
