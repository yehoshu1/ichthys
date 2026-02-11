import { NextRequest, NextResponse } from "next/server";
import { requireGuildManageAccess } from "@/lib/guild-auth";
import { parseDiscordIds } from "@/lib/validation";
import { getDiscordUsers } from "@/lib/discord-user-cache";
import logger from "@/lib/logger";

const MEMBER_LOOKUP_CONCURRENCY = 5;

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
}

async function isGuildMember(guildId: string, userId: string, botToken: string): Promise<boolean> {
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
        headers: {
            Authorization: `Bot ${botToken}`,
        },
        cache: "no-store",
    }).catch((error) => { logger.warn(`Failed to check guild membership for user ${userId}:`, error); return null; });

    if (!response) {
        return false;
    }

    if (response.status === 404) {
        return false;
    }

    return response.ok;
}

async function filterGuildMemberIds(guildId: string, ids: string[], botToken: string): Promise<string[]> {
    const allowedIds: string[] = [];
    const chunks = chunkArray(ids, MEMBER_LOOKUP_CONCURRENCY);

    for (const chunk of chunks) {
        const results = await Promise.all(chunk.map((id) => isGuildMember(guildId, id, botToken)));
        for (let index = 0; index < results.length; index += 1) {
            if (results[index]) {
                const id = chunk[index];
                if (id) {
                    allowedIds.push(id);
                }
            }
        }
    }

    return allowedIds;
}


export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const auth = await requireGuildManageAccess(params.guildId, req);
    if ("response" in auth) return auth.response;

    const { searchParams } = new URL(req.url);
    const parsedIds = parseDiscordIds(searchParams.get("ids"), 25);
    if (!parsedIds.success) return parsedIds.response;
    if (parsedIds.ids.length === 0) return NextResponse.json({ members: [] });

    const botToken = process.env.DISCORD_TOKEN;
    if (!botToken) {
        return NextResponse.json({ error: "Discord bot token not configured" }, { status: 503 });
    }

    const memberIds = await filterGuildMemberIds(params.guildId, parsedIds.ids, botToken);
    if (memberIds.length === 0) {
        return NextResponse.json({ members: [] });
    }

    if (memberIds.length !== parsedIds.ids.length) {
        logger.debug("Filtered non-member user IDs from dashboard members lookup", {
            guildId: params.guildId,
            requestedCount: parsedIds.ids.length,
            resolvedCount: memberIds.length,
        });
    }

    const users = await getDiscordUsers(memberIds);
    const members = memberIds
        .map((id) => {
            const user = users.get(id);
            if (!user) return null;
            return {
                id,
                username: user.globalName || user.username,
                avatar: user.avatarUrl,
            };
        })
        .filter((entry): entry is { id: string; username: string; avatar: string | null } => entry !== null);

    return NextResponse.json({ members });
}
