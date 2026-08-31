import { relations } from 'drizzle-orm';
import {
    boolean,
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from 'drizzle-orm/pg-core';

export const roleActionTriggerEnum = pgEnum('role_action_trigger', ['ADD', 'REMOVE']);
export const roleActionTypeEnum = pgEnum('role_action_type', ['DM', 'KICK', 'LOG', 'MSG', 'MESSAGE']);
export const roleActionRequiredLogicEnum = pgEnum('role_action_required_logic', ['AND', 'OR']);
export const welcomeTargetTypeEnum = pgEnum('welcome_target_type', ['CHANNEL', 'DM']);
export const welcomeBackgroundTypeEnum = pgEnum('welcome_background_type', ['COLOR', 'GRADIENT', 'IMAGE']);
export const welcomeAvatarShapeEnum = pgEnum('welcome_avatar_shape', ['CIRCLE', 'SQUARE', 'ROUNDED']);
export const welcomeImagePositionEnum = pgEnum('welcome_image_position', ['ABOVE', 'BELOW', 'ONLY']);
export const eventStatusEnum = pgEnum('event_status', ['SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED']);
export const rsvpStatusEnum = pgEnum('rsvp_status', ['YES', 'NO', 'MAYBE', 'WAITLIST']);
export const pollTypeEnum = pgEnum('poll_type', ['STANDARD', 'TIME', 'ANONYMOUS']);
export const repeatFrequencyEnum = pgEnum('repeat_frequency', ['NONE', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY']);
export const scheduledRoleActionStatusEnum = pgEnum('scheduled_role_action_status', [
    'PENDING',
    'PROCESSING',
    'DONE',
    'FAILED',
    'CANCELLED',
]);
export const notificationSeverityEnum = pgEnum('notification_severity', ['INFO', 'WARNING', 'ERROR', 'CRITICAL']);
export const notificationSourceEnum = pgEnum('notification_source', ['BOT_EVENT', 'BOT_JOB', 'DASHBOARD_API']);
export const notificationDeliveryChannelEnum = pgEnum('notification_delivery_channel', ['DISCORD_CHANNEL', 'WEBHOOK']);
export const notificationDeliveryStatusEnum = pgEnum('notification_delivery_status', ['PENDING', 'SENT', 'FAILED', 'SKIPPED']);
export const notificationDigestModeEnum = pgEnum('notification_digest_mode', ['OFF', 'HOURLY', 'DAILY']);

export const guildConfig = pgTable('guild_config', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').unique().notNull(),

    welcomeEnabled: boolean('welcome_enabled').default(false).notNull(),
    autoRoleId: text('auto_role_id'),
    joinMessageChannelId: text('join_message_channel_id'),
    joinMessage: text('join_message'),
    joinMessageEmbed: jsonb('join_message_embed'),
    leaveMessageChannelId: text('leave_message_channel_id'),
    leaveMessage: text('leave_message'),
    leaveMessageEmbed: jsonb('leave_message_embed'),

    verificationEnabled: boolean('verification_enabled').default(false).notNull(),
    unverifiedRoleId: text('unverified_role_id'),
    verificationRoleId: text('verification_role_id'),
    verificationGraceDays: integer('verification_grace_days').default(30).notNull(),
    verificationKickDmEnabled: boolean('verification_kick_dm_enabled').default(true).notNull(),
    verificationMessage: text('verification_message'),
    verificationMessageChannelId: text('verification_message_channel_id'),
    verificationWelcomeMessage: text('verification_welcome_message'),
    verificationMessageEmbed: jsonb('verification_message_embed'),

    lastMemberSync: timestamp('last_member_sync', { withTimezone: true, mode: 'date' }),

    boostEnabled: boolean('boost_enabled').default(false).notNull(),
    boostAnnouncementChannelId: text('boost_announcement_channel_id'),
    boostRoleId: text('boost_role_id'),
    boostRoleName: text('boost_role_name'),
    boostRoleColorPrimary: text('boost_role_color_primary'),
    boostRoleColorSecondary: text('boost_role_color_secondary'),
    boostClaimRequired: boolean('boost_claim_required').default(true).notNull(),
    boostWelcomeMessage: text('boost_welcome_message'),
    boostWelcomeMessageEmbed: jsonb('boost_welcome_message_embed'),
    boostReBoostMessage: text('boost_re_boost_message'),
    boostReBoostMessageEmbed: jsonb('boost_re_boost_message_embed'),
    boostRoleRemovalDays: integer('boost_role_removal_days').default(30).notNull(),
    boostRoleRemovalDmEnabled: boolean('boost_role_removal_dm_enabled').default(true).notNull(),

    levelingEnabled: boolean('leveling_enabled').default(false).notNull(),
    textXpMin: integer('text_xp_min').default(15).notNull(),
    textXpMax: integer('text_xp_max').default(25).notNull(),
    textXpCooldown: integer('text_xp_cooldown').default(60).notNull(),
    voiceXpPerMinute: integer('voice_xp_per_minute').default(10).notNull(),
    levelUpNotifEnabled: boolean('level_up_notif_enabled').default(true).notNull(),
    levelUpChannelId: text('level_up_channel_id'),
    levelUpMessage: text('level_up_message'),
    levelUpMessageEmbed: jsonb('level_up_message_embed'),

    dashboardUrl: text('dashboard_url'),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

export const messageTemplate = pgTable('message_template', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull(),
    name: text('name').notNull(),
    content: text('content').notNull(),
    embedEnabled: boolean('embed_enabled').default(false).notNull(),
    embedTitle: text('embed_title'),
    embedDescription: text('embed_description'),
    embedColor: text('embed_color'),
    embedThumbnail: boolean('embed_thumbnail').default(false).notNull(),
    embedData: jsonb('embed_data'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildIdIdx: index('message_template_guild_id_idx').on(table.guildId),
}));

export const welcomeTrigger = pgTable('welcome_trigger', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    roleId: text('role_id').notNull(),
    channelId: text('channel_id'),
    templateId: uuid('template_id').notNull().references(() => messageTemplate.id, { onDelete: 'cascade' }),
    enabled: boolean('enabled').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildIdIdx: index('welcome_trigger_guild_id_idx').on(table.guildId),
    uniqueGuildRole: index('welcome_trigger_guild_role_unique').on(table.guildId, table.roleId),
}));

export const userJoin = pgTable('user_join', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true, mode: 'date' }),
    isVerified: boolean('is_verified').default(false).notNull(),
    isBot: boolean('is_bot').default(false).notNull(),
    kickedAt: timestamp('kicked_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildUserIdx: uniqueIndex('user_join_guild_user_unique').on(table.guildId, table.userId),
    guildVerifiedIdx: index('user_join_guild_verified_idx').on(table.guildId, table.isVerified),
    guildJoinedIdx: index('user_join_guild_joined_idx').on(table.guildId, table.joinedAt),
}));

export const verificationMessageRule = pgTable('verification_message_rule', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    name: text('name'),
    roleId: text('role_id').notNull(),
    notifyChannelId: text('notify_channel_id'),
    message: text('message'),
    messageEmbed: jsonb('message_embed'),
    welcomeMessage: text('welcome_message'),
    enabled: boolean('enabled').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildRoleUnique: uniqueIndex('verification_message_rule_guild_role_unique').on(table.guildId, table.roleId),
    guildIdIdx: index('verification_message_rule_guild_id_idx').on(table.guildId),
}));

export const verificationRoleMessage = pgTable('verification_role_message', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    roleId: text('role_id').notNull(),
    notifyChannelId: text('notify_channel_id'),
    message: text('message'),
    messageEmbed: jsonb('message_embed'),
    welcomeMessage: text('welcome_message'),
    enabled: boolean('enabled').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildRoleUnique: uniqueIndex('verification_role_message_guild_role_unique').on(table.guildId, table.roleId),
    guildIdIdx: index('verification_role_message_guild_id_idx').on(table.guildId),
}));

export const userBoost = pgTable('user_boost', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    boostedAt: timestamp('boosted_at', { withTimezone: true, mode: 'date' }).notNull(),
    boostEndsAt: timestamp('boost_ends_at', { withTimezone: true, mode: 'date' }).notNull(),
    roleAssigned: boolean('role_assigned').default(false).notNull(),
    roleRemoved: boolean('role_removed').default(false).notNull(),
    roleRemovedAt: timestamp('role_removed_at', { withTimezone: true, mode: 'date' }),
    notifiedBeforeRemoval: boolean('notified_before_removal').default(false).notNull(),
    boostCountTotal: integer('boost_count_total').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildUserIdx: uniqueIndex('user_boost_guild_user_unique').on(table.guildId, table.userId),
    guildEndsIdx: index('user_boost_guild_ends_idx').on(table.guildId, table.boostEndsAt),
    guildRemovedIdx: index('user_boost_guild_removed_idx').on(table.guildId, table.roleRemoved),
    guildRemovedBoostedIdx: index('user_boost_guild_removed_boosted_idx').on(table.guildId, table.roleRemoved, table.boostedAt),
}));

export const levelProfile = pgTable('level_profile', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    textXp: integer('text_xp').default(0).notNull(),
    voiceXp: integer('voice_xp').default(0).notNull(),
    totalXp: integer('total_xp').default(0).notNull(),
    level: integer('level').default(0).notNull(),
    lastTextXpAt: timestamp('last_text_xp_at', { withTimezone: true, mode: 'date' }),
    voiceJoinedAt: timestamp('voice_joined_at', { withTimezone: true, mode: 'date' }),
    totalVoiceMinutes: integer('total_voice_minutes').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildUserIdx: uniqueIndex('level_profile_guild_user_unique').on(table.guildId, table.userId),
    guildXpIdx: index('level_profile_guild_xp_idx').on(table.guildId, table.totalXp),
    guildLevelIdx: index('level_profile_guild_level_idx').on(table.guildId, table.level),
}));

export const levelReward = pgTable('level_reward', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    roleId: text('role_id').notNull(),
    level: integer('level').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildLevelRoleUnique: uniqueIndex('level_reward_guild_level_role_unique').on(table.guildId, table.level, table.roleId),
    guildIdIdx: index('level_reward_guild_id_idx').on(table.guildId),
}));

export const levelProfileRelations = relations(levelProfile, ({ one }) => ({
    guild: one(guildConfig, {
        fields: [levelProfile.guildId],
        references: [guildConfig.guildId],
    }),
}));

export const levelRewardRelations = relations(levelReward, ({ one }) => ({
    guild: one(guildConfig, {
        fields: [levelReward.guildId],
        references: [guildConfig.guildId],
    }),
}));

export const roleAction = pgTable('role_action', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    roleId: text('role_id').notNull(),
    actionGroup: text('action_group'),
    triggerType: roleActionTriggerEnum('trigger_type').default('ADD').notNull(),
    actionType: roleActionTypeEnum('action_type').notNull(),
    actionDelay: integer('action_delay').default(0).notNull(),
    dmMessage: text('dm_message'),
    dmMessageEmbed: jsonb('dm_message_embed'),
    channelId: text('channel_id'),
    kickReason: text('kick_reason'),
    logChannelId: text('log_channel_id'),
    requiredRoleIds: text('required_role_ids').array().default([]).notNull(),
    requiredRoleLogic: roleActionRequiredLogicEnum('required_role_logic').default('AND').notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildRoleIdx: index('role_action_guild_role_idx').on(table.guildId, table.roleId),
}));

export const actionLog = pgTable('action_log', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    actionType: text('action_type').notNull(),
    targetUserId: text('target_user_id').notNull(),
    executedAt: timestamp('executed_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    success: boolean('success').notNull(),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata'),
}, (table) => ({
    guildTypeIdx: index('action_log_guild_type_idx').on(table.guildId, table.actionType),
    guildExecutedIdx: index('action_log_guild_executed_idx').on(table.guildId, table.executedAt),
    guildTypeExecutedIdx: index('action_log_guild_type_executed_idx').on(table.guildId, table.actionType, table.executedAt),
}));

export const notificationEvent = pgTable('notification_event', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    severity: notificationSeverityEnum('severity').default('INFO').notNull(),
    source: notificationSourceEnum('source').default('BOT_EVENT').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    actorUserId: text('actor_user_id'),
    targetUserId: text('target_user_id'),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    metadata: jsonb('metadata'),
    dedupeKey: text('dedupe_key'),
    occurrenceCount: integer('occurrence_count').default(1).notNull(),
    inAppVisible: boolean('in_app_visible').default(true).notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildOccurredIdx: index('notification_event_guild_occurred_idx').on(table.guildId, table.occurredAt),
    guildTypeOccurredIdx: index('notification_event_guild_type_occurred_idx').on(table.guildId, table.eventType, table.occurredAt),
    guildSeverityOccurredIdx: index('notification_event_guild_severity_occurred_idx').on(table.guildId, table.severity, table.occurredAt),
    guildDedupeIdx: index('notification_event_guild_dedupe_idx').on(table.guildId, table.dedupeKey),
    guildVisibleOccurredIdx: index('notification_event_guild_visible_occurred_idx').on(table.guildId, table.inAppVisible, table.occurredAt),
}));

export const notificationUserState = pgTable('notification_user_state', {
    id: uuid('id').defaultRandom().primaryKey(),
    notificationId: uuid('notification_id').notNull().references(() => notificationEvent.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    readAt: timestamp('read_at', { withTimezone: true, mode: 'date' }),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'date' }),
    pinnedAt: timestamp('pinned_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    notificationUserUnique: uniqueIndex('notification_user_state_notification_user_unique').on(table.notificationId, table.userId),
    userReadIdx: index('notification_user_state_user_read_idx').on(table.userId, table.readAt),
    userArchivedIdx: index('notification_user_state_user_archived_idx').on(table.userId, table.archivedAt),
}));

export const notificationUserCursor = pgTable('notification_user_cursor', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'date' }),
    lastReadAt: timestamp('last_read_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildUserUnique: uniqueIndex('notification_user_cursor_guild_user_unique').on(table.guildId, table.userId),
    guildSeenIdx: index('notification_user_cursor_guild_seen_idx').on(table.guildId, table.lastSeenAt),
}));

export const notificationPreference = pgTable('notification_preference', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    minSeverity: notificationSeverityEnum('min_severity').default('INFO').notNull(),
    inAppEnabled: boolean('in_app_enabled').default(true).notNull(),
    discordChannelEnabled: boolean('discord_channel_enabled').default(false).notNull(),
    discordChannelId: text('discord_channel_id'),
    webhookEnabled: boolean('webhook_enabled').default(false).notNull(),
    webhookUrl: text('webhook_url'),
    digestMode: notificationDigestModeEnum('digest_mode').default('OFF').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildEventUnique: uniqueIndex('notification_preference_guild_event_unique').on(table.guildId, table.eventType),
    guildIdIdx: index('notification_preference_guild_id_idx').on(table.guildId),
}));

export const notificationDelivery = pgTable('notification_delivery', {
    id: uuid('id').defaultRandom().primaryKey(),
    notificationId: uuid('notification_id').notNull().references(() => notificationEvent.id, { onDelete: 'cascade' }),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    channelType: notificationDeliveryChannelEnum('channel_type').notNull(),
    target: text('target').notNull(),
    status: notificationDeliveryStatusEnum('status').default('PENDING').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    lastError: text('last_error'),
    sentAt: timestamp('sent_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    statusNextAttemptIdx: index('notification_delivery_status_next_attempt_idx').on(table.status, table.nextAttemptAt),
    notificationIdx: index('notification_delivery_notification_idx').on(table.notificationId),
    guildStatusIdx: index('notification_delivery_guild_status_idx').on(table.guildId, table.status),
}));

export const messageActivity = pgTable('message_activity', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    hour: integer('hour').notNull(),
    day: integer('day').notNull(),
    date: timestamp('date', { withTimezone: true, mode: 'date' }).notNull(),
    messageCount: integer('message_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    uniqueGuildHourDay: uniqueIndex('message_activity_guild_hour_day_date').on(table.guildId, table.date, table.hour),
    guildIdIdx: index('message_activity_guild_id_idx').on(table.guildId),
    guildDateHourIdx: index('message_activity_guild_date_hour_idx').on(table.guildId, table.date, table.hour),
}));

export const guildGrowth = pgTable('guild_growth', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    date: timestamp('date', { withTimezone: true, mode: 'date' }).notNull(),
    memberCount: integer('member_count').notNull(),
    verifiedCount: integer('verified_count').default(0).notNull(),
    joinedToday: integer('joined_today').default(0).notNull(),
    leftToday: integer('left_today').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildDateUnique: uniqueIndex('guild_growth_guild_date_unique').on(table.guildId, table.date),
    guildIdIdx: index('guild_growth_guild_id_idx').on(table.guildId),
}));

export const moderationCase = pgTable('moderation_case', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    caseNumber: integer('case_number').notNull(),
    userId: text('user_id').notNull(),
    moderatorId: text('moderator_id').notNull(),
    action: text('action').notNull(),
    reason: text('reason'),
    duration: integer('duration'),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
    active: boolean('active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildCaseUnique: uniqueIndex('moderation_case_guild_case_unique').on(table.guildId, table.caseNumber),
    guildUserIdx: index('moderation_case_guild_user_idx').on(table.guildId, table.userId),
    guildModeratorIdx: index('moderation_case_guild_moderator_idx').on(table.guildId, table.moderatorId),
    guildActionIdx: index('moderation_case_guild_action_idx').on(table.guildId, table.action),
}));

export const memberWatchlist = pgTable('member_watchlist', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    addedBy: text('added_by').notNull(),
    reason: text('reason').notNull(),
    notes: text('notes'),
    severity: text('severity').default('LOW').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildUserUnique: uniqueIndex('member_watchlist_guild_user_unique').on(table.guildId, table.userId),
    guildIdIdx: index('member_watchlist_guild_id_idx').on(table.guildId),
    userIdIdx: index('member_watchlist_user_id_idx').on(table.userId),
}));

export const moderationSettings = pgTable('moderation_settings', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    autoModEnabled: boolean('auto_mod_enabled').default(false).notNull(),
    spamThreshold: integer('spam_threshold').default(5),
    spamAction: text('spam_action').default('WARN'),
    spamMuteDuration: integer('spam_mute_duration').default(10),
    wordFilterEnabled: boolean('word_filter_enabled').default(false).notNull(),
    wordFilterList: text('word_filter_list'),
    wordFilterAction: text('word_filter_action').default('DELETE'),
    inviteFilterEnabled: boolean('invite_filter_enabled').default(false).notNull(),
    inviteFilterAction: text('invite_filter_action').default('DELETE'),
    logChannelId: text('log_channel_id'),
    muteRoleId: text('mute_role_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildIdUnique: uniqueIndex('moderation_settings_guild_unique').on(table.guildId),
}));

// 🆕 Welcome System Configuration (ProBot-style)
export const welcomeConfig = pgTable('welcome_config', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),

    // ═══════════════════════════════════════════════════════════
    // WELCOME MESSAGE SETTINGS
    // ═══════════════════════════════════════════════════════════

    // Basic toggle
    enabled: boolean('enabled').default(false).notNull(),

    // Message target
    targetType: welcomeTargetTypeEnum('target_type').default('CHANNEL').notNull(),
    channelId: text('channel_id'),

    // Message content with [variable] format (ProBot style)
    messageTemplate: text('message_template'),
    embedEnabled: boolean('embed_enabled').default(false).notNull(),
    embedConfig: jsonb('embed_config'),
    welcomeBotsEnabled: boolean('welcome_bots_enabled').default(false).notNull(),

    // ═══════════════════════════════════════════════════════════
    // GOODBYE MESSAGE SETTINGS
    // ═══════════════════════════════════════════════════════════

    goodbyeEnabled: boolean('goodbye_enabled').default(false).notNull(),
    goodbyeChannelId: text('goodbye_channel_id'),
    goodbyeMessageTemplate: text('goodbye_message_template'),
    goodbyeEmbedEnabled: boolean('goodbye_embed_enabled').default(false).notNull(),
    goodbyeEmbedConfig: jsonb('goodbye_embed_config'),
    goodbyeBotsEnabled: boolean('goodbye_bots_enabled').default(false).notNull(),
    goodbyeImageEnabled: boolean('goodbye_image_enabled').default(false).notNull(),

    // ═══════════════════════════════════════════════════════════
    // PRIVATE (DM) MESSAGE SETTINGS
    // ═══════════════════════════════════════════════════════════

    privateEnabled: boolean('private_enabled').default(false).notNull(),
    privateMessageTemplate: text('private_message_template'),
    privateEmbedEnabled: boolean('private_embed_enabled').default(false).notNull(),
    privateEmbedConfig: jsonb('private_embed_config'),
    privateImageEnabled: boolean('private_image_enabled').default(false).notNull(),

    // ═══════════════════════════════════════════════════════════
    // WELCOME IMAGE CARD SETTINGS
    // ═══════════════════════════════════════════════════════════

    imageEnabled: boolean('image_enabled').default(false).notNull(),
    // Image send mode: WITH_TEXT, BEFORE_TEXT, TO_CHANNEL, IMAGE_ONLY
    imageSendMode: text('image_send_mode').default('WITH_TEXT'),
    imageChannelId: text('image_channel_id'), // For TO_CHANNEL mode

    // Canvas dimensions (ProBot-style customizable)
    canvasWidth: integer('canvas_width').default(1024),
    canvasHeight: integer('canvas_height').default(500),

    // Background settings
    backgroundType: welcomeBackgroundTypeEnum('background_type').default('COLOR').notNull(),
    backgroundValue: text('background_value').default('#36393f'), // Color, gradient, image URL
    overlayOpacity: integer('overlay_opacity').default(50),

    // Avatar settings
    avatarShape: welcomeAvatarShapeEnum('avatar_shape').default('CIRCLE').notNull(),
    avatarX: integer('avatar_x').default(150),
    avatarY: integer('avatar_y').default(150),
    avatarSize: integer('avatar_size').default(128),
    avatarBorderColor: text('avatar_border_color').default('#ffffff'),
    avatarBorderWidth: integer('avatar_border_width').default(4),

    // Username text settings
    usernameX: integer('username_x').default(300),
    usernameY: integer('username_y').default(130),
    usernameFont: text('username_font').default('Arial'),
    usernameSize: integer('username_size').default(32),
    usernameColor: text('username_color').default('#ffffff'),
    usernameAlign: text('username_align').default('left'),

    // Subtitle text settings
    subtitleEnabled: boolean('subtitle_enabled').default(true).notNull(),
    subtitleTemplate: text('subtitle_template').default('Welcome to [server]!'),
    subtitleX: integer('subtitle_x').default(300),
    subtitleY: integer('subtitle_y').default(180),
    subtitleFont: text('subtitle_font').default('Arial'),
    subtitleSize: integer('subtitle_size').default(24),
    subtitleColor: text('subtitle_color').default('#cccccc'),

    // Server name overlay
    showServerName: boolean('show_server_name').default(false).notNull(),
    serverNameX: integer('server_name_x').default(300),
    serverNameY: integer('server_name_y').default(80),
    serverNameFont: text('server_name_font').default('Arial'),
    serverNameSize: integer('server_name_size').default(28),
    serverNameColor: text('server_name_color').default('#ffffff'),

    // Safety settings
    cooldownEnabled: boolean('cooldown_enabled').default(false).notNull(),
    cooldownSeconds: integer('cooldown_seconds').default(5),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildIdUnique: uniqueIndex('welcome_config_guild_id_unique').on(table.guildId),
    guildIdIdx: index('welcome_config_guild_id_idx').on(table.guildId),
}));

export const discordUserCache = pgTable('discord_user_cache', {
    userId: text('user_id').primaryKey(),
    username: text('username').notNull(),
    globalName: text('global_name'),
    avatar: text('avatar'),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    updatedAtIdx: index('discord_user_cache_updated_idx').on(table.updatedAt),
}));

export const scheduledRoleAction = pgTable('scheduled_role_action', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    actionId: uuid('action_id').notNull().references(() => roleAction.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    executeAt: timestamp('execute_at', { withTimezone: true, mode: 'date' }).notNull(),
    status: scheduledRoleActionStatusEnum('status').default('PENDING').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    statusExecuteIdx: index('scheduled_role_action_status_execute_idx').on(table.status, table.executeAt),
    guildStatusExecuteIdx: index('scheduled_role_action_guild_status_execute_idx').on(table.guildId, table.status, table.executeAt),
}));

export const birthdayConfig = pgTable('birthday_config', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    enabled: boolean('enabled').default(false).notNull(),
    channelId: text('channel_id'),
    roleId: text('role_id'),
    messageTemplate: text('message_template').default('🎉 Happy Birthday {user.mention}! 🎂').notNull(),
    messageEmbed: jsonb('message_embed'),
    hourOfDay: integer('hour_of_day').default(9).notNull(),
    showAge: boolean('show_age').default(true).notNull(),
    mentionRoleId: text('mention_role_id'),
    autoRemoveRole: boolean('auto_remove_role').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildIdUnique: uniqueIndex('birthday_config_guild_id_unique').on(table.guildId),
    guildIdIdx: index('birthday_config_guild_id_idx').on(table.guildId),
}));

export const birthdayEntry = pgTable('birthday_entry', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    month: integer('month').notNull(),
    day: integer('day').notNull(),
    year: integer('year'),
    timezone: text('timezone').default('UTC').notNull(),
    lastCelebratedYear: integer('last_celebrated_year'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildUserUnique: uniqueIndex('birthday_entry_guild_user_unique').on(table.guildId, table.userId),
    guildMonthDayIdx: index('birthday_entry_guild_month_day_idx').on(table.guildId, table.month, table.day),
    guildIdIdx: index('birthday_entry_guild_id_idx').on(table.guildId),
}));

export const birthdayLog = pgTable('birthday_log', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    celebratedAt: timestamp('celebrated_at', { withTimezone: true, mode: 'date' }).notNull(),
    messageSent: boolean('message_sent').default(false).notNull(),
    roleAssigned: boolean('role_assigned').default(false).notNull(),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildUserIdx: index('birthday_log_guild_user_idx').on(table.guildId, table.userId),
    guildCelebratedIdx: index('birthday_log_guild_celebrated_idx').on(table.guildId, table.celebratedAt),
}));

export const messageAlias = pgTable('message_alias', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    trigger: text('trigger').notNull(),
    response: text('response').notNull(),
    responseEmbed: jsonb('response_embed'),
    enabled: boolean('enabled').default(true).notNull(),
    caseSensitive: boolean('case_sensitive').default(false).notNull(),
    deleteTrigger: boolean('delete_trigger').default(false).notNull(),
    requirePrefix: text('require_prefix').default('!'),
    allowedChannels: text('allowed_channels').array(),
    allowedRoles: text('allowed_roles').array(),
    cooldownSeconds: integer('cooldown_seconds').default(5).notNull(),
    usageCount: integer('usage_count').default(0).notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildTriggerUnique: uniqueIndex('message_alias_guild_trigger_unique').on(table.guildId, table.trigger),
    guildIdIdx: index('message_alias_guild_id_idx').on(table.guildId),
    guildEnabledIdx: index('message_alias_guild_enabled_idx').on(table.guildId, table.enabled),
}));

export const commandConfig = pgTable('command_config', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    commandId: text('command_id').notNull(),

    enabledRoles: text('enabled_roles').array(),
    disabledRoles: text('disabled_roles').array(),
    enabledChannels: text('enabled_channels').array(),
    disabledChannels: text('disabled_channels').array(),
    rolesCanSkipMaxLimit: text('roles_can_skip_max_limit').array(),

    maxLimit: integer('max_limit'),

    autoDeleteInvocation: boolean('auto_delete_invocation').default(false).notNull(),
    autoDeleteReplyAfterSeconds: integer('auto_delete_reply_after_seconds'),
    autoDeleteWithInvocationDeletion: boolean('auto_delete_with_invocation_deletion').default(false).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildCommandUnique: uniqueIndex('command_config_guild_command_unique').on(table.guildId, table.commandId),
    guildIdIdx: index('command_config_guild_id_idx').on(table.guildId),
}));

export const moduleState = pgTable('module_state', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    moduleId: text('module_id').notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    updatedBy: text('updated_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildModuleUnique: uniqueIndex('module_state_guild_module_unique').on(table.guildId, table.moduleId),
    guildIdIdx: index('module_state_guild_id_idx').on(table.guildId),
}));

export type GuildConfig = typeof guildConfig.$inferSelect;
export type NewGuildConfig = typeof guildConfig.$inferInsert;

export type WelcomeTrigger = typeof welcomeTrigger.$inferSelect;
export type NewWelcomeTrigger = typeof welcomeTrigger.$inferInsert;

export type MessageTemplate = typeof messageTemplate.$inferSelect;
export type NewMessageTemplate = typeof messageTemplate.$inferInsert;

export type UserJoin = typeof userJoin.$inferSelect;
export type NewUserJoin = typeof userJoin.$inferInsert;

export type VerificationMessageRule = typeof verificationMessageRule.$inferSelect;
export type NewVerificationMessageRule = typeof verificationMessageRule.$inferInsert;
export type VerificationRoleMessage = typeof verificationRoleMessage.$inferSelect;
export type NewVerificationRoleMessage = typeof verificationRoleMessage.$inferInsert;

export type UserBoost = typeof userBoost.$inferSelect;
export type NewUserBoost = typeof userBoost.$inferInsert;

export type LevelProfile = typeof levelProfile.$inferSelect;
export type NewLevelProfile = typeof levelProfile.$inferInsert;

export type GuildGrowth = typeof guildGrowth.$inferSelect;
export type NewGuildGrowth = typeof guildGrowth.$inferInsert;

export type DiscordUserCache = typeof discordUserCache.$inferSelect;
export type NewDiscordUserCache = typeof discordUserCache.$inferInsert;

export type ScheduledRoleAction = typeof scheduledRoleAction.$inferSelect;
export type NewScheduledRoleAction = typeof scheduledRoleAction.$inferInsert;

export type RoleAction = typeof roleAction.$inferSelect;
export type NewRoleAction = typeof roleAction.$inferInsert;

export type ActionLog = typeof actionLog.$inferSelect;
export type NewActionLog = typeof actionLog.$inferInsert;

export type NotificationEvent = typeof notificationEvent.$inferSelect;
export type NewNotificationEvent = typeof notificationEvent.$inferInsert;

export type NotificationUserState = typeof notificationUserState.$inferSelect;
export type NewNotificationUserState = typeof notificationUserState.$inferInsert;

export type NotificationUserCursor = typeof notificationUserCursor.$inferSelect;
export type NewNotificationUserCursor = typeof notificationUserCursor.$inferInsert;

export type NotificationPreference = typeof notificationPreference.$inferSelect;
export type NewNotificationPreference = typeof notificationPreference.$inferInsert;

export type NotificationDelivery = typeof notificationDelivery.$inferSelect;
export type NewNotificationDelivery = typeof notificationDelivery.$inferInsert;

export type MessageActivity = typeof messageActivity.$inferSelect;
export type NewMessageActivity = typeof messageActivity.$inferInsert;

export type ModerationCase = typeof moderationCase.$inferSelect;
export type NewModerationCase = typeof moderationCase.$inferInsert;

export type ModerationSettings = typeof moderationSettings.$inferSelect;
export type NewModerationSettings = typeof moderationSettings.$inferInsert;

export type MemberWatchlist = typeof memberWatchlist.$inferSelect;
export type NewMemberWatchlist = typeof memberWatchlist.$inferInsert;

export type BirthdayConfig = typeof birthdayConfig.$inferSelect;
export type NewBirthdayConfig = typeof birthdayConfig.$inferInsert;

export type BirthdayEntry = typeof birthdayEntry.$inferSelect;
export type NewBirthdayEntry = typeof birthdayEntry.$inferInsert;

export type BirthdayLog = typeof birthdayLog.$inferSelect;
export type NewBirthdayLog = typeof birthdayLog.$inferInsert;

export type MessageAlias = typeof messageAlias.$inferSelect;
export type NewMessageAlias = typeof messageAlias.$inferInsert;

export type CommandConfig = typeof commandConfig.$inferSelect;
export type NewCommandConfig = typeof commandConfig.$inferInsert;

export type ModuleState = typeof moduleState.$inferSelect;
export type NewModuleState = typeof moduleState.$inferInsert;

export type WelcomeConfig = typeof welcomeConfig.$inferSelect;
export type NewWelcomeConfig = typeof welcomeConfig.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT MANAGEMENT TABLES
// ═══════════════════════════════════════════════════════════════════════════════

export const event = pgTable('event', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    creatorId: text('creator_id').notNull(),
    messageId: text('message_id'),
    channelId: text('channel_id').notNull(),
    
    // Event details
    title: text('title').notNull(),
    description: text('description'),
    location: text('location'),
    locationChannelId: text('location_channel_id'),
    imageUrl: text('image_url'),
    color: text('color'),
    
    // Timing
    startTime: timestamp('start_time', { withTimezone: true, mode: 'date' }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true, mode: 'date' }),
    durationMinutes: integer('duration_minutes'),
    
    // Status and visibility
    status: eventStatusEnum('status').default('SCHEDULED').notNull(),
    
    // RSVP settings
    maxAttendees: integer('max_attendees'),
    enableWaitlist: boolean('enable_waitlist').default(false).notNull(),
    closeRsvpBeforeStartMinutes: integer('close_rsvp_before_start_minutes'),
    
    // Mentions
    mentionRoleIds: text('mention_role_ids').array(),
    mentionOnCreate: boolean('mention_on_create').default(false).notNull(),
    mentionOnStart: boolean('mention_on_start').default(false).notNull(),
    
    // Role restrictions
    requiredRoleIds: text('required_role_ids').array(),
    blockedRoleIds: text('blocked_role_ids').array(),
    
    // Auto-assign roles
    attendeeRoleId: text('attendee_role_id'),
    
    // Repeating events
    repeatFrequency: repeatFrequencyEnum('repeat_frequency').default('NONE').notNull(),
    repeatUntil: timestamp('repeat_until', { withTimezone: true, mode: 'date' }),
    parentEventId: uuid('parent_event_id'),
    
    // Discord Scheduled Event mirroring
    mirrorToDiscord: boolean('mirror_to_discord').default(true).notNull(),
    discordScheduledEventId: text('discord_scheduled_event_id'),
    
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildIdIdx: index('event_guild_id_idx').on(table.guildId),
    guildStartTimeIdx: index('event_guild_start_time_idx').on(table.guildId, table.startTime),
    guildStatusIdx: index('event_guild_status_idx').on(table.guildId, table.status),
    startTimeIdx: index('event_start_time_idx').on(table.startTime),
    statusStartTimeIdx: index('event_status_start_time_idx').on(table.status, table.startTime),
}));

export const eventRsvp = pgTable('event_rsvp', {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id').notNull().references(() => event.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    status: rsvpStatusEnum('status').default('YES').notNull(),
    respondedAt: timestamp('responded_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    eventUserUnique: uniqueIndex('event_rsvp_event_user_unique').on(table.eventId, table.userId),
    eventIdIdx: index('event_rsvp_event_id_idx').on(table.eventId),
    userIdIdx: index('event_rsvp_user_id_idx').on(table.userId),
    statusIdx: index('event_rsvp_status_idx').on(table.status),
}));

export const eventReminder = pgTable('event_reminder', {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id').notNull().references(() => event.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    minutesBefore: integer('minutes_before').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    eventUserMinutesUnique: uniqueIndex('event_reminder_event_user_minutes_unique').on(table.eventId, table.userId, table.minutesBefore),
    eventIdIdx: index('event_reminder_event_id_idx').on(table.eventId),
    userIdIdx: index('event_reminder_user_id_idx').on(table.userId),
    sentAtIdx: index('event_reminder_sent_at_idx').on(table.sentAt),
}));

export const eventTemplate = pgTable('event_template', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    creatorId: text('creator_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    title: text('title'),
    location: text('location'),
    defaultColor: text('default_color'),
    durationMinutes: integer('duration_minutes'),
    maxAttendees: integer('max_attendees'),
    enableWaitlist: boolean('enable_waitlist').default(false).notNull(),
    mentionRoleIds: text('mention_role_ids').array(),
    requiredRoleIds: text('required_role_ids').array(),
    blockedRoleIds: text('blocked_role_ids').array(),
    attendeeRoleId: text('attendee_role_id'),
    imageUrl: text('image_url'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildNameUnique: uniqueIndex('event_template_guild_name_unique').on(table.guildId, table.name),
    guildIdIdx: index('event_template_guild_id_idx').on(table.guildId),
}));

export const userTimezone = pgTable('user_timezone', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').unique().notNull(),
    timezone: text('timezone').default('UTC').notNull(),
    detectedAutomatically: boolean('detected_automatically').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIdIdx: index('user_timezone_user_id_idx').on(table.userId),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// POLLING TABLES
// ═══════════════════════════════════════════════════════════════════════════════

export const poll = pgTable('poll', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    creatorId: text('creator_id').notNull(),
    messageId: text('message_id'),
    channelId: text('channel_id').notNull(),
    
    // Poll details
    question: text('question').notNull(),
    description: text('description'),
    color: text('color'), // Custom embed color
    
    // Poll type and settings
    type: pollTypeEnum('type').default('STANDARD').notNull(),
    allowMultipleVotes: boolean('allow_multiple_votes').default(false).notNull(),
    maxVotesPerUser: integer('max_votes_per_user'),
    allowCustomOptions: boolean('allow_custom_options').default(false).notNull(),
    
    // Role restrictions
    allowedRoleIds: text('allowed_role_ids').array(),
    
    // Mentions
    mentionRoleIds: text('mention_role_ids').array(),
    mentionOnCreate: boolean('mention_on_create').default(false).notNull(),
    
    // End settings
    endTime: timestamp('end_time', { withTimezone: true, mode: 'date' }),
    closed: boolean('closed').default(false).notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true, mode: 'date' }),
    
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildIdIdx: index('poll_guild_id_idx').on(table.guildId),
    guildClosedIdx: index('poll_guild_closed_idx').on(table.guildId, table.closed),
    endTimeIdx: index('poll_end_time_idx').on(table.endTime),
}));

export const pollOption = pgTable('poll_option', {
    id: uuid('id').defaultRandom().primaryKey(),
    pollId: uuid('poll_id').notNull().references(() => poll.id, { onDelete: 'cascade' }),
    order: integer('order').default(0).notNull(),
    text: text('text').notNull(),
    emoji: text('emoji'),
    
    // For time polls - store the actual date/time
    dateTimeValue: timestamp('date_time_value', { withTimezone: true, mode: 'date' }),
    
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    pollOrderUnique: uniqueIndex('poll_option_poll_order_unique').on(table.pollId, table.order),
    pollIdIdx: index('poll_option_poll_id_idx').on(table.pollId),
}));

export const pollVote = pgTable('poll_vote', {
    id: uuid('id').defaultRandom().primaryKey(),
    pollId: uuid('poll_id').notNull().references(() => poll.id, { onDelete: 'cascade' }),
    optionId: uuid('option_id').notNull().references(() => pollOption.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    votedAt: timestamp('voted_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    pollUserOptionUnique: uniqueIndex('poll_vote_poll_user_option_unique').on(table.pollId, table.userId, table.optionId),
    pollIdIdx: index('poll_vote_poll_id_idx').on(table.pollId),
    optionIdIdx: index('poll_vote_option_id_idx').on(table.optionId),
    userIdIdx: index('poll_vote_user_id_idx').on(table.userId),
}));

export const pollTemplate = pgTable('poll_template', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    creatorId: text('creator_id').notNull(),
    
    name: text('name').notNull(),
    description: text('description'),
    
    // Template content
    question: text('question'),
    pollDescription: text('poll_description'),
    type: pollTypeEnum('type').default('STANDARD').notNull(),
    allowMultipleVotes: boolean('allow_multiple_votes').default(false).notNull(),
    maxVotesPerUser: integer('max_votes_per_user'),
    allowCustomOptions: boolean('allow_custom_options').default(false).notNull(),
    defaultOptions: text('default_options').array(),
    
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildIdIdx: index('poll_template_guild_id_idx').on(table.guildId),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT/POLL SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

export const eventPollSettings = pgTable('event_poll_settings', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    
    // Default channels
    defaultEventChannelId: text('default_event_channel_id'),
    defaultPollChannelId: text('default_poll_channel_id'),
    
    // Default behaviors
    defaultMentionOnCreate: boolean('default_mention_on_create').default(false).notNull(),
    defaultMentionOnStart: boolean('default_mention_on_start').default(false).notNull(),
    
    // Permissions
    allowedEventCreators: text('allowed_event_creators').array(), // Role IDs
    allowedPollCreators: text('allowed_poll_creators').array(), // Role IDs
    
    // Timezone
    serverTimezone: text('server_timezone').default('UTC').notNull(),
    
    // AI Settings
    aiEnabled: boolean('ai_enabled').default(true).notNull(),
    aiRateLimitPerHour: integer('ai_rate_limit_per_hour').default(10).notNull(),
    
    // Discord Integration
    mirrorToDiscordEvents: boolean('mirror_to_discord_events').default(true).notNull(),
    
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildIdUnique: uniqueIndex('event_poll_settings_guild_unique').on(table.guildId),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK & API TABLES
// ═══════════════════════════════════════════════════════════════════════════════

export const webhookEndpoint = pgTable('webhook_endpoint', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    
    // Webhook configuration
    name: text('name').notNull(),
    url: text('url').notNull(),
    secret: text('secret'), // HMAC-SHA256 secret for signature verification
    
    // Event subscriptions (array of event types like 'event.created', 'rsvp.yes', etc.)
    eventTypes: text('event_types').array().notNull(),
    
    // Status
    enabled: boolean('enabled').default(true).notNull(),
    
    // Health tracking
    failureCount: integer('failure_count').default(0).notNull(),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true, mode: 'date' }),
    lastFailureAt: timestamp('last_failure_at', { withTimezone: true, mode: 'date' }),
    
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildIdIdx: index('webhook_endpoint_guild_id_idx').on(table.guildId),
    guildEnabledIdx: index('webhook_endpoint_guild_enabled_idx').on(table.guildId, table.enabled),
}));

export const webhookDelivery = pgTable('webhook_delivery', {
    id: uuid('id').defaultRandom().primaryKey(),
    webhookId: uuid('webhook_id').notNull().references(() => webhookEndpoint.id, { onDelete: 'cascade' }),
    
    // Delivery details
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    
    // Request/response tracking
    requestStartedAt: timestamp('request_started_at', { withTimezone: true, mode: 'date' }),
    requestCompletedAt: timestamp('request_completed_at', { withTimezone: true, mode: 'date' }),
    statusCode: integer('status_code'),
    responseBody: text('response_body'),
    
    // Result
    success: boolean('success').default(false).notNull(),
    error: text('error'),
    
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    webhookIdIdx: index('webhook_delivery_webhook_id_idx').on(table.webhookId),
    createdAtIdx: index('webhook_delivery_created_at_idx').on(table.createdAt),
}));

export const apiKey = pgTable('api_key', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    
    // Key details
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull(), // SHA-256 hash of the key
    
    // Permissions
    permissions: text('permissions').array().notNull(), // e.g., ['events:read', 'polls:write']
    
    // Usage tracking
    createdBy: text('created_by').notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'date' }),
    useCount: integer('use_count').default(0).notNull(),
    
    // Expiration
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
    
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildIdIdx: index('api_key_guild_id_idx').on(table.guildId),
    keyHashIdx: index('api_key_key_hash_idx').on(table.keyHash),
}));



// ═══════════════════════════════════════════════════════════════════════════════
// RBAC (Role-Based Access Control) for Dashboard
// ═══════════════════════════════════════════════════════════════════════════════

export const rbacDefaultAccessEnum = pgEnum('rbac_default_access', ['manage_guild_only', 'deny']);

export const dashboardRbacConfig = pgTable('dashboard_rbac_config', {
    guildId: text('guild_id').primaryKey(),
    enabled: boolean('enabled').default(false).notNull(),
    defaultAccess: rbacDefaultAccessEnum('default_access').default('manage_guild_only').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
});

export const dashboardRbacRules = pgTable('dashboard_rbac_rules', {
    guildId: text('guild_id').notNull().references(() => dashboardRbacConfig.guildId, { onDelete: 'cascade' }),
    moduleId: text('module_id').notNull(),
    allowedViewRoles: jsonb('allowed_view_roles').$type<string[]>().default([]).notNull(),
    allowedEditRoles: jsonb('allowed_edit_roles').$type<string[]>().default([]).notNull(),
}, (table) => ({
    pk: primaryKey({ columns: [table.guildId, table.moduleId] }),
    guildIdIdx: index('dashboard_rbac_rules_guild_id_idx').on(table.guildId),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export type Event = typeof event.$inferSelect;
export type NewEvent = typeof event.$inferInsert;

export type EventRsvp = typeof eventRsvp.$inferSelect;
export type NewEventRsvp = typeof eventRsvp.$inferInsert;

export type EventReminder = typeof eventReminder.$inferSelect;
export type NewEventReminder = typeof eventReminder.$inferInsert;

export type EventTemplate = typeof eventTemplate.$inferSelect;
export type NewEventTemplate = typeof eventTemplate.$inferInsert;

export type UserTimezone = typeof userTimezone.$inferSelect;
export type NewUserTimezone = typeof userTimezone.$inferInsert;

export type Poll = typeof poll.$inferSelect;
export type NewPoll = typeof poll.$inferInsert;

export type PollOption = typeof pollOption.$inferSelect;
export type NewPollOption = typeof pollOption.$inferInsert;

export type PollVote = typeof pollVote.$inferSelect;
export type NewPollVote = typeof pollVote.$inferInsert;

export type EventPollSettings = typeof eventPollSettings.$inferSelect;
export type NewEventPollSettings = typeof eventPollSettings.$inferInsert;

export type WebhookEndpoint = typeof webhookEndpoint.$inferSelect;
export type NewWebhookEndpoint = typeof webhookEndpoint.$inferInsert;

export type WebhookDelivery = typeof webhookDelivery.$inferSelect;
export type NewWebhookDelivery = typeof webhookDelivery.$inferInsert;

export type ApiKey = typeof apiKey.$inferSelect;
export type NewApiKey = typeof apiKey.$inferInsert;

export type DashboardRbacConfig = typeof dashboardRbacConfig.$inferSelect;
export type NewDashboardRbacConfig = typeof dashboardRbacConfig.$inferInsert;

export type DashboardRbacRule = typeof dashboardRbacRules.$inferSelect;
export type NewDashboardRbacRule = typeof dashboardRbacRules.$inferInsert;
