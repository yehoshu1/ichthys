import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Session-floor middleware for guild-scoped API routes.
 *
 * Every route under /api/guilds/[guildId]/ must be authenticated. Route-level
 * guards (requireGuildManageAccess etc.) enforce authorization, but this
 * middleware guarantees that no guild API route is ever reachable without a
 * valid session JWT — even if a new route is added without a guard.
 *
 * It intentionally does NOT perform guild-permission or RBAC checks: those
 * need Discord/DB access and belong in the Node.js route handlers.
 */
export async function middleware(req: NextRequest): Promise<NextResponse> {
    const token = await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token?.sub) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/api/guilds/:guildId", "/api/guilds/:guildId/:path*"],
};
