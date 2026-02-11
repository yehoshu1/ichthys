/**
 * Next.js Middleware
 * 
 * Provides security headers, CSRF protection, and rate limiting
 * for all dashboard routes.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getVersionHeaders } from "./lib/api-version";

// Rate limiting store (in production, use Redis)
interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // requests per window

// Maximum number of entries to prevent memory exhaustion
const MAX_RATE_LIMIT_ENTRIES = 10000;

// Security headers
const securityHeaders = {
    // Prevent XSS attacks
    "X-DNS-Prefetch-Control": "on",
    "X-XSS-Protection": "1; mode=block",
    
    // Prevent clickjacking
    "X-Frame-Options": "SAMEORIGIN",
    
    // Prevent MIME-type sniffing
    "X-Content-Type-Options": "nosniff",
    
    // Referrer policy
    "Referrer-Policy": "strict-origin-when-cross-origin",
    
    // Permissions policy
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), vr=()",
    
    // HSTS (HTTPS only)
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
};

function getCspHeader(): string {
    const isDevelopment = process.env.NODE_ENV !== "production";

    // Next.js App Router relies on inline bootstrap scripts; dev mode also needs eval and WS/HMR connections.
    const scriptSrc = isDevelopment
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval';"
        : "script-src 'self' 'unsafe-inline';";
    const connectSrc = isDevelopment
        ? "connect-src 'self' https://discord.com ws: wss: http: https:;"
        : "connect-src 'self' https://discord.com;";

    return `
        default-src 'self';
        ${scriptSrc}
        style-src 'self' 'unsafe-inline';
        img-src 'self' https://cdn.discordapp.com https://authjs.dev data: blob:;
        font-src 'self';
        ${connectSrc}
        media-src 'self';
        frame-ancestors 'none';
        base-uri 'self';
        form-action 'self';
        object-src 'none';
        upgrade-insecure-requests;
    `.replace(/\s+/g, " ").trim();
}

/**
 * Check if request should be rate limited
 */
function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || entry.resetAt < now) {
        // Clean up if we're at max capacity
        if (rateLimitMap.size >= MAX_RATE_LIMIT_ENTRIES) {
            // Remove oldest entries to make room
            const entries = Array.from(rateLimitMap.entries())
                .sort(([, a], [, b]) => a.resetAt - b.resetAt)
                .slice(0, Math.floor(MAX_RATE_LIMIT_ENTRIES * 0.1)); // Remove 10% of oldest entries
            
            entries.forEach(([key]) => rateLimitMap.delete(key));
        }
        
        // Create new entry
        rateLimitMap.set(ip, {
            count: 1,
            resetAt: now + RATE_LIMIT_WINDOW_MS,
        });
        return { allowed: true };
    }

    // Check limit
    if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
        return {
            allowed: false,
            retryAfter: Math.ceil((entry.resetAt - now) / 1000),
        };
    }

    // Increment count
    entry.count++;
    return { allowed: true };
}

/**
 * Clean up expired rate limit entries
 */
function cleanupRateLimits(): void {
    const now = Date.now();
    for (const [ip, entry] of rateLimitMap.entries()) {
        if (entry.resetAt < now) {
            rateLimitMap.delete(ip);
        }
    }
}

// Cleanup every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000);

export function proxy(request: NextRequest) {
    const response = NextResponse.next();
    // Get IP from headers (works with most hosting providers)
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
        ?? request.headers.get("x-real-ip") 
        ?? "unknown";
    const { pathname } = request.nextUrl;
    
    // Apply security headers to all responses
    Object.entries(securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
    });
    
    // Add CSP header
    response.headers.set("Content-Security-Policy", getCspHeader());
    
    // Add API version headers
    const versionHeaders = getVersionHeaders();
    Object.entries(versionHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
    });
    
    // Rate limit API routes
    if (pathname.startsWith("/api/")) {
        const rateLimit = checkRateLimit(ip);
        
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: "Too many requests" },
                {
                    status: 429,
                    headers: {
                        "Retry-After": String(rateLimit.retryAfter),
                        ...securityHeaders,
                    },
                }
            );
        }
        
        // Add rate limit headers
        const entry = rateLimitMap.get(ip);
        if (entry) {
            response.headers.set("X-RateLimit-Limit", String(RATE_LIMIT_MAX_REQUESTS));
            response.headers.set("X-RateLimit-Remaining", String(Math.max(0, RATE_LIMIT_MAX_REQUESTS - entry.count)));
            response.headers.set("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));
        }
    }
    
    // CSRF protection for state-changing methods
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
        const origin = request.headers.get("origin");
        const host = request.headers.get("host");
        
        // In production, check that origin matches expected host
        if (process.env.NODE_ENV === "production" && origin) {
            const originHost = new URL(origin).host;
            if (originHost !== host) {
                return NextResponse.json(
                    { error: "Invalid origin" },
                    { status: 403 }
                );
            }
        }
    }
    
    return response;
}

// Configure which routes the middleware runs on
export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        "/((?!_next/static|_next/image|favicon.ico|public).*)",
    ],
};
