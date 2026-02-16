/**
 * Rate limiting middleware for Next.js API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { checkRateLimit, getRateLimitHeaders, RateLimitConfig } from './rate-limit';
import logger from './logger';

// Different rate limits for different endpoint types
const RATE_LIMITS: Record<string, RateLimitConfig> = {
    default: { windowMs: 60000, maxRequests: 100 },
    'discord-data': { windowMs: 60000, maxRequests: 30 }, // Expensive Discord API calls
    'analytics': { windowMs: 60000, maxRequests: 20 },    // Data-heavy queries
    'members': { windowMs: 60000, maxRequests: 50 },
    'logs': { windowMs: 60000, maxRequests: 60 },
    'settings': { windowMs: 60000, maxRequests: 30 },     // Write operations
    'welcome': { windowMs: 60000, maxRequests: 30 },
    'verification': { windowMs: 60000, maxRequests: 30 },
    'leveling': { windowMs: 60000, maxRequests: 40 },
    'notifications': { windowMs: 60000, maxRequests: 60 },
};

/**
 * Get rate limit configuration for an endpoint type
 */
export function getRateLimitConfig(endpointType: string = 'default'): RateLimitConfig {
    return RATE_LIMITS[endpointType] || RATE_LIMITS.default;
}

/**
 * Get identifier for rate limiting (user ID from session or IP address)
 */
async function getRateLimitIdentifier(req: NextRequest): Promise<string> {
    // Try to get user ID from session
    try {
        const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
        if (token?.sub) {
            return `user:${token.sub}`;
        }
    } catch (error) {
        logger.debug('Could not get token for rate limiting:', error);
    }

    // Fall back to IP address
    const ip = (req as any).ip
        ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? req.headers.get('x-real-ip')
        ?? 'unknown';

    return `ip:${ip}`;
}

/**
 * Apply rate limiting to a request
 * Returns null if allowed, or a NextResponse if rate limited
 */
export async function applyRateLimit(
    req: NextRequest,
    endpointType: string = 'default'
): Promise<{ allowed: true; headers: Record<string, string> } | { allowed: false; response: NextResponse }> {
    const identifier = await getRateLimitIdentifier(req);
    const config = getRateLimitConfig(endpointType);

    const result = await checkRateLimit(identifier, config);

    if (!result.allowed) {
        logger.warn('Rate limit exceeded', {
            identifier,
            endpoint: endpointType,
            path: (req as any).nextUrl?.pathname || req.url,
            userAgent: req.headers.get('user-agent')
        });

        const response = new NextResponse(
            JSON.stringify({
                error: 'Rate limit exceeded',
                retryAfter: result.retryAfter,
                message: `Too many requests. Please try again in ${result.retryAfter} seconds.`
            }),
            {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'Retry-After': (result.retryAfter || 60).toString(),
                    ...getRateLimitHeaders(result, config.maxRequests)
                }
            }
        );

        return { allowed: false, response };
    }

    return {
        allowed: true,
        headers: getRateLimitHeaders(result, config.maxRequests)
    };
}

/**
 * Higher-order function to wrap API handlers with rate limiting
 * Usage:
 *   export const GET = withRateLimit(async (req, context) => { ... }, 'analytics');
 */
export function withRateLimit<
    T extends (req: NextRequest, context: any) => Promise<NextResponse>
>(
    handler: T,
    endpointType: string = 'default'
): (req: NextRequest, context: any) => Promise<NextResponse> {
    return async (req: NextRequest, context: any): Promise<NextResponse> => {
        const rateLimitResult = await applyRateLimit(req, endpointType);

        if (!rateLimitResult.allowed) {
            return rateLimitResult.response;
        }

        // Call the actual handler
        const response = await handler(req, context);

        // Add rate limit headers to successful response
        Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
            response.headers.set(key, value);
        });

        return response;
    };
}

/**
 * Middleware-compatible rate limiter for use in middleware.ts
 */
export async function rateLimitMiddleware(
    req: NextRequest,
    endpointType: string = 'default'
): Promise<NextResponse | null> {
    const result = await applyRateLimit(req, endpointType);

    if (!result.allowed) {
        return result.response;
    }

    // Return headers to be added to the response
    const headers = new Headers();
    Object.entries(result.headers).forEach(([key, value]) => {
        headers.set(key, value);
    });

    return null; // Allow request to continue
}
