import { and, eq } from 'drizzle-orm';
import { db } from '@shared/database/client';
import { guildConfig, moduleState } from '@shared/database/schema';
import {
    MODULE_IDS,
    MODULE_MANIFEST_MAP,
    ModuleId,
    type LegacyGuildFeatureFlag,
} from './registry';

export interface ResolvedModuleState {
    moduleId: ModuleId;
    enabled: boolean;
    source: 'module_state' | 'legacy_guild_config' | 'default';
    updatedAt: Date | null;
}

function resolveLegacyValue(
    moduleId: ModuleId,
    config: typeof guildConfig.$inferSelect | null
): boolean | null {
    if (!config) return null;

    const manifest = MODULE_MANIFEST_MAP.get(moduleId);
    const featureFlag = manifest?.legacyGuildFeatureFlag as LegacyGuildFeatureFlag | undefined;
    if (!featureFlag) return null;

    switch (featureFlag) {
        case 'welcomeEnabled':
            return config.welcomeEnabled;
        case 'verificationEnabled':
            return config.verificationEnabled;
        case 'boostEnabled':
            return config.boostEnabled;
        case 'levelingEnabled':
            return config.levelingEnabled;
        default:
            return null;
    }
}

export async function getGuildModuleStates(guildId: string): Promise<ResolvedModuleState[]> {
    const [rows, config] = await Promise.all([
        db.select().from(moduleState).where(eq(moduleState.guildId, guildId)),
        db.query.guildConfig.findFirst({ where: eq(guildConfig.guildId, guildId) }),
    ]);

    const rowsByModule = new Map<ModuleId, typeof moduleState.$inferSelect>();
    for (const row of rows) {
        rowsByModule.set(row.moduleId as ModuleId, row);
    }

    return MODULE_IDS.map((moduleId) => {
        const explicit = rowsByModule.get(moduleId);
        if (explicit) {
            return {
                moduleId,
                enabled: explicit.enabled,
                source: 'module_state' as const,
                updatedAt: explicit.updatedAt,
            };
        }

        const legacyValue = resolveLegacyValue(moduleId, config ?? null);
        if (legacyValue !== null) {
            return {
                moduleId,
                enabled: legacyValue,
                source: 'legacy_guild_config' as const,
                updatedAt: config?.updatedAt ?? null,
            };
        }

        return {
            moduleId,
            enabled: true,
            source: 'default' as const,
            updatedAt: null,
        };
    });
}

export async function isModuleEnabled(guildId: string, moduleId: ModuleId): Promise<boolean> {
    const [explicit] = await db
        .select()
        .from(moduleState)
        .where(and(eq(moduleState.guildId, guildId), eq(moduleState.moduleId, moduleId)))
        .limit(1);

    if (explicit) {
        return explicit.enabled;
    }

    const config = await db.query.guildConfig.findFirst({
        where: eq(guildConfig.guildId, guildId),
    });

    const legacyValue = resolveLegacyValue(moduleId, config ?? null);
    if (legacyValue !== null) {
        return legacyValue;
    }

    return true;
}

export async function setModuleEnabled(
    guildId: string,
    moduleId: ModuleId,
    enabled: boolean,
    updatedBy?: string | null
): Promise<ResolvedModuleState> {
    if (moduleId === 'core' && !enabled) {
        throw new Error('The core module cannot be disabled.');
    }

    const [updated] = await db
        .insert(moduleState)
        .values({
            guildId,
            moduleId,
            enabled,
            updatedBy: updatedBy ?? null,
        })
        .onConflictDoUpdate({
            target: [moduleState.guildId, moduleState.moduleId],
            set: {
                enabled,
                updatedBy: updatedBy ?? null,
                updatedAt: new Date(),
            },
        })
        .returning();

    return {
        moduleId,
        enabled: updated.enabled,
        source: 'module_state',
        updatedAt: updated.updatedAt,
    };
}
