import { SlashCommandBuilder, CommandInteraction, CacheType, ChatInputCommandInteraction, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';

export interface Command {
    data: SlashCommandBuilder | Omit<SlashCommandBuilder, "addBooleanOption" | "addUserOption" | "addChannelOption" | "addRoleOption" | "addAttachmentOption" | "addMentionableOption" | "addStringOption" | "addIntegerOption" | "addNumberOption">;
    execute: (interaction: ChatInputCommandInteraction<CacheType>) => Promise<void>;
}
