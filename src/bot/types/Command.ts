import { SlashCommandBuilder, CacheType, ChatInputCommandInteraction, SlashCommandSubcommandsOnlyBuilder, SlashCommandOptionsOnlyBuilder, AutocompleteInteraction } from 'discord.js';
import type { ModuleId } from '@shared/modules/registry';

export type CommandCreatorPolicy = 'events' | 'polls';
export type CommandPostChannelPolicy = 'events' | 'polls';

export interface CommandPolicy {
    requiredMemberPermissions?: bigint[];
    requiredBotPermissions?: bigint[];
    subcommandMemberPermissions?: Record<string, bigint[]>;
    subcommandBotPermissions?: Record<string, bigint[]>;
    creatorPolicy?: CommandCreatorPolicy;
    postChannelPolicy?: CommandPostChannelPolicy;
    channelOptionName?: string;
    requireMemberSendPermissionInTargetChannel?: boolean;
    requireBotSendPermissionInTargetChannel?: boolean;
}

export interface Command {
    data: SlashCommandBuilder | Omit<SlashCommandBuilder, any> | SlashCommandSubcommandsOnlyBuilder | SlashCommandOptionsOnlyBuilder;
    execute: (interaction: ChatInputCommandInteraction<CacheType>) => Promise<any>;
    autocomplete?: (interaction: AutocompleteInteraction) => Promise<any>;
    moduleId?: ModuleId;
    policy?: CommandPolicy;
    limitOptionName?: string;
}
