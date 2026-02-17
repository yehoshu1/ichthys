import type {
    ButtonInteraction,
    ModalSubmitInteraction,
    StringSelectMenuInteraction,
    RoleSelectMenuInteraction,
    ChannelSelectMenuInteraction,
} from 'discord.js';
import type { ModuleId } from '@shared/modules/registry';
import { isModuleEnabled } from '@shared/modules/state';
import logger from '../utils/logger';

type ComponentKind = 'button' | 'string_select' | 'role_select' | 'channel_select' | 'modal';

type HandlerInteraction = ButtonInteraction | StringSelectMenuInteraction | RoleSelectMenuInteraction | ChannelSelectMenuInteraction | ModalSubmitInteraction;
type ComponentHandler = (interaction: any) => Promise<void>;

interface ComponentRoute {
    prefix: string;
    handler: ComponentHandler;
    moduleId?: ModuleId;
}

async function sendModuleDisabledReply(interaction: HandlerInteraction, moduleId: ModuleId): Promise<void> {
    const message = `The **${moduleId.replace(/_/g, ' ')}** module is disabled in this server.`;

    if ('deferred' in interaction && interaction.deferred) {
        await interaction.editReply({ content: message, components: [], embeds: [] }).catch(() => undefined);
        return;
    }

    if ('replied' in interaction && interaction.replied) {
        await interaction.followUp({ content: message, ephemeral: true }).catch(() => undefined);
        return;
    }

    if ('reply' in interaction) {
        await interaction.reply({ content: message, ephemeral: true }).catch(() => undefined);
    }
}

export class ComponentRouter {
    private readonly routes: Record<ComponentKind, ComponentRoute[]> = {
        button: [],
        string_select: [],
        role_select: [],
        channel_select: [],
        modal: [],
    };

    register(
        kind: ComponentKind,
        prefix: string,
        handler: ComponentHandler,
        options?: { moduleId?: ModuleId }
    ): void {
        this.routes[kind].push({
            prefix,
            handler,
            moduleId: options?.moduleId,
        });
    }

    async dispatchButton(interaction: ButtonInteraction): Promise<boolean> {
        return this.dispatch('button', interaction);
    }

    async dispatchStringSelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
        return this.dispatch('string_select', interaction);
    }

    async dispatchRoleSelect(interaction: RoleSelectMenuInteraction): Promise<boolean> {
        return this.dispatch('role_select', interaction);
    }

    async dispatchChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<boolean> {
        return this.dispatch('channel_select', interaction);
    }

    async dispatchModal(interaction: ModalSubmitInteraction): Promise<boolean> {
        return this.dispatch('modal', interaction);
    }

    private async dispatch(kind: ComponentKind, interaction: HandlerInteraction): Promise<boolean> {
        const customId = interaction.customId;
        const route = this.routes[kind].find((candidate) => customId.startsWith(candidate.prefix));
        if (!route) return false;

        if (route.moduleId && interaction.guildId) {
            const enabled = await isModuleEnabled(interaction.guildId, route.moduleId);
            if (!enabled) {
                await sendModuleDisabledReply(interaction, route.moduleId);
                return true;
            }
        }

        try {
            await route.handler(interaction);
            return true;
        } catch (error) {
            logger.error(`Error handling component ${kind}:${customId}:`, error);

            if ('reply' in interaction && !interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'An error occurred while handling this action.', ephemeral: true }).catch(() => undefined);
            } else if ('followUp' in interaction) {
                await interaction.followUp({ content: 'An error occurred while handling this action.', ephemeral: true }).catch(() => undefined);
            }

            return true;
        }
    }
}
