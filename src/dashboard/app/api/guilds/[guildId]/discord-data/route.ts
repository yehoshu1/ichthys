import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

async function checkAuth(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return null;
    return session;
}

const CACHE_TTL = 300 * 1000; // 5 minutes
const cache = new Map<string, { data: any, timestamp: number }>();

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const { guildId } = params;

    const session = await checkAuth(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Check cache
    const cached = cache.get(guildId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json(cached.data);
    }

    try {
        // Fetch guild data from Discord API
        const botToken = process.env.DISCORD_TOKEN;

        if (!botToken) {
            console.error("Missing DISCORD_TOKEN in environment");
            return NextResponse.json({ error: "Bot token not configured" }, { status: 500 });
        }

        // Fetch roles and channels concurrently
        const [rolesResponse, channelsResponse] = await Promise.all([
            fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
                headers: { Authorization: `Bot ${botToken}` },
            }),
            fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
                headers: { Authorization: `Bot ${botToken}` },
            })
        ]);

        if (!rolesResponse.ok || !channelsResponse.ok) {
            console.error(`Discord API Error: Roles ${rolesResponse.status}, Channels ${channelsResponse.status}`);
            return NextResponse.json({ error: "Failed to fetch Discord data" }, { status: 500 });
        }

        const roles = await rolesResponse.json();
        const channels = await channelsResponse.json();

        // Filter and format roles (exclude @everyone, sort by position)
        const formattedRoles = roles
            .filter((role: any) => role.name !== "@everyone")
            .sort((a: any, b: any) => b.position - a.position)
            .map((role: any) => ({
                id: role.id,
                name: role.name,
                color: role.color,
                position: role.position
            }));

        // Filter and format channels (only text channels, sort by position)
        const formattedChannels = channels
            .filter((channel: any) => channel.type === 0) // 0 = GUILD_TEXT
            .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
            .map((channel: any) => ({
                id: channel.id,
                name: channel.name,
                type: channel.type,
                position: channel.position
            }));

        const responseData = {
            roles: formattedRoles,
            channels: formattedChannels
        };

        // Update cache
        cache.set(guildId, { data: responseData, timestamp: Date.now() });

        return NextResponse.json(responseData);

    } catch (error) {
        console.error("Error fetching Discord data:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
