import { NextResponse } from 'next/server';

/**
 * Health check endpoint
 * Returns sanitized environment status information
 */
export async function GET() {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        nodeEnv: process.env.NODE_ENV,
        hasDiscordToken: !!process.env.DISCORD_TOKEN,
        hasDiscordClientId: !!process.env.DISCORD_CLIENT_ID,
        // Note: Token prefix removed for security - prevents credential enumeration attacks
    });
}
