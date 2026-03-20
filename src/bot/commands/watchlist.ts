import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChatInputCommandInteraction,
    EmbedBuilder,
    GuildMember,
} from 'discord.js';
import type { Command } from '../types/Command';
import { db } from '../../shared/database/client';
import { memberWatchlist } from '../../shared/database/schema';
import { eq, and, desc } from 'drizzle-orm';
import logger from '../utils/logger';

const SEVERITY_EMOJIS: Record<string, string> = {
    LOW: '🟡',
    MEDIUM: '🟠',
    HIGH: '🔴',
};

export const data = new SlashCommandBuilder()
    .setName('watchlist')
    .setDescription('Manage the staff watchlist for suspicious members')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((sub) =>
        sub
            .setName('add')
            .setDescription('Add a member to the watchlist')
            .addUserOption((opt) =>
                opt.setName('member').setDescription('Member to watch').setRequired(true)
            )
            .addStringOption((opt) =>
                opt.setName('reason').setDescription('Why is this member being watched?').setRequired(true).setMaxLength(500)
            )
            .addStringOption((opt) =>
                opt
                    .setName('severity')
                    .setDescription('Concern level (default: Low)')
                    .addChoices(
                        { name: '🟡 Low — keep an eye on', value: 'LOW' },
                        { name: '🟠 Medium — moderately suspicious', value: 'MEDIUM' },
                        { name: '🔴 High — immediate concern', value: 'HIGH' }
                    )
            )
            .addStringOption((opt) =>
                opt.setName('notes').setDescription('Additional context or notes').setMaxLength(1000)
            )
    )
    .addSubcommand((sub) =>
        sub
            .setName('remove')
            .setDescription('Remove a member from the watchlist')
            .addUserOption((opt) =>
                opt.setName('member').setDescription('Member to remove').setRequired(true)
            )
    )
    .addSubcommand((sub) =>
        sub
            .setName('view')
            .setDescription('View watchlist entry for a member')
            .addUserOption((opt) =>
                opt.setName('member').setDescription('Member to look up').setRequired(true)
            )
    )
    .addSubcommand((sub) =>
        sub.setName('list').setDescription('List all members currently on the watchlist')
    )
    .addSubcommand((sub) =>
        sub
            .setName('note')
            .setDescription('Add or update notes for a watchlist entry')
            .addUserOption((opt) =>
                opt.setName('member').setDescription('Member to update').setRequired(true)
            )
            .addStringOption((opt) =>
                opt.setName('note').setDescription('Note to add').setRequired(true).setMaxLength(1000)
            )
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;
    if (!guild) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
    }

    const member = interaction.member as GuildMember;
    if (
        !member.permissions.has(PermissionFlagsBits.ManageMessages) &&
        !member.permissions.has(PermissionFlagsBits.ManageGuild)
    ) {
        await interaction.reply({ content: 'You need the **Manage Messages** or **Manage Server** permission to use this command.', ephemeral: true });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();

    try {
        switch (sub) {
            case 'add':
                await handleAdd(interaction, guild.id);
                break;
            case 'remove':
                await handleRemove(interaction, guild.id);
                break;
            case 'view':
                await handleView(interaction, guild.id);
                break;
            case 'list':
                await handleList(interaction, guild.id);
                break;
            case 'note':
                await handleNote(interaction, guild.id);
                break;
        }
    } catch (error) {
        logger.error('Error in /watchlist command:', error);
        await interaction.editReply('An error occurred. Please try again.');
    }
}

async function handleAdd(interaction: ChatInputCommandInteraction, guildId: string) {
    const target = interaction.options.getUser('member', true);
    const reason = interaction.options.getString('reason', true);
    const severity = (interaction.options.getString('severity') ?? 'LOW') as 'LOW' | 'MEDIUM' | 'HIGH';
    const notes = interaction.options.getString('notes');

    await db
        .insert(memberWatchlist)
        .values({
            guildId,
            userId: target.id,
            addedBy: interaction.user.id,
            reason,
            notes: notes ?? null,
            severity,
        })
        .onConflictDoUpdate({
            target: [memberWatchlist.guildId, memberWatchlist.userId],
            set: {
                reason,
                notes: notes ?? null,
                severity,
                addedBy: interaction.user.id,
                updatedAt: new Date(),
            },
        });

    const emoji = SEVERITY_EMOJIS[severity];
    const embed = new EmbedBuilder()
        .setTitle(`${emoji} Added to Watchlist`)
        .setColor(severity === 'HIGH' ? 0xed4245 : severity === 'MEDIUM' ? 0xffa500 : 0xfee75c)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
            { name: 'Member', value: `${target} (${target.id})`, inline: false },
            { name: 'Severity', value: `${emoji} ${severity}`, inline: true },
            { name: 'Added by', value: `${interaction.user}`, inline: true },
            { name: 'Reason', value: reason, inline: false }
        );

    if (notes) {
        embed.addFields({ name: 'Notes', value: notes, inline: false });
    }

    await interaction.editReply({ embeds: [embed] });
    logger.info(`Watchlist: ${target.tag} added by ${interaction.user.tag} in guild ${guildId}`);
}

async function handleRemove(interaction: ChatInputCommandInteraction, guildId: string) {
    const target = interaction.options.getUser('member', true);

    const result = await db
        .delete(memberWatchlist)
        .where(and(eq(memberWatchlist.guildId, guildId), eq(memberWatchlist.userId, target.id)));

    if ((result.rowCount ?? 0) === 0) {
        await interaction.editReply(`**${target.tag}** is not on the watchlist.`);
        return;
    }

    await interaction.editReply(`✅ **${target.tag}** has been removed from the watchlist.`);
    logger.info(`Watchlist: ${target.tag} removed by ${interaction.user.tag} in guild ${guildId}`);
}

async function handleView(interaction: ChatInputCommandInteraction, guildId: string) {
    const target = interaction.options.getUser('member', true);

    const [entry] = await db
        .select()
        .from(memberWatchlist)
        .where(and(eq(memberWatchlist.guildId, guildId), eq(memberWatchlist.userId, target.id)));

    if (!entry) {
        await interaction.editReply(`**${target.tag}** is not on the watchlist.`);
        return;
    }

    const emoji = SEVERITY_EMOJIS[entry.severity];
    const addedBy = await interaction.client.users.fetch(entry.addedBy).catch(() => null);

    const embed = new EmbedBuilder()
        .setTitle(`${emoji} Watchlist Entry`)
        .setColor(entry.severity === 'HIGH' ? 0xed4245 : entry.severity === 'MEDIUM' ? 0xffa500 : 0xfee75c)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
            { name: 'Member', value: `${target} (${target.id})`, inline: false },
            { name: 'Severity', value: `${emoji} ${entry.severity}`, inline: true },
            { name: 'Added by', value: addedBy ? `${addedBy}` : entry.addedBy, inline: true },
            { name: 'Added on', value: `<t:${Math.floor(new Date(entry.createdAt).getTime() / 1000)}:D>`, inline: true },
            { name: 'Reason', value: entry.reason, inline: false }
        );

    if (entry.notes) {
        embed.addFields({ name: 'Notes', value: entry.notes, inline: false });
    }

    if (entry.updatedAt > entry.createdAt) {
        embed.setFooter({ text: `Last updated: ${entry.updatedAt.toLocaleDateString()}` });
    }

    await interaction.editReply({ embeds: [embed] });
}

async function handleList(interaction: ChatInputCommandInteraction, guildId: string) {
    const entries = await db
        .select()
        .from(memberWatchlist)
        .where(eq(memberWatchlist.guildId, guildId))
        .orderBy(desc(memberWatchlist.createdAt));

    if (entries.length === 0) {
        await interaction.editReply('The watchlist is empty.');
        return;
    }

    const lines = await Promise.all(
        entries.map(async (entry) => {
            const emoji = SEVERITY_EMOJIS[entry.severity];
            let username = entry.userId;
            try {
                const user = await interaction.client.users.fetch(entry.userId);
                username = user.tag;
            } catch {
                // fallback to ID
            }
            return `${emoji} **${username}** — ${entry.reason.slice(0, 60)}${entry.reason.length > 60 ? '…' : ''}`;
        })
    );

    const highCount = entries.filter((e) => e.severity === 'HIGH').length;
    const medCount = entries.filter((e) => e.severity === 'MEDIUM').length;
    const lowCount = entries.filter((e) => e.severity === 'LOW').length;

    const embed = new EmbedBuilder()
        .setTitle('👁️ Watchlist')
        .setColor(0x5865f2)
        .setDescription(lines.join('\n'))
        .addFields({
            name: 'Summary',
            value: `🔴 High: **${highCount}** | 🟠 Medium: **${medCount}** | 🟡 Low: **${lowCount}**`,
            inline: false,
        })
        .setFooter({ text: `${entries.length} member${entries.length === 1 ? '' : 's'} on watchlist` });

    await interaction.editReply({ embeds: [embed] });
}

async function handleNote(interaction: ChatInputCommandInteraction, guildId: string) {
    const target = interaction.options.getUser('member', true);
    const note = interaction.options.getString('note', true);

    const [updated] = await db
        .update(memberWatchlist)
        .set({ notes: note, updatedAt: new Date() })
        .where(and(eq(memberWatchlist.guildId, guildId), eq(memberWatchlist.userId, target.id)))
        .returning();

    if (!updated) {
        await interaction.editReply(`**${target.tag}** is not on the watchlist. Use \`/watchlist add\` first.`);
        return;
    }

    await interaction.editReply(`✅ Notes updated for **${target.tag}**.`);
}

export default {
    data,
    execute,
    moduleId: 'moderation',
} as Command;
