import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        hasDiscordToken: !!process.env.DISCORD_TOKEN,
        hasDiscordClientId: !!process.env.DISCORD_CLIENT_ID,
        tokenPrefix: process.env.DISCORD_TOKEN?.substring(0, 10) + '...',
        clientId: process.env.DISCORD_CLIENT_ID,
        nodeEnv: process.env.NODE_ENV,
    });
}
