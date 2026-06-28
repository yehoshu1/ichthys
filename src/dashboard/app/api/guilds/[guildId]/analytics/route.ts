import { NextRequest, NextResponse } from "next/server";
import { db } from "@shared/database/client";
import { guildConfig, userJoin, actionLog, levelProfile, messageActivity, guildGrowth, moderationCase, event, poll, birthdayEntry } from "@shared/database/schema";
import { sql, eq, and, gt, lt, desc, gte, asc, isNotNull } from "drizzle-orm";
import { requireGuildManageAccess } from "@/lib/guild-auth";
import { getDiscordUsers } from "@/lib/discord-user-cache";
import logger from "@/lib/logger";

const ANALYTICS_CACHE_TTL_MS = 45_000;
const analyticsCache = new Map<string, { payload: unknown; expiresAt: number }>();

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const guildId = params.guildId;

    const auth = await requireGuildManageAccess(guildId, req);
    if ("response" in auth) return auth.response;

    const cached = analyticsCache.get(guildId);
    if (cached && cached.expiresAt > Date.now()) {
        return NextResponse.json(cached.payload);
    }

    let memberCount = 0;
    let boostCount = 0;

    try {
        const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}?with_counts=true`, {
            headers: {
                Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
            },
            cache: "no-store",
        });

        if (res.ok) {
            const data = await res.json();
            memberCount = data.approximate_member_count || 0;
            boostCount = data.premium_subscription_count || 0;
        }
    } catch (error) {
        logger.error("Failed to fetch Discord guild info", { error: error instanceof Error ? error.message : String(error), guildId });
    }

    try {
        const configResult = await db
            .select({
                levelingEnabled: guildConfig.levelingEnabled,
            })
            .from(guildConfig)
            .where(eq(guildConfig.guildId, guildId));

        const levelingEnabled = configResult[0]?.levelingEnabled || false;

        const dbMemberCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(userJoin)
            .where(and(eq(userJoin.guildId, guildId), eq(userJoin.isBot, false)));

        if (memberCount === 0) {
            memberCount = dbMemberCount[0]?.count || 0;
        }

        const dbVerified = await db
            .select({ count: sql<number>`count(*)` })
            .from(userJoin)
            .where(and(eq(userJoin.guildId, guildId), eq(userJoin.isVerified, true), eq(userJoin.isBot, false)));
        const verifiedCount = dbVerified[0]?.count || 0;

        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const actionsCountResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(actionLog)
            .where(and(eq(actionLog.guildId, guildId), gt(actionLog.executedAt, yesterday)));
        const actionsToday = actionsCountResult[0]?.count || 0;

        const voiceStats = await db
            .select({ minutes: sql<number>`sum(${levelProfile.totalVoiceMinutes})` })
            .from(levelProfile)
            .where(eq(levelProfile.guildId, guildId));
        const totalVoiceHours = Math.round((voiceStats[0]?.minutes || 0) / 60);

        const heatmapData = await db
            .select({
                day: messageActivity.day,
                hour: messageActivity.hour,
                count: sql<number>`sum(${messageActivity.messageCount})`,
            })
            .from(messageActivity)
            .where(and(eq(messageActivity.guildId, guildId), gte(messageActivity.date, sevenDaysAgo)))
            .groupBy(messageActivity.day, messageActivity.hour);

        const dbLeaderboard = await db
            .select({
                userId: levelProfile.userId,
                xp: levelProfile.totalXp,
                level: levelProfile.level,
            })
            .from(levelProfile)
            .where(eq(levelProfile.guildId, guildId))
            .orderBy(desc(levelProfile.totalXp))
            .limit(5);

        const users = await getDiscordUsers(dbLeaderboard.map((user) => user.userId));
        const leaderboard = dbLeaderboard.map((user) => {
            const profile = users.get(user.userId);
            return {
                ...user,
                username: profile?.globalName || profile?.username || `User ${user.userId.slice(0, 4)}...`,
                avatar: profile?.avatarUrl || null,
            };
        });

        const oldMemberCountRes = await db
            .select({ count: sql<number>`count(*)` })
            .from(userJoin)
            .where(and(eq(userJoin.guildId, guildId), lt(userJoin.joinedAt, sevenDaysAgo)));

        const totalUsersRes = await db
            .select({ count: sql<number>`count(*)` })
            .from(userJoin)
            .where(eq(userJoin.guildId, guildId));

        const totalUsers = totalUsersRes[0]?.count || 1;
        const retainedUsers = oldMemberCountRes[0]?.count || 0;
        const retentionRate = Math.round((retainedUsers / totalUsers) * 100);

        // Fetch growth data for the last 30 days
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const growthData = await db
            .select({
                date: guildGrowth.date,
                memberCount: guildGrowth.memberCount,
                verifiedCount: guildGrowth.verifiedCount,
                joinedToday: guildGrowth.joinedToday,
                leftToday: guildGrowth.leftToday,
            })
            .from(guildGrowth)
            .where(and(eq(guildGrowth.guildId, guildId), gte(guildGrowth.date, thirtyDaysAgo)))
            .orderBy(asc(guildGrowth.date));

        // --- NEW METRICS ---

        // 1. Moderation Cases
        const moderationCasesStats = await db
            .select({
                action: moderationCase.action,
                count: sql<number>`count(*)::int`,
            })
            .from(moderationCase)
            .where(and(eq(moderationCase.guildId, guildId), gte(moderationCase.createdAt, thirtyDaysAgo)))
            .groupBy(moderationCase.action);

        // 2. Verification Funnel
        const recentJoinsResult = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(userJoin)
            .where(and(eq(userJoin.guildId, guildId), gte(userJoin.joinedAt, thirtyDaysAgo), eq(userJoin.isBot, false)));
        const joinedLast30Days = recentJoinsResult[0]?.count || 0;

        const recentVerifiedResult = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(userJoin)
            .where(and(
                eq(userJoin.guildId, guildId),
                gte(userJoin.joinedAt, thirtyDaysAgo),
                eq(userJoin.isVerified, true),
                eq(userJoin.isBot, false)
            ));
        const verifiedLast30Days = recentVerifiedResult[0]?.count || 0;

        const avgVerifyTimeResult = await db
            .select({ avgHours: sql<number>`extract(epoch from avg(${userJoin.verifiedAt} - ${userJoin.joinedAt})) / 3600` })
            .from(userJoin)
            .where(and(
                eq(userJoin.guildId, guildId),
                eq(userJoin.isVerified, true),
                isNotNull(userJoin.verifiedAt)
            ));
        const avgVerifyHours = Math.round((avgVerifyTimeResult[0]?.avgHours || 0) * 10) / 10;

        // 3. Events and Polls
        const eventsResult = await db.select({ count: sql<number>`count(*)::int` })
            .from(event).where(and(eq(event.guildId, guildId), gte(event.startTime, thirtyDaysAgo)));
        const eventsThisMonth = eventsResult[0]?.count || 0;

        const pollsResult = await db.select({ count: sql<number>`count(*)::int` })
            .from(poll).where(and(eq(poll.guildId, guildId), gte(poll.createdAt, thirtyDaysAgo)));
        const pollsThisMonth = pollsResult[0]?.count || 0;

        // 4. Birthdays
        const currentMonth = now.getMonth() + 1; // 1-12
        const birthdaysResult = await db.select({ count: sql<number>`count(*)::int` })
            .from(birthdayEntry).where(and(eq(birthdayEntry.guildId, guildId), eq(birthdayEntry.month, currentMonth)));
        const birthdaysThisMonth = birthdaysResult[0]?.count || 0;

        // 5. Action Reliability
        const actionLogStats = await db.select({
            success: actionLog.success,
            count: sql<number>`count(*)::int`
        })
        .from(actionLog)
        .where(and(eq(actionLog.guildId, guildId), gte(actionLog.executedAt, sevenDaysAgo)))
        .groupBy(actionLog.success);

        let successfulActions = 0;
        let failedActions = 0;
        actionLogStats.forEach(stat => {
            if (stat.success) successfulActions += stat.count;
            else failedActions += stat.count;
        });
        const actionSuccessRate = (successfulActions + failedActions) > 0 
            ? Math.round((successfulActions / (successfulActions + failedActions)) * 100) 
            : 100;

        const payload = {
            stats: {
                members: memberCount,
                verified: verifiedCount,
                boosts: boostCount,
                actionsToday,
                levelingEnabled,
                voiceHours: totalVoiceHours,
                retentionRate,
                eventsThisMonth,
                pollsThisMonth,
                birthdaysThisMonth,
                actionSuccessRate,
                avgVerifyHours,
            },
            heatmap: heatmapData,
            leaderboard,
            growth: growthData,
            moderationStats: moderationCasesStats,
            verificationStats: {
                joinedLast30Days,
                verifiedLast30Days
            }
        };

        analyticsCache.set(guildId, {
            payload,
            expiresAt: Date.now() + ANALYTICS_CACHE_TTL_MS,
        });

        return NextResponse.json(payload);
    } catch (error) {
        logger.error("Database analytics query failed", { error: error instanceof Error ? error.message : String(error), guildId });
        return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
    }
}
