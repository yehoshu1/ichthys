import {
    EmbedBuilder,
    GuildMember,
    PermissionFlagsBits,
    type ButtonInteraction,
    type StringSelectMenuInteraction,
} from 'discord.js';
import { pollService } from '../../services/poll-service';
import type { PollOption } from '@shared/database/schema';
import logger from '../../utils/logger';
import type { ComponentRouter } from '../component-router';

function truncatePollResults(value: string): string {
    const maxLength = 1024;
    if (value.length <= maxLength) {
        return value;
    }

    return `${value.slice(0, maxLength - 15)}\n…(truncated)`;
}

function formatTimePollOption(option: PollOption): string {
    if (option.dateTimeValue) {
        const parsed = new Date(option.dateTimeValue);
        if (!Number.isNaN(parsed.getTime())) {
            return `<t:${Math.floor(parsed.getTime() / 1000)}:F>`;
        }
    }

    if (option.text.includes('<t:')) {
        return option.text;
    }

    const fromText = new Date(option.text);
    if (!Number.isNaN(fromText.getTime())) {
        return `<t:${Math.floor(fromText.getTime() / 1000)}:F>`;
    }

    return option.text;
}

function formatPollOptionLabel(option: PollOption, pollType: 'STANDARD' | 'TIME' | 'ANONYMOUS'): string {
    return pollType === 'TIME' ? formatTimePollOption(option) : option.text;
}

async function handlePollVote(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    const pollId = parts[2];
    const optionIndex = parseInt(parts[3], 10);

    await interaction.deferReply({ ephemeral: true });

    const pollData = await pollService.getPollWithOptions(pollId);
    if (!pollData) {
        await interaction.editReply({ content: 'This poll no longer exists.' });
        return;
    }

    if (pollData.poll.closed) {
        await interaction.editReply({ content: 'This poll is closed.' });
        return;
    }

    const member = interaction.member as GuildMember;
    if (pollData.poll.allowedRoleIds?.length) {
        const hasAllowedRole = pollData.poll.allowedRoleIds.some((roleId) => member.roles.cache.has(roleId));
        if (!hasAllowedRole) {
            await interaction.editReply({ content: 'You do not have permission to vote in this poll.' });
            return;
        }
    }

    const option = pollData.options[optionIndex];
    if (!option) {
        await interaction.editReply({ content: 'Invalid option.' });
        return;
    }

    const result = await pollService.castVote({
        pollId,
        optionId: option.id,
        userId: interaction.user.id,
    });

    if (!result.success) {
        await interaction.editReply({ content: result.message || 'Could not cast vote.' });
        return;
    }

    if (interaction.guild) {
        try {
            const { pollDiscordService } = await import('../../services/poll-discord-service');
            if (pollDiscordService) {
                await pollDiscordService.updateVoteDisplay(pollId, interaction.guild);
            }
        } catch (error) {
            logger.warn('Could not update poll Discord message:', error);
        }
    }

    const optionLabel = formatPollOptionLabel(option, pollData.poll.type);
    const message = result.message === 'Vote removed'
        ? `Your vote for "${optionLabel}" has been removed.`
        : `You voted for "${optionLabel}"`;

    await interaction.editReply({ content: message });
}

async function handlePollVoteSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const pollId = interaction.customId.split(':')[2];
    const selectedOptions = interaction.values
        .map((value) => parseInt(value, 10))
        .filter((value) => !Number.isNaN(value));

    await interaction.deferReply({ ephemeral: true });

    const pollData = await pollService.getPollWithOptions(pollId);
    if (!pollData) {
        await interaction.editReply({ content: 'This poll no longer exists.' });
        return;
    }

    if (pollData.poll.closed) {
        await interaction.editReply({ content: 'This poll is closed.' });
        return;
    }

    const member = interaction.member as GuildMember;
    if (pollData.poll.allowedRoleIds?.length) {
        const hasAllowedRole = pollData.poll.allowedRoleIds.some((roleId) => member.roles.cache.has(roleId));
        if (!hasAllowedRole) {
            await interaction.editReply({ content: 'You do not have permission to vote in this poll.' });
            return;
        }
    }

    await pollService.removeAllUserVotes(pollId, interaction.user.id, pollData.poll.type === 'ANONYMOUS');

    if (selectedOptions.length === 0) {
        if (interaction.guild) {
            try {
                const { pollDiscordService } = await import('../../services/poll-discord-service');
                if (pollDiscordService) {
                    await pollDiscordService.updateVoteDisplay(pollId, interaction.guild);
                }
            } catch (error) {
                logger.warn('Could not update poll Discord message:', error);
            }
        }

        await interaction.editReply({ content: 'Your poll responses have been removed.' });
        return;
    }

    for (const optionIndex of selectedOptions) {
        const option = pollData.options[optionIndex];
        if (!option) continue;

        const result = await pollService.castVote({
            pollId,
            optionId: option.id,
            userId: interaction.user.id,
        });

        if (!result.success) {
            await interaction.editReply({ content: result.message || 'Could not cast vote.' });
            return;
        }
    }

    if (interaction.guild) {
        try {
            const { pollDiscordService } = await import('../../services/poll-discord-service');
            if (pollDiscordService) {
                await pollDiscordService.updateVoteDisplay(pollId, interaction.guild);
            }
        } catch (error) {
            logger.warn('Could not update poll Discord message:', error);
        }
    }

    const selectedTexts = selectedOptions
        .map((idx) => {
            const option = pollData.options[idx];
            if (!option) return null;
            return formatPollOptionLabel(option, pollData.poll.type);
        })
        .filter(Boolean);

    await interaction.editReply({ content: `You voted for: ${selectedTexts.join(', ')}` });
}

async function handlePollResults(interaction: ButtonInteraction): Promise<void> {
    const pollId = interaction.customId.split(':')[2];

    const results = await pollService.getResults(pollId);
    const pollData = await pollService.getPollWithOptions(pollId);

    if (!pollData) {
        await interaction.reply({ content: 'This poll no longer exists.', ephemeral: true });
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle('📊 Poll Results')
        .setDescription(pollData.poll.question)
        .setColor('#5865F2')
        .setFooter({ text: `${results.totalVotes} total vote${results.totalVotes !== 1 ? 's' : ''}` });

    const showVoters = pollData.poll.type !== 'ANONYMOUS';
    const resultsText = results.options.map((opt, i) => {
        const bar = '█'.repeat(Math.round(opt.percentage / 5)) + '░'.repeat(20 - Math.round(opt.percentage / 5));
        if (!showVoters || !opt.voters || opt.voters.length === 0) {
            return `${i + 1}. ${formatPollOptionLabel(opt.option, pollData.poll.type)}\n\`${bar}\` ${opt.percentage}% (${opt.voteCount})`;
        }

        const maxVisible = 10;
        const visibleVoters = opt.voters.slice(0, maxVisible).map((userId: string) => `<@${userId}>`);
        const remaining = opt.voters.length - visibleVoters.length;
        const voterText = remaining > 0 ? `${visibleVoters.join(', ')} +${remaining} more` : visibleVoters.join(', ');

        return `${i + 1}. ${formatPollOptionLabel(opt.option, pollData.poll.type)}\n\`${bar}\` ${opt.percentage}% (${opt.voteCount})\n👥 ${voterText}`;
    }).join('\n\n');

    embed.addFields({
        name: showVoters ? 'Results (With Voters)' : 'Results',
        value: truncatePollResults(resultsText || 'No votes yet'),
        inline: false,
    });

    if (!showVoters) {
        embed.addFields({
            name: 'Privacy',
            value: '🕵️ This is an anonymous poll. Voter identities are hidden.',
            inline: false,
        });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handlePollClose(interaction: ButtonInteraction): Promise<void> {
    const pollId = interaction.customId.split(':')[2];
    const pollData = await pollService.getPollById(pollId);

    if (!pollData) {
        await interaction.reply({ content: 'This poll no longer exists.', ephemeral: true });
        return;
    }

    const member = interaction.member as GuildMember;
    const isCreator = pollData.creatorId === interaction.user.id;
    const isAdmin = member.permissions.has(PermissionFlagsBits.ManageGuild) || member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isCreator && !isAdmin) {
        await interaction.reply({ content: 'Only the poll creator or administrators can close this poll.', ephemeral: true });
        return;
    }

    const updatedPoll = await pollService.closePoll(pollId);

    if (interaction.guild && updatedPoll) {
        try {
            const { pollDiscordService } = await import('../../services/poll-discord-service');
            if (pollDiscordService) {
                await pollDiscordService.updatePollMessage(updatedPoll, interaction.guild);
            }
        } catch (syncError) {
            logger.warn('Could not sync closed poll Discord message:', syncError);
        }
    }

    await interaction.reply({ content: 'Poll closed successfully.', ephemeral: true });
}

export function registerPollComponentHandlers(router: ComponentRouter): void {
    router.register('button', 'poll:vote:', handlePollVote, { moduleId: 'polls' });
    router.register('button', 'poll:results:', handlePollResults, { moduleId: 'polls' });
    router.register('button', 'poll:end:', handlePollClose, { moduleId: 'polls' });
    router.register('string_select', 'poll:vote:', handlePollVoteSelect, { moduleId: 'polls' });
}
