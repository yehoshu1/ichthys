import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from 'discord.js';
import { Command } from '../types/Command';
import { parseNaturalLanguageDate } from '../utils/date-parser';
import logger from '../utils/logger';

export const data = new SlashCommandBuilder()
    .setName('timestamp')
    .setDescription('Generate Discord-formatted timestamps')
    .addStringOption(option =>
        option
            .setName('datetime')
            .setDescription('Date/time (e.g., "tomorrow 6pm", "in 3 hours", "2026-02-15 18:00")')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('timezone')
            .setDescription('Timezone (default: UTC)')
            .addChoices(
                { name: 'UTC', value: 'UTC' },
                { name: 'Eastern (ET)', value: 'America/New_York' },
                { name: 'Central (CT)', value: 'America/Chicago' },
                { name: 'Mountain (MT)', value: 'America/Denver' },
                { name: 'Pacific (PT)', value: 'America/Los_Angeles' },
                { name: 'London (GMT)', value: 'Europe/London' },
                { name: 'Paris (CET)', value: 'Europe/Paris' },
                { name: 'Tokyo (JST)', value: 'Asia/Tokyo' },
                { name: 'Sydney (AEST)', value: 'Australia/Sydney' }
            )
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const dateTimeInput = interaction.options.getString('datetime', true);
        const timezone = interaction.options.getString('timezone') || 'UTC';

        const date = parseNaturalLanguageDate(dateTimeInput, timezone);

        if (!date) {
            await interaction.editReply(
                'Invalid date/time format. Try something like:\n' +
                '• "tomorrow 6pm"\n' +
                '• "in 3 hours"\n' +
                '• "next friday 2pm"\n' +
                '• "2026-02-15 18:00"'
            );
            return;
        }

        const unixTimestamp = Math.floor(date.getTime() / 1000);

        const embed = new EmbedBuilder()
            .setTitle('🕐 Discord Timestamp Generator')
            .setColor('#5865F2')
            .setDescription(`Generated for: **${date.toLocaleString('en-US', { timeZone: timezone })}** (${timezone})`)
            .addFields(
                { 
                    name: 'Short Time', 
                    value: `\`<t:${unixTimestamp}:t>\`\n<t:${unixTimestamp}:t>`, 
                    inline: true 
                },
                { 
                    name: 'Long Time', 
                    value: `\`<t:${unixTimestamp}:T>\`\n<t:${unixTimestamp}:T>`, 
                    inline: true 
                },
                { 
                    name: 'Short Date', 
                    value: `\`<t:${unixTimestamp}:d>\`\n<t:${unixTimestamp}:d>`, 
                    inline: true 
                },
                { 
                    name: 'Long Date', 
                    value: `\`<t:${unixTimestamp}:D>\`\n<t:${unixTimestamp}:D>`, 
                    inline: true 
                },
                { 
                    name: 'Short Date/Time', 
                    value: `\`<t:${unixTimestamp}:f>\`\n<t:${unixTimestamp}:f>`, 
                    inline: true 
                },
                { 
                    name: 'Long Date/Time', 
                    value: `\`<t:${unixTimestamp}:F>\`\n<t:${unixTimestamp}:F>`, 
                    inline: true 
                },
                { 
                    name: 'Relative Time', 
                    value: `\`<t:${unixTimestamp}:R>\`\n<t:${unixTimestamp}:R>`, 
                    inline: false 
                }
            )
            .setFooter({ text: `Timezone: ${timezone}` });

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        logger.error('Error generating timestamp:', error);
        await interaction.editReply('An error occurred. Please try again.');
    }
}

export default { data, execute } as Command;
