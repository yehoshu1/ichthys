import { describe, expect, it } from 'vitest';
import { PermissionFlagsBits, type GuildMember } from 'discord.js';
import { canMemberManageCreatorOwnedResource } from '../resource-authorization-service';

function createMockMember(input: {
    id: string;
    hasAdminPermission?: boolean;
}): GuildMember {
    return {
        id: input.id,
        permissions: {
            has: (permission: bigint) =>
                Boolean(input.hasAdminPermission) && permission === PermissionFlagsBits.Administrator,
        },
    } as unknown as GuildMember;
}

describe('resource-authorization-service', () => {
    it('allows resource creator', () => {
        const member = createMockMember({ id: 'user-1', hasAdminPermission: false });
        const allowed = canMemberManageCreatorOwnedResource({
            member,
            creatorUserId: 'user-1',
            adminPermissions: [PermissionFlagsBits.Administrator],
        });

        expect(allowed).toBe(true);
    });

    it('allows admin permission holder', () => {
        const member = createMockMember({ id: 'user-2', hasAdminPermission: true });
        const allowed = canMemberManageCreatorOwnedResource({
            member,
            creatorUserId: 'user-1',
            adminPermissions: [PermissionFlagsBits.Administrator],
        });

        expect(allowed).toBe(true);
    });

    it('denies non-creator without required admin permissions', () => {
        const member = createMockMember({ id: 'user-2', hasAdminPermission: false });
        const allowed = canMemberManageCreatorOwnedResource({
            member,
            creatorUserId: 'user-1',
            adminPermissions: [PermissionFlagsBits.Administrator],
        });

        expect(allowed).toBe(false);
    });
});
