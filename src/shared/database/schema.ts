import { relations } from 'drizzle-orm';
import {
    boolean,
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from 'drizzle-orm/pg-core';

export const roleActionTriggerEnum = pgEnum('role_action_trigger', ['ADD', 'REMOVE']);
export const roleActionTypeEnum = pgEnum('role_action_type', ['DM', 'KICK', 'LOG', 'MSG', 'MESSAGE']);
export const reactionRoleTypeEnum = pgEnum('reaction_role_type', ['TOGGLE', 'ADD_ONLY', 'REMOVE_ONLY', 'UNIQUE']);
export const scheduledRoleActionStatusEnum = pgEnum('scheduled_role_action_status', [
    'PENDING',
    'PROCESSING',
    'DONE',
    'FAILED',
    'CANCELLED',
]);

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
    message: text('message').notNull(),
    messageEmbed: jsonb('message_embed'),
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
    message: text('message').notNull(),
    messageEmbed: jsonb('message_embed'),
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

export const reactionRoleMessage = pgTable('reaction_role_message', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    messageId: text('message_id'),
    channelId: text('channel_id').notNull(),
    title: text('title'),
    content: text('content'),
    embed: jsonb('embed'),
    color: integer('color'),
    enabled: boolean('enabled').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildIdIdx: index('reaction_role_message_guild_id_idx').on(table.guildId),
    messageIdIdx: index('reaction_role_message_message_id_idx').on(table.messageId),
}));

export const reactionRole = pgTable('reaction_role', {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: text('guild_id').notNull().references(() => guildConfig.guildId, { onDelete: 'cascade' }),
    reactionRoleMessageId: uuid('reaction_role_message_id').references(() => reactionRoleMessage.id, { onDelete: 'cascade' }),
    messageId: text('message_id').notNull(),
    channelId: text('channel_id').notNull(),
    emoji: text('emoji').notNull(),
    roleId: text('role_id').notNull(),
    type: reactionRoleTypeEnum('type').default('TOGGLE').notNull(),
    exclusiveRoleIds: text('exclusive_role_ids').array(),
    description: text('description'),
    enabled: boolean('enabled').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    guildMessageIdx: index('reaction_role_guild_message_idx').on(table.guildId, table.messageId),
    messageEmojiUnique: uniqueIndex('reaction_role_message_emoji_unique').on(table.messageId, table.emoji),
    guildIdIdx: index('reaction_role_guild_id_idx').on(table.guildId),
    reactionRoleMessageIdx: index('reaction_role_reaction_role_message_idx').on(table.reactionRoleMessageId),
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
