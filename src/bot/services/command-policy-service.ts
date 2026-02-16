import {
    ChatInputCommandInteraction,
    GuildBasedChannel,
    GuildMember,
    PermissionFlagsBits,
} from 'discord.js';
import type { CommandPolicy } from '../types/Command';
import {
    canMemberCreateEvent,
    canMemberCreatePoll,
    getEventPollSettingsForGuild,
    isSupportedPostChannel,
    resolveConfiguredPostChannel,
} from './event-poll-settings-service';

export interface CommandPolicyContext {
    targetChannel?: GuildBasedChannel;
}

type CommandPolicyResult =
    | { allowed: true; context: CommandPolicyContext }
    | { allowed: false; message: string };

const POLICY_CONTEXT = new WeakMap<ChatInputCommandInteraction, CommandPolicyContext>();

function getChannelOptionName(policy: CommandPolicy): string {
    return policy.channelOptionName ?? 'channel';
}

function getDefaultChannelIdForPolicy(
    policy: CommandPolicy,
    settings: Awaited<ReturnType<typeof getEventPollSettingsForGuild>>
): string | null | undefined {
    if (policy.postChannelPolicy === 'events') {
        return settings?.defaultEventChannelId;
    }

    if (policy.postChannelPolicy === 'polls') {
        return settings?.defaultPollChannelId;
    }

    return null;
}

async function resolveInteractionMember(
    interaction: ChatInputCommandInteraction
): Promise<GuildMember | null> {
    if (!interaction.guild) return null;

    if (interaction.member instanceof GuildMember) {
        return interaction.member;
    }

    return interaction.guild.members.fetch(interaction.user.id).catch(() => null);
}

function hasRequiredMemberPermissions(
    member: GuildMember,
    requiredPermissions: bigint[]
): boolean {
    return requiredPermissions.every((permission) => member.permissions.has(permission));
}

function getActiveSubcommand(interaction: ChatInputCommandInteraction): string | null {
    try {
        const subcommand = interaction.options.getSubcommand(false);
        if (!subcommand) return null;
        const subcommandGroup = interaction.options.getSubcommandGroup(false);
        return subcommandGroup ? `${subcommandGroup}.${subcommand}` : subcommand;
    } catch {
        return null;
    }
}

function getRequiredPermissionsForInteraction(
    basePermissions: bigint[] | undefined,
    subcommandPermissions: Record<string, bigint[]> | undefined,
    subcommand: string | null
): bigint[] {
    const required = new Set<bigint>(basePermissions ?? []);
    if (subcommand && subcommandPermissions?.[subcommand]) {
        for (const permission of subcommandPermissions[subcommand]) {
            required.add(permission);
        }
    }
    return [...required];
}

async function evaluateCreatorPolicy(
    policy: CommandPolicy,
    member: GuildMember,
    settings: Awaited<ReturnType<typeof getEventPollSettingsForGuild>>
): Promise<CommandPolicyResult> {
    if (!policy.creatorPolicy) {
        return { allowed: true, context: {} };
    }

    if (policy.creatorPolicy === 'events') {
        if (!canMemberCreateEvent(member, settings)) {
            return { allowed: false, message: 'You do not have permission to create events in this server.' };
        }
        return { allowed: true, context: {} };
    }

    if (!canMemberCreatePoll(member, settings)) {
        return { allowed: false, message: 'You do not have permission to create polls in this server.' };
    }

    return { allowed: true, context: {} };
}

async function evaluatePostChannelPolicy(
    interaction: ChatInputCommandInteraction,
    policy: CommandPolicy,
    member: GuildMember,
    settings: Awaited<ReturnType<typeof getEventPollSettingsForGuild>>
): Promise<CommandPolicyResult> {
    if (!policy.postChannelPolicy) {
        return { allowed: true, context: {} };
    }

    const guild = interaction.guild;
    if (!guild) {
        return { allowed: false, message: 'This command can only be used in a server.' };
    }

    const channelOptionName = getChannelOptionName(policy);
    const channelOption = interaction.options.getChannel(channelOptionName, false);
    const defaultChannelId = getDefaultChannelIdForPolicy(policy, settings);
    const defaultChannel = channelOption
        ? null
        : await resolveConfiguredPostChannel(guild, defaultChannelId);
    const targetChannel = channelOption ?? defaultChannel ?? interaction.channel;

    if (!isSupportedPostChannel(targetChannel)) {
        return { allowed: false, message: 'Please specify a valid text channel.' };
    }

    const requireMemberPermission = policy.requireMemberSendPermissionInTargetChannel ?? true;
    if (requireMemberPermission && !member.permissionsIn(targetChannel).has(PermissionFlagsBits.SendMessages)) {
        return { allowed: false, message: 'You do not have permission to send messages in that channel.' };
    }

    if (policy.requireBotSendPermissionInTargetChannel) {
        const botMember = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
        if (!botMember || !botMember.permissionsIn(targetChannel).has(PermissionFlagsBits.SendMessages)) {
            return { allowed: false, message: 'I do not have permission to send messages in that channel.' };
        }
    }

    return { allowed: true, context: { targetChannel } };
}

export async function evaluateCommandPolicy(
    interaction: ChatInputCommandInteraction,
    policy: CommandPolicy
): Promise<CommandPolicyResult> {
    const subcommand = getActiveSubcommand(interaction);

    const member = await resolveInteractionMember(interaction);
    if (!member) {
        return {
            allowed: false,
            message: 'Unable to verify your server membership. Please try again.',
        };
    }

    const requiredMemberPermissions = getRequiredPermissionsForInteraction(
        policy.requiredMemberPermissions,
        policy.subcommandMemberPermissions,
        subcommand
    );
    if (requiredMemberPermissions.length > 0) {
        const hasPermissions = hasRequiredMemberPermissions(member, requiredMemberPermissions);
        if (!hasPermissions) {
            return {
                allowed: false,
                message: 'You do not have the required permissions to use this command.',
            };
        }
    }

    const requiredBotPermissions = getRequiredPermissionsForInteraction(
        policy.requiredBotPermissions,
        policy.subcommandBotPermissions,
        subcommand
    );
    if (requiredBotPermissions.length > 0) {
        const guild = interaction.guild;
        if (!guild) {
            return {
                allowed: false,
                message: 'This command can only be used in a server.',
            };
        }

        const botMember = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
        if (!botMember || !hasRequiredMemberPermissions(botMember, requiredBotPermissions)) {
            return {
                allowed: false,
                message: 'I do not have the required permissions to run this command.',
            };
        }
    }

    const needsEventPollSettings = Boolean(policy.creatorPolicy || policy.postChannelPolicy);
    const settings = needsEventPollSettings && interaction.guild
        ? await getEventPollSettingsForGuild(interaction.guild.id)
        : null;

    const creatorResult = await evaluateCreatorPolicy(policy, member, settings);
    if (!creatorResult.allowed) {
        return creatorResult;
    }

    const channelResult = await evaluatePostChannelPolicy(interaction, policy, member, settings);
    if (!channelResult.allowed) {
        return channelResult;
    }

    return {
        allowed: true,
        context: {
            ...creatorResult.context,
            ...channelResult.context,
        },
    };
}

export function setCommandPolicyContext(
    interaction: ChatInputCommandInteraction,
    context: CommandPolicyContext
): void {
    POLICY_CONTEXT.set(interaction, context);
}

export function getCommandPolicyContext(
    interaction: ChatInputCommandInteraction
): CommandPolicyContext | undefined {
    return POLICY_CONTEXT.get(interaction);
}

export function clearCommandPolicyContext(interaction: ChatInputCommandInteraction): void {
    POLICY_CONTEXT.delete(interaction);
}
