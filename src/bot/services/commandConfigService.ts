import { eq } from 'drizzle-orm';
import client from '../client';
import logger from '../utils/logger';
import { db } from '../../shared/database/client';
import { commandConfig, type CommandConfig } from '../../shared/database/schema';
import { parseCsvList } from '../../shared/command-config';


const CONFIG_CACHE_TTL_MS = 15_000;

function getPositiveIntEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const MAX_GUILD_CACHE_ENTRIES = getPositiveIntEnv('MAX_COMMAND_CONFIG_GUILD_CACHE_ENTRIES', 500);

export interface ResolvedCommandConfig extends Omit<CommandConfig, 'enabledRoles' | 'disabledRoles' | 'enabledChannels' | 'disabledChannels' | 'rolesCanSkipMaxLimit'> {
    enabledRoles: string[];
    disabledRoles: string[];
    enabledChannels: string[];
    disabledChannels: string[];
    rolesCanSkipMaxLimit: string[];
}

export interface CommandExecutionCheckResult {
    allowed: boolean;
    reason?: 'base' | 'channel' | 'role';
    config: ResolvedCommandConfig | null;
}

export interface CommandLimitCheckResult {
    allowed: boolean;
    maxLimit: number | null;
    exceededBy?: number;
}

interface GuildConfigCacheEntry {
    configs: ResolvedCommandConfig[];
    expiresAt: number;
}

export class CommandConfigService {
    private readonly guildCache = new Map<string, GuildConfigCacheEntry>();

    private pruneGuildCache(now: number): void {
        for (const [key, value] of this.guildCache.entries()) {
            if (value.expiresAt <= now) {
                this.guildCache.delete(key);
            }
        }

        if (this.guildCache.size <= MAX_GUILD_CACHE_ENTRIES) {
            return;
        }

        const entries = Array.from(this.guildCache.entries()).sort((a, b) => a[1].expiresAt - b[1].expiresAt);
        const overflow = this.guildCache.size - MAX_GUILD_CACHE_ENTRIES;
        for (let i = 0; i < overflow; i += 1) {
            const [key] = entries[i] ?? [];
            if (key) {
                this.guildCache.delete(key);
            }
        }
    }

    private toResolvedConfig(row: CommandConfig): ResolvedCommandConfig {
        return {
            ...row,
            enabledRoles: parseCsvList(row.enabledRoles),
            disabledRoles: parseCsvList(row.disabledRoles),
            enabledChannels: parseCsvList(row.enabledChannels),
            disabledChannels: parseCsvList(row.disabledChannels),
            rolesCanSkipMaxLimit: parseCsvList(row.rolesCanSkipMaxLimit),
        };
    }

    private async getGuildConfigsCached(guildId: string): Promise<ResolvedCommandConfig[]> {
        const now = Date.now();
        this.pruneGuildCache(now);
        const cached = this.guildCache.get(guildId);
        if (cached && cached.expiresAt > now) {
            return cached.configs;
        }

        const rows = await db
            .select()
            .from(commandConfig)
            .where(eq(commandConfig.guildId, guildId));

        const configs = rows.map((row) => this.toResolvedConfig(row));
        this.guildCache.set(guildId, {
            configs,
            expiresAt: now + CONFIG_CACHE_TTL_MS,
        });
        return configs;
    }

    async getGuildCommandConfigs(guildId: string): Promise<ResolvedCommandConfig[]> {
        return this.getGuildConfigsCached(guildId);
    }

    async getCommandConfig(guildId: string, commandId: string): Promise<ResolvedCommandConfig | null> {
        const configs = await this.getGuildConfigsCached(guildId);
        return configs.find((config) => config.commandId === commandId) ?? null;
    }



    private async isBaseAllowed(commandId: string, guildId: string, userId: string): Promise<boolean> {
        try {
            const command = client.commands?.get(commandId);
            if (!command) {
                return false;
            }

            const commandData = command.data as { toJSON?: () => { default_member_permissions?: string | null } };
            const commandJson = typeof commandData.toJSON === 'function'
                ? commandData.toJSON()
                : { default_member_permissions: null };
            const requiredPermissionsRaw = commandJson.default_member_permissions;
            if (!requiredPermissionsRaw) {
                return true;
            }

            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
                return true;
            }

            const member = guild.members.cache.get(userId) ?? await guild.members.fetch(userId).catch((error) => { logger.warn(`Failed to fetch member ${userId} for command permission check:`, error); return null; });
            if (!member) {
                return true;
            }

            const requiredPermissions = BigInt(requiredPermissionsRaw);
            return member.permissions.has(requiredPermissions);
        } catch (error) {
            logger.warn(`Failed to evaluate base permissions for ${commandId} in guild ${guildId}:`, error);
            return true;
        }
    }

    private isChannelAllowed(config: ResolvedCommandConfig, channelId: string): boolean {
        const enabledAllows = config.enabledChannels.length === 0 || config.enabledChannels.includes(channelId);
        const isDenied = config.disabledChannels.includes(channelId);
        return enabledAllows && !isDenied;
    }

    private isRoleAllowed(config: ResolvedCommandConfig, userRoleIds: string[]): boolean {
        const enabledAllows = config.enabledRoles.length === 0
            || userRoleIds.some((roleId) => config.enabledRoles.includes(roleId));
        const hasDeniedRole = userRoleIds.some((roleId) => config.disabledRoles.includes(roleId));
        return enabledAllows && !hasDeniedRole;
    }

    async evaluateCommandExecution(
        commandId: string,
        guildId: string,
        channelId: string,
        userId: string,
        userRoleIds: string[]
    ): Promise<CommandExecutionCheckResult> {
        const baseAllowed = await this.isBaseAllowed(commandId, guildId, userId);
        if (!baseAllowed) {
            return { allowed: false, reason: 'base', config: null };
        }

        const config = await this.getCommandConfig(guildId, commandId);
        if (!config) {
            return { allowed: true, config: null };
        }

        const channelAllowed = this.isChannelAllowed(config, channelId);
        if (!channelAllowed) {
            return { allowed: false, reason: 'channel', config };
        }

        const roleAllowed = this.isRoleAllowed(config, userRoleIds);
        if (!roleAllowed) {
            return { allowed: false, reason: 'role', config };
        }

        return { allowed: true, config };
    }

    async canExecuteCommand(
        commandId: string,
        guildId: string,
        channelId: string,
        userId: string,
        userRoleIds: string[]
    ): Promise<boolean> {
        const result = await this.evaluateCommandExecution(commandId, guildId, channelId, userId, userRoleIds);
        return result.allowed;
    }

    async checkCommandLimit(
        commandId: string,
        guildId: string,
        requestedAmount: number | null,
        userRoleIds: string[]
    ): Promise<CommandLimitCheckResult> {
        if (requestedAmount === null) {
            return { allowed: true, maxLimit: null };
        }

        const config = await this.getCommandConfig(guildId, commandId);
        if (!config || config.maxLimit === null) {
            return { allowed: true, maxLimit: null };
        }

        if (requestedAmount <= config.maxLimit) {
            return { allowed: true, maxLimit: config.maxLimit };
        }

        const canSkip = userRoleIds.some((roleId) => config.rolesCanSkipMaxLimit.includes(roleId));
        if (canSkip) {
            return { allowed: true, maxLimit: config.maxLimit };
        }

        return {
            allowed: false,
            maxLimit: config.maxLimit,
            exceededBy: requestedAmount - config.maxLimit,
        };
    }

    invalidateGuildCache(guildId: string): void {
        this.guildCache.delete(guildId);
    }
}

export const commandConfigService = new CommandConfigService();
