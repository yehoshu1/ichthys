import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ====================
// GUILD CONFIGURATION
// ====================

export const guildConfig = sqliteTable('guild_config', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    guildId: text('guild_id').unique().notNull(),

    // Welcome settings
    welcomeEnabled: integer('welcome_enabled', { mode: 'boolean' }).default(false).notNull(),
    autoRoleId: text('auto_role_id'), // Auto-assign this role on join
    joinMessageChannelId: text('join_message_channel_id'), // Channel for join messages  
    joinMessage: text('join_message'), // Message template for joins
    joinMessageEmbed: text('join_message_embed', { mode: 'json' }), // JSON Embed config
    leaveMessageChannelId: text('leave_message_channel_id'), // Channel for leave messages
    leaveMessage: text('leave_message'), // Message template for leaves
    leaveMessageEmbed: text('leave_message_embed', { mode: 'json' }), // JSON Embed config

    // Verification settings
    verificationEnabled: integer('verification_enabled', { mode: 'boolean' }).default(false).notNull(),
    unverifiedRoleId: text('unverified_role_id'), // Role assigned to unverified users
    verificationRoleId: text('verification_role_id'),
    verificationGraceDays: integer('verification_grace_days').default(30).notNull(),
    verificationKickDmEnabled: integer('verification_kick_dm_enabled', { mode: 'boolean' }).default(true).notNull(),
    verificationMessage: text('verification_message'), // Custom message on verification
    verificationMessageEmbed: text('verification_message_embed', { mode: 'json' }), // JSON Embed config

    // Analytics Sync
    lastMemberSync: integer('last_member_sync', { mode: 'timestamp' }), // Timestamp of last full member fetch

    // Boost settings
    boostEnabled: integer('boost_enabled', { mode: 'boolean' }).default(false).notNull(),
    boostAnnouncementChannelId: text('boost_announcement_channel_id'),
    boostRoleId: text('boost_role_id'),
    boostRoleName: text('boost_role_name'),
    boostRoleColorPrimary: text('boost_role_color_primary'),
    boostRoleColorSecondary: text('boost_role_color_secondary'),
    boostClaimRequired: integer('boost_claim_required', { mode: 'boolean' }).default(true).notNull(),
    boostWelcomeMessage: text('boost_welcome_message'),
    boostWelcomeMessageEmbed: text('boost_welcome_message_embed', { mode: 'json' }),
    boostReBoostMessage: text('boost_re_boost_message'),
    boostReBoostMessageEmbed: text('boost_re_boost_message_embed', { mode: 'json' }),
    boostRoleRemovalDays: integer('boost_role_removal_days').default(30).notNull(),
    boostRoleRemovalDmEnabled: integer('boost_role_removal_dm_enabled', { mode: 'boolean' }).default(true).notNull(),

    // Leveling settings
    levelingEnabled: integer('leveling_enabled', { mode: 'boolean' }).default(false).notNull(),
    textXpMin: integer('text_xp_min').default(15).notNull(),
    textXpMax: integer('text_xp_max').default(25).notNull(),
    textXpCooldown: integer('text_xp_cooldown').default(60).notNull(),
    voiceXpPerMinute: integer('voice_xp_per_minute').default(10).notNull(),
    levelUpNotifEnabled: integer('level_up_notif_enabled', { mode: 'boolean' }).default(true).notNull(),
    levelUpChannelId: text('level_up_channel_id'),
    levelUpMessage: text('level_up_message'), // Custom level up message template
    levelUpMessageEmbed: text('level_up_message_embed', { mode: 'json' }),

    // Dashboard URL
    dashboardUrl: text('dashboard_url'), // Custom dashboard URL for this server

    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});

// ====================
// WELCOME SYSTEM
// ====================

export const welcomeTrigger = sqliteTable('welcome_trigger', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    roleId: text('role_id').notNull(),
    channelId: text('channel_id'),
    templateId: text('template_id').notNull().references(() => messageTemplate.id, { onDelete: 'cascade' }),
    enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
    guildIdIdx: index('welcome_trigger_guild_id_idx').on(table.guildId),
    uniqueGuildRole: index('welcome_trigger_guild_role_unique').on(table.guildId, table.roleId),
}));

export const messageTemplate = sqliteTable('message_template', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    guildId: text('guild_id').notNull(),
    name: text('name').notNull(),
    content: text('content').notNull(),
    embedEnabled: integer('embed_enabled', { mode: 'boolean' }).default(false).notNull(),
    embedTitle: text('embed_title'),
    embedDescription: text('embed_description'),
    embedColor: text('embed_color'),
    embedThumbnail: integer('embed_thumbnail', { mode: 'boolean' }).default(false).notNull(),
    embedData: text('embed_data', { mode: 'json' }), // New standardized JSON structure
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
    guildIdIdx: index('message_template_guild_id_idx').on(table.guildId),
}));

// ====================
// VERIFICATION TRACKING
// ====================

export const userJoin = sqliteTable('user_join', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    joinedAt: integer('joined_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    verifiedAt: integer('verified_at', { mode: 'timestamp' }),
    isVerified: integer('is_verified', { mode: 'boolean' }).default(false).notNull(),
    isBot: integer('is_bot', { mode: 'boolean' }).default(false).notNull(),
    kickedAt: integer('kicked_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
    guildUserIdx: uniqueIndex('user_join_guild_user_unique').on(table.guildId, table.userId),
    guildVerifiedIdx: index('user_join_guild_verified_idx').on(table.guildId, table.isVerified),
    guildJoinedIdx: index('user_join_guild_joined_idx').on(table.guildId, table.joinedAt),
}));

export const verificationMessageRule = sqliteTable('verification_message_rule', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    name: text('name'),
    roleId: text('role_id').notNull(),
    notifyChannelId: text('notify_channel_id'),
    message: text('message').notNull(),
    messageEmbed: text('message_embed', { mode: 'json' }), // JSON Embed config
    enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
    guildRoleUnique: uniqueIndex('verification_message_rule_guild_role_unique').on(table.guildId, table.roleId),
    guildIdIdx: index('verification_message_rule_guild_id_idx').on(table.guildId),
}));

export const verificationRoleMessage = sqliteTable('verification_role_message', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    roleId: text('role_id').notNull(),
    message: text('message').notNull(),
    messageEmbed: text('message_embed', { mode: 'json' }),
    enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
    guildRoleUnique: uniqueIndex('verification_role_message_guild_role_unique').on(table.guildId, table.roleId),
    guildIdIdx: index('verification_role_message_guild_id_idx').on(table.guildId),
}));

// ====================
// BOOST MANAGEMENT
// ====================

export const userBoost = sqliteTable('user_boost', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    boostedAt: integer('boosted_at', { mode: 'timestamp' }).notNull(),
    boostEndsAt: integer('boost_ends_at', { mode: 'timestamp' }).notNull(),
    roleAssigned: integer('role_assigned', { mode: 'boolean' }).default(false).notNull(),
    roleRemoved: integer('role_removed', { mode: 'boolean' }).default(false).notNull(),
    roleRemovedAt: integer('role_removed_at', { mode: 'timestamp' }),
    notifiedBeforeRemoval: integer('notified_before_removal', { mode: 'boolean' }).default(false).notNull(),
    boostCountTotal: integer('boost_count_total').default(0).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
    guildUserIdx: uniqueIndex('user_boost_guild_user_unique').on(table.guildId, table.userId),
    guildEndsIdx: index('user_boost_guild_ends_idx').on(table.guildId, table.boostEndsAt),
    guildRemovedIdx: index('user_boost_guild_removed_idx').on(table.guildId, table.roleRemoved),
    guildRemovedBoostedIdx: index('user_boost_guild_removed_boosted_idx').on(table.guildId, table.roleRemoved, table.boostedAt),
}));

// ====================
// LEVELING SYSTEM
// ====================

export const levelProfile = sqliteTable('level_profile', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    textXp: integer('text_xp').default(0).notNull(),
    voiceXp: integer('voice_xp').default(0).notNull(),
    totalXp: integer('total_xp').default(0).notNull(),
    level: integer('level').default(0).notNull(),
    lastTextXpAt: integer('last_text_xp_at', { mode: 'timestamp' }),
    voiceJoinedAt: integer('voice_joined_at', { mode: 'timestamp' }),
    totalVoiceMinutes: integer('total_voice_minutes').default(0).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
    guildUserIdx: uniqueIndex('level_profile_guild_user_unique').on(table.guildId, table.userId),
    guildXpIdx: index('level_profile_guild_xp_idx').on(table.guildId, table.totalXp),
    guildLevelIdx: index('level_profile_guild_level_idx').on(table.guildId, table.level),
}));

export const levelReward = sqliteTable('level_reward', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    roleId: text('role_id').notNull(),
    level: integer('level').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
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



// ====================
// ROLE-BASED ACTIONS
// ====================

export const roleAction = sqliteTable('role_action', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    roleId: text('role_id').notNull(),
    actionGroup: text('action_group'), // Group ID for multiple actions
    triggerType: text('trigger_type').default('ADD').notNull(), // "ADD", "REMOVE"
    actionType: text('action_type').notNull(), // "DM", "KICK", "LOG"
    actionDelay: integer('action_delay').default(0).notNull(),
    dmMessage: text('dm_message'),
    dmMessageEmbed: text('dm_message_embed', { mode: 'json' }),
    channelId: text('channel_id'), // Target channel for message actions
    kickReason: text('kick_reason'),
    logChannelId: text('log_channel_id'),
    enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
    guildRoleIdx: index('role_action_guild_role_idx').on(table.guildId, table.roleId),
}));

export const actionLog = sqliteTable('action_log', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    actionType: text('action_type').notNull(),
    targetUserId: text('target_user_id').notNull(),
    executedAt: integer('executed_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    success: integer('success', { mode: 'boolean' }).notNull(),
    errorMessage: text('error_message'),
    metadata: text('metadata'), // JSON string
}, (table) => ({
    guildTypeIdx: index('action_log_guild_type_idx').on(table.guildId, table.actionType),
    guildExecutedIdx: index('action_log_guild_executed_idx').on(table.guildId, table.executedAt),
    guildTypeExecutedIdx: index('action_log_guild_type_executed_idx').on(table.guildId, table.actionType, table.executedAt),
}));

export const messageActivity = sqliteTable('message_activity', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    hour: integer('hour').notNull(), // 0-23
    day: integer('day').notNull(), // 0-6 (Sunday-Saturday)
    date: integer('date', { mode: 'timestamp' }).notNull(), // 2024-01-01 00:00:00 (Floor to day/hour if needed, or just day)
    messageCount: integer('message_count').default(0).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
    uniqueGuildHourDay: uniqueIndex('message_activity_guild_hour_day_date').on(table.guildId, table.date, table.hour),
    // ^ Changed to include date to separate different days. Original prompt said day (0-6) which implies weekly aggregation.
    // If we want a true heatmap of "Busiest times of week" (aggregated over time), we sum by day(0-6)/hour.
    // If we want history, we store by date.
    // Let's store by DATE+HOUR so we can do both (history + aggregate).
    guildIdIdx: index('message_activity_guild_id_idx').on(table.guildId),
    guildDateHourIdx: index('message_activity_guild_date_hour_idx').on(table.guildId, table.date, table.hour),
}));

export const guildGrowth = sqliteTable('guild_growth', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    date: integer('date', { mode: 'timestamp' }).notNull(),
    memberCount: integer('member_count').notNull(),
    verifiedCount: integer('verified_count').default(0).notNull(),
    joinedToday: integer('joined_today').default(0).notNull(),
    leftToday: integer('left_today').default(0).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
    guildDateUnique: uniqueIndex('guild_growth_guild_date_unique').on(table.guildId, table.date),
    guildIdIdx: index('guild_growth_guild_id_idx').on(table.guildId),
}));

// ====================
// MODERATION SYSTEM
// ====================

export const moderationCase = sqliteTable('moderation_case', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    caseNumber: integer('case_number').notNull(),
    userId: text('user_id').notNull(),
    moderatorId: text('moderator_id').notNull(),
    action: text('action').notNull(), // WARN, KICK, BAN, TIMEOUT, MUTE
    reason: text('reason'),
    duration: integer('duration'), // Duration in minutes (for timeouts/mutes)
    expiresAt: integer('expires_at', { mode: 'timestamp' }), // For temporary bans/timeouts
    active: integer('active', { mode: 'boolean' }).default(true).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
    guildCaseUnique: uniqueIndex('moderation_case_guild_case_unique').on(table.guildId, table.caseNumber),
    guildUserIdx: index('moderation_case_guild_user_idx').on(table.guildId, table.userId),
    guildModeratorIdx: index('moderation_case_guild_moderator_idx').on(table.guildId, table.moderatorId),
    guildActionIdx: index('moderation_case_guild_action_idx').on(table.guildId, table.action),
}));

export const moderationSettings = sqliteTable('moderation_settings', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    // Auto-moderation settings
    autoModEnabled: integer('auto_mod_enabled', { mode: 'boolean' }).default(false).notNull(),
    spamThreshold: integer('spam_threshold').default(5), // Messages per 5 seconds
    spamAction: text('spam_action').default('WARN'), // WARN, MUTE, KICK
    spamMuteDuration: integer('spam_mute_duration').default(10), // Minutes
    // Word filter
    wordFilterEnabled: integer('word_filter_enabled', { mode: 'boolean' }).default(false).notNull(),
    wordFilterList: text('word_filter_list'), // Comma-separated list
    wordFilterAction: text('word_filter_action').default('DELETE'), // DELETE, WARN, MUTE
    // Invite filter
    inviteFilterEnabled: integer('invite_filter_enabled', { mode: 'boolean' }).default(false).notNull(),
    inviteFilterAction: text('invite_filter_action').default('DELETE'),
    // Log channel
    logChannelId: text('log_channel_id'),
    // Mute role
    muteRoleId: text('mute_role_id'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
    guildIdUnique: uniqueIndex('moderation_settings_guild_unique').on(table.guildId),
}));

// ====================
// REACTION ROLES
// ====================

// Stores reaction role messages created from dashboard
export const reactionRoleMessage = sqliteTable('reaction_role_message', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    // Discord message info (populated after sending)
    messageId: text('message_id'), // Discord message ID (null until sent)
    channelId: text('channel_id').notNull(), // Target channel ID
    // Message content
    title: text('title'), // Optional title/header
    content: text('content'), // Main message content
    embed: text('embed', { mode: 'json' }), // Optional embed data
    color: integer('color'), // Embed color (default: 0x5865F2)
    // Settings
    enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
    guildIdIdx: index('reaction_role_message_guild_id_idx').on(table.guildId),
    messageIdIdx: index('reaction_role_message_message_id_idx').on(table.messageId),
}));

export const reactionRole = sqliteTable('reaction_role', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    // Can reference either a reactionRoleMessage or external message
    reactionRoleMessageId: text('reaction_role_message_id').references(() => reactionRoleMessage.id, { onDelete: 'cascade' }),
    messageId: text('message_id').notNull(), // Discord message ID
    channelId: text('channel_id').notNull(),
    emoji: text('emoji').notNull(), // Unicode emoji or custom emoji ID
    roleId: text('role_id').notNull(),
    // Behavior settings
    type: text('type').default('TOGGLE').notNull(), // TOGGLE, ADD_ONLY, REMOVE_ONLY, UNIQUE
    // For UNIQUE type - remove these roles when adding this one
    exclusiveRoleIds: text('exclusive_role_ids'), // Comma-separated role IDs
    // Message template reference (optional)
    description: text('description'),
    enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
    guildMessageIdx: index('reaction_role_guild_message_idx').on(table.guildId, table.messageId),
    messageEmojiUnique: uniqueIndex('reaction_role_message_emoji_unique').on(table.messageId, table.emoji),
    guildIdIdx: index('reaction_role_guild_id_idx').on(table.guildId),
    reactionRoleMessageIdx: index('reaction_role_reaction_role_message_idx').on(table.reactionRoleMessageId),
}));

export const discordUserCache = sqliteTable('discord_user_cache', {
    userId: text('user_id').primaryKey(),
    username: text('username').notNull(),
    globalName: text('global_name'),
    avatar: text('avatar'),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
    updatedAtIdx: index('discord_user_cache_updated_idx').on(table.updatedAt),
}));

export const scheduledRoleAction = sqliteTable('scheduled_role_action', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    actionId: text('action_id').notNull().references(() => roleAction.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    executeAt: integer('execute_at', { mode: 'timestamp' }).notNull(),
    status: text('status').default('PENDING').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    lastError: text('last_error'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
    statusExecuteIdx: index('scheduled_role_action_status_execute_idx').on(table.status, table.executeAt),
    guildStatusExecuteIdx: index('scheduled_role_action_guild_status_execute_idx').on(table.guildId, table.status, table.executeAt),
}));

// Export types
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

export type MessageActivity = typeof messageActivity.$inferSelect;
export type NewMessageActivity = typeof messageActivity.$inferInsert;

export type ModerationCase = typeof moderationCase.$inferSelect;
export type NewModerationCase = typeof moderationCase.$inferInsert;

export type ModerationSettings = typeof moderationSettings.$inferSelect;
export type NewModerationSettings = typeof moderationSettings.$inferInsert;

// ====================
// BIRTHDAY SYSTEM
// ====================

export const birthdayConfig = sqliteTable('birthday_config', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    
    // Settings
    enabled: integer('enabled', { mode: 'boolean' }).default(false).notNull(),
    channelId: text('channel_id'), // Channel for birthday messages
    roleId: text('role_id'), // Role to assign on birthday
    messageTemplate: text('message_template').default('🎉 Happy Birthday {user.mention}! 🎂').notNull(),
    messageEmbed: text('message_embed', { mode: 'json' }), // Optional embed config
    hourOfDay: integer('hour_of_day').default(9).notNull(), // 0-23, when to send message
    
    // Additional options
    showAge: integer('show_age', { mode: 'boolean' }).default(true).notNull(),
    mentionRoleId: text('mention_role_id'), // Role ID to mention ("everyone", "here", or actual role ID). Null = no mention.
    autoRemoveRole: integer('auto_remove_role', { mode: 'boolean' }).default(true).notNull(), // Remove role after birthday
    
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
    guildIdUnique: uniqueIndex('birthday_config_guild_id_unique').on(table.guildId),
    guildIdIdx: index('birthday_config_guild_id_idx').on(table.guildId),
}));

export const birthdayEntry = sqliteTable('birthday_entry', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    
    // Birthday info
    month: integer('month').notNull(), // 1-12
    day: integer('day').notNull(), // 1-31
    year: integer('year'), // Optional, for age calculation
    timezone: text('timezone').default('UTC').notNull(), // IANA timezone identifier
    
    // Tracking
    lastCelebratedYear: integer('last_celebrated_year'), // Track if already celebrated this year
    
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
    guildUserUnique: uniqueIndex('birthday_entry_guild_user_unique').on(table.guildId, table.userId),
    guildMonthDayIdx: index('birthday_entry_guild_month_day_idx').on(table.guildId, table.month, table.day),
    guildIdIdx: index('birthday_entry_guild_id_idx').on(table.guildId),
}));

export const birthdayLog = sqliteTable('birthday_log', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    celebratedAt: integer('celebrated_at', { mode: 'timestamp' }).notNull(),
    messageSent: integer('message_sent', { mode: 'boolean' }).default(false).notNull(),
    roleAssigned: integer('role_assigned', { mode: 'boolean' }).default(false).notNull(),
    errorMessage: text('error_message'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
    guildUserIdx: index('birthday_log_guild_user_idx').on(table.guildId, table.userId),
    guildCelebratedIdx: index('birthday_log_guild_celebrated_idx').on(table.guildId, table.celebratedAt),
}));

// ====================
// MESSAGE ALIASES (Auto-Responder)
// ====================

export const messageAlias = sqliteTable('message_alias', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    
    // Trigger configuration
    trigger: text('trigger').notNull(), // The alias/word that triggers the response (e.g., "!rules")
    
    // Response configuration
    response: text('response').notNull(), // The message content to send
    responseEmbed: text('response_embed', { mode: 'json' }), // Optional embed
    
    // Behavior settings
    enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
    caseSensitive: integer('case_sensitive', { mode: 'boolean' }).default(false).notNull(),
    deleteTrigger: integer('delete_trigger', { mode: 'boolean' }).default(false).notNull(), // Delete the triggering message
    requirePrefix: text('require_prefix').default('!'), // Prefix required (e.g., "!", ".", or null for any)
    allowedChannels: text('allowed_channels'), // Comma-separated channel IDs (null = all channels)
    allowedRoles: text('allowed_roles'), // Comma-separated role IDs (null = all roles)
    
    // Cooldown
    cooldownSeconds: integer('cooldown_seconds').default(5).notNull(), // Per-user cooldown
    
    // Metadata
    usageCount: integer('usage_count').default(0).notNull(),
    createdBy: text('created_by').notNull(), // User ID who created the alias
    
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
    guildTriggerUnique: uniqueIndex('message_alias_guild_trigger_unique').on(table.guildId, table.trigger),
    guildIdIdx: index('message_alias_guild_id_idx').on(table.guildId),
    guildEnabledIdx: index('message_alias_guild_enabled_idx').on(table.guildId, table.enabled),
}));

// ====================
// COMMAND CONFIGURATION
// ====================

export const commandConfig = sqliteTable('command_config', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    commandId: text('command_id').notNull(),

    enabledRoles: text('enabled_roles'),
    disabledRoles: text('disabled_roles'),
    enabledChannels: text('enabled_channels'),
    disabledChannels: text('disabled_channels'),
    rolesCanSkipMaxLimit: text('roles_can_skip_max_limit'),

    maxLimit: integer('max_limit'),

    autoDeleteInvocation: integer('auto_delete_invocation', { mode: 'boolean' }).default(false).notNull(),
    autoDeleteReplyAfterSeconds: integer('auto_delete_reply_after_seconds'),
    autoDeleteWithInvocationDeletion: integer('auto_delete_with_invocation_deletion', { mode: 'boolean' }).default(false).notNull(),

    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
    guildCommandUnique: uniqueIndex('command_config_guild_command_unique').on(table.guildId, table.commandId),
    guildIdIdx: index('command_config_guild_id_idx').on(table.guildId),
}));

// Export types
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

export type ReactionRoleMessage = typeof reactionRoleMessage.$inferSelect;
export type NewReactionRoleMessage = typeof reactionRoleMessage.$inferInsert;

export type ReactionRole = typeof reactionRole.$inferSelect;
export type NewReactionRole = typeof reactionRole.$inferInsert;
