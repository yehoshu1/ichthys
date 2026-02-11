import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from 'discord.js';
import { Command } from '../types/Command';
import { calendarService } from '../services/calendar-service';
import logger from '../utils/logger';

export const data = new SlashCommandBuilder()
    .setName('link')
    .setDescription('Generate your personal calendar feed link')
    .addChannelOption(option =>
        option
            .setName('channel')
            .setDescription('Filter events by channel (optional)')
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;
        if (!guild) {
            await interaction.editReply('This command can only be used in a server.');
            return;
        }

        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const feedUrl = calendarService.generateFeedUrl(interaction.user.id, baseUrl);

        const embed = new EmbedBuilder()
            .setTitle('📅 Your Personal Calendar Feed')
            .setColor('#5865F2')
            .setDescription(
                'Subscribe to this calendar feed to see all events you\'re attending in your calendar app!'
            )
            .addFields(
                {
                    name: '📱 How to Subscribe',
                    value: [
                        '**Google Calendar:**',
                        '1. Go to calendar.google.com',
                        '2. Click "+" next to "Other calendars"',
                        '3. Select "From URL"',
                        '4. Paste the link below',
                        '',
                        '**Apple Calendar:**',
                        '1. Go to File → New Calendar Subscription',
                        '2. Paste the link below',
                        '',
                        '**Outlook:**',
                        '1. Go to Add Calendar → From Internet',
                        '2. Paste the link below',
                    ].join('\n'),
                    inline: false,
                },
                {
                    name: '🔗 Your Calendar URL',
                    value: `\`\`\`\n${feedUrl}\n\`\`\``,
                    inline: false,
                }
            )
            .setFooter({ text: 'Keep this URL private - anyone with this link can see your events!' });

        await interaction.editReply({ embeds: [embed] });

        logger.info(`Calendar feed link generated for user ${interaction.user.id}`);

    } catch (error) {
        logger.error('Error generating calendar link:', error);
        await interaction.editReply('An error occurred. Please try again.');
    }
}

export default { data, execute } as Command;
