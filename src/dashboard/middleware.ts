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

// Content Security Policy
const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline';
    style-src 'self' 'unsafe-inline';
    img-src 'self' https://cdn.discordapp.com https://*.discordapp.com data: blob:;
    font-src 'self';
    connect-src 'self' https://discord.com https://*.discord.com;
    media-src 'self' https://cdn.discordapp.com;
    frame-src 'none';
    base-uri 'self';
    form-action 'self';
`.replace(/\s+/g, " ").trim();

/**
 * Check if request should be rate limited
 */
function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    
    if (!entry || entry.resetAt < now) {
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

export function middleware(request: NextRequest) {
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
    response.headers.set("Content-Security-Policy", cspHeader);
    
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
