import { NextRequest, NextResponse } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function requireSameOrigin(request: NextRequest): NextResponse | null {
    if (SAFE_METHODS.has(request.method)) {
        return null;
    }

    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    
    // Get the expected origin - trust X-Forwarded headers for proxied requests
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
