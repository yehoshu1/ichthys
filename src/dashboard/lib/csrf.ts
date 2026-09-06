import { NextRequest, NextResponse } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Determine the origin this deployment is actually served from.
 *
 * We deliberately do NOT trust client-supplied X-Forwarded-Proto /
 * X-Forwarded-Host headers here: those are attacker-controlled on any request
 * that reaches the app directly (or through a proxy that does not sanitize
 * them), which previously let a cross-site attacker echo their own origin
 * back and bypass the same-origin check.
 *
 * Instead the expected origin is pinned to a server-side allowlist:
 *  1. TRUSTED_ORIGINS (comma-separated) if configured
 *  2. NEXTAUTH_URL
 *  3. DASHBOARD_URL
 * The forwarded headers are used only as a fallback when none of the above
 * are configured (local development), which is fail-open only in the same
 * situations the old behaviour was.
 */
function getAllowedOrigins(): string[] {
    const origins: string[] = [];

    const trusted = process.env.TRUSTED_ORIGINS;
    if (trusted) {
        for (const raw of trusted.split(",")) {
            const trimmed = raw.trim().replace(/\/+$/, "");
            if (trimmed) origins.push(trimmed);
        }
    }

    for (const envName of ["NEXTAUTH_URL", "DASHBOARD_URL"] as const) {
        const value = process.env[envName];
        if (value) {
            const normalized = value.trim().replace(/\/+$/, "");
            if (normalized && !origins.includes(normalized)) {
                origins.push(normalized);
            }
        }
    }

    return origins;
}

export function requireSameOrigin(request: NextRequest): NextResponse | null {
    if (SAFE_METHODS.has(request.method)) {
        return null;
    }

    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");

    const allowedOrigins = getAllowedOrigins();

    if (allowedOrigins.length === 0) {
        // No server-side origin configured (typically local development).
        // Fall back to forwarding headers, which is safe only when the
        // deployment cannot be reached directly by clients.
        const forwardedProto = request.headers.get("x-forwarded-proto");
        const forwardedHost = request.headers.get("x-forwarded-host");
        const expectedOrigin = (forwardedProto && forwardedHost)
            ? `${forwardedProto}://${forwardedHost}`
            : request.nextUrl.origin;

        if (origin && origin !== expectedOrigin) {
            return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
        }

        if (!origin && referer && !referer.startsWith(expectedOrigin)) {
            return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
        }

        if (!origin && !referer) {
            return NextResponse.json({ error: "Missing origin" }, { status: 403 });
        }

        return null;
    }

    if (origin) {
        const normalized = origin.replace(/\/+$/, "");
        if (!allowedOrigins.includes(normalized)) {
            return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
        }
        return null;
    }

    if (referer) {
        const matches = allowedOrigins.some((allowed) => referer.startsWith(`${allowed}/`) || referer === allowed);
        if (!matches) {
            return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
        }
        return null;
    }

    return NextResponse.json({ error: "Missing origin" }, { status: 403 });
}
