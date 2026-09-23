import { describe, expect, it } from 'vitest';
import { PermissionFlagsBits } from 'discord.js';
import {
    clearCommandPolicyContext,
    evaluateCommandPolicy,
    getCommandPolicyContext,
    setCommandPolicyContext,
} from '../command-policy-service';

function createMockInteraction(hasManageGuild: boolean) {
    const member = {
        permissions: {
            has: (permission: bigint) => hasManageGuild && permission === PermissionFlagsBits.ManageGuild,
        },
    };

    return {
        guild: {
            id: 'guild-1',
            members: {
                fetch: async () => member,
            },
        },
        member: null,
        user: { id: 'user-1' },
        options: {
            getChannel: () => null,
            getSubcommand: () => null,
            getSubcommandGroup: () => null,
        },
        channel: null,
    } as any;
}

function createMockInteractionWithBotPermission(options?: {
    hasManageGuild?: boolean;
    subcommand?: string | null;
    botHasManageRoles?: boolean;
}) {
    const hasManageGuild = options?.hasManageGuild ?? true;
    const botHasManageRoles = options?.botHasManageRoles ?? true;
    const subcommand = options?.subcommand ?? null;

    const member = {
        permissions: {
            has: (permission: bigint) => hasManageGuild && permission === PermissionFlagsBits.ManageGuild,
        },
    };

    const botMember = {
        permissions: {
            has: (permission: bigint) => botHasManageRoles && permission === PermissionFlagsBits.ManageRoles,
        },
    };

    return {
        guild: {
            id: 'guild-1',
            members: {
                me: botMember,
                fetch: async () => member,
                fetchMe: async () => botMember,
            },
        },
        member: null,
        user: { id: 'user-1' },
        options: {
            getChannel: () => null,
            getSubcommand: () => subcommand,
            getSubcommandGroup: () => null,
        },
        channel: null,
    } as any;
}

describe('command-policy-service', () => {
    it('enforces required member permissions when configured', async () => {
        const deniedInteraction = createMockInteraction(false);
        const denied = await evaluateCommandPolicy(deniedInteraction, {
            requiredMemberPermissions: [PermissionFlagsBits.ManageGuild],
        });
        expect(denied.allowed).toBe(false);

        const allowedInteraction = createMockInteraction(true);
        const allowed = await evaluateCommandPolicy(allowedInteraction, {
            requiredMemberPermissions: [PermissionFlagsBits.ManageGuild],
        });
        expect(allowed.allowed).toBe(true);
    });

    it('stores and clears policy context per interaction', () => {
        const interaction = {} as any;
        setCommandPolicyContext(interaction, { targetChannel: { id: 'channel-1' } as any });
        expect(getCommandPolicyContext(interaction)?.targetChannel?.id).toBe('channel-1');

        clearCommandPolicyContext(interaction);
        expect(getCommandPolicyContext(interaction)).toBeUndefined();
    });

    it('enforces subcommand-specific member permissions', async () => {
        const deniedInteraction = createMockInteractionWithBotPermission({
            hasManageGuild: false,
            subcommand: 'admin-set',
        });

        const denied = await evaluateCommandPolicy(deniedInteraction, {
            subcommandMemberPermissions: {
                'admin-set': [PermissionFlagsBits.ManageGuild],
            },
        });
        expect(denied.allowed).toBe(false);

        const allowedInteraction = createMockInteractionWithBotPermission({
            hasManageGuild: true,
            subcommand: 'admin-set',
        });
        const allowed = await evaluateCommandPolicy(allowedInteraction, {
            subcommandMemberPermissions: {
                'admin-set': [PermissionFlagsBits.ManageGuild],
            },
        });
        expect(allowed.allowed).toBe(true);
    });

    it('enforces required bot permissions', async () => {
        const deniedInteraction = createMockInteractionWithBotPermission({
            botHasManageRoles: false,
        });
        const denied = await evaluateCommandPolicy(deniedInteraction, {
            requiredBotPermissions: [PermissionFlagsBits.ManageRoles],
        });
        expect(denied.allowed).toBe(false);

        const allowedInteraction = createMockInteractionWithBotPermission({
            botHasManageRoles: true,
        });
        const allowed = await evaluateCommandPolicy(allowedInteraction, {
            requiredBotPermissions: [PermissionFlagsBits.ManageRoles],
        });
        expect(allowed.allowed).toBe(true);
    });
});
