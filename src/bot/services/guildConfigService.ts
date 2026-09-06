import { eq } from 'drizzle-orm';
import { db } from '../../shared/database/client';
import { guildConfig, type GuildConfig } from '../../shared/database/schema';

/**
 * Service for managing guild configurations
 */
export class GuildConfigService {
    /**
     * Get guild configuration, creating it if it doesn't exist
     */
    async getGuildConfig(guildId: string): Promise<GuildConfig> {
        const [config] = await db
            .select()
            .from(guildConfig)
            .where(eq(guildConfig.guildId, guildId))
            .limit(1);

        if (!config) {
            return await this.createGuildConfig(guildId);
        }

        return config;
    }

    /**
     * Create a new guild configuration with default settings
     */
    async createGuildConfig(guildId: string): Promise<GuildConfig> {
        const [config] = await db
            .insert(guildConfig)
            .values({
                guildId,
            })
            .returning();

        return config;
    }

    /**
     * Update guild configuration
     */
    async updateGuildConfig(
        guildId: string,
        data: Partial<Omit<GuildConfig, 'id' | 'guildId' | 'createdAt' | 'updatedAt'>>
    ): Promise<GuildConfig> {
        const [updated] = await db
            .update(guildConfig)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(guildConfig.guildId, guildId))
            .returning();

        return updated;
    }

    /**
     * Delete guild configuration (when bot leaves server)
     */
    async deleteGuildConfig(guildId: string): Promise<void> {
        await db.delete(guildConfig).where(eq(guildConfig.guildId, guildId));
    }

    /**
     * Check if guild has any feature enabled
     */
    async isAnyFeatureEnabled(guildId: string): Promise<boolean> {
        const config = await this.getGuildConfig(guildId);
        return (
            config.welcomeEnabled ||
            config.verificationEnabled ||
            config.boostEnabled ||
            config.levelingEnabled
        );
    }
}

export const guildConfigService = new GuildConfigService();
