import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { and, eq } from 'drizzle-orm';
import { db, userCalendarIntegration } from '@/lib/db';
import { requireGuildManageAccess } from '@/lib/guild-auth';
import logger from '@/lib/logger';
import { encryptCalendarToken } from '@shared/utils/calendar-token-security';

type Provider = 'google' | 'outlook';

interface SignedState {
    guildId: string;
    userId: string;
    provider: Provider;
    issuedAt: number;
}

function getAppUrl(request: NextRequest): string {
    return process.env.NEXTAUTH_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
}

function verifyState(state: string): SignedState | null {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return null;

    const [payloadEncoded, signature] = state.split('.');
    if (!payloadEncoded || !signature) return null;

    const expected = crypto.createHmac('sha256', secret).update(payloadEncoded).digest('base64url');
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (signatureBuffer.length !== expectedBuffer.length) {
        return null;
    }
    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
        return null;
    }

    try {
        const decoded = Buffer.from(payloadEncoded, 'base64url').toString('utf8');
        const parsed = JSON.parse(decoded) as SignedState;
        if (!parsed.guildId || !parsed.userId || !parsed.provider || !parsed.issuedAt) {
            return null;
        }

        if (Date.now() - parsed.issuedAt > 10 * 60 * 1000) {
            return null;
        }

        if (parsed.provider !== 'google' && parsed.provider !== 'outlook') {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
}

async function exchangeGoogleCode(code: string, request: NextRequest, guildId: string): Promise<{
    accessToken: string;
    refreshToken: string | null;
    expiresIn: number | null;
    providerAccountId: string;
}> {
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI
        || `${getAppUrl(request)}/api/guilds/${guildId}/calendar-integrations/callback?provider=google`;

    if (!clientId || !clientSecret) {
        throw new Error('Google calendar OAuth is not configured');
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        }),
    });

    if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Google token exchange failed: ${errorText}`);
    }

    const tokenData = await tokenResponse.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
    };

    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!profileResponse.ok) {
        throw new Error('Failed to fetch Google profile');
    }
    const profile = await profileResponse.json() as { id?: string; email?: string };

    return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token ?? null,
        expiresIn: tokenData.expires_in ?? null,
        providerAccountId: profile.id || profile.email || 'google-account',
    };
}

async function exchangeOutlookCode(code: string, request: NextRequest, guildId: string): Promise<{
    accessToken: string;
    refreshToken: string | null;
    expiresIn: number | null;
    providerAccountId: string;
}> {
    const clientId = process.env.OUTLOOK_CALENDAR_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.OUTLOOK_CALENDAR_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET;
    const redirectUri = process.env.OUTLOOK_CALENDAR_REDIRECT_URI
        || `${getAppUrl(request)}/api/guilds/${guildId}/calendar-integrations/callback?provider=outlook`;

    if (!clientId || !clientSecret) {
        throw new Error('Outlook calendar OAuth is not configured');
    }

    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
            scope: 'offline_access User.Read Calendars.ReadWrite',
        }),
    });

    if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Outlook token exchange failed: ${errorText}`);
    }

    const tokenData = await tokenResponse.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
    };

    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!profileResponse.ok) {
        throw new Error('Failed to fetch Outlook profile');
    }
    const profile = await profileResponse.json() as { id?: string; userPrincipalName?: string };

    return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token ?? null,
        expiresIn: tokenData.expires_in ?? null,
        providerAccountId: profile.id || profile.userPrincipalName || 'outlook-account',
    };
}

function redirectToDashboard(request: NextRequest, guildId: string, query: string): NextResponse {
    const url = new URL(`/dashboard/${guildId}/webhooks?tab=calendar&${query}`, getAppUrl(request));
    return NextResponse.redirect(url);
}

// GET /api/guilds/[guildId]/calendar-integrations/callback
export async function GET(
    request: NextRequest,
    props: { params: Promise<{ guildId: string }> }
) {
    const { guildId } = await props.params;
    const code = request.nextUrl.searchParams.get('code');
    const stateParam = request.nextUrl.searchParams.get('state');
    const providerParam = request.nextUrl.searchParams.get('provider') as Provider | null;
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
        return redirectToDashboard(request, guildId, `error=${encodeURIComponent(error)}`);
    }

    if (!code || !stateParam || (providerParam !== 'google' && providerParam !== 'outlook')) {
        return redirectToDashboard(request, guildId, 'error=invalid_oauth_callback');
    }

    const signedState = verifyState(stateParam);
    if (!signedState || signedState.guildId !== guildId || signedState.provider !== providerParam) {
        return redirectToDashboard(request, guildId, 'error=invalid_state');
    }

    const auth = await requireGuildManageAccess(guildId, request);
    if ('response' in auth || auth.userId !== signedState.userId) {
        return redirectToDashboard(request, guildId, 'error=unauthorized');
    }

    try {
        const tokenData = providerParam === 'google'
            ? await exchangeGoogleCode(code, request, guildId)
            : await exchangeOutlookCode(code, request, guildId);

        const tokenExpiresAt = tokenData.expiresIn
            ? new Date(Date.now() + tokenData.expiresIn * 1000)
            : null;

        const encryptedAccessToken = encryptCalendarToken(tokenData.accessToken);
        const encryptedRefreshToken = tokenData.refreshToken
            ? encryptCalendarToken(tokenData.refreshToken)
            : null;

        const [existing] = await db
            .select()
            .from(userCalendarIntegration)
            .where(and(
                eq(userCalendarIntegration.userId, auth.userId),
                eq(userCalendarIntegration.provider, providerParam)
            ))
            .limit(1);

        if (existing) {
            const includeGuildIds = Array.from(new Set([...(existing.includeGuildIds || []), guildId]));
            await db
                .update(userCalendarIntegration)
                .set({
                    providerAccountId: tokenData.providerAccountId,
                    accessToken: encryptedAccessToken,
                    refreshToken: encryptedRefreshToken,
                    tokenExpiresAt,
                    syncEnabled: true,
                    includeGuildIds,
                    updatedAt: new Date(),
                })
                .where(eq(userCalendarIntegration.id, existing.id));
        } else {
            await db.insert(userCalendarIntegration).values({
                userId: auth.userId,
                provider: providerParam,
                providerAccountId: tokenData.providerAccountId,
                accessToken: encryptedAccessToken,
                refreshToken: encryptedRefreshToken,
                tokenExpiresAt,
                syncEnabled: true,
                syncDirection: 'outbound',
                includeGuildIds: [guildId],
            });
        }

        return redirectToDashboard(request, guildId, 'success=calendar_connected');
    } catch (callbackError) {
        logger.error('Calendar OAuth callback failed:', callbackError);
        return redirectToDashboard(
            request,
            guildId,
            `error=${encodeURIComponent((callbackError as Error).message || 'calendar_connect_failed')}`
        );
    }
}
