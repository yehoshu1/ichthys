import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireGuildManageAccess } from '@/lib/guild-auth';

type Provider = 'google' | 'outlook';

function getAppUrl(request: NextRequest): string {
    return process.env.NEXTAUTH_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
}

function signState(payload: object): string {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
        throw new Error('NEXTAUTH_SECRET is required');
    }

    const json = JSON.stringify(payload);
    const encoded = Buffer.from(json, 'utf8').toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
    return `${encoded}.${signature}`;
}

function getGoogleAuthUrl(request: NextRequest, guildId: string, state: string): string {
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const redirectUri =
        process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
        `${getAppUrl(request)}/api/guilds/${guildId}/calendar-integrations/callback?provider=google`;
    if (!clientId) {
        throw new Error('GOOGLE_CALENDAR_CLIENT_ID is required');
    }

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        access_type: 'offline',
        prompt: 'consent',
        scope: [
            'openid',
            'profile',
            'email',
            'https://www.googleapis.com/auth/calendar.readonly',
            'https://www.googleapis.com/auth/calendar.events',
        ].join(' '),
        state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function getOutlookAuthUrl(request: NextRequest, guildId: string, state: string): string {
    const clientId = process.env.OUTLOOK_CALENDAR_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID;
    const redirectUri =
        process.env.OUTLOOK_CALENDAR_REDIRECT_URI ||
        `${getAppUrl(request)}/api/guilds/${guildId}/calendar-integrations/callback?provider=outlook`;
    if (!clientId) {
        throw new Error('OUTLOOK_CALENDAR_CLIENT_ID is required');
    }

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        response_mode: 'query',
        scope: 'offline_access User.Read Calendars.ReadWrite',
        state,
    });

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

// GET /api/guilds/[guildId]/calendar-integrations/connect?provider=google|outlook
export async function GET(
    request: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    const { guildId } = await props.params;
    const auth = await requireGuildManageAccess(guildId, request);
    if ('response' in auth) {
        return auth.response;
    }

    const providerRaw = request.nextUrl.searchParams.get('provider');
    const provider = providerRaw as Provider | null;

    if (provider !== 'google' && provider !== 'outlook') {
        const redirectUrl = new URL(`/dashboard/${guildId}/webhooks?tab=calendar&error=unsupported_provider`, getAppUrl(request));
        return NextResponse.redirect(redirectUrl);
    }

    try {
        const state = signState({
            guildId,
            userId: auth.userId,
            provider,
            issuedAt: Date.now(),
        });

        const authUrl = provider === 'google'
            ? getGoogleAuthUrl(request, guildId, state)
            : getOutlookAuthUrl(request, guildId, state);

        return NextResponse.redirect(authUrl);
    } catch (error) {
        const message = encodeURIComponent((error as Error).message || 'calendar_connect_failed');
        const redirectUrl = new URL(`/dashboard/${guildId}/webhooks?tab=calendar&error=${message}`, getAppUrl(request));
        return NextResponse.redirect(redirectUrl);
    }
}
