import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../types/Command';

export const ping: Command = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong and shows bot latency!'),

    async execute(interaction) {
        const response = await interaction.reply({
            content: 'Pinging...',
            withResponse: true
        });

        const latency = response.resource ?
            (response.resource.message ?
                response.resource.message.createdTimestamp - interaction.createdTimestamp :
                Date.now() - interaction.createdTimestamp) :
            Date.now() - interaction.createdTimestamp;

        // Fallback calculation if resource isn't available immediately
        const finalLatency = Math.abs(Date.now() - interaction.createdTimestamp);
        const apiLatency = Math.round(interaction.client.ws.ping);

        await interaction.editReply(
            `🏓 Pong!\n` +
            `📡 Latency: ${latency > 0 ? latency : finalLatency}ms\n` +
            `💓 API Latency: ${apiLatency}ms`
        );
    },
};
