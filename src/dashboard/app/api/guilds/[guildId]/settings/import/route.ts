import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
    db,
    guildConfig,
    welcomeTrigger,
    messageTemplate,
    levelReward,
    roleAction,
    verificationMessageRule,
    verificationRoleMessage,
    moderationSettings,
    birthdayConfig,
    birthdayEntry,
    messageAlias,
    commandConfig,
    moduleState,
    eventTemplate,
    pollTemplate,
    eventPollSettings,
    dashboardRbacConfig,
    dashboardRbacRules,
} from "@/lib/db";
import { requireGuildManageStrictAccess } from "@/lib/guild-auth";
import { invalidateRbacCache } from "@/lib/rbac";
import { RBAC_MODULE_IDS } from "@/lib/rbac-modules";
import { eq } from "drizzle-orm";
import logger from "@/lib/logger";
import { emitGuildNotification } from "@shared/services/notification-service";
import {
    normalizeDiscordId,
    normalizeDiscordIdList,
    serializeDiscordIdList,
} from "@/lib/validation";

const MAX_TEMPLATES = 300;
const MAX_TRIGGERS = 600;
const MAX_REWARDS = 300;
const MAX_ACTIONS = 800;
const MAX_VERIFICATION_RULES = 400;
const MAX_VERIFICATION_ROLE_MESSAGES = 400;
const MAX_BIRTHDAY_ENTRIES = 2_500;
const MAX_ALIASES = 500;
const MAX_COMMAND_CONFIGS = 500;
const MAX_MODULE_STATES = 100;
const MAX_EVENT_TEMPLATES = 100;
const MAX_POLL_TEMPLATES = 100;
const MAX_RBAC_RULES = 200;

const importPayloadSchema = z.object({
    version: z.number().int().min(1),
    timestamp: z.string().optional(),
    guildId: z.string().optional(),
    config: z.record(z.string(), z.unknown()).nullable().optional(),
    welcomeTriggers: z.array(z.record(z.string(), z.unknown())).max(MAX_TRIGGERS).default([]),
    messageTemplates: z.array(z.record(z.string(), z.unknown())).max(MAX_TEMPLATES).default([]),
    levelRewards: z.array(z.record(z.string(), z.unknown())).max(MAX_REWARDS).default([]),
    roleActions: z.array(z.record(z.string(), z.unknown())).max(MAX_ACTIONS).default([]),
    verificationRules: z.array(z.record(z.string(), z.unknown())).max(MAX_VERIFICATION_RULES).default([]),
    verificationRoleMessages: z.array(z.record(z.string(), z.unknown())).max(MAX_VERIFICATION_ROLE_MESSAGES).default([]),
    moderationSettings: z.record(z.string(), z.unknown()).nullable().optional(),
    reactionRoleMessages: z.array(z.record(z.string(), z.unknown())).default([]),
    reactionRoles: z.array(z.record(z.string(), z.unknown())).default([]),
    birthdayConfig: z.record(z.string(), z.unknown()).nullable().optional(),
    birthdayEntries: z.array(z.record(z.string(), z.unknown())).max(MAX_BIRTHDAY_ENTRIES).default([]),
    messageAliases: z.array(z.record(z.string(), z.unknown())).max(MAX_ALIASES).default([]),
    commandConfigs: z.array(z.record(z.string(), z.unknown())).max(MAX_COMMAND_CONFIGS).default([]),
    moduleStates: z.array(z.record(z.string(), z.unknown())).max(MAX_MODULE_STATES).default([]),
    eventTemplates: z.array(z.record(z.string(), z.unknown())).max(MAX_EVENT_TEMPLATES).default([]),
    pollTemplates: z.array(z.record(z.string(), z.unknown())).max(MAX_POLL_TEMPLATES).default([]),
    eventPollSettings: z.record(z.string(), z.unknown()).nullable().optional(),
    dashboardRbacConfig: z.record(z.string(), z.unknown()).nullable().optional(),
    dashboardRbacRules: z.array(z.record(z.string(), z.unknown())).max(MAX_RBAC_RULES).default([]),
}).strict();

const ALLOWED_CONFIG_KEYS = new Set([
    "welcomeEnabled", "autoRoleId", "joinMessageChannelId", "joinMessage", "joinMessageEmbed",
    "leaveMessageChannelId", "leaveMessage", "leaveMessageEmbed",
    "verificationEnabled", "unverifiedRoleId", "verificationRoleId", "verificationGraceDays", "verificationKickDmEnabled", "verificationMessage", "verificationMessageEmbed",
    "boostEnabled", "boostAnnouncementChannelId", "boostRoleId", "boostRoleName", "boostRoleColorPrimary", "boostRoleColorSecondary", "boostClaimRequired",
    "boostWelcomeMessage", "boostWelcomeMessageEmbed", "boostReBoostMessage", "boostReBoostMessageEmbed", "boostRoleRemovalDays", "boostRoleRemovalDmEnabled",
    "levelingEnabled", "textXpMin", "textXpMax", "textXpCooldown", "voiceXpPerMinute", "levelUpNotifEnabled", "levelUpChannelId", "levelUpMessage", "levelUpMessageEmbed",
    "dashboardUrl",
]);

const ROLE_OR_CHANNEL_CONFIG_KEYS = new Set([
    "autoRoleId",
    "joinMessageChannelId",
    "leaveMessageChannelId",
    "unverifiedRoleId",
    "verificationRoleId",
    "boostAnnouncementChannelId",
    "boostRoleId",
    "levelUpChannelId",
]);

type ImportWarnings = Record<string, number>;

function addWarning(warnings: ImportWarnings, key: string, count: number = 1): void {
    if (count <= 0) return;
    warnings[key] = (warnings[key] ?? 0) + count;
}

function normalizeNullableDiscordId(
    value: unknown,
    warnings: ImportWarnings,
    warningKey: string
): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string") {
        addWarning(warnings, warningKey);
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed) return null;

    const normalized = normalizeDiscordId(trimmed);
    if (!normalized) {
        addWarning(warnings, warningKey);
        return null;
    }

    return normalized;
}

function normalizeCsvDiscordIds(
    value: unknown,
    warnings: ImportWarnings,
    warningKey: string
): string[] | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string") {
        addWarning(warnings, warningKey);
        return null;
    }

    // Transitional compatibility for pre-v3 exports (CSV string lists).
    addWarning(warnings, "legacyCsvInput.used");

    const entries = value.split(",");
    const normalized = normalizeDiscordIdList(entries);
    addWarning(warnings, warningKey, Math.max(0, entries.filter((entry) => entry.trim().length > 0).length - normalized.length));
    return serializeDiscordIdList(normalized);
}

function normalizeUnknownIdListToCsv(
    value: unknown,
    warnings: ImportWarnings,
    warningKey: string
): string[] | null {
    if (value === null || value === undefined) return null;

    if (Array.isArray(value)) {
        const normalized = normalizeDiscordIdList(value);
        addWarning(warnings, warningKey, Math.max(0, value.length - normalized.length));
        return serializeDiscordIdList(normalized);
    }

    return normalizeCsvDiscordIds(value, warnings, warningKey);
}

function toStringOrNull(value: unknown): string | null {
    return typeof value === "string" ? value : null;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === "boolean" ? value : fallback;
}

function toInteger(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function toObjectOrNull(value: unknown): Record<string, unknown> | null {
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                return parsed as Record<string, unknown>;
            }
            return null;
        } catch {
            return null;
        }
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

function sanitizeConfig(
    config: Record<string, unknown> | null | undefined,
    warnings: ImportWarnings
): Record<string, unknown> {
    if (!config) {
        return {};
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
        if (ALLOWED_CONFIG_KEYS.has(key)) {
            if (ROLE_OR_CHANNEL_CONFIG_KEYS.has(key)) {
                sanitized[key] = normalizeNullableDiscordId(value, warnings, `config.${key}.invalid`);
            } else {
                sanitized[key] = value;
            }
        }
    }
    return sanitized;
}

function sanitizeTemplates(items: Record<string, unknown>[]): Array<Record<string, unknown>> {
    return items.map((item) => ({
        id: typeof item.id === "string" ? item.id : undefined,
        guildId: undefined,
        name: typeof item.name === "string" ? item.name : "Imported Template",
        content: typeof item.content === "string" ? item.content : "",
        embedEnabled: toBoolean(item.embedEnabled, false),
        embedTitle: toStringOrNull(item.embedTitle),
        embedDescription: toStringOrNull(item.embedDescription),
        embedColor: toStringOrNull(item.embedColor),
        embedThumbnail: toBoolean(item.embedThumbnail, false),
        embedData: item.embedData ?? null,
    }));
}

function sanitizeTriggers(
    items: Record<string, unknown>[],
    validTemplateIds: Set<string>,
    warnings: ImportWarnings
): Array<Record<string, unknown>> {
    const sanitized: Array<Record<string, unknown>> = [];
    for (const item of items) {
        if (typeof item.templateId !== "string" || !validTemplateIds.has(item.templateId)) {
            addWarning(warnings, "welcomeTriggers.templateId.invalid");
            continue;
        }

        const roleId = normalizeNullableDiscordId(item.roleId, warnings, "welcomeTriggers.roleId.invalid");
        if (!roleId) {
            continue;
        }

        sanitized.push({
            id: typeof item.id === "string" ? item.id : undefined,
            guildId: undefined,
            roleId,
            channelId: normalizeNullableDiscordId(item.channelId, warnings, "welcomeTriggers.channelId.invalid"),
            templateId: item.templateId,
            enabled: toBoolean(item.enabled, true),
        });
    }
    return sanitized;
}

function sanitizeRewards(items: Record<string, unknown>[], warnings: ImportWarnings): Array<Record<string, unknown>> {
    const sanitized: Array<Record<string, unknown>> = [];
    for (const item of items) {
        const roleId = normalizeNullableDiscordId(item.roleId, warnings, "levelRewards.roleId.invalid");
        if (!roleId || !Number.isFinite(Number(item.level))) {
            if (!Number.isFinite(Number(item.level))) {
                addWarning(warnings, "levelRewards.level.invalid");
            }
            continue;
        }

        sanitized.push({
            id: typeof item.id === "string" ? item.id : undefined,
            guildId: undefined,
            roleId,
            level: toInteger(item.level, 1),
        });
    }
    return sanitized;
}

function sanitizeActions(items: Record<string, unknown>[], warnings: ImportWarnings): Array<Record<string, unknown>> {
    const sanitized: Array<Record<string, unknown>> = [];
    for (const item of items) {
        const roleId = normalizeNullableDiscordId(item.roleId, warnings, "roleActions.roleId.invalid");
        if (!roleId || typeof item.actionType !== "string") {
            if (typeof item.actionType !== "string") {
                addWarning(warnings, "roleActions.actionType.invalid");
            }
            continue;
        }

        sanitized.push({
            id: typeof item.id === "string" ? item.id : undefined,
            guildId: undefined,
            roleId,
            actionGroup: toStringOrNull(item.actionGroup),
            triggerType: item.triggerType === "REMOVE" ? "REMOVE" : "ADD",
            actionType: item.actionType,
            actionDelay: toInteger(item.actionDelay, 0),
            dmMessage: toStringOrNull(item.dmMessage),
            dmMessageEmbed: item.dmMessageEmbed ?? null,
            channelId: normalizeNullableDiscordId(item.channelId, warnings, "roleActions.channelId.invalid"),
            kickReason: toStringOrNull(item.kickReason),
            logChannelId: normalizeNullableDiscordId(item.logChannelId, warnings, "roleActions.logChannelId.invalid"),
            enabled: toBoolean(item.enabled, true),
        });
    }
    return sanitized;
}

function sanitizeVerificationRules(items: Record<string, unknown>[], warnings: ImportWarnings): Array<Record<string, unknown>> {
    const sanitized: Array<Record<string, unknown>> = [];
    for (const item of items) {
        const roleId = normalizeNullableDiscordId(item.roleId, warnings, "verificationRules.roleId.invalid");
        if (!roleId || typeof item.message !== "string") {
            if (typeof item.message !== "string") {
                addWarning(warnings, "verificationRules.message.invalid");
            }
            continue;
        }

        sanitized.push({
            id: typeof item.id === "string" ? item.id : undefined,
            guildId: undefined,
            name: toStringOrNull(item.name),
            roleId,
            notifyChannelId: normalizeNullableDiscordId(item.notifyChannelId, warnings, "verificationRules.notifyChannelId.invalid"),
            message: item.message,
            messageEmbed: item.messageEmbed ?? null,
            welcomeMessage: toStringOrNull(item.welcomeMessage),
            enabled: toBoolean(item.enabled, true),
        });
    }
    return sanitized;
}

function sanitizeVerificationRoleMessages(items: Record<string, unknown>[], warnings: ImportWarnings): Array<Record<string, unknown>> {
    const sanitized: Array<Record<string, unknown>> = [];
    for (const item of items) {
        const roleId = normalizeNullableDiscordId(item.roleId, warnings, "verificationRoleMessages.roleId.invalid");
        if (!roleId || typeof item.message !== "string") {
            if (typeof item.message !== "string") {
                addWarning(warnings, "verificationRoleMessages.message.invalid");
            }
            continue;
        }

        sanitized.push({
            id: typeof item.id === "string" ? item.id : undefined,
            guildId: undefined,
            roleId,
            notifyChannelId: normalizeNullableDiscordId(item.notifyChannelId, warnings, "verificationRoleMessages.notifyChannelId.invalid"),
            message: item.message,
            messageEmbed: item.messageEmbed ?? null,
            welcomeMessage: toStringOrNull(item.welcomeMessage),
            enabled: toBoolean(item.enabled, true),
        });
    }
    return sanitized;
}

function sanitizeModerationSettings(
    item: Record<string, unknown> | null | undefined,
    warnings: ImportWarnings
): Record<string, unknown> | null {
    if (!item) {
        return null;
    }

    return {
        autoModEnabled: toBoolean(item.autoModEnabled, false),
        spamThreshold: toInteger(item.spamThreshold, 5),
        spamAction: item.spamAction === "KICK" ? "KICK" : item.spamAction === "MUTE" ? "MUTE" : "WARN",
        spamMuteDuration: toInteger(item.spamMuteDuration, 10),
        wordFilterEnabled: toBoolean(item.wordFilterEnabled, false),
        wordFilterList: toStringOrNull(item.wordFilterList),
        wordFilterAction: item.wordFilterAction === "WARN"
            ? "WARN"
            : item.wordFilterAction === "MUTE"
                ? "MUTE"
                : item.wordFilterAction === "KICK"
                    ? "KICK"
                    : "DELETE",
        inviteFilterEnabled: toBoolean(item.inviteFilterEnabled, false),
        inviteFilterAction: item.inviteFilterAction === "WARN" ? "WARN" : "DELETE",
        logChannelId: normalizeNullableDiscordId(item.logChannelId, warnings, "moderationSettings.logChannelId.invalid"),
        muteRoleId: normalizeNullableDiscordId(item.muteRoleId, warnings, "moderationSettings.muteRoleId.invalid"),
    };
}

function sanitizeBirthdayConfig(
    item: Record<string, unknown> | null | undefined,
    warnings: ImportWarnings
): Record<string, unknown> | null {
    if (!item) {
        return null;
    }

    return {
        enabled: toBoolean(item.enabled, false),
        channelId: normalizeNullableDiscordId(item.channelId, warnings, "birthdayConfig.channelId.invalid"),
        roleId: normalizeNullableDiscordId(item.roleId, warnings, "birthdayConfig.roleId.invalid"),
        messageTemplate: typeof item.messageTemplate === "string"
            ? item.messageTemplate
            : "🎉 **Happy Birthday {user.mention}!** 🎂 They are now {age} years old!",
        messageEmbed: item.messageEmbed ?? null,
        hourOfDay: Math.max(0, Math.min(23, toInteger(item.hourOfDay, 9))),
        showAge: toBoolean(item.showAge, true),
        mentionRoleId: item.mentionRoleId === "everyone"
            || item.mentionRoleId === "here"
            ? item.mentionRoleId
            : normalizeNullableDiscordId(item.mentionRoleId, warnings, "birthdayConfig.mentionRoleId.invalid"),
        autoRemoveRole: toBoolean(item.autoRemoveRole, true),
    };
}

function sanitizeBirthdayEntries(items: Record<string, unknown>[]): Array<Record<string, unknown>> {
    return items
        .filter((item) => typeof item.userId === "string")
        .map((item) => ({
            id: typeof item.id === "string" ? item.id : undefined,
            guildId: undefined,
            userId: item.userId,
            month: Math.max(1, Math.min(12, toInteger(item.month, 1))),
            day: Math.max(1, Math.min(31, toInteger(item.day, 1))),
            year: Number.isFinite(Number(item.year)) ? Number(item.year) : null,
            timezone: typeof item.timezone === "string" ? item.timezone : "UTC",
            lastCelebratedYear: Number.isFinite(Number(item.lastCelebratedYear)) ? Number(item.lastCelebratedYear) : null,
        }));
}

function sanitizeMessageAliases(
    items: Record<string, unknown>[],
    fallbackUserId: string,
    warnings: ImportWarnings
): Array<Record<string, unknown>> {
    const sanitized: Array<Record<string, unknown>> = [];
    for (const item of items) {
        if (typeof item.trigger !== "string" || typeof item.response !== "string") {
            addWarning(warnings, "messageAliases.requiredFields.invalid");
            continue;
        }

        sanitized.push({
            id: typeof item.id === "string" ? item.id : undefined,
            guildId: undefined,
            trigger: item.trigger,
            response: item.response,
            responseEmbed: toObjectOrNull(item.responseEmbed),
            enabled: toBoolean(item.enabled, true),
            caseSensitive: toBoolean(item.caseSensitive, false),
            deleteTrigger: toBoolean(item.deleteTrigger, false),
            requirePrefix: toStringOrNull(item.requirePrefix),
            allowedChannels: normalizeUnknownIdListToCsv(item.allowedChannels, warnings, "messageAliases.allowedChannels.invalid"),
            allowedRoles: normalizeUnknownIdListToCsv(item.allowedRoles, warnings, "messageAliases.allowedRoles.invalid"),
            cooldownSeconds: Math.max(0, toInteger(item.cooldownSeconds, 5)),
            usageCount: Math.max(0, toInteger(item.usageCount, 0)),
            createdBy: typeof item.createdBy === "string" ? item.createdBy : fallbackUserId,
        });
    }
    return sanitized;
}

function sanitizeCommandConfigs(items: Record<string, unknown>[], warnings: ImportWarnings): Array<Record<string, unknown>> {
    const sanitized: Array<Record<string, unknown>> = [];
    for (const item of items) {
        if (typeof item.commandId !== "string") {
            addWarning(warnings, "commandConfigs.commandId.invalid");
            continue;
        }

        sanitized.push({
            id: typeof item.id === "string" ? item.id : undefined,
            guildId: undefined,
            commandId: item.commandId,
            enabledRoles: normalizeUnknownIdListToCsv(item.enabledRoles, warnings, "commandConfigs.enabledRoles.invalid"),
            disabledRoles: normalizeUnknownIdListToCsv(item.disabledRoles, warnings, "commandConfigs.disabledRoles.invalid"),
            enabledChannels: normalizeUnknownIdListToCsv(item.enabledChannels, warnings, "commandConfigs.enabledChannels.invalid"),
            disabledChannels: normalizeUnknownIdListToCsv(item.disabledChannels, warnings, "commandConfigs.disabledChannels.invalid"),
            rolesCanSkipMaxLimit: normalizeUnknownIdListToCsv(item.rolesCanSkipMaxLimit, warnings, "commandConfigs.rolesCanSkipMaxLimit.invalid"),
            maxLimit: Number.isFinite(Number(item.maxLimit)) ? Number(item.maxLimit) : null,
            autoDeleteInvocation: toBoolean(item.autoDeleteInvocation, false),
            autoDeleteReplyAfterSeconds: Number.isFinite(Number(item.autoDeleteReplyAfterSeconds))
                ? Number(item.autoDeleteReplyAfterSeconds)
                : null,
            autoDeleteWithInvocationDeletion: toBoolean(item.autoDeleteWithInvocationDeletion, false),
        });
    }
    return sanitized;
}

function sanitizeModuleStates(items: Record<string, unknown>[], fallbackUserId: string): Array<Record<string, unknown>> {
    const sanitized: Array<Record<string, unknown>> = [];
    for (const item of items) {
        if (typeof item.moduleId !== "string") continue;
        sanitized.push({
            id: typeof item.id === "string" ? item.id : undefined,
            guildId: undefined,
            moduleId: item.moduleId,
            enabled: toBoolean(item.enabled, true),
            updatedBy: typeof item.updatedBy === "string" ? item.updatedBy : fallbackUserId,
        });
    }
    return sanitized;
}

function sanitizeEventTemplates(items: Record<string, unknown>[], fallbackUserId: string, warnings: ImportWarnings): Array<Record<string, unknown>> {
    const sanitized: Array<Record<string, unknown>> = [];
    for (const item of items) {
        if (typeof item.name !== "string") continue;
        sanitized.push({
            id: typeof item.id === "string" ? item.id : undefined,
            guildId: undefined,
            creatorId: typeof item.creatorId === "string" ? item.creatorId : fallbackUserId,
            name: item.name,
            description: toStringOrNull(item.description),
            imageBanner: toStringOrNull(item.imageBanner),
            locationType: item.locationType === "VOICE" || item.locationType === "EXTERNAL" ? item.locationType : "TEXT",
            locationUrl: toStringOrNull(item.locationUrl),
            locationChannelId: normalizeNullableDiscordId(item.locationChannelId, warnings, "eventTemplates.locationChannelId.invalid"),
            durationMinutes: toInteger(item.durationMinutes, 60),
            allowRsvp: toBoolean(item.allowRsvp, true),
            allowWaitlist: toBoolean(item.allowWaitlist, false),
            requireApproval: toBoolean(item.requireApproval, false),
            maxAttendees: Number.isFinite(Number(item.maxAttendees)) ? Number(item.maxAttendees) : null,
            allowedRoles: normalizeUnknownIdListToCsv(item.allowedRoles, warnings, "eventTemplates.allowedRoles.invalid"),
            color: toStringOrNull(item.color),
        });
    }
    return sanitized;
}

function sanitizePollTemplates(items: Record<string, unknown>[], fallbackUserId: string): Array<Record<string, unknown>> {
    const sanitized: Array<Record<string, unknown>> = [];
    for (const item of items) {
        if (typeof item.name !== "string") continue;
        sanitized.push({
            id: typeof item.id === "string" ? item.id : undefined,
            guildId: undefined,
            creatorId: typeof item.creatorId === "string" ? item.creatorId : fallbackUserId,
            name: item.name,
            description: toStringOrNull(item.description),
            question: toStringOrNull(item.question),
            pollDescription: toStringOrNull(item.pollDescription),
            type: item.type === "TIME" || item.type === "ANONYMOUS" ? item.type : "STANDARD",
            allowMultipleVotes: toBoolean(item.allowMultipleVotes, false),
            maxVotesPerUser: Number.isFinite(Number(item.maxVotesPerUser)) ? Number(item.maxVotesPerUser) : null,
            allowCustomOptions: toBoolean(item.allowCustomOptions, false),
            defaultOptions: Array.isArray(item.defaultOptions) ? item.defaultOptions.filter(o => typeof o === "string") : null,
        });
    }
    return sanitized;
}

function sanitizeEventPollSettings(item: Record<string, unknown> | null | undefined, warnings: ImportWarnings): Record<string, unknown> | null {
    if (!item) return null;
    return {
        defaultEventChannelId: normalizeNullableDiscordId(item.defaultEventChannelId, warnings, "eventPollSettings.defaultEventChannelId.invalid"),
        defaultPollChannelId: normalizeNullableDiscordId(item.defaultPollChannelId, warnings, "eventPollSettings.defaultPollChannelId.invalid"),
        defaultMentionOnCreate: toBoolean(item.defaultMentionOnCreate, false),
        defaultMentionOnStart: toBoolean(item.defaultMentionOnStart, false),
        allowedEventCreators: Array.isArray(item.allowedEventCreators) ? normalizeDiscordIdList(item.allowedEventCreators) : null,
        allowedPollCreators: Array.isArray(item.allowedPollCreators) ? normalizeDiscordIdList(item.allowedPollCreators) : null,
        serverTimezone: typeof item.serverTimezone === "string" ? item.serverTimezone : "UTC",
        aiEnabled: toBoolean(item.aiEnabled, true),
        aiRateLimitPerHour: toInteger(item.aiRateLimitPerHour, 10),
        mirrorToDiscordEvents: toBoolean(item.mirrorToDiscordEvents, true),
    };
}

function sanitizeRbacConfig(item: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
    if (!item) return null;
    return {
        enabled: toBoolean(item.enabled, false),
        defaultAccess: item.defaultAccess === "deny" ? "deny" : "manage_guild_only",
    };
}

const RBAC_MODULE_ID_SET = new Set<string>(RBAC_MODULE_IDS);

function sanitizeRbacRules(items: Record<string, unknown>[]): Array<Record<string, unknown>> {
    const sanitized: Array<Record<string, unknown>> = [];
    for (const item of items) {
        if (typeof item.moduleId !== "string") continue;
        // Only known RBAC module IDs are accepted. Importing arbitrary strings
        // could create rules for non-module paths (e.g. "api-keys").
        if (!RBAC_MODULE_ID_SET.has(item.moduleId)) continue;
        sanitized.push({
            guildId: undefined,
            moduleId: item.moduleId,
            allowedViewRoles: Array.isArray(item.allowedViewRoles) ? normalizeDiscordIdList(item.allowedViewRoles) : [],
            allowedEditRoles: Array.isArray(item.allowedEditRoles) ? normalizeDiscordIdList(item.allowedEditRoles) : [],
        });
    }
    return sanitized;
}

export async function POST(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const { guildId } = params;

    // Strict access: settings import overwrites dashboard_rbac_config and
    // dashboard_rbac_rules, so it must NEVER be reachable through RBAC
    // delegation — otherwise a user with edit access to the settings module
    // could rewrite RBAC rules and escalate to full control (privilege
    // escalation via import). RBAC config changes require Manage Server.
    const auth = await requireGuildManageStrictAccess(guildId, req);
    if ("response" in auth) return auth.response;

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = importPayloadSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid settings file" }, { status: 400 });
    }

    try {
        const payload = parsed.data;
        const warnings: ImportWarnings = {};
        const safeConfig = sanitizeConfig(payload.config, warnings);
        const safeTemplates = sanitizeTemplates(payload.messageTemplates);
        const templateIds = new Set(safeTemplates.map((template) => template.id).filter((id): id is string => typeof id === "string"));
        const safeTriggers = sanitizeTriggers(payload.welcomeTriggers, templateIds, warnings);
        const safeRewards = sanitizeRewards(payload.levelRewards, warnings);
        const safeActions = sanitizeActions(payload.roleActions, warnings);
        const safeVerificationRules = sanitizeVerificationRules(payload.verificationRules, warnings);
        const safeVerificationRoleMessages = sanitizeVerificationRoleMessages(payload.verificationRoleMessages, warnings);
        const safeModerationSettings = sanitizeModerationSettings(payload.moderationSettings, warnings);
        addWarning(
            warnings,
            "reactionRoles.removed",
            payload.reactionRoleMessages.length + payload.reactionRoles.length > 0 ? 1 : 0
        );
        const safeBirthdayConfig = sanitizeBirthdayConfig(payload.birthdayConfig, warnings);
        const safeBirthdayEntries = sanitizeBirthdayEntries(payload.birthdayEntries);
        const safeAliases = sanitizeMessageAliases(payload.messageAliases, auth.userId, warnings);
        const safeCommandConfigs = sanitizeCommandConfigs(payload.commandConfigs, warnings);
        const safeModuleStates = sanitizeModuleStates(payload.moduleStates, auth.userId);
        const safeEventTemplates = sanitizeEventTemplates(payload.eventTemplates, auth.userId, warnings);
        const safePollTemplates = sanitizePollTemplates(payload.pollTemplates, auth.userId);
        const safeEventPollSettings = sanitizeEventPollSettings(payload.eventPollSettings, warnings);
        const safeRbacConfig = sanitizeRbacConfig(payload.dashboardRbacConfig);
        const safeRbacRules = sanitizeRbacRules(payload.dashboardRbacRules);

        await db.transaction(async (tx: any) => {
            await tx.insert(guildConfig)
                .values({ guildId, ...safeConfig })
                .onConflictDoUpdate({
                    target: guildConfig.guildId,
                    set: {
                        ...safeConfig,
                        updatedAt: new Date(),
                    },
                });

            await tx.delete(welcomeTrigger).where(eq(welcomeTrigger.guildId, guildId));
            await tx.delete(messageTemplate).where(eq(messageTemplate.guildId, guildId));
            await tx.delete(levelReward).where(eq(levelReward.guildId, guildId));
            await tx.delete(roleAction).where(eq(roleAction.guildId, guildId));
            await tx.delete(verificationMessageRule).where(eq(verificationMessageRule.guildId, guildId));
            await tx.delete(verificationRoleMessage).where(eq(verificationRoleMessage.guildId, guildId));
            await tx.delete(birthdayEntry).where(eq(birthdayEntry.guildId, guildId));
            await tx.delete(messageAlias).where(eq(messageAlias.guildId, guildId));
            await tx.delete(commandConfig).where(eq(commandConfig.guildId, guildId));
            await tx.delete(moderationSettings).where(eq(moderationSettings.guildId, guildId));
            await tx.delete(birthdayConfig).where(eq(birthdayConfig.guildId, guildId));
            await tx.delete(moduleState).where(eq(moduleState.guildId, guildId));
            await tx.delete(eventTemplate).where(eq(eventTemplate.guildId, guildId));
            await tx.delete(pollTemplate).where(eq(pollTemplate.guildId, guildId));
            await tx.delete(eventPollSettings).where(eq(eventPollSettings.guildId, guildId));
            await tx.delete(dashboardRbacConfig).where(eq(dashboardRbacConfig.guildId, guildId));
            await tx.delete(dashboardRbacRules).where(eq(dashboardRbacRules.guildId, guildId));

            if (safeTemplates.length > 0) {
                await tx.insert(messageTemplate).values(safeTemplates.map((template) => ({ ...template, guildId })));
            }

            if (safeTriggers.length > 0) {
                await tx.insert(welcomeTrigger).values(safeTriggers.map((trigger) => ({ ...trigger, guildId })));
            }

            if (safeRewards.length > 0) {
                await tx.insert(levelReward).values(safeRewards.map((reward) => ({ ...reward, guildId })));
            }

            if (safeActions.length > 0) {
                await tx.insert(roleAction).values(safeActions.map((action) => ({ ...action, guildId })));
            }

            if (safeVerificationRules.length > 0) {
                await tx.insert(verificationMessageRule).values(safeVerificationRules.map((rule) => ({ ...rule, guildId })));
            }

            if (safeVerificationRoleMessages.length > 0) {
                await tx.insert(verificationRoleMessage).values(safeVerificationRoleMessages.map((message) => ({ ...message, guildId })));
            }

            if (safeModerationSettings) {
                await tx.insert(moderationSettings).values({
                    guildId,
                    ...safeModerationSettings,
                });
            }

            if (safeBirthdayConfig) {
                await tx.insert(birthdayConfig).values({
                    guildId,
                    ...safeBirthdayConfig,
                });
            }

            if (safeBirthdayEntries.length > 0) {
                await tx.insert(birthdayEntry).values(safeBirthdayEntries.map((entry) => ({ ...entry, guildId })));
            }

            if (safeAliases.length > 0) {
                await tx.insert(messageAlias).values(safeAliases.map((alias) => ({ ...alias, guildId })));
            }

            if (safeCommandConfigs.length > 0) {
                await tx.insert(commandConfig).values(safeCommandConfigs.map((configRow) => ({ ...configRow, guildId })));
            }
            if (safeModuleStates.length > 0) {
                await tx.insert(moduleState).values(safeModuleStates.map((state) => ({ ...state, guildId })));
            }
            if (safeEventTemplates.length > 0) {
                await tx.insert(eventTemplate).values(safeEventTemplates.map((template) => ({ ...template, guildId })));
            }
            if (safePollTemplates.length > 0) {
                await tx.insert(pollTemplate).values(safePollTemplates.map((template) => ({ ...template, guildId })));
            }
            if (safeEventPollSettings) {
                await tx.insert(eventPollSettings).values({ guildId, ...safeEventPollSettings });
            }
            if (safeRbacConfig) {
                await tx.insert(dashboardRbacConfig).values({ guildId, ...safeRbacConfig });
            }
            if (safeRbacRules.length > 0) {
                await tx.insert(dashboardRbacRules).values(safeRbacRules.map((rule) => ({ ...rule, guildId })));
            }
        });

        // RBAC config/rules may have been replaced by this import — make the
        // change effective immediately instead of waiting for cache expiry.
        invalidateRbacCache(guildId);

        const warningEntries = Object.entries(warnings)
            .filter(([, count]) => count > 0)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, count]) => ({ key, count }));

        const warningCount = warningEntries.reduce((total, entry) => total + entry.count, 0);
        await emitGuildNotification({
            guildId,
            eventType: 'DASHBOARD_SETTINGS_IMPORTED',
            severity: warningCount > 0 ? 'WARNING' : 'INFO',
            source: 'DASHBOARD_API',
            title: `Settings imported${warningCount > 0 ? ` with ${warningCount} warning(s)` : ''}`,
            actorUserId: auth.userId,
            metadata: {
                warningCount,
                warnings: warningEntries,
            },
            dedupeKey: `dashboard-settings-imported:${guildId}`,
            dedupeWindowSeconds: 60,
        });

        return NextResponse.json({
            success: true,
            warnings: warningEntries,
            warningCount,
        });
    } catch (error) {
        logger.error("Error importing settings", {
            error: error instanceof Error ? error.message : String(error),
            guildId,
        });
        await emitGuildNotification({
            guildId,
            eventType: 'DASHBOARD_SETTINGS_IMPORT_FAILED',
            severity: 'ERROR',
            source: 'DASHBOARD_API',
            title: `Settings import failed`,
            body: error instanceof Error ? error.message : String(error),
            actorUserId: auth.userId,
            dedupeKey: `dashboard-settings-import-failed:${guildId}`,
            dedupeWindowSeconds: 120,
        }).catch((error) => { logger.warn(`Failed to emit guild notification for settings import failure:`, error); return null; });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
