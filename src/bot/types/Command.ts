import { SlashCommandBuilder, CacheType, ChatInputCommandInteraction, SlashCommandSubcommandsOnlyBuilder, SlashCommandOptionsOnlyBuilder, AutocompleteInteraction } from 'discord.js';

export interface Command {
    data: SlashCommandBuilder | Omit<SlashCommandBuilder, any> | SlashCommandSubcommandsOnlyBuilder | SlashCommandOptionsOnlyBuilder;
    execute: (interaction: ChatInputCommandInteraction<CacheType>) => Promise<any>;
    autocomplete?: (interaction: AutocompleteInteraction) => Promise<any>;
}
