import { db } from '@shared/database/client';
import { actionLog } from '@shared/database/schema';
import { MODULE_MANIFEST_MAP, type ModuleId } from './registry';
import { setModuleEnabled, type ResolvedModuleState } from './state';

export type ModuleToggleSource = 'dashboard_api' | 'bot_command';

export interface SetGuildModuleStateWithAuditInput {
    guildId: string;
    moduleId: ModuleId;
    enabled: boolean;
    actorUserId: string;
    source: ModuleToggleSource;
}

function assertModuleCanBeDisabled(moduleId: ModuleId, enabled: boolean): void {
    if (moduleId === 'core' && !enabled) {
        throw new Error('The core module cannot be disabled.');
    }
}

function resolveActionType(enabled: boolean): string {
    return enabled ? 'MODULE_ENABLED' : 'MODULE_DISABLED';
}

export async function setGuildModuleStateWithAudit(
    input: SetGuildModuleStateWithAuditInput
): Promise<ResolvedModuleState> {
    assertModuleCanBeDisabled(input.moduleId, input.enabled);

    const state = await setModuleEnabled(
        input.guildId,
        input.moduleId,
        input.enabled,
        input.actorUserId
    );

    const moduleName = MODULE_MANIFEST_MAP.get(input.moduleId)?.name ?? input.moduleId;

    await db.insert(actionLog).values({
        guildId: input.guildId,
        actionType: resolveActionType(input.enabled),
        targetUserId: input.actorUserId,
        success: true,
        metadata: {
            moduleId: input.moduleId,
            moduleName,
            enabled: input.enabled,
            source: input.source,
        },
    });

    return state;
}
