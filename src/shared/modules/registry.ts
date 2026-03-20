export const MODULE_IDS = [
    'core',
    'welcome',
    'verification',
    'boosts',
    'leveling',
    'events',
    'polls',
    'role_actions',
    'aliases',
    'moderation',
    'birthdays',
    'webhooks',
    'notifications',
    'analytics',
    'settings_backups',
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

export type LegacyGuildFeatureFlag =
    | 'welcomeEnabled'
    | 'verificationEnabled'
    | 'boostEnabled'
    | 'levelingEnabled';

export interface ModuleManifest {
    id: ModuleId;
    name: string;
    description: string;
    commandIds: string[];
    componentPrefixes: string[];
    jobs: string[];
    routes: string[];
    tables: string[];
    requiredEnv: string[];
    legacyGuildFeatureFlag?: LegacyGuildFeatureFlag;
}

export const MODULE_MANIFESTS: ModuleManifest[] = [
    {
        id: 'core',
        name: 'Core',
        description: 'Core bot utilities and informational commands.',
        commandIds: ['ping', 'info', 'avatar', 'user', 'server', 'roles', 'dashboard', 'moveme', 'move', 'moveall', 'setup', 'config', 'module'],
        componentPrefixes: [],
        jobs: ['cleanupUserCache'],
        routes: [
            '/api/guilds/[guildId]',
            '/api/guilds/[guildId]/channels',
            '/api/guilds/[guildId]/commands',
            '/api/guilds/[guildId]/discord-data',
            '/api/guilds/[guildId]/members',
            '/api/guilds/[guildId]/modules',
            '/api/guilds/[guildId]/me',
            '/api/guilds/[guildId]/rbac',
        ],
        tables: ['guild_config', 'dashboard_rbac_config', 'dashboard_rbac_rules'],
        requiredEnv: ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'],
    },
    {
        id: 'welcome',
        name: 'Welcome',
        description: 'Welcome messages, cards, and role-based welcome triggers.',
        commandIds: ['welcome'],
        componentPrefixes: [],
        jobs: [],
        routes: ['/api/guilds/[guildId]/welcome'],
        tables: ['welcome_config', 'welcome_trigger', 'message_template'],
        requiredEnv: [],
        legacyGuildFeatureFlag: 'welcomeEnabled',
    },
    {
        id: 'verification',
        name: 'Verification',
        description: 'Verification workflows and grace-period auto-kick.',
        commandIds: ['verify'],
        componentPrefixes: [],
        jobs: ['cleanupUnverified'],
        routes: ['/api/guilds/[guildId]/verification'],
        tables: ['user_join', 'verification_message_rule', 'verification_role_message'],
        requiredEnv: [],
        legacyGuildFeatureFlag: 'verificationEnabled',
    },
    {
        id: 'boosts',
        name: 'Boosts',
        description: 'Server boost tracking and boost rewards.',
        commandIds: ['boost'],
        componentPrefixes: [],
        jobs: ['cleanupBoosts'],
        routes: ['/api/guilds/[guildId]/boosts'],
        tables: ['user_boost', 'boost_log'],
        requiredEnv: [],
        legacyGuildFeatureFlag: 'boostEnabled',
    },
    {
        id: 'leveling',
        name: 'Leveling',
        description: 'XP, leveling, and role rewards.',
        commandIds: ['rank', 'profile', 'leaderboard', 'top', 'setxp', 'setlevel'],
        componentPrefixes: [],
        jobs: ['processVoiceXp'],
        routes: ['/api/guilds/[guildId]/leveling'],
        tables: ['level_profile', 'level_reward'],
        requiredEnv: [],
        legacyGuildFeatureFlag: 'levelingEnabled',
    },
    {
        id: 'events',
        name: 'Events',
        description: 'Event creation, RSVP, reminders, and recurring schedules.',
        commandIds: ['create', 'list', 'delete', 'link', 'remind', 'settings'],
        componentPrefixes: ['event:rsvp:', 'event:reminder:', 'event:details:', 'reminder:preset:', 'reminder:custom:', 'reminder_modal:', 'dm_reminder:'],
        jobs: ['event-reminders', 'event-start', 'event-complete', 'event-message-sync'],
        routes: ['/api/guilds/[guildId]/events'],
        tables: ['event', 'event_rsvp', 'event_reminder', 'event_template', 'event_poll_settings'],
        requiredEnv: [],
    },
    {
        id: 'polls',
        name: 'Polls',
        description: 'Standard, time, and anonymous polls.',
        commandIds: ['poll'],
        componentPrefixes: ['poll:vote:', 'poll:results:', 'poll:end:'],
        jobs: ['poll-end', 'poll-message-sync'],
        routes: ['/api/guilds/[guildId]/polls'],
        tables: ['poll', 'poll_option', 'poll_vote', 'poll_template'],
        requiredEnv: ['ANONYMIZE_SECRET'],
    },
    {
        id: 'role_actions',
        name: 'Role Actions',
        description: 'Automated actions on role add/remove events.',
        commandIds: [],
        componentPrefixes: [],
        jobs: ['processScheduledRoleActions'],
        routes: ['/api/guilds/[guildId]/role-actions'],
        tables: ['role_action', 'scheduled_role_action'],
        requiredEnv: [],
    },
    {
        id: 'aliases',
        name: 'Aliases',
        description: 'Message auto-responders and trigger aliases.',
        commandIds: [],
        componentPrefixes: [],
        jobs: [],
        routes: ['/api/guilds/[guildId]/aliases'],
        tables: ['message_alias'],
        requiredEnv: [],
    },
    {
        id: 'moderation',
        name: 'Moderation',
        description: 'Warnings, mutes, kicks, bans, and moderation cases.',
        commandIds: ['warn', 'mute', 'unmute', 'timeout', 'untimeout', 'kick', 'vkick', 'ban', 'unban', 'clear', 'cases', 'lock', 'unlock', 'slowmode', 'setnick', 'role'],
        componentPrefixes: [],
        jobs: ['processModerationExpirations'],
        routes: ['/api/guilds/[guildId]/moderation'],
        tables: ['moderation_case', 'moderation_settings'],
        requiredEnv: [],
    },
    {
        id: 'birthdays',
        name: 'Birthdays',
        description: 'Birthday tracking and announcements.',
        commandIds: ['birthday'],
        componentPrefixes: [],
        jobs: ['checkBirthdays'],
        routes: ['/api/guilds/[guildId]/birthdays'],
        tables: ['birthday_config', 'birthday_entry', 'birthday_log'],
        requiredEnv: [],
    },
    {
        id: 'webhooks',
        name: 'Webhooks & API',
        description: 'Outgoing webhooks and API key management.',
        commandIds: [],
        componentPrefixes: [],
        jobs: [],
        routes: ['/api/guilds/[guildId]/webhooks', '/api/guilds/[guildId]/api-keys'],
        tables: ['webhook_endpoint', 'webhook_delivery', 'api_key'],
        requiredEnv: [],
    },
    {
        id: 'notifications',
        name: 'Notifications',
        description: 'Internal notification events and deliveries.',
        commandIds: [],
        componentPrefixes: [],
        jobs: ['processNotificationDeliveries'],
        routes: ['/api/guilds/[guildId]/notifications'],
        tables: ['notification_event', 'notification_delivery', 'notification_preference', 'notification_user_state', 'notification_user_cursor'],
        requiredEnv: [],
    },
    {
        id: 'analytics',
        name: 'Analytics',
        description: 'Growth and activity analytics.',
        commandIds: [],
        componentPrefixes: [],
        jobs: ['syncAnalytics', 'trackGrowth'],
        routes: ['/api/guilds/[guildId]/analytics', '/api/guilds/[guildId]/logs'],
        tables: ['message_activity', 'guild_growth'],
        requiredEnv: [],
    },
    {
        id: 'settings_backups',
        name: 'Settings & Backups',
        description: 'Settings import/export and backup management.',
        commandIds: [],
        componentPrefixes: [],
        jobs: [],
        routes: ['/api/guilds/[guildId]/settings'],
        tables: ['guild_config'],
        requiredEnv: [],
    },
];

export const MODULE_MANIFEST_MAP = new Map<ModuleId, ModuleManifest>(
    MODULE_MANIFESTS.map((manifest) => [manifest.id, manifest])
);

export const COMMAND_TO_MODULE = new Map<string, ModuleId>();
for (const manifest of MODULE_MANIFESTS) {
    for (const commandId of manifest.commandIds) {
        COMMAND_TO_MODULE.set(commandId, manifest.id);
    }
}

export function resolveModuleForCommand(commandId: string): ModuleId {
    return COMMAND_TO_MODULE.get(commandId) ?? 'core';
}

export function isValidModuleId(value: string): value is ModuleId {
    return MODULE_MANIFEST_MAP.has(value as ModuleId);
}
