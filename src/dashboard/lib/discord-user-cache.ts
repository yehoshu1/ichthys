import { db, discordUserCache } from "@/lib/db";
import { inArray, sql } from "drizzle-orm";

const CACHE_STALE_MS = 6 * 60 * 60 * 1000;
const FETCH_CONCURRENCY = 5;

export interface CachedDiscordUser {
    userId: string;
    username: string;
    globalName: string | null;
    avatarHash: string | null;
    avatarUrl: string | null;
}

interface DiscordUserApiPayload {
    id: string;
    username: string;
    global_name?: string | null;
    avatar: string | null;
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
}

function buildAvatarUrl(userId: string, avatarHash: string | null): string | null {
    if (!avatarHash) {
        return null;
    }
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png`;
}

async function fetchDiscordUser(userId: string, token: string): Promise<DiscordUserApiPayload | null> {
    try {
        const response = await fetch(`https://discord.com/api/v10/users/${userId}`, {
            headers: {
                Authorization: `Bot ${token}`,
            },
            cache: "no-store",
        });

        if (!response.ok) {
            return null;
        }

        return await response.json() as DiscordUserApiPayload;
    } catch {
        return null;
    }
}

async function fetchMissingUsers(userIds: string[], token: string): Promise<Map<string, DiscordUserApiPayload>> {
    const result = new Map<string, DiscordUserApiPayload>();

    const chunks = chunkArray(userIds, FETCH_CONCURRENCY);
    for (const chunk of chunks) {
        const fetched = await Promise.all(chunk.map((userId) => fetchDiscordUser(userId, token)));
        for (const user of fetched) {
            if (user) {
                result.set(user.id, user);
            }
        }
    }

    return result;
}

export async function getDiscordUsers(userIds: string[]): Promise<Map<string, CachedDiscordUser>> {
    const uniqueUserIds = Array.from(new Set(userIds.filter((id) => /^\d{17,20}$/.test(id))));
    const result = new Map<string, CachedDiscordUser>();

    if (uniqueUserIds.length === 0) {
        return result;
    }

    const rows = await db
        .select()
        .from(discordUserCache)
        .where(inArray(discordUserCache.userId, uniqueUserIds));

    const now = Date.now();
    const cachedMap = new Map(rows.map((row) => [row.userId, row]));
    const missingOrStale: string[] = [];

    for (const userId of uniqueUserIds) {
        const cached = cachedMap.get(userId);

        if (!cached) {
            missingOrStale.push(userId);
            continue;
        }

        const isStale = now - cached.updatedAt.getTime() > CACHE_STALE_MS;
        if (isStale) {
            missingOrStale.push(userId);
        }

        result.set(userId, {
            userId,
            username: cached.username,
            globalName: cached.globalName,
            avatarHash: cached.avatar,
            avatarUrl: buildAvatarUrl(userId, cached.avatar),
        });
    }

    const botToken = process.env.DISCORD_TOKEN;
    if (!botToken || missingOrStale.length === 0) {
        return result;
    }

    const fetched = await fetchMissingUsers(missingOrStale, botToken);
    const upsertValues = Array.from(fetched.values()).map((user) => ({
        userId: user.id,
        username: user.username,
        globalName: user.global_name ?? null,
        avatar: user.avatar,
        updatedAt: new Date(),
    }));

    if (upsertValues.length > 0) {
        await db.insert(discordUserCache)
            .values(upsertValues)
            .onConflictDoUpdate({
                target: discordUserCache.userId,
                set: {
                    username: sql`excluded.username`,
                    globalName: sql`excluded.global_name`,
                    avatar: sql`excluded.avatar`,
                    updatedAt: new Date(),
                },
                where: sql`${discordUserCache.username} IS DISTINCT FROM excluded.username
                    OR ${discordUserCache.globalName} IS DISTINCT FROM excluded.global_name
                    OR ${discordUserCache.avatar} IS DISTINCT FROM excluded.avatar`,
            });

        for (const user of fetched.values()) {
            result.set(user.id, {
                userId: user.id,
                username: user.username,
                globalName: user.global_name ?? null,
                avatarHash: user.avatar,
                avatarUrl: buildAvatarUrl(user.id, user.avatar),
            });
        }
    }

    return result;
}

export async function getDiscordUser(userId: string): Promise<CachedDiscordUser | null> {
    const users = await getDiscordUsers([userId]);
    return users.get(userId) ?? null;
}
