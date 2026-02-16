import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command } from '../types/Command';
import { db } from '../../shared/database/client';
import { welcomeTrigger, messageTemplate } from '../../shared/database/schema';
import { eq, and } from 'drizzle-orm';
import logger from '../utils/logger';

export const welcome: Command = {
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Welcome system commands')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('test')
                .setDescription('Test a welcome message trigger')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role trigger to test')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'test') {
            const role = interaction.options.getRole('role', true);
            const guildId = interaction.guildId!;

            // Defer reply for database operations
            await interaction.deferReply({ ephemeral: true });

            try {
                // Find trigger for this role
                const triggers = await db.select({
                    trigger: welcomeTrigger,
                    template: messageTemplate
                })
                    .from(welcomeTrigger)
                    .innerJoin(messageTemplate, eq(welcomeTrigger.templateId, messageTemplate.id))
                    .where(and(
                        eq(welcomeTrigger.guildId, guildId),
                        eq(welcomeTrigger.roleId, role.id)
                    ));

                if (triggers.length === 0) {
                    return interaction.editReply({
                        content: `No welcome trigger found for role **${role.name}**. Create one in the dashboard first!`
                    });
                }

                const { trigger, template } = triggers[0];
                const member = interaction.member as any;

                // Build preview message
                const placeholders: Record<string, string> = {
                    '{user}': member.toString(),
                    '{username}': interaction.user.username,
                    '{server}': interaction.guild!.name,
                    '{memberCount}': interaction.guild!.memberCount.toString(),
                    '{role}': role.name,
                    '{date}': new Date().toLocaleDateString(),
                    '{time}': new Date().toLocaleTimeString(),
                };

                let content = template.content;
                for (const [key, value] of Object.entries(placeholders)) {
                    content = content.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
                }

                const embed = new EmbedBuilder()
                    .setTitle('📧 Welcome Message Preview')
                    .setDescription(`**Template:** ${template.name}\n**Target:** ${trigger.channelId ? `<#${trigger.channelId}>` : 'DM'}\n**Status:** ${trigger.enabled ? '✅ Enabled' : '❌ Disabled'}`)
                    .addFields({ name: 'Message Content', value: content.substring(0, 1024) })
                    .setColor('#5865F2');

                if (template.embedEnabled) {
                    embed.addFields({
                        name: 'Embed Preview',
                        value: `Title: ${template.embedTitle || 'None'}\nDescription: ${(template.embedDescription || 'None').substring(0, 100)}...`
                    });
                }

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                logger.error('Error testing welcome:', error);
                await interaction.editReply({ content: 'An error occurred while testing.' });
            }
        }
        return;
    }
};
