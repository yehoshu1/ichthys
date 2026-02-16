import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { pollService } from '../services/poll-service';

import logger from '../utils/logger';
import { isModuleEnabled } from '@shared/modules/state';

// ═══════════════════════════════════════════════════════════════════════════════
// POLL END JOB
// ═══════════════════════════════════════════════════════════════════════════════

export const name = 'poll-end';
export const schedule = '*/1 * * * *'; // Run every minute

export async function execute(client: Client) {
    try {
        const now = new Date();

        // Find polls that have ended
        const endingPolls = await pollService.getPollsEndingBefore(now);

        for (const poll of endingPolls) {
            try {
                const pollsEnabled = await isModuleEnabled(poll.guildId, 'polls');
                if (!pollsEnabled) {
                    continue;
                }

                // Close the poll
                await pollService.closePoll(poll.id);

                // Get guild and channel
                const guild = client.guilds.cache.get(poll.guildId);
                if (!guild) {
                    logger.warn(`Guild ${poll.guildId} not found for ending poll ${poll.id}`);
                    continue;
                }

                // Try to update the original message
                if (poll.messageId && poll.channelId) {
                    try {
                        const channel = guild.channels.cache.get(poll.channelId) as TextChannel;
                        if (channel?.isTextBased()) {
                            const message = await channel.messages.fetch(poll.messageId);
                            if (message) {
                                // Get results
                                const results = await pollService.getResults(poll.id);

                                // Build results embed
                                const oldEmbed = message.embeds[0];
                                const newEmbed = EmbedBuilder.from(oldEmbed)
                                    .setTitle(`🔒 ${oldEmbed.title}`)
                                    .setColor('#999999')
                                    .setFooter({ text: `Poll ended • ${results.totalVotes} votes` });

                                // Update options with final results
                                const optionsFieldIndex = oldEmbed.fields?.findIndex((f: any) => f.name === 'Options');
                                if (optionsFieldIndex !== undefined && optionsFieldIndex >= 0) {
                                    const resultsText = results.options.map((opt, i) => {
                                        const bar = '█'.repeat(Math.round(opt.percentage / 5)) + '░'.repeat(20 - Math.round(opt.percentage / 5));
                                        const optionLabel = formatPollOptionLabel(opt.option.text, opt.option.dateTimeValue, poll.type);
                                        return `${i + 1}. ${optionLabel}\n\`${bar}\` ${opt.percentage}% (${opt.voteCount})`;
                                    }).join('\n\n');

                                    newEmbed.spliceFields(optionsFieldIndex, 1, {
                                        name: 'Final Results',
                                        value: resultsText || 'No votes',
                                        inline: false,
                                    });
                                }

                                await message.edit({ embeds: [newEmbed], components: [] });

                                // Send final results
                                const winnerNames = results.options
                                    .filter(o => o.voteCount === results.options[0]?.voteCount && o.voteCount > 0)
                                    .map(o => formatPollOptionLabel(o.option.text, o.option.dateTimeValue, poll.type));

                                if (winnerNames.length > 0 && results.totalVotes > 0) {
                                    const winnerText = winnerNames.length === 1
                                        ? `Winner: **${winnerNames[0]}**`
                                        : `Tied winners: **${winnerNames.join('**, **')}**`;

                                    await channel.send({
                                        content: `📊 Poll ended: **${poll.question}**\n${winnerText} with ${results.options[0].voteCount} vote${results.options[0].voteCount !== 1 ? 's' : ''}!`,
                                    });
                                } else {
                                    await channel.send({
                                        content: `📊 Poll ended: **${poll.question}**\nNo votes were cast.`,
                                    });
                                }
                            }
                        }
                    } catch (error) {
                        logger.warn(`Could not update ended poll message ${poll.messageId}:`, error);
                    }
                }

                logger.info(`Poll ${poll.id} "${poll.question}" ended in ${guild.name}`);

            } catch (error) {
                logger.error(`Error handling end of poll ${poll.id}:`, error);
            }
        }

    } catch (error) {
        logger.error('Error in poll end job:', error);
    }
}

function formatPollOptionLabel(text: string, dateTimeValue: Date | null, type: 'STANDARD' | 'TIME' | 'ANONYMOUS'): string {
    if (type !== 'TIME') return text;

    if (dateTimeValue) {
        return `<t:${Math.floor(new Date(dateTimeValue).getTime() / 1000)}:F>`;
    }

    if (text.includes('<t:')) {
        return text;
    }

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
        return `<t:${Math.floor(parsed.getTime() / 1000)}:F>`;
    }

    return text;
}
