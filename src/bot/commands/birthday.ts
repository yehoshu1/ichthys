/**
 * Birthday Command Module
 * 
 * Comprehensive birthday management system for Discord servers.
 * Features:
 * - User birthday registration with interactive timezone selection
 * - Automatic birthday announcements at configured times
 * - Age calculation (optional)
 * - Birthday role assignment
 * - Upcoming birthday lists
 * - Admin management commands
 * 
 * @module commands/birthday
 */

import { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    PermissionFlagsBits,
    StringSelectMenuBuilder,
    ActionRowBuilder,
    ComponentType,
    MessageComponentInteraction,
    CacheType
} from 'discord.js';
import { Command } from '../types/Command';
import { db } from '../../shared/database/client';
import { birthdayEntry, birthdayConfig } from '../../shared/database/schema';
import { eq, and } from 'drizzle-orm';
import logger from '../utils/logger';

// Comprehensive timezone list organized by region
const TIMEZONES = [
    // UTC
    { label: '🌍 UTC (Coordinated Universal Time)', value: 'UTC', offset: '+00:00' },
    
    // North America
    { label: '🇺🇸 Pacific Time (Los Angeles, Vancouver)', value: 'America/Los_Angeles', offset: '-08:00' },
    { label: '🇺🇸 Mountain Time (Denver, Phoenix)', value: 'America/Denver', offset: '-07:00' },
    { label: '🇺🇸 Central Time (Chicago, Mexico City)', value: 'America/Chicago', offset: '-06:00' },
    { label: '🇺🇸 Eastern Time (New York, Toronto)', value: 'America/New_York', offset: '-05:00' },
    { label: '🇨🇦 Atlantic Time (Halifax)', value: 'America/Halifax', offset: '-04:00' },
    { label: '🇨🇦 Newfoundland Time (St. John\'s)', value: 'America/St_Johns', offset: '-03:30' },
    { label: '🇧🇷 Brasília Time', value: 'America/Sao_Paulo', offset: '-03:00' },
    { label: '🇦🇷 Argentina Time (Buenos Aires)', value: 'America/Argentina/Buenos_Aires', offset: '-03:00' },
    
    // Europe
    { label: '🇬🇧 UK Time (London, Dublin)', value: 'Europe/London', offset: '+00:00/+01:00' },
    { label: '🇨🇪 Central Europe (Berlin, Paris, Rome)', value: 'Europe/Berlin', offset: '+01:00/+02:00' },
    { label: '🇪🇪 Eastern Europe (Helsinki, Athens)', value: 'Europe/Helsinki', offset: '+02:00/+03:00' },
    { label: '🇷🇺 Moscow Time', value: 'Europe/Moscow', offset: '+03:00' },
    { label: '🇹🇷 Turkey Time (Istanbul)', value: 'Europe/Istanbul', offset: '+03:00' },
    
    // Asia
    { label: '🇦🇪 Gulf Time (Dubai)', value: 'Asia/Dubai', offset: '+04:00' },
    { label: '🇮🇳 India Time (Mumbai, New Delhi)', value: 'Asia/Kolkata', offset: '+05:30' },
    { label: '🇧🇩 Bangladesh Time (Dhaka)', value: 'Asia/Dhaka', offset: '+06:00' },
    { label: '🇹🇭 Thailand Time (Bangkok)', value: 'Asia/Bangkok', offset: '+07:00' },
    { label: '🇸🇬 Singapore/Malaysia Time', value: 'Asia/Singapore', offset: '+08:00' },
    { label: '🇨🇳 China Time (Beijing, Shanghai)', value: 'Asia/Shanghai', offset: '+08:00' },
    { label: '🇭🇰 Hong Kong Time', value: 'Asia/Hong_Kong', offset: '+08:00' },
    { label: '🇹🇼 Taiwan Time (Taipei)', value: 'Asia/Taipei', offset: '+08:00' },
    { label: '🇰🇷 Korea Time (Seoul)', value: 'Asia/Seoul', offset: '+09:00' },
    { label: '🇯🇵 Japan Time (Tokyo)', value: 'Asia/Tokyo', offset: '+09:00' },
    
    // Oceania
    { label: '🇦🇺 Australian Western (Perth)', value: 'Australia/Perth', offset: '+08:00' },
    { label: '🇦🇺 Australian Central (Adelaide)', value: 'Australia/Adelaide', offset: '+09:30/+10:30' },
    { label: '🇦🇺 Australian Eastern (Sydney, Melbourne)', value: 'Australia/Sydney', offset: '+10:00/+11:00' },
    { label: '🇳🇿 New Zealand Time (Auckland)', value: 'Pacific/Auckland', offset: '+12:00/+13:00' },
    
    // Pacific
    { label: '🇫🇯 Fiji Time', value: 'Pacific/Fiji', offset: '+12:00/+13:00' },
    { label: '🇭🇹 Hawaii Time (Honolulu)', value: 'Pacific/Honolulu', offset: '-10:00' },
];

// Group timezones for the select menu (max 25 options per menu)
const TIMEZONE_GROUPS = [
    {
        label: '🌍 UTC & North America',
        options: TIMEZONES.filter(tz => 
            tz.value === 'UTC' || 
            tz.value.startsWith('America/') ||
            tz.value === 'Pacific/Honolulu'
        )
    },
    {
        label: '🌍 Europe, Africa & Middle East',
        options: TIMEZONES.filter(tz => 
            tz.value.startsWith('Europe/') || 
            tz.value === 'Asia/Dubai'
        )
    },
    {
        label: '🌍 Asia & Oceania',
        options: TIMEZONES.filter(tz => 
            tz.value.startsWith('Asia/') && tz.value !== 'Asia/Dubai' ||
            tz.value.startsWith('Australia/') ||
            tz.value.startsWith('Pacific/') && tz.value !== 'Pacific/Honolulu'
        )
    }
];

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// Temporary storage for pending birthday setups (userId -> birthday data)
const pendingBirthdays = new Map<string, {
    guildId: string;
    day: number;
    month: number;
    year: number | null;
    requestedAt: number;
}>();
const MAX_PENDING_BIRTHDAYS = 500;
const PENDING_BIRTHDAY_TTL_MS = 10 * 60 * 1000;

function cleanupPendingBirthdays(now: number): void {
    for (const [key, value] of pendingBirthdays.entries()) {
        if (now - value.requestedAt > PENDING_BIRTHDAY_TTL_MS) {
            pendingBirthdays.delete(key);
        }
    }

    if (pendingBirthdays.size <= MAX_PENDING_BIRTHDAYS) {
        return;
    }

    const entries = Array.from(pendingBirthdays.entries()).sort((a, b) => a[1].requestedAt - b[1].requestedAt);
    const overflow = pendingBirthdays.size - MAX_PENDING_BIRTHDAYS;
    for (let i = 0; i < overflow; i += 1) {
        const [key] = entries[i] ?? [];
        if (key) {
            pendingBirthdays.delete(key);
        }
    }
}

function isValidDate(day: number, month: number): boolean {
    const daysInMonth = new Date(2000, month, 0).getDate();
    return day >= 1 && day <= daysInMonth;
}

function getAge(year: number | null): number | null {
    if (!year) return null;
    return new Date().getFullYear() - year;
}

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('Birthday management commands')
        // Set subcommand - configure your own birthday
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set your birthday with timezone selection')
                .addIntegerOption(option =>
                    option.setName('day')
                        .setDescription('Day of birth (1-31)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(31))
                .addIntegerOption(option =>
                    option.setName('month')
                        .setDescription('Month of birth')
                        .setRequired(true)
                        .addChoices(
                            { name: 'January', value: 1 },
                            { name: 'February', value: 2 },
                            { name: 'March', value: 3 },
                            { name: 'April', value: 4 },
                            { name: 'May', value: 5 },
                            { name: 'June', value: 6 },
                            { name: 'July', value: 7 },
                            { name: 'August', value: 8 },
                            { name: 'September', value: 9 },
                            { name: 'October', value: 10 },
                            { name: 'November', value: 11 },
                            { name: 'December', value: 12 },
                        ))
                .addIntegerOption(option =>
                    option.setName('year')
                        .setDescription('Year of birth (optional, for age calculation)')
                        .setRequired(false)
                        .setMinValue(1900)
                        .setMaxValue(new Date().getFullYear())))
        // Remove subcommand - remove your birthday
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove your birthday from the server'))
        // View subcommand - view someone's birthday
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View a user\'s birthday')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to view birthday for (default: yourself)')
                        .setRequired(false)))
        // List subcommand - list upcoming birthdays
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List upcoming birthdays in the server')
                .addIntegerOption(option =>
                    option.setName('limit')
                        .setDescription('Number of birthdays to show (default: 10)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(50)))
        // Next subcommand - show next birthday
        .addSubcommand(subcommand =>
            subcommand
                .setName('next')
                .setDescription('Show whose birthday is next'))
        // Admin subcommand group
        .addSubcommand(subcommand =>
            subcommand
                .setName('admin-set')
                .setDescription('Admin: Set a user\'s birthday (uses server timezone)')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to set birthday for')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('day')
                        .setDescription('Day of birth (1-31)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(31))
                .addIntegerOption(option =>
                    option.setName('month')
                        .setDescription('Month of birth')
                        .setRequired(true)
                        .addChoices(
                            { name: 'January', value: 1 },
                            { name: 'February', value: 2 },
                            { name: 'March', value: 3 },
                            { name: 'April', value: 4 },
                            { name: 'May', value: 5 },
                            { name: 'June', value: 6 },
                            { name: 'July', value: 7 },
                            { name: 'August', value: 8 },
                            { name: 'September', value: 9 },
                            { name: 'October', value: 10 },
                            { name: 'November', value: 11 },
                            { name: 'December', value: 12 },
                        ))
                .addIntegerOption(option =>
                    option.setName('year')
                        .setDescription('Year of birth (optional)')
                        .setRequired(false)
                        .setMinValue(1900)
                        .setMaxValue(new Date().getFullYear())))
        .addSubcommand(subcommand =>
            subcommand
                .setName('admin-remove')
                .setDescription('Admin: Remove a user\'s birthday')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to remove birthday for')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('test')
                .setDescription('Admin: Test birthday message'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Show birthday statistics for the server')),

    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId!;

        try {
            switch (subcommand) {
                case 'set': {
                    const day = interaction.options.getInteger('day', true);
                    const month = interaction.options.getInteger('month', true);
                    const year = interaction.options.getInteger('year');

                    if (!isValidDate(day, month)) {
                        await interaction.reply({ 
                            content: `❌ Invalid date: ${MONTHS[month - 1]} only has ${new Date(2000, month, 0).getDate()} days.`,
                            ephemeral: true 
                        });
                        return;
                    }

                    // Store the birthday data temporarily
                    cleanupPendingBirthdays(Date.now());
                    pendingBirthdays.set(interaction.user.id, {
                        guildId,
                        day,
                        month,
                        year: year || null,
                        requestedAt: Date.now(),
                    });

                    // Create timezone selection embed
                    const embed = new EmbedBuilder()
                        .setTitle('🎂 Set Your Birthday - Select Timezone')
                        .setDescription(
                            `You've entered: **${MONTHS[month - 1]} ${day}${year ? `, ${year}` : ''}**\n\n` +
                            `Now, please select your **timezone** from the dropdown menu below.\n\n` +
                            `This ensures your birthday is celebrated at the right time in your local timezone! 🌍`
                        )
                        .setColor('#FF69B4')
                        .setFooter({ text: 'Select your timezone region from the menu below' });

                    // Create select menus for each timezone group
                    const rows: ActionRowBuilder<StringSelectMenuBuilder>[] = [];
                    
                    for (const group of TIMEZONE_GROUPS) {
                        const selectMenu = new StringSelectMenuBuilder()
                            .setCustomId(`birthday_tz_${group.label.replace(/[^a-zA-Z0-9]/g, '_')}`)
                            .setPlaceholder(`${group.label}`)
                            .addOptions(
                                group.options.map(tz => ({
                                    label: tz.label.substring(0, 100),
                                    value: tz.value,
                                    description: `${tz.offset} - Click to select`,
                                }))
                            );
                        
                        rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
                    }

                    // Add cancel button row
                    const cancelEmbed = new EmbedBuilder()
                        .setDescription('⏰ This selection will timeout in 2 minutes. Click the menu above to select your timezone.');

                    await interaction.reply({
                        embeds: [embed, cancelEmbed],
                        components: rows,
                        ephemeral: true,
                    });

                    // Set up collector for timezone selection
                    const collector = interaction.channel?.createMessageComponentCollector({
                        componentType: ComponentType.StringSelect,
                        time: 120000, // 2 minutes
                        filter: (i: MessageComponentInteraction<CacheType>) => 
                            i.user.id === interaction.user.id && 
                            i.customId.startsWith('birthday_tz_')
                    });

                    collector?.on('collect', async (i) => {
                        if (!i.isStringSelectMenu()) return;

                        const timezone = i.values[0];
                        const pending = pendingBirthdays.get(interaction.user.id);

                        if (!pending || pending.guildId !== guildId) {
                            await i.update({
                                content: '❌ Your birthday setup has expired. Please run `/birthday set` again.',
                                components: [],
                                embeds: [],
                            });
                            return;
                        }

                        // Save to database
                        await db.insert(birthdayEntry).values({
                            guildId: pending.guildId,
                            userId: interaction.user.id,
                            month: pending.month,
                            day: pending.day,
                            year: pending.year,
                            timezone,
                        }).onConflictDoUpdate({
                            target: [birthdayEntry.guildId, birthdayEntry.userId],
                            set: {
                                month: pending.month,
                                day: pending.day,
                                year: pending.year,
                                timezone,
                                updatedAt: new Date(),
                            },
                        });

                        // Clean up pending data
                        pendingBirthdays.delete(interaction.user.id);

                        const age = getAge(pending.year);
                        const selectedTz = TIMEZONES.find(tz => tz.value === timezone);

                        const successEmbed = new EmbedBuilder()
                            .setTitle('✅ Birthday Set Successfully!')
                            .setDescription(
                                `Your birthday has been saved:\n\n` +
                                `📅 **Date:** ${MONTHS[pending.month - 1]} ${pending.day}${pending.year ? `, ${pending.year}` : ''}\n` +
                                `🌍 **Timezone:** ${selectedTz?.label || timezone}\n` +
                                `${age !== null ? `🎂 **Age:** ${age} years old\n` : ''}\n` +
                                `You'll be celebrated on your special day! 🎉`
                            )
                            .setColor('#00FF00')
                            .setFooter({ text: 'You can change this anytime with /birthday set' });

                        await i.update({
                            embeds: [successEmbed],
                            components: [],
                            content: null,
                        });

                        logger.info(`${interaction.user.tag} set their birthday to ${pending.month}/${pending.day} with timezone ${timezone} in ${interaction.guild?.name}`);
                        collector.stop('completed');
                    });

                    collector?.on('end', async (_, reason) => {
                        if (reason === 'time') {
                            pendingBirthdays.delete(interaction.user.id);
                            try {
                                await interaction.editReply({
                                    content: '⏰ Timezone selection timed out. Please run `/birthday set` again.',
                                    components: [],
                                    embeds: [],
                                });
                            } catch {
                                // Message might already be deleted or updated
                            }
                        }
                    });

                    break;
                }

                case 'remove': {
                    await db.delete(birthdayEntry).where(
                        and(
                            eq(birthdayEntry.guildId, guildId),
                            eq(birthdayEntry.userId, interaction.user.id)
                        )
                    );

                    const embed = new EmbedBuilder()
                        .setTitle('✅ Birthday Removed')
                        .setDescription('Your birthday has been removed from this server.')
                        .setColor('#00FF00');

                    await interaction.reply({ embeds: [embed], ephemeral: true });
                    logger.info(`${interaction.user.tag} removed their birthday from ${interaction.guild.name}`);
                    break;
                }

                case 'view': {
                    await interaction.deferReply({ ephemeral: true });
                    const targetUser = interaction.options.getUser('user') || interaction.user;

                    const entry = await db.query.birthdayEntry.findFirst({
                        where: and(
                            eq(birthdayEntry.guildId, guildId),
                            eq(birthdayEntry.userId, targetUser.id)
                        )
                    });

                    if (!entry) {
                        await interaction.editReply({
                            content: targetUser.id === interaction.user.id
                                ? '❌ You haven\'t set your birthday yet. Use `/birthday set` to add it.'
                                : `❌ ${targetUser.tag} hasn't set their birthday.`
                        });
                        return;
                    }

                    const age = getAge(entry.year);
                    const embed = new EmbedBuilder()
                        .setTitle('🎂 Birthday Information')
                        .setThumbnail(targetUser.displayAvatarURL())
                        .setColor('#FF69B4')
                        .addFields(
                            { name: 'User', value: targetUser.tag, inline: true },
                            { name: 'Birthday', value: `${MONTHS[entry.month - 1]} ${entry.day}`, inline: true },
                            { name: 'Timezone', value: entry.timezone, inline: true },
                        )
                        .setFooter({ text: `Set on ${entry.createdAt.toLocaleDateString()}` });

                    if (age !== null) {
                        embed.addFields({ name: 'Current Age', value: `${age} years old`, inline: true });
                    }

                    // Calculate days until birthday
                    const today = new Date();
                    const currentYear = today.getFullYear();
                    let birthdayThisYear = new Date(currentYear, entry.month - 1, entry.day);
                    
                    if (birthdayThisYear < today) {
                        birthdayThisYear = new Date(currentYear + 1, entry.month - 1, entry.day);
                    }
                    
                    const daysUntil = Math.ceil((birthdayThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    
                    if (daysUntil === 0) {
                        embed.setDescription('🎉 **It\'s their birthday today!**');
                    } else if (daysUntil === 1) {
                        embed.addFields({ name: 'Coming Up', value: 'Tomorrow! 🎈', inline: false });
                    } else {
                        embed.addFields({ name: 'Coming Up', value: `In **${daysUntil}** days`, inline: false });
                    }

                    await interaction.editReply({ embeds: [embed] });
                    break;
                }

                case 'list': {
                    await interaction.deferReply({ ephemeral: true });
                    const limit = interaction.options.getInteger('limit') || 10;
                    const today = new Date();
                    const currentMonth = today.getMonth() + 1;
                    const currentDay = today.getDate();

                    const entries = await db.query.birthdayEntry.findMany({
                        where: eq(birthdayEntry.guildId, guildId),
                    });

                    // Sort by next birthday
                    const sortedEntries = entries.map(entry => {
                        const entryMonth = entry.month;
                        const entryDay = entry.day;
                        
                        // Calculate days until next birthday
                        let daysUntil;
                        if (entryMonth > currentMonth || (entryMonth === currentMonth && entryDay >= currentDay)) {
                            // Birthday is later this year
                            const nextBirthday = new Date(today.getFullYear(), entryMonth - 1, entryDay);
                            daysUntil = Math.ceil((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        } else {
                            // Birthday is next year
                            const nextBirthday = new Date(today.getFullYear() + 1, entryMonth - 1, entryDay);
                            daysUntil = Math.ceil((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        }
                        
                        return { ...entry, daysUntil };
                    }).sort((a, b) => a.daysUntil - b.daysUntil).slice(0, limit);

                    if (sortedEntries.length === 0) {
                        await interaction.editReply({ content: '❌ No birthdays have been set in this server yet.' });
                        return;
                    }

                    const embed = new EmbedBuilder()
                        .setTitle(`🎂 Upcoming Birthdays`)
                        .setColor('#FF69B4')
                        .setDescription(`Showing the next ${sortedEntries.length} birthday${sortedEntries.length !== 1 ? 's' : ''}`);

                    for (const entry of sortedEntries) {
                        const user = await interaction.client.users.fetch(entry.userId).catch((error) => { logger.warn(`Failed to fetch user ${entry.userId} for birthday list:`, error); return null; });
                        const username = user?.tag || entry.userId;
                        
                        let timeText;
                        if (entry.daysUntil === 0) {
                            timeText = '🎉 **Today!**';
                        } else if (entry.daysUntil === 1) {
                            timeText = 'Tomorrow';
                        } else {
                            timeText = `In ${entry.daysUntil} days`;
                        }

                        embed.addFields({
                            name: `${MONTHS[entry.month - 1]} ${entry.day} - ${username}`,
                            value: timeText,
                            inline: false
                        });
                    }

                    await interaction.editReply({ embeds: [embed] });
                    break;
                }

                case 'next': {
                    await interaction.deferReply({ ephemeral: true });
                    const today = new Date();
                    const currentMonth = today.getMonth() + 1;
                    const currentDay = today.getDate();

                    const entries = await db.query.birthdayEntry.findMany({
                        where: eq(birthdayEntry.guildId, guildId),
                    });

                    if (entries.length === 0) {
                        await interaction.editReply({ content: '❌ No birthdays have been set in this server yet.' });
                        return;
                    }

                    // Find next birthday
                    const sortedEntries = entries.map(entry => {
                        const entryMonth = entry.month;
                        const entryDay = entry.day;
                        
                        let daysUntil;
                        if (entryMonth > currentMonth || (entryMonth === currentMonth && entryDay >= currentDay)) {
                            const nextBirthday = new Date(today.getFullYear(), entryMonth - 1, entryDay);
                            daysUntil = Math.ceil((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        } else {
                            const nextBirthday = new Date(today.getFullYear() + 1, entryMonth - 1, entryDay);
                            daysUntil = Math.ceil((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        }
                        
                        return { ...entry, daysUntil };
                    }).sort((a, b) => a.daysUntil - b.daysUntil);

                    const nextEntry = sortedEntries[0];
                    const user = await interaction.client.users.fetch(nextEntry.userId).catch((error) => { logger.warn(`Failed to fetch user ${nextEntry.userId} for next birthday:`, error); return null; });

                    let description;
                    if (nextEntry.daysUntil === 0) {
                        description = '🎉 **It\'s their birthday today!**';
                    } else if (nextEntry.daysUntil === 1) {
                        description = '🎈 Their birthday is **tomorrow**!';
                    } else {
                        description = `🎂 Their birthday is in **${nextEntry.daysUntil}** days.`;
                    }

                    const embed = new EmbedBuilder()
                        .setTitle(`🎂 Next Birthday`)
                        .setColor('#FF69B4')
                        .setThumbnail(user?.displayAvatarURL() || null)
                        .addFields(
                            { name: 'User', value: user?.tag || nextEntry.userId, inline: true },
                            { name: 'Birthday', value: `${MONTHS[nextEntry.month - 1]} ${nextEntry.day}`, inline: true },
                        )
                        .setDescription(description);

                    await interaction.editReply({ embeds: [embed] });
                    break;
                }

                case 'admin-set': {
                    await interaction.deferReply({ ephemeral: true });

                    const targetUser = interaction.options.getUser('user', true);
                    const day = interaction.options.getInteger('day', true);
                    const month = interaction.options.getInteger('month', true);
                    const year = interaction.options.getInteger('year');

                    if (!isValidDate(day, month)) {
                        await interaction.editReply({ content: `❌ Invalid date: ${MONTHS[month - 1]} only has ${new Date(2000, month, 0).getDate()} days.` });
                        return;
                    }

                    await db.insert(birthdayEntry).values({
                        guildId,
                        userId: targetUser.id,
                        month,
                        day,
                        year: year || null,
                        timezone: 'UTC',
                    }).onConflictDoUpdate({
                        target: [birthdayEntry.guildId, birthdayEntry.userId],
                        set: {
                            month,
                            day,
                            year: year || null,
                            updatedAt: new Date(),
                        },
                    });

                    await interaction.editReply({
                        content: `✅ Set **${targetUser.tag}**'s birthday to **${MONTHS[month - 1]} ${day}**${year ? `, ${year}` : ''}.`
                    });
                    logger.info(`${interaction.user.tag} set ${targetUser.tag}'s birthday to ${month}/${day} in ${interaction.guild.name}`);
                    break;
                }

                case 'admin-remove': {
                    await interaction.deferReply({ ephemeral: true });

                    const targetUser = interaction.options.getUser('user', true);

                    await db.delete(birthdayEntry).where(
                        and(
                            eq(birthdayEntry.guildId, guildId),
                            eq(birthdayEntry.userId, targetUser.id)
                        )
                    );

                    await interaction.editReply({ content: `✅ Removed **${targetUser.tag}**'s birthday.` });
                    logger.info(`${interaction.user.tag} removed ${targetUser.tag}'s birthday from ${interaction.guild.name}`);
                    break;
                }

                case 'test': {
                    await interaction.deferReply({ ephemeral: true });

                    const config = await db.query.birthdayConfig.findFirst({
                        where: eq(birthdayConfig.guildId, guildId)
                    });

                    if (!config?.enabled) {
                        await interaction.editReply({ content: '❌ Birthday module is not enabled. Enable it in the dashboard first.' });
                        return;
                    }

                    if (!config.channelId) {
                        await interaction.editReply({ content: '❌ Birthday channel is not configured.' });
                        return;
                    }

                    const channel = interaction.guild.channels.cache.get(config.channelId);
                    if (!channel?.isTextBased()) {
                        await interaction.editReply({ content: '❌ Birthday channel is not found or not a text channel.' });
                        return;
                    }

                    // Send test message
                    const testMessage = config.messageTemplate
                        .replace(/{user\.mention}/g, interaction.user.toString())
                        .replace(/{user\.username}/g, interaction.user.username)
                        .replace(/{user\.displayname}/g, interaction.user.displayName)
                        .replace(/{age}/g, '25')
                        .replace(/{server\.name}/g, interaction.guild.name);

                    // Handle role mention for test
                    let testContent = testMessage;
                    const allowedMentions: { parse: ('everyone' | 'roles' | 'users')[], roles?: string[] } = { parse: [] };
                    
                    if (config.mentionRoleId) {
                        if (config.mentionRoleId === 'everyone') {
                            testContent = `@everyone ${testMessage}`;
                            allowedMentions.parse = ['everyone'];
                        } else if (config.mentionRoleId === 'here') {
                            testContent = `@here ${testMessage}`;
                            allowedMentions.parse = ['everyone'];
                        } else {
                            testContent = `<@&${config.mentionRoleId}> ${testMessage}`;
                            allowedMentions.parse = ['roles'];
                            allowedMentions.roles = [config.mentionRoleId];
                        }
                    }

                    await channel.send({
                        content: testContent,
                        allowedMentions
                    });

                    await interaction.editReply({ content: `✅ Test birthday message sent to <#${config.channelId}>.` });
                    break;
                }

                case 'stats': {
                    await interaction.deferReply({ ephemeral: true });
                    const entries = await db.query.birthdayEntry.findMany({
                        where: eq(birthdayEntry.guildId, guildId),
                    });

                    const config = await db.query.birthdayConfig.findFirst({
                        where: eq(birthdayConfig.guildId, guildId)
                    });

                    // Count by month
                    const monthCounts = new Array(12).fill(0);
                    entries.forEach(e => monthCounts[e.month - 1]++);

                    const mostCommonMonth = monthCounts.indexOf(Math.max(...monthCounts)) + 1;

                    const embed = new EmbedBuilder()
                        .setTitle(`🎂 Birthday Statistics`)
                        .setColor('#FF69B4')
                        .addFields(
                            { name: 'Total Birthdays', value: entries.length.toString(), inline: true },
                            { name: 'Module Status', value: config?.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                            { name: 'Most Common Month', value: entries.length > 0 ? MONTHS[mostCommonMonth - 1] : 'N/A', inline: true },
                        );

                    if (entries.length > 0) {
                        const ageEntries = entries.filter(e => e.year !== null);
                        if (ageEntries.length > 0) {
                            const avgAge = Math.round(ageEntries.reduce((sum, e) => sum + (new Date().getFullYear() - (e.year || 0)), 0) / ageEntries.length);
                            embed.addFields({ name: 'Average Age', value: `${avgAge} years`, inline: true });
                        }

                        // Show monthly distribution
                        const monthDistribution = monthCounts
                            .map((count, idx) => ({ month: MONTHS[idx], count }))
                            .filter(m => m.count > 0)
                            .sort((a, b) => b.count - a.count)
                            .slice(0, 5)
                            .map(m => `${m.month}: ${m.count}`)
                            .join('\n');

                        if (monthDistribution) {
                            embed.addFields({ name: 'Top Months', value: monthDistribution, inline: false });
                        }
                    }

                    await interaction.editReply({ embeds: [embed] });
                    break;
                }

                default:
                    await interaction.reply({ content: '❌ Unknown subcommand.', ephemeral: true });
            }
        } catch (error) {
            logger.error('Error in birthday command:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ content: '❌ An error occurred while processing your request.' });
            } else {
                await interaction.reply({ content: '❌ An error occurred while processing your request.', ephemeral: true });
            }
        }
    },
    policy: {
        subcommandMemberPermissions: {
            'admin-set': [PermissionFlagsBits.ModerateMembers],
            'admin-remove': [PermissionFlagsBits.ModerateMembers],
            test: [PermissionFlagsBits.ManageGuild],
        },
    },
};

export default command;
