import type { ButtonInteraction } from 'discord.js';
import { ComponentRouter } from '../component-router';
import { guildConfigService } from '../../services/guildConfigService';
import { buildSetupPanel } from '../../utils/setupPanel';
import logger from '../../utils/logger';

export function registerSetupComponentHandlers(router: ComponentRouter) {
    // Toggle buttons
    router.register('button', 'setup:toggle:', handleSetupToggle);
    
    // Page navigation
    router.register('button', 'setup:page:', handleSetupPageChange);
    
    // Role selects
    router.register('role_select', 'setup:role:', handleSetupRoleSelect);
    
    // Channel selects
    router.register('channel_select', 'setup:channel:', handleSetupChannelSelect);
    
    // Clear optional fields
    router.register('button', 'setup:clear:optional', handleClearOptionalFields);
}

async function handleSetupToggle(interaction: ButtonInteraction) {
    if (!interaction.guild) return;
    
    await interaction.deferUpdate();
    
    try {
        // Parse feature from customId: setup:toggle:welcome
        const parts = interaction.customId.split(':');
        const feature = parts[2]; // welcome, verification, boost, leveling, levelup
        const config = await guildConfigService.getGuildConfig(interaction.guild.id);
        
        // Toggle the feature
        const updates: Record<string, boolean> = {};
        
        switch (feature) {
            case 'welcome':
                updates.welcomeEnabled = !config.welcomeEnabled;
                break;
            case 'verification':
                updates.verificationEnabled = !config.verificationEnabled;
                break;
            case 'boost':
                updates.boostEnabled = !config.boostEnabled;
                break;
            case 'leveling':
                updates.levelingEnabled = !config.levelingEnabled;
                break;
            case 'levelup':
                updates.levelUpNotifEnabled = !config.levelUpNotifEnabled;
                break;
            default:
                logger.warn(`Unknown setup toggle feature: ${feature}`);
                return;
        }
        
        await guildConfigService.updateGuildConfig(interaction.guild.id, updates);
        
        // Fetch updated config and rebuild panel
        const updatedConfig = await guildConfigService.getGuildConfig(interaction.guild.id);
        const panel = buildSetupPanel(interaction.guild, updatedConfig, 'toggles');
        
        await interaction.editReply(panel);
    } catch (error) {
        logger.error('Error handling setup toggle:', error);
        await interaction.followUp({
            content: 'An error occurred while updating settings.',
            ephemeral: true
        });
    }
}

async function handleSetupPageChange(interaction: ButtonInteraction) {
    if (!interaction.guild) return;
    
    await interaction.deferUpdate();
    
    try {
        // Parse page from customId: setup:page:toggles
        const parts = interaction.customId.split(':');
        const page = parts[2] as 'toggles' | 'targets';
        const config = await guildConfigService.getGuildConfig(interaction.guild.id);
        const panel = buildSetupPanel(interaction.guild, config, page);
        
        await interaction.editReply(panel);
    } catch (error) {
        logger.error('Error handling setup page change:', error);
    }
}

async function handleSetupRoleSelect(interaction: any) {
    if (!interaction.guild) return;
    
    await interaction.deferUpdate();
    
    try {
        // Parse role type from customId: setup:role:verified
        const parts = interaction.customId.split(':');
        const roleType = parts[2]; // verified, unverified, boost
        const roleId = interaction.values[0];
        
        const updates: Record<string, string | null> = {};
        
        switch (roleType) {
            case 'verified':
                updates.verificationRoleId = roleId;
                break;
            case 'unverified':
                updates.unverifiedRoleId = roleId;
                break;
            case 'boost':
                updates.boostRoleId = roleId;
                break;
            default:
                logger.warn(`Unknown setup role type: ${roleType}`);
                return;
        }
        
        await guildConfigService.updateGuildConfig(interaction.guild.id, updates);
        
        // Fetch updated config and rebuild panel
        const updatedConfig = await guildConfigService.getGuildConfig(interaction.guild.id);
        const panel = buildSetupPanel(interaction.guild, updatedConfig, 'targets');
        
        await interaction.editReply(panel);
    } catch (error) {
        logger.error('Error handling setup role select:', error);
    }
}

async function handleSetupChannelSelect(interaction: any) {
    if (!interaction.guild) return;
    
    await interaction.deferUpdate();
    
    try {
        // Parse channel type from customId: setup:channel:levelup
        const parts = interaction.customId.split(':');
        const channelType = parts[2]; // levelup
        const channelId = interaction.values[0];
        
        const updates: Record<string, string | null> = {};
        
        switch (channelType) {
            case 'levelup':
                updates.levelUpChannelId = channelId;
                break;
            default:
                logger.warn(`Unknown setup channel type: ${channelType}`);
                return;
        }
        
        await guildConfigService.updateGuildConfig(interaction.guild.id, updates);
        
        // Fetch updated config and rebuild panel
        const updatedConfig = await guildConfigService.getGuildConfig(interaction.guild.id);
        const panel = buildSetupPanel(interaction.guild, updatedConfig, 'targets');
        
        await interaction.editReply(panel);
    } catch (error) {
        logger.error('Error handling setup channel select:', error);
    }
}

async function handleClearOptionalFields(interaction: ButtonInteraction) {
    if (!interaction.guild) return;
    
    await interaction.deferUpdate();
    
    try {
        // Clear optional fields
        await guildConfigService.updateGuildConfig(interaction.guild.id, {
            unverifiedRoleId: null,
            boostRoleId: null,
            levelUpChannelId: null
        });
        
        // Fetch updated config and rebuild panel
        const updatedConfig = await guildConfigService.getGuildConfig(interaction.guild.id);
        const panel = buildSetupPanel(interaction.guild, updatedConfig, 'targets');
        
        await interaction.editReply(panel);
    } catch (error) {
        logger.error('Error clearing optional fields:', error);
    }
}
