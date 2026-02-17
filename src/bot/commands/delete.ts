import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    GuildMember,
} from 'discord.js';
import { Command } from '../types/Command';
import { eventService } from '../services/event-service';
import { pollService } from '../services/poll-service';
import { canMemberManageCreatorOwnedResource } from '../services/resource-authorization-service';
import logger from '../utils/logger';

export const data = new SlashCommandBuilder()
    .setName('delete')
    .setDescription('Delete an event or poll')
    .addStringOption(option =>
        option
            .setName('type')
            .setDescription('What to delete')
            .setRequired(true)
            .addChoices(
                { name: 'Event', value: 'event' },
                { name: 'Poll', value: 'poll' }
            )
    )
    .addStringOption(option =>
        option
            .setName('id')
            .setDescription('ID of the event or poll (use /list to find IDs)')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('reason')
            .setDescription('Reason for deletion')
    );

async function resolveInteractionMember(
    interaction: ChatInputCommandInteraction
): Promise<GuildMember | null> {
    if (!interaction.guild) {
        return null;
    }

    if (interaction.member instanceof GuildMember) {
        return interaction.member;
    }

    return interaction.guild.members.fetch(interaction.user.id).catch(() => null);
}

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;
        if (!guild) {
            await interaction.editReply('This command can only be used in a server.');
            return;
        }

        const member = await resolveInteractionMember(interaction);
        if (!member) {
            await interaction.editReply('Unable to verify your server membership. Please try again.');
            return;
        }

        const type = interaction.options.getString('type', true);
        const id = interaction.options.getString('id', true);
        const reason = interaction.options.getString('reason');

        if (type === 'event') {
            await deleteEvent(interaction, id, member, reason);
        } else {
            await deletePoll(interaction, id, member, reason);
        }

    } catch (error) {
        logger.error('Error deleting item:', error);
        await interaction.editReply('An error occurred while deleting. Please try again.');
    }
}

async function deleteEvent(
    interaction: ChatInputCommandInteraction,
    eventId: string,
    member: GuildMember,
    reason: string | null
) {
    const evt = await eventService.getEventById(eventId);

    if (!evt) {
        await interaction.editReply('Event not found. Use `/list type:events` to see available events.');
        return;
    }

    if (evt.guildId !== interaction.guildId) {
        await interaction.editReply('This event is not in this server.');
        return;
    }

    const allowed = canMemberManageCreatorOwnedResource({
        member,
        creatorUserId: evt.creatorId,
        adminPermissions: [
            PermissionFlagsBits.ManageEvents,
            PermissionFlagsBits.Administrator,
        ],
    });

    if (!allowed) {
        await interaction.editReply('You can only delete events you created or if you have Manage Events permission.');
        return;
    }

    // Delete through shared domain path (includes Discord artifact cleanup).
    await eventService.deleteEvent(eventId);

    const reasonText = reason ? `\nReason: ${reason}` : '';
    await interaction.editReply(`✅ Event "${evt.title}" has been deleted.${reasonText}`);

    logger.info(`Event ${eventId} deleted by ${interaction.user.tag}${reason ? ` (reason: ${reason})` : ''}`);
}

async function deletePoll(
    interaction: ChatInputCommandInteraction,
    pollId: string,
    member: GuildMember,
    reason: string | null
) {
    const poll = await pollService.getPollById(pollId);

    if (!poll) {
        await interaction.editReply('Poll not found. Use `/list type:polls` to see available polls.');
        return;
    }

    if (poll.guildId !== interaction.guildId) {
        await interaction.editReply('This poll is not in this server.');
        return;
    }

    const allowed = canMemberManageCreatorOwnedResource({
        member,
        creatorUserId: poll.creatorId,
        adminPermissions: [
            PermissionFlagsBits.ManageGuild,
            PermissionFlagsBits.Administrator,
        ],
    });

    if (!allowed) {
        await interaction.editReply('You can only delete polls you created or if you have Administrator permission.');
        return;
    }

    // Delete through shared domain path (includes Discord artifact cleanup).
    await pollService.deletePollWithArtifacts(pollId);

    const reasonText = reason ? `\nReason: ${reason}` : '';
    await interaction.editReply(`✅ Poll "${poll.question}" has been deleted.${reasonText}`);

    logger.info(`Poll ${pollId} deleted by ${interaction.user.tag}${reason ? ` (reason: ${reason})` : ''}`);
}

export default { data, execute } as Command;
