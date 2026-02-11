import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, ChannelType } from 'discord.js';
import type { Command } from '../types/Command';
import { db } from '../../shared/database/client';
import { reactionRole } from '../../shared/database/schema';
import { eq, and } from 'drizzle-orm';
import logger from '../utils/logger';

const REACTION_TYPES = [
    { name: 'Toggle (Add/Remove)', value: 'TOGGLE' },
    { name: 'Add Only', value: 'ADD_ONLY' },
    { name: 'Remove Only', value: 'REMOVE_ONLY' },
    { name: 'Unique (Only one role)', value: 'UNIQUE' },
] as const;
type ReactionRoleType = (typeof REACTION_TYPES)[number]['value'];

function isReactionRoleType(value: string): value is ReactionRoleType {
    return REACTION_TYPES.some((reactionType) => reactionType.value === value);
}

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('reactionrole')
        .setDescription('Manage reaction roles')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new reaction role message')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel to send the message in')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('Title for the reaction role message')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('Description for the reaction role message')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a reaction role to an existing message')
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('ID of the message to add the reaction to')
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel containing the message')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to assign')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('emoji')
                        .setDescription('Emoji to use (unicode or custom emoji)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('How the reaction role behaves')
                        .addChoices(...REACTION_TYPES)
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('Description shown to users')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a reaction role from a message')
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('ID of the message')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('emoji')
                        .setDescription('Emoji of the reaction role to remove')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all reaction roles in the server'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete a reaction role message and all its roles')
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('ID of the message to delete')
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel containing the message')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'create':
                    await handleCreate(interaction);
                    break;
                case 'add':
                    await handleAdd(interaction);
                    break;
                case 'remove':
                    await handleRemove(interaction);
                    break;
                case 'list':
                    await handleList(interaction);
                    break;
                case 'delete':
                    await handleDelete(interaction);
                    break;
            }
        } catch (error) {
            logger.error(`Error executing reaction role command ${subcommand}:`, error);
            await interaction.reply({
                content: 'An error occurred while executing this command.',
                ephemeral: true
            });
        }
    }
};

async function handleCreate(interaction: ChatInputCommandInteraction) {
    const channel = interaction.options.getChannel('channel', true);
    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description') || 'React below to get your roles!';

    const embed = {
        color: 0x5865F2,
        title: title,
        description: description,
        footer: { text: 'React to get your roles!' },
        timestamp: new Date().toISOString(),
    };

    try {
        const textChannel = await interaction.guild!.channels.fetch(channel.id);
        if (!textChannel?.isTextBased()) {
            await interaction.reply({ content: 'Selected channel is not a text channel.', ephemeral: true });
            return;
        }

        const message = await textChannel.send({ embeds: [embed] });

        await interaction.reply({
            content: `✅ Reaction role message created! Message ID: \`${message.id}\`\n\nUse \`/reactionrole add\` to add roles to this message.`,
            ephemeral: true
        });
    } catch (error) {
        logger.error('Error creating reaction role message:', error);
        await interaction.reply({
            content: 'Failed to create reaction role message. Make sure I have permission to send messages in that channel.',
            ephemeral: true
        });
    }
}

async function handleAdd(interaction: ChatInputCommandInteraction) {
    const messageId = interaction.options.getString('message_id', true);
    const channel = interaction.options.getChannel('channel', true);
    const role = interaction.options.getRole('role', true);
    const emoji = interaction.options.getString('emoji', true);
    const requestedType = interaction.options.getString('type');
    const type: ReactionRoleType = requestedType && isReactionRoleType(requestedType)
        ? requestedType
        : 'TOGGLE';
    const description = interaction.options.getString('description') || undefined;

    // Validate emoji format
    const customEmojiRegex = /^<a?:(\w+):(\d+)>$/;

    let emojiId = emoji;

    const customMatch = emoji.match(customEmojiRegex);
    if (customMatch) {
        emojiId = customMatch[2];
    }

    try {
        const textChannel = await interaction.guild!.channels.fetch(channel.id);
        if (!textChannel?.isTextBased()) {
            await interaction.reply({ content: 'Selected channel is not a text channel.', ephemeral: true });
            return;
        }

        const message = await textChannel.messages.fetch(messageId).catch((error) => { logger.warn(`Failed to fetch message ${messageId} for reaction role:`, error); return null; });
        if (!message) {
            await interaction.reply({ content: 'Message not found. Make sure the message ID and channel are correct.', ephemeral: true });
            return;
        }

        // Check if role is manageable
        const botMember = interaction.guild!.members.me;
        if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
            await interaction.reply({ content: 'I need the "Manage Roles" permission to assign roles.', ephemeral: true });
            return;
        }

        const botHighestRole = botMember.roles.highest;
        const roleToAssign = await interaction.guild!.roles.fetch(role.id);
        if (!roleToAssign) {
            await interaction.reply({ content: 'Role not found.', ephemeral: true });
            return;
        }

        if (roleToAssign.position >= botHighestRole.position) {
            await interaction.reply({ content: 'I cannot assign this role because it is higher than or equal to my highest role.', ephemeral: true });
            return;
        }

        // Check for existing reaction role with same emoji
        const existing = await db.query.reactionRole.findFirst({
            where: and(
                eq(reactionRole.messageId, messageId),
                eq(reactionRole.emoji, emojiId)
            )
        });

        if (existing) {
            await interaction.reply({ content: 'A reaction role already exists for this emoji on this message.', ephemeral: true });
            return;
        }

        // Add the reaction to the message
        await message.react(emoji);

        // Save to database
        await db.insert(reactionRole).values({
            guildId: interaction.guildId!,
            messageId,
            channelId: channel.id,
            emoji: emojiId,
            roleId: role.id,
            type,
            description,
            enabled: true,
        });

        await interaction.reply({
            content: `✅ Added reaction role: ${emoji} → <@&${role.id}> (${type})`,
            ephemeral: true
        });
    } catch (error) {
        logger.error('Error adding reaction role:', error);
        await interaction.reply({
            content: 'Failed to add reaction role. Make sure the emoji is valid and I have permission to add reactions.',
            ephemeral: true
        });
    }
}

async function handleRemove(interaction: ChatInputCommandInteraction) {
    const messageId = interaction.options.getString('message_id', true);
    const emoji = interaction.options.getString('emoji', true);

    // Parse custom emoji
    const customEmojiRegex = /^<a?:(\w+):(\d+)>$/;
    const customMatch = emoji.match(customEmojiRegex);
    const emojiId = customMatch ? customMatch[2] : emoji;

    try {
        // Find and delete the reaction role
        const deleted = await db.delete(reactionRole)
            .where(and(
                eq(reactionRole.guildId, interaction.guildId!),
                eq(reactionRole.messageId, messageId),
                eq(reactionRole.emoji, emojiId)
            ))
            .returning();

        if (deleted.length === 0) {
            await interaction.reply({ content: 'Reaction role not found.', ephemeral: true });
            return;
        }

        await interaction.reply({
            content: `✅ Removed reaction role with emoji ${emoji}`,
            ephemeral: true
        });
    } catch (error) {
        logger.error('Error removing reaction role:', error);
        await interaction.reply({
            content: 'Failed to remove reaction role.',
            ephemeral: true
        });
    }
}

async function handleList(interaction: ChatInputCommandInteraction) {
    try {
        const reactionRoles = await db.query.reactionRole.findMany({
            where: and(
                eq(reactionRole.guildId, interaction.guildId!),
                eq(reactionRole.enabled, true)
            )
        });

        if (reactionRoles.length === 0) {
            await interaction.reply({ content: 'No reaction roles configured in this server.', ephemeral: true });
            return;
        }

        // Group by message
        const grouped = reactionRoles.reduce((acc, rr) => {
            if (!acc[rr.messageId]) {
                acc[rr.messageId] = [];
            }
            acc[rr.messageId].push(rr);
            return acc;
        }, {} as Record<string, typeof reactionRoles>);

        const lines = Object.entries(grouped).map(([messageId, roles]) => {
            const roleList = roles.map(r => {
                const emojiDisplay = r.emoji
                    ? (r.emoji.length > 10 ? `<:emoji:${r.emoji}>` : r.emoji)
                    : (r.label || '🔘');
                return `${emojiDisplay} → <#${r.channelId}> <@&${r.roleId}> (${r.type})`;
            }).join('\n   ');
            return `**Message:** \`${messageId}\`\n   ${roleList}`;
        });

        await interaction.reply({
            content: `**Reaction Roles**\n\n${lines.join('\n\n')}`,
            ephemeral: true
        });
    } catch (error) {
        logger.error('Error listing reaction roles:', error);
        await interaction.reply({
            content: 'Failed to list reaction roles.',
            ephemeral: true
        });
    }
}

async function handleDelete(interaction: ChatInputCommandInteraction) {
    const messageId = interaction.options.getString('message_id', true);
    const channel = interaction.options.getChannel('channel', true);

    try {
        // Delete all reaction roles for this message
        await db.delete(reactionRole)
            .where(and(
                eq(reactionRole.guildId, interaction.guildId!),
                eq(reactionRole.messageId, messageId)
            ));

        // Try to delete the message
        const textChannel = await interaction.guild!.channels.fetch(channel.id);
        if (textChannel?.isTextBased()) {
            const message = await textChannel.messages.fetch(messageId).catch((error) => { logger.warn(`Failed to fetch message ${messageId} for deletion:`, error); return null; });
            if (message) {
                await message.delete();
            }
        }

        await interaction.reply({
            content: '✅ Reaction role message and all associated roles deleted.',
            ephemeral: true
        });
    } catch (error) {
        logger.error('Error deleting reaction role message:', error);
        await interaction.reply({
            content: 'Failed to delete reaction role message. Associated roles have been removed from the database.',
            ephemeral: true
        });
    }
}

export default command;
