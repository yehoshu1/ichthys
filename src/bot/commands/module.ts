import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types/Command';
import { MODULE_MANIFESTS, MODULE_MANIFEST_MAP, type ModuleId } from '@shared/modules/registry';
import { getGuildModuleStates } from '@shared/modules/state';
import { setGuildModuleStateWithAudit } from '@shared/modules/admin';
import logger from '../utils/logger';

const MODULE_TOGGLE_CHOICES = MODULE_MANIFESTS
    .filter((manifest) => manifest.id !== 'core')
    .map((manifest) => ({
        name: manifest.name,
        value: manifest.id,
    }));

const data = new SlashCommandBuilder()
    .setName('module')
    .setDescription('Manage module enable/disable states for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
        subcommand
            .setName('list')
            .setDescription('List all module states')
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName('enable')
            .setDescription('Enable a module')
            .addStringOption((option) =>
                option
                    .setName('module')
                    .setDescription('Module to enable')
                    .setRequired(true)
                    .addChoices(...MODULE_TOGGLE_CHOICES)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName('disable')
            .setDescription('Disable a module')
            .addStringOption((option) =>
                option
                    .setName('module')
                    .setDescription('Module to disable')
                    .setRequired(true)
                    .addChoices(...MODULE_TOGGLE_CHOICES)
            )
    );

function buildModuleListEmbed(states: Awaited<ReturnType<typeof getGuildModuleStates>>): EmbedBuilder {
    const lines = states
        .slice()
        .sort((a, b) => a.moduleId.localeCompare(b.moduleId))
        .map((state) => {
            const manifest = MODULE_MANIFEST_MAP.get(state.moduleId);
            const displayName = manifest?.name ?? state.moduleId;
            const status = state.enabled ? 'Enabled' : 'Disabled';
            return `${state.enabled ? '✅' : '❌'} **${displayName}** (\`${state.moduleId}\`) - ${status} [${state.source}]`;
        });

    return new EmbedBuilder()
        .setTitle('Module States')
        .setColor('#2B8A3E')
        .setDescription(lines.join('\n'))
        .setTimestamp(new Date());
}

async function execute(interaction: Parameters<Command['execute']>[0]): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
        if (subcommand === 'list') {
            const states = await getGuildModuleStates(guildId);
            await interaction.reply({
                embeds: [buildModuleListEmbed(states)],
                ephemeral: true,
            });
            return;
        }

        const moduleId = interaction.options.getString('module', true) as ModuleId;
        const enabled = subcommand === 'enable';
        const updated = await setGuildModuleStateWithAudit({
            guildId,
            moduleId,
            enabled,
            actorUserId: interaction.user.id,
            source: 'bot_command',
        });

        const moduleName = MODULE_MANIFEST_MAP.get(moduleId)?.name ?? moduleId;
        await interaction.reply({
            content: `${updated.enabled ? '✅' : '❌'} ${moduleName} module has been ${updated.enabled ? 'enabled' : 'disabled'}.`,
            ephemeral: true,
        });
    } catch (error) {
        logger.error('Failed to update module state via /module command:', error);
        await interaction.reply({
            content: 'Failed to update module state.',
            ephemeral: true,
        }).catch(() => undefined);
    }
}

export default {
    data,
    execute,
    moduleId: 'core',
} as Command;
