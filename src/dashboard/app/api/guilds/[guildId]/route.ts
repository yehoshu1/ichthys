import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

interface DiscordGuild {
    id: string;
    name: string;
    icon: string | null;
}

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const guildId = params.guildId;
    let guild: DiscordGuild | null = null;
    let isBotMember = false;

    // 1. Try fetching with Bot Token (Checks if Bot is in guild)
    try {
        const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
            headers: {
                Authorization: `Bot ${process.env.DISCORD_TOKEN}`
            }
        });

        if (res.ok) {
            guild = await res.json();
            isBotMember = true;
        }
    } catch (error) {
        console.error("Bot guild fetch failed:", error);
    }

    // 2. If Bot check failed, try fetching with User Token (Checks if User is in guild)
    if (!guild && (session as any).accessToken) {
        try {
            const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
                headers: {
                    Authorization: `Bearer ${(session as any).accessToken}`
                }
            });

            if (res.ok) {
                guild = await res.json();
                isBotMember = false;
            } else {
                console.warn(`User guild fetch failed with status: ${res.status}`);
                if (res.status === 404 || res.status === 403 || res.status === 401) {
                    // User is not in the server or doesn't have access
                    // We treat 401 as 404 here because accessing /guilds/{id} with a token for a user NOT in the guild
                    // sometimes returns 401 instead of 404/403.
                    return NextResponse.json({ error: "Guild not found or access denied" }, { status: 404 });
                }
                // For other errors (429, 500, etc.), we'll fall through to the final check
            }
        } catch (error) {
            console.error("User guild fetch failed:", error);
            // Network error - fall through to final check
        }
    } else if (!guild && !(session as any).accessToken) {
        console.warn("No access token in session for guild check");
        return NextResponse.json({ error: "Unauthorized (No Token)" }, { status: 401 });
    }

    if (!guild) {
        // If we reached here, it means we couldn't get guild info from Bot OR User
        // This could be due to network errors or rate limiting
        // Return 503 (Service Unavailable) instead of 500 to indicate temporary issue
        return NextResponse.json({
            error: "Unable to fetch guild information. Please try again later."
        }, { status: 503 });
    }

    return NextResponse.json({
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        iconUrl: guild.icon
            ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
            : null,
        isBotMember
    });
}
