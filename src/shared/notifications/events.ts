export const GUILD_NOTIFICATION_EVENT_TYPES = [
    'VERIFICATION_USER_VERIFIED',
    'VERIFICATION_USER_UNVERIFIED',
    'VERIFICATION_PROFILE_MESSAGE_FAILED',
    'VERIFICATION_GRACE_EXPIRING',
    'VERIFICATION_AUTO_KICK_SUCCESS',
    'VERIFICATION_AUTO_KICK_FAILED',
    'WELCOME_AUTO_ROLE_ASSIGNED',
    'WELCOME_AUTO_ROLE_ASSIGN_FAILED',
    'WELCOME_JOIN_MESSAGE_FAILED',
    'WELCOME_LEAVE_MESSAGE_FAILED',
    'WELCOME_TRIGGER_SENT',
    'WELCOME_TRIGGER_FAILED',
    'BOOST_STARTED',
    'BOOST_RENEWED',
    'BOOST_ENDED',
    'BOOST_ROLE_REMOVED',
    'BOOST_ROLE_REMOVE_FAILED',
    'ROLE_ACTION_QUEUED',
    'ROLE_ACTION_EXECUTED',
    'ROLE_ACTION_FAILED',
    'SCHEDULED_ROLE_ACTION_CANCELLED',
    'SCHEDULED_ROLE_ACTION_FAILED',
    'MOD_CASE_CREATED_WARN',
    'MOD_CASE_CREATED_MUTE',
    'MOD_CASE_CREATED_TIMEOUT',
    'MOD_CASE_CREATED_KICK',
    'MOD_CASE_CREATED_BAN',
    'MOD_CASE_CREATED_UNMUTE',
    'MOD_CASE_CREATED_UNTIMEOUT',
    'MOD_CASE_CREATED_UNBAN',
    'MOD_WARNING_REMOVED',
    'MOD_CASE_EXPIRED_SUCCESS',
    'MOD_CASE_EXPIRED_FAILED',
    'AUTOMOD_BANNED_WORD_TRIGGERED',
    'AUTOMOD_INVITE_TRIGGERED',
    'AUTOMOD_SPAM_TRIGGERED',
    'AUTOMOD_ACTION_FAILED',
    'BIRTHDAY_ANNOUNCEMENT_SENT',
    'BIRTHDAY_ANNOUNCEMENT_FAILED',
    'BIRTHDAY_ROLE_ASSIGNED',
    'BIRTHDAY_ROLE_ASSIGN_FAILED',
    'BIRTHDAY_ROLE_REMOVED',
    'BIRTHDAY_ROLE_REMOVE_FAILED',
    'REACTION_ROLE_PROCESSING_ERROR',
    'REACTION_ROLE_CONFIG_BROKEN',
    'ROLE_BUTTON_USED',
    'ROLE_DROPDOWN_USED',
    'WELCOME_MESSAGE_SENT',
    'WELCOME_MESSAGE_FAILED',
    'ALIAS_RESPONSE_FAILED',
    'ALIAS_EMBED_INVALID',
    'ALIAS_HIGH_USAGE',
    'DASHBOARD_SETTINGS_CHANGED',
    'DASHBOARD_SETTINGS_IMPORTED',
    'DASHBOARD_SETTINGS_IMPORT_FAILED',
    'DASHBOARD_SETTINGS_EXPORTED',
    'GUILD_BOT_MISSING_PERMISSIONS',
    'GUILD_BOT_MISSING_IN_GUILD',
] as const;

export type GuildNotificationEventType = typeof GUILD_NOTIFICATION_EVENT_TYPES[number];

export const NOTIFICATION_SEVERITIES = ['INFO', 'WARNING', 'ERROR', 'CRITICAL'] as const;
export type NotificationSeverity = typeof NOTIFICATION_SEVERITIES[number];

export const NOTIFICATION_SOURCES = ['BOT_EVENT', 'BOT_JOB', 'DASHBOARD_API'] as const;
export type NotificationSource = typeof NOTIFICATION_SOURCES[number];

export const NOTIFICATION_DIGEST_MODES = ['OFF', 'HOURLY', 'DAILY'] as const;
export type NotificationDigestMode = typeof NOTIFICATION_DIGEST_MODES[number];

const EVENT_TYPE_SET = new Set<string>(GUILD_NOTIFICATION_EVENT_TYPES);
const SEVERITY_SET = new Set<string>(NOTIFICATION_SEVERITIES);
const SOURCE_SET = new Set<string>(NOTIFICATION_SOURCES);
const DIGEST_MODE_SET = new Set<string>(NOTIFICATION_DIGEST_MODES);

export function isGuildNotificationEventType(value: string): value is GuildNotificationEventType {
    return EVENT_TYPE_SET.has(value);
}

export function isNotificationSeverity(value: string): value is NotificationSeverity {
    return SEVERITY_SET.has(value);
}

export function isNotificationSource(value: string): value is NotificationSource {
    return SOURCE_SET.has(value);
}

export function isNotificationDigestMode(value: string): value is NotificationDigestMode {
    return DIGEST_MODE_SET.has(value);
}

const SEVERITY_RANK: Record<NotificationSeverity, number> = {
    INFO: 1,
    WARNING: 2,
    ERROR: 3,
    CRITICAL: 4,
};

export function meetsSeverityThreshold(
    severity: NotificationSeverity,
    minSeverity: NotificationSeverity
): boolean {
    return SEVERITY_RANK[severity] >= SEVERITY_RANK[minSeverity];
}

