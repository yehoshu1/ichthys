import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql, relations } from 'drizzle-orm';

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
    roleId: text('role_id').notNull(),
    message: text('message').notNull(),
    messageEmbed: text('message_embed', { mode: 'json' }), // JSON Embed config
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
    guildRoleUnique: uniqueIndex('verification_message_rule_guild_role_unique').on(table.guildId, table.roleId),
    guildIdIdx: index('verification_message_rule_guild_id_idx').on(table.guildId),
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
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
    guildUserIdx: uniqueIndex('user_boost_guild_user_unique').on(table.guildId, table.userId),
    guildEndsIdx: index('user_boost_guild_ends_idx').on(table.guildId, table.boostEndsAt),
    guildRemovedIdx: index('user_boost_guild_removed_idx').on(table.guildId, table.roleRemoved),
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

export type UserBoost = typeof userBoost.$inferSelect;
export type NewUserBoost = typeof userBoost.$inferInsert;

export type LevelProfile = typeof levelProfile.$inferSelect;
export type NewLevelProfile = typeof levelProfile.$inferInsert;

export type RoleAction = typeof roleAction.$inferSelect;
export type NewRoleAction = typeof roleAction.$inferInsert;

export type ActionLog = typeof actionLog.$inferSelect;
export type NewActionLog = typeof actionLog.$inferInsert;

export type MessageActivity = typeof messageActivity.$inferSelect;
export type NewMessageActivity = typeof messageActivity.$inferInsert;
