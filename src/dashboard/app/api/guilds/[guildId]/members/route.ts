import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

interface DiscordMember {
    user: {
        id: string;
        username: string;
        avatar: string | null;
        global_name?: string | null;
    };
    nick?: string | null;
}

export async function GET(req: NextRequest, props: { params: Promise<{ guildId: string }> }) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const ids = (searchParams.get("ids") || "").split(",").map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0) return NextResponse.json({ members: [] });

    const guildId = params.guildId;
    const token = process.env.DISCORD_TOKEN;
    if (!token) return NextResponse.json({ error: "Missing bot token" }, { status: 500 });

    try {
        const results = await Promise.all(ids.map(async (id) => {
            const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${id}`, {
                headers: { Authorization: `Bot ${token}` },
            });
            if (!res.ok) return null;
            const member: DiscordMember = await res.json();
            const username = member.nick || member.user.global_name || member.user.username;
            const avatar = member.user.avatar
                ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png`
                : null;
            return { id: member.user.id, username, avatar };
        }));

        return NextResponse.json({ members: results.filter(Boolean) });
    } catch (error) {
        console.error("Failed to fetch members:", error);
        return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
    }
}
