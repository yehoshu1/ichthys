import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    TextChannel,
    Guild,
    Message,
    Client,
} from 'discord.js';
import { pollService } from './poll-service';
import { Poll, PollOption } from '@shared/database/schema';
import logger from '../utils/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// POLL DISCORD SERVICE
// Handles Discord embeds and voting buttons for polls
// ═══════════════════════════════════════════════════════════════════════════════

interface PollDisplayData {
    id: string;
    question: string;
    description?: string | null;
    color?: string | null;
    type: 'STANDARD' | 'TIME' | 'ANONYMOUS';
    allowMultipleVotes: boolean;
    maxVotesPerUser?: number | null;
    endTime?: Date | null;
    closed: boolean;
    creatorId: string;
}

export class PollDiscordService {
    constructor() {}

    // ═══════════════════════════════════════════════════════════════════════════════
    // EMBED BUILDER
    // ═══════════════════════════════════════════════════════════════════════════════

    async buildPollEmbed(pollData: PollDisplayData, options: PollOption[], results?: any): Promise<EmbedBuilder> {
        const typeIcons: Record<string, string> = {
            'STANDARD': '📊',
            'TIME': '🕐',
            'ANONYMOUS': '🕵️',
        };

        const icon = typeIcons[pollData.type] || '📊';
        const title = pollData.closed ? `🔒 ${icon} ${pollData.question}` : `${icon} ${pollData.question}`;
        
        // Use custom color if set, otherwise default based on closed status
        let color = pollData.closed ? 0x999999 : 0x5865F2;
        if (pollData.color && !pollData.closed) {
            const parsedColor = this.parseColor(pollData.color);
            if (parsedColor) color = parsedColor;
        }

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor(color)
            .setTimestamp();

        // Description
        let description = '';
        if (pollData.description) {
            description += pollData.description + '\n\n';
        }

        // Add poll info
        if (pollData.type === 'ANONYMOUS') {
            description += '🕵️ **Anonymous Poll** - Votes are hidden\n';
        }
        if (pollData.allowMultipleVotes) {
            const maxVotes = pollData.maxVotesPerUser ? ` (max ${pollData.maxVotesPerUser})` : '';
            description += `✓ **Multiple votes allowed**${maxVotes}\n`;
        }
        if (pollData.endTime) {
            const endsAt = Math.floor(new Date(pollData.endTime).getTime() / 1000);
            description += `⏰ Ends <t:${endsAt}:R>\n`;
        }

        if (description) {
            embed.setDescription(description.trim());
        }

        // Options with vote counts if results provided
        let optionsText = '';
        if (results && results.totalVotes > 0) {
            const maxBarLength = 20;
            const showVoters = pollData.type !== 'ANONYMOUS';
            optionsText = results.options.map((opt: any, i: number) => {
                const emoji = opt.option.emoji || `${i + 1}.`;
                const bar = '█'.repeat(Math.round(opt.percentage / 5)) + '░'.repeat(maxBarLength - Math.round(opt.percentage / 5));
                const votersText = showVoters && opt.voteCount > 0
                    ? `\n👥 ${this.formatVoters(opt.voters)}`
                    : '';
                return `${emoji} ${this.getOptionDisplayText(opt.option, pollData.type)}\n\`${bar}\` ${opt.percentage}% (${opt.voteCount})${votersText}`;
            }).join('\n\n');
        } else {
            optionsText = options.map((opt, i) => {
                const emoji = opt.emoji || `${i + 1}.`;
                return `${emoji} ${this.getOptionDisplayText(opt, pollData.type)}`;
            }).join('\n\n');
        }

        embed.addFields({
            name: pollData.closed ? 'Final Results' : 'Options',
            value: this.truncateFieldValue(optionsText || 'No options'),
            inline: false,
        });

        // Footer with vote count
        const totalVotes = results?.totalVotes || 0;
        const statusText = pollData.closed ? 'Poll closed' : `${totalVotes} vote${totalVotes !== 1 ? 's' : ''}`;
        embed.setFooter({ text: statusText });

        return embed;
    }

    buildVoteButtons(
        pollId: string,
        options: PollOption[],
        pollType: PollDisplayData['type'],
        allowMultiple: boolean,
        maxVotes?: number | null
    ): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
        const components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];

        if (options.length <= 5) {
            // Use buttons for up to 5 options
            const rows: ActionRowBuilder<ButtonBuilder>[] = [];
            let currentRow = new ActionRowBuilder<ButtonBuilder>();

            for (let i = 0; i < options.length; i++) {
                if (i > 0 && i % 5 === 0) {
                    rows.push(currentRow);
                    currentRow = new ActionRowBuilder<ButtonBuilder>();
                }

                currentRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`poll:vote:${pollId}:${i}`)
                        .setLabel(options[i].emoji || `${i + 1}`)
                        .setStyle(ButtonStyle.Primary)
                );
            }

            if (currentRow.components.length > 0) {
                rows.push(currentRow);
            }

            components.push(...rows);
        } else {
            // Use select menu for more options
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`poll:vote:${pollId}`)
                .setPlaceholder(allowMultiple ? 'Select option(s) to vote (or clear to remove)' : 'Select an option to vote (or clear to remove)')
                .setMinValues(0)
                .setMaxValues(allowMultiple ? (maxVotes || options.length) : 1);

            for (let i = 0; i < options.length; i++) {
                const opt = options[i];
                const optionDisplayText = this.getOptionDisplayText(opt, pollType);
                selectMenu.addOptions({
                    label: pollType === 'TIME'
                        ? `Slot ${i + 1}`
                        : optionDisplayText.substring(0, 100),
                    value: `${i}`,
                    ...(pollType === 'TIME'
                        ? { description: optionDisplayText.substring(0, 100) }
                        : {}),
                    ...(opt.emoji ? { emoji: opt.emoji } : {}),
                });
            }

            const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
            components.push(selectRow);
        }

        // Add control buttons
        const controlRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`poll:results:${pollId}`)
                .setLabel('📊 Results')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`poll:end:${pollId}`)
                .setLabel('🔒 Close Poll')
                .setStyle(ButtonStyle.Danger)
        );

        components.push(controlRow);
        return components;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // MESSAGE OPERATIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    async createPollMessage(poll: Poll, guild: Guild): Promise<Message | null> {
        const channel = await this.getPollChannel(poll.channelId, guild);
        if (!channel) return null;

        // Get options
        const pollWithOptions = await pollService.getPollWithOptions(poll.id);
        if (!pollWithOptions) return null;

        const { options } = pollWithOptions;

        const embed = await this.buildPollEmbed(poll, options);
        const components = this.buildVoteButtons(poll.id, options, poll.type, poll.allowMultipleVotes, poll.maxVotesPerUser);

        // Build mention string
        let mentionContent = '';
        if (poll.mentionOnCreate && poll.mentionRoleIds?.length) {
            mentionContent = poll.mentionRoleIds.map(id => `<@&${id}>`).join(' ');
        }

        const message = await channel.send({
            content: mentionContent || undefined,
            embeds: [embed],
            components,
        });

        // Store message ID
        await pollService.setPollMessageId(poll.id, message.id);

        return message;
    }

    async updatePollMessage(poll: Poll, guild: Guild): Promise<Message | null> {
        if (!poll.messageId) return null;

        const channel = await this.getPollChannel(poll.channelId, guild);
        if (!channel) return null;

        try {
            const message = await channel.messages.fetch(poll.messageId);
            if (!message) return null;

            // Get options and results
            const pollWithOptions = await pollService.getPollWithOptions(poll.id);
            if (!pollWithOptions) return null;

            const { options } = pollWithOptions;
            const results = await pollService.getResults(poll.id);

            const embed = await this.buildPollEmbed(poll, options, results);

            // If poll is closed, remove components
            if (poll.closed) {
                await message.edit({
                    embeds: [embed],
                    components: [],
                });
            } else {
                const components = this.buildVoteButtons(poll.id, options, poll.type, poll.allowMultipleVotes, poll.maxVotesPerUser);
                await message.edit({
                    embeds: [embed],
                    components,
                });
            }

            return message;
        } catch (error) {
            logger.warn('Failed to update poll message:', error);
            return null;
        }
    }

    async deletePollMessage(poll: Poll, guild: Guild): Promise<void> {
        if (!poll.messageId) return;

        const channel = await this.getPollChannel(poll.channelId, guild);
        if (!channel) return;

        try {
            const message = await channel.messages.fetch(poll.messageId);
            if (message) {
                await message.delete();
            }
        } catch (error) {
            // Message already deleted or not found
            logger.debug('Poll message already deleted or not found');
        }
    }

    async updateVoteDisplay(pollId: string, guild: Guild): Promise<void> {
        const poll = await pollService.getPollById(pollId);
        if (!poll || !poll.messageId) return;

        await this.updatePollMessage(poll, guild);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // UTILITY
    // ═══════════════════════════════════════════════════════════════════════════════

    private async getPollChannel(channelId: string, guild: Guild): Promise<TextChannel | null> {
        try {
            const channel = await guild.channels.fetch(channelId);
            if (channel?.isTextBased()) {
                return channel as TextChannel;
            }
        } catch (error) {
            logger.warn('Failed to fetch poll channel:', error);
        }
        return null;
    }

    private parseColor(color?: string | null): number | null {
        if (!color) return null;
        try {
            return parseInt(color.replace('#', ''), 16);
        } catch {
            return null;
        }
    }

    private formatVoters(voters?: string[]): string {
        if (!voters || voters.length === 0) {
            return 'No voters';
        }

        const maxVisible = 8;
        const visible = voters.slice(0, maxVisible).map((userId) => `<@${userId}>`);
        const remaining = voters.length - visible.length;

        return remaining > 0
            ? `${visible.join(', ')} +${remaining} more`
            : visible.join(', ');
    }

    private truncateFieldValue(value: string): string {
        const maxLength = 1024;
        if (value.length <= maxLength) {
            return value;
        }

        return `${value.slice(0, maxLength - 15)}\n…(truncated)`;
    }

    private getOptionDisplayText(option: PollOption, pollType: PollDisplayData['type']): string {
        if (pollType !== 'TIME') {
            return option.text;
        }

        const fromDate = this.normalizeDate(option.dateTimeValue);
        if (fromDate) {
            return this.formatDiscordTimestamp(fromDate);
        }

        if (option.text.includes('<t:')) {
            return option.text;
        }

        const parsedFromText = this.normalizeDate(option.text);
        if (parsedFromText) {
            return this.formatDiscordTimestamp(parsedFromText);
        }

        return option.text;
    }

    private normalizeDate(value: Date | string | null | undefined): Date | null {
        if (!value) return null;
        const parsed = value instanceof Date ? value : new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    private formatDiscordTimestamp(date: Date): string {
        const unix = Math.floor(date.getTime() / 1000);
        return `<t:${unix}:F>`;
    }
}

export let pollDiscordService: PollDiscordService;

export function initPollDiscordService(client: Client) {
    void client;
    pollDiscordService = new PollDiscordService();
    return pollDiscordService;
}
