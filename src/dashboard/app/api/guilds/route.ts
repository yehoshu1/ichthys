import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

// Discord API permissions
const MANAGE_GUILD = 0x20;

interface DiscordGuild {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: string;
}

export interface Guild {
    id: string;
    name: string;
    icon: string | null;
    iconUrl: string | null;
    hasManagePermission: boolean;
    botPresent: boolean;
}

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // Fetch user's guilds from Discord API
        const response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
            headers: {
                Authorization: `Bearer ${session.accessToken}`,
            },
        });

        if (!response.ok) {
            console.error("Discord API error:", response.status, await response.text());
            return NextResponse.json({ error: "Failed to fetch guilds" }, { status: 500 });
        }

        const discordGuilds: DiscordGuild[] = await response.json();

        // Filter and transform guilds
        const guilds: Guild[] = discordGuilds
            .filter((guild) => {
                const permissions = BigInt(guild.permissions);
                return guild.owner || (permissions & BigInt(MANAGE_GUILD)) !== BigInt(0);
            })
            .map((guild) => ({
                id: guild.id,
                name: guild.name,
                icon: guild.icon,
                iconUrl: guild.icon
                    ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${guild.icon.startsWith("a_") ? "gif" : "png"}`
                    : null,
                hasManagePermission: true,
                botPresent: false, // TODO: Check if bot is in guild via database
            }));

        return NextResponse.json(guilds);
    } catch (error) {
        console.error("Error fetching guilds:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
