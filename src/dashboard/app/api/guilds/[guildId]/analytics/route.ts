
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@shared/database/client";
import { guildConfig, userJoin, userBoost, actionLog, levelProfile, messageActivity } from "@shared/database/schema";
import { sql, eq, and, gt, lt, desc, inArray } from "drizzle-orm";

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const guildId = params.guildId;

    // 1. Fetch live member & boost count from Discord API
    let memberCount = 0;
    let boostCount = 0;
    try {
        const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}?with_counts=true`, {
            headers: {
                Authorization: `Bot ${process.env.DISCORD_TOKEN}`
            }
        });
        if (res.ok) {
            const data = await res.json();
            memberCount = data.approximate_member_count || 0;
            boostCount = data.premium_subscription_count || 0;
        } else {
            console.warn(`[Analytics] Failed to fetch live guild counts: ${res.status}`);
        }
    } catch (e) {
        console.error("Failed to fetch Discord guild info", e);
    }

    // 2. Database Queries
    try {
        // Guild Config
        const configResult = await db
            .select({
                levelingEnabled: guildConfig.levelingEnabled,
                verificationRoleId: guildConfig.verificationRoleId,
                lastMemberSync: guildConfig.lastMemberSync
            })
            .from(guildConfig)
            .where(eq(guildConfig.guildId, guildId));
        const levelingEnabled = configResult[0]?.levelingEnabled || false;
        const verificationRoleId = configResult[0]?.verificationRoleId;

        let verifiedCount = 0;

        // Sync Logic
        // Check if we need to backfill members (older than 24h or never synced)
        const lastSync = configResult[0]?.lastMemberSync;
        const ONE_DAY = 24 * 60 * 60 * 1000;
        const shouldSync = !lastSync || (new Date().getTime() - lastSync.getTime() > ONE_DAY);

        if (shouldSync) {
            console.log(`[Analytics] Syncing members for guild ${guildId}...`);
            try {
                // Fetch members (limit 1000)
                const membersRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`, {
                    headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }
                });

                if (membersRes.ok) {
                    const members = await membersRes.json();
                    console.log(`[Analytics] Fetched ${members.length} members.`);

                    // 1. Calculate Verified Count (Live)
                    if (verificationRoleId) {
                        const verifiedMembers = members.filter((m: any) => m.roles.includes(verificationRoleId));
                        verifiedCount = verifiedMembers.length;
                    }

                    // 2. Backfill/Upsert Join History & Verification Status
                    // Fix: Chunk the inserts to avoid SQLite parameter limits (SQLITE_MAX_VARIABLE_NUMBER)
                    const CHUNK_SIZE = 50;
                    const valuesToInsert = members.map((m: any) => ({
                        userId: m.user.id,
                        guildId: guildId,
                        joinedAt: m.joined_at ? new Date(m.joined_at) : new Date(),
                        isVerified: verificationRoleId ? m.roles.includes(verificationRoleId) : false,
                        updatedAt: new Date()
                    }));

                    if (valuesToInsert.length > 0) {
                        try {
                            for (let i = 0; i < valuesToInsert.length; i += CHUNK_SIZE) {
                                const chunk = valuesToInsert.slice(i, i + CHUNK_SIZE);
                                await db.insert(userJoin)
                                    .values(chunk)
                                    .onConflictDoUpdate({
                                        target: [userJoin.userId, userJoin.guildId],
                                        set: {
                                            isVerified: sql`excluded.is_verified`,
                                            updatedAt: new Date()
                                        }
                                    });
                            }
                            console.log(`[Analytics] Successfully upserted ${valuesToInsert.length} members in chunks.`);
                        } catch (upsertError) {
                            console.error("Upsert failed (chunked)", upsertError);
                        }
                    }

                    // 3. Update Last Sync Time
                    await db.update(guildConfig)
                        .set({ lastMemberSync: new Date() })
                        .where(eq(guildConfig.guildId, guildId));

                    // (Role Distribution Fetch Removed)

                } else {
                    console.warn(`[Analytics] Failed to fetch members: ${membersRes.status}`);
                    // Fallback to DB query
                    const dbVerified = await db
                        .select({ count: sql<number>`count(*)` })
                        .from(userJoin)
                        .where(and(eq(userJoin.guildId, guildId), eq(userJoin.isVerified, true)));
                    verifiedCount = dbVerified[0]?.count || 0;
                }
            } catch (e) {
                console.error("Error during member backfill/sync:", e);
                const dbVerified = await db
                    .select({ count: sql<number>`count(*)` })
                    .from(userJoin)
                    .where(and(eq(userJoin.guildId, guildId), eq(userJoin.isVerified, true)));
                verifiedCount = dbVerified[0]?.count || 0;
            }
        } else {
            // Skip sync, use Database
            const dbVerified = await db
                .select({ count: sql<number>`count(*)` })
                .from(userJoin)
                .where(and(eq(userJoin.guildId, guildId), eq(userJoin.isVerified, true)));
            verifiedCount = dbVerified[0]?.count || 0;
        }

        // Active Boosts Count - Using live Discord data
        const boostsCount = boostCount;

        // Actions Today (Last 24h)
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const actionsCountResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(actionLog)
            .where(and(eq(actionLog.guildId, guildId), gt(actionLog.executedAt, yesterday)));
        const actionsToday = actionsCountResult[0]?.count || 0;

        // --- NEW ANALYTICS ---

        // 1. Voice Hours (Total Sum)
        const voiceStats = await db
            .select({ minutes: sql<number>`sum(${levelProfile.totalVoiceMinutes})` })
            .from(levelProfile)
            .where(eq(levelProfile.guildId, guildId));
        const totalVoiceHours = Math.round((voiceStats[0]?.minutes || 0) / 60);

        // 2. Activity Heatmap (Last 7 Days)
        const heatmapData = await db
            .select({
                day: messageActivity.day,
                hour: messageActivity.hour,
                count: sql<number>`sum(${messageActivity.messageCount})`
            })
            .from(messageActivity)
            .where(eq(messageActivity.guildId, guildId))
            .groupBy(messageActivity.day, messageActivity.hour);

        // 3. Leaderboard (Top 5 XP)
        const dbLeaderboard = await db
            .select({
                userId: levelProfile.userId,
                xp: levelProfile.totalXp,
                level: levelProfile.level
            })
            .from(levelProfile)
            .where(eq(levelProfile.guildId, guildId))
            .orderBy(desc(levelProfile.totalXp))
            .limit(5);

        // Fetch Usernames
        const leaderboard = await Promise.all(dbLeaderboard.map(async (user) => {
            try {
                const userRes = await fetch(`https://discord.com/api/v10/users/${user.userId}`, {
                    headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }
                });
                if (userRes.ok) {
                    const discordUser = await userRes.json();
                    return { ...user, username: discordUser.username, avatar: discordUser.avatar };
                }
            } catch (e) {
                console.error(`Failed to fetch user ${user.userId}`, e);
            }
            return { ...user, username: `User ${user.userId.slice(0, 4)}...`, avatar: null };
        }));

        // (Growth Data Aggregation Removed)

        // Retention Rate
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oldMemberCountRes = await db.select({ count: sql<number>`count(*)` })
            .from(userJoin)
            .where(and(eq(userJoin.guildId, guildId), lt(userJoin.joinedAt, sevenDaysAgo)));

        const totalUsersRes = await db.select({ count: sql<number>`count(*)` }).from(userJoin).where(eq(userJoin.guildId, guildId));
        const totalUsers = totalUsersRes[0]?.count || 1;
        const retainedUsers = oldMemberCountRes[0]?.count || 0;
        const retentionRate = Math.round((retainedUsers / totalUsers) * 100);

        return NextResponse.json({
            stats: {
                members: memberCount,
                verified: verifiedCount,
                boosts: boostsCount,
                actionsToday: actionsToday,
                levelingEnabled: levelingEnabled,
                voiceHours: totalVoiceHours,
                retentionRate: retentionRate
            },
            // growth: removed
            // roleDistribution: removed
            heatmap: heatmapData,
            leaderboard: leaderboard
        });

    } catch (error) {
        console.error("Database analytics query failed:", error);
        return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
    }
}
